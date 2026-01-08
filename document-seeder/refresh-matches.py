import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("PLASMO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY must be set")

MATCH_THRESHOLD = float(os.getenv("MATCH_REFRESH_THRESHOLD", "0.5"))
MATCH_COUNT = int(os.getenv("MATCH_REFRESH_COUNT", "5"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    provider_id: int, tracked_page_ids: List[int], limit: int = 200
) -> List[Dict[str, Any]]:
    if not tracked_page_ids:
        return []
    resp = (
        supabase.table("site_content")
        .select("id,chunk_text,page_url,embedding,metadata,sitemap_page_id")
        .eq("provider_id", provider_id)
        .in_("sitemap_page_id", tracked_page_ids)
        .limit(limit)
        .execute()
    )
    return resp.data or []


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
    return rpc.data or []


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


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python refresh-matches.py <provider_id> [<limit>]")
    provider_id = int(sys.argv[1])
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 200

    existing_matches, approved_ids = fetch_existing_matches(provider_id)
    deleted_pairs = fetch_deleted_pairs(provider_id)
    tracked_pages = fetch_tracked_page_ids(provider_id)
    if not tracked_pages:
        print(f"[refresh] no tracked pages for provider {provider_id}, skipping")
        return
    site_chunks = fetch_site_chunks(provider_id, tracked_pages, limit=limit)

    inserted = 0
    skipped_deleted = 0
    skipped_approved = 0

    for chunk in site_chunks:
        site_id = chunk.get("id")
        if not site_id or site_id in approved_ids:
            skipped_approved += bool(site_id)
            continue
        if site_id in existing_matches and not chunk:
            continue
        embedding = chunk.get("embedding")
        if not embedding:
            continue
        matches = find_matches(embedding, provider_id, MATCH_THRESHOLD, MATCH_COUNT)
        for match in matches:
            url_page = chunk.get("page_url")
            knowledge_id = match.get("id")
            if (url_page, knowledge_id) in deleted_pairs:
                skipped_deleted += 1
                continue
            existing = existing_matches.get(site_id)
            if existing:
                if existing.get("status") == "approved":
                    skipped_approved += 1
                    break
                existing_confidence = existing.get("confidence") or 0
                if (match.get("confidence") or 0) <= existing_confidence:
                    continue
            knowledge_row = fetch_knowledge_row(knowledge_id)
            match_id = insert_page_match(provider_id, chunk, match, knowledge_row)
            if match_id:
                inserted += 1
                break

    print(
        f"[refresh] completed={datetime.utcnow().isoformat()} provider={provider_id} inserted={inserted} "
        f"skipped_deleted={skipped_deleted} skipped_approved={skipped_approved}"
    )


if __name__ == "__main__":
    main()
