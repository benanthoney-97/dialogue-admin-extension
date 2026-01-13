import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("PLASMO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY must be set")

MATCH_THRESHOLD = float(os.getenv("MATCH_REFRESH_THRESHOLD", "0.55"))
MATCH_COUNT = int(os.getenv("MATCH_REFRESH_COUNT", "5"))

httpx_client = httpx.Client(http2=False, timeout=httpx.Timeout(30.0))
client_options = SyncClientOptions(httpx_client=httpx_client)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, client_options)

knowledge_cache: Dict[int, Dict[str, Any]] = {}


def fetch_existing_matches(provider_id: int) -> Dict[int, Dict[str, Any]]:
    resp = (
        supabase.table("page_matches")
        .select("id,status,confidence,knowledge_id,site_content_id,url")
        .eq("provider_id", provider_id)
        .execute()
    )
    data = resp.data or []
    match_map = {}
    approved_ids = set()
    for row in data:
        site_id = row.get("site_content_id")
        if not site_id:
            continue
        if row.get("status") == "approved":
            approved_ids.add(site_id)
        match_map[site_id] = row
    print(f"[refresh] fetched {len(data)} existing page_matches for provider {provider_id}")
    return match_map, approved_ids


def fetch_deleted_pairs(provider_id: int) -> set:
    resp = (
        supabase.table("deleted_matches")
        .select("knowledge_id,url")
        .eq("provider_id", provider_id)
        .execute()
    )
    data = resp.data or []
    return {(row.get("url"), row.get("knowledge_id")) for row in data if row.get("knowledge_id")}


def fetch_tracked_page_ids(provider_id: int) -> List[int]:
    feed_resp = (
        supabase.table("sitemap_feeds")
        .select("id")
        .eq("provider_id", provider_id)
        .eq("tracked", True)
        .execute()
    )
    feed_ids = [row["id"] for row in (feed_resp.data or []) if row.get("id")]
    if not feed_ids:
        return []
    page_resp = (
        supabase.table("sitemap_pages")
        .select("id")
        .in_("feed_id", feed_ids)
        .eq("tracked", True)
        .execute()
    )
    return [row["id"] for row in (page_resp.data or []) if row.get("id")]


def fetch_site_chunks(
    provider_id: int,
    sitemap_page_id: Optional[int],
    limit: int = 50,
    after_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if sitemap_page_id is None:
        return []
    builder = (
        supabase.table("site_content")
        .select("id,chunk_text,page_url,embedding,metadata,sitemap_page_id")
        .eq("provider_id", provider_id)
        .eq("sitemap_page_id", sitemap_page_id)
    )
    if after_id:
        builder = builder.gt("id", after_id)
    resp = builder.limit(limit).execute()
    chunks = resp.data or []
    print(
        f"[refresh] fetched {len(chunks)} site_content chunks for provider {provider_id} "
        f"(page_id={sitemap_page_id}, limit={limit})"
    )
    return chunks


def find_matches(embedding, provider_id: int, threshold: float, count: int):
    rpc = (
        supabase.rpc(
            "match_provider_knowledge",
            {
                "query_embedding": embedding,
                "match_threshold": threshold,
                "match_count": count,
                "filter_provider_id": provider_id,
            },
        )
        .limit(count)
        .execute()
    )
    matches = rpc.data or []
    print(
        f"[refresh] match_provider_knowledge returned {len(matches)} knowledge rows for provider {provider_id} "
        f"(threshold={threshold}, count={count})"
    )
    return matches


def parse_metadata(metadata):
    if not metadata:
        return {}
    if isinstance(metadata, dict):
        return metadata
    try:
        return json.loads(metadata)
    except Exception:
        return {}


def summarize_text(text: str, max_sentences: int = 1) -> str:
    if not text:
        return ""
    pieces = re.split(r"(?<=[.!?])\s+", text.strip())
    clean = [piece.strip() for piece in pieces if piece.strip()]
    selected = clean[:max_sentences]
    return " ".join(selected)


def to_vimeo_player_url(value: str, start_time: Optional[int] = None) -> str:
    match = re.search(r"vimeo\.com/(?:video/)?(\d+)", value or "")
    if not match:
        return value or ""
    embed = f"https://player.vimeo.com/video/{match.group(1)}"
    suffix = f"#t={start_time}s" if start_time is not None else ""
    return f"{embed}?autoplay=0&title=0&byline=0&portrait=0{suffix}"


def build_video_url(metadata: Dict[str, Any]) -> str:
    timestamp_start = metadata.get("timestampStart")
    if timestamp_start is None:
        timestamp_start = metadata.get("timestamp_start")
    start_time = None
    if timestamp_start is not None:
        try:
            start_time = int(float(timestamp_start))
        except (TypeError, ValueError):
            start_time = None

    for key in ("source", "source_url", "video_url"):
        value = metadata.get(key) or ""
        if value:
            return to_vimeo_player_url(value, start_time)
    return ""


def fetch_knowledge_row(knowledge_id: int) -> Dict[str, Any]:
    if not knowledge_id:
        return {}
    if knowledge_id in knowledge_cache:
        return knowledge_cache[knowledge_id]
    resp = (
        supabase.table("provider_knowledge")
        .select("id,document_id,metadata")
        .eq("id", knowledge_id)
        .maybe_single()
        .execute()
    )
    row = resp.data or {}
    knowledge_cache[knowledge_id] = row
    return row


def insert_page_match(
    provider_id: int,
    site_row: Dict[str, Any],
    match: Dict[str, Any],
    knowledge_meta: Dict[str, Any],
) -> Optional[int]:
    payload = {
        "provider_id": provider_id,
        "document_id": match.get("document_id"),
        "url": site_row.get("page_url"),
        "phrase": summarize_text(site_row.get("chunk_text") or ""),
        "video_url": match.get("video_url") or build_video_url(parse_metadata(knowledge_meta.get("metadata"))),
        "confidence": match.get("confidence") or match.get("similarity") or 0,
        "status": "active",
        "knowledge_id": match.get("id"),
        "site_content_id": site_row.get("id"),
    }
    if not payload["document_id"]:
        payload["document_id"] = knowledge_meta.get("document_id")
    resp = supabase.table("page_matches").insert(payload).execute()
    error = getattr(resp, "error", None)
    if error:
        print(f"[refresh] failed to insert match: {error}")
        return None
    inserted = resp.data or []
    if inserted:
        return inserted[0].get("id")
    return None
