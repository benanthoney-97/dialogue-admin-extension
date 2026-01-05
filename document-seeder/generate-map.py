import os
import re
import sys
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from llama_index.embeddings.openai import OpenAIEmbedding

# 1. SETUP
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("PLASMO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# ⚠️ CONFIGURATION
PROVIDER_ID = int(os.getenv("SITEMAP_PROVIDER_ID") or 12)

DEFAULT_FEED_ID = os.getenv("SITEMAP_FEED_ID")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": "https://www.google.com/",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
}


def normalize_source_url(url: str) -> str:
    if not url:
        return ""
    cleaned = re.sub(r"[#?].*", "", url)
    return cleaned.rstrip("/")


def fetch_pages_for_feed(feed_id: int) -> list[str]:
    resp = (
        supabase.table("sitemap_pages")
        .select("page_url")
        .eq("feed_id", feed_id)
        .eq("tracked", True)
        .execute()
    )
    error = getattr(resp, "error", None)
    status = getattr(resp, "status_code", None)
    if status and status >= 400:
        error = error or f"Status {status}"
    if error:
        raise RuntimeError(f"Failed to load sitemap_pages for feed {feed_id}: {error}")
    return [row["page_url"] for row in resp.data or [] if row.get("page_url")]


def fetch_candidate_sentences(url: str) -> list[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        html_content = response.text
    except Exception as exc:
        print(f"❌ Failed to fetch {url}: {exc}")
        return []

    soup = BeautifulSoup(html_content, "html.parser")
    content_area = soup.find("div", class_="elementor-section-wrap") or soup.body
    raw_text = content_area.get_text(" ", strip=True) if content_area else ""
    if not raw_text:
        return []

    sentences = []
    potential_sentences = re.split(r"(?<=[.!?])\s+", raw_text)
    for sentence in potential_sentences:
        clean = sentence.strip()
        if 30 < len(clean) < 150:
            sentences.append(clean)
    return list(dict.fromkeys(sentences))[:50]


def embed_vimeo_url(original_url: str, timestamp: int) -> str:
    video_id = None
    for pattern in (r"vimeo\\.com/(\\d+)", r"player\\.vimeo\\.com/video/(\\d+)"):
        found = re.search(pattern, original_url)
        if found:
            video_id = found.group(1)
            break
    if not video_id:
        return f"{original_url}#t={timestamp}"
    ts_param = f"#t={timestamp}s" if timestamp else ""
    return f"https://player.vimeo.com/video/{video_id}?autoplay=1&title=0&byline=0{ts_param}"


def load_provider_documents() -> dict[str, dict]:
    lookup = {}
    resp = (
        supabase.table("provider_documents")
        .select("title, source_url")
        .eq("provider_id", PROVIDER_ID)
        .execute()
    )
    if resp.data:
        for doc in resp.data:
            normalized_url = normalize_source_url(doc.get("source_url"))
            if normalized_url:
                lookup[normalized_url] = doc
    return lookup


def match_sentences(sentences: list[str], provider_docs_lookup: dict, page_url: str) -> list[dict]:
    matches = []
    batch_size = 20
    for i in range(0, len(sentences), batch_size):
        batch = sentences[i : i + batch_size]
        try:
            vectors = embed_model.get_text_embedding_batch(batch)
            for j, vector in enumerate(vectors):
                sentence = batch[j]
                resp = supabase.rpc(
                    "match_provider_knowledge",
                    {
                        "query_embedding": vector,
                        "match_threshold": 0.50,
                        "match_count": 1,
                        "filter_provider_id": PROVIDER_ID,
                    },
                ).execute()
                if not resp.data:
                    continue
                match_data = resp.data[0]
                details = (
                    supabase.table("provider_knowledge")
                    .select("metadata, document_id")
                    .eq("id", match_data["id"])
                    .single()
                    .execute()
                )
                if not details.data:
                    continue
                meta = details.data.get("metadata", {})
                doc_id = details.data.get("document_id")
                url = meta.get("source") or meta.get("source_url")
                ts = meta.get("timestampStart", 0)
                if not url:
                    continue
                normalized_url = normalize_source_url(url)
                doc_title = ""
                doc_ref = provider_docs_lookup.get(normalized_url)
                if doc_ref:
                    doc_title = doc_ref.get("title", "")
                meta_title = meta.get("title", "")
                document_title_value = doc_title or meta_title or ""
                video_url = embed_vimeo_url(url, ts)
                confidence_value = (
                    match_data.get("confidence")
                    or match_data.get("similarity")
                    or 0.0
                )
                similarity_value = (
                    match_data.get("similarity")
                    if match_data.get("similarity") is not None
                    else confidence_value
                )
                matches.append(
                    {
                        "phrase": sentence,
                        "video_url": video_url,
                        "confidence": confidence_value,
                        "document_title": document_title_value,
                        "document_id": doc_id,
                        "knowledge_id": match_data.get("id"),
                        "provider_id": PROVIDER_ID,
                        "page_url": page_url,
                    }
                )
                print(f"   📄 ({page_url}) -> {document_title_value or '—'}")
                print(f"   ✅ ({similarity_value:.2f}) '{sentence[:30]}...'")
        except Exception as exc:
            print(f"   ⚠️ Batch error ({page_url}): {exc}")
    return matches


def persist_matches(matches: list[dict]) -> None:
    if not matches:
        print("⚠️ No new matches to persist.")
        return
    knowledge_ids = [m["knowledge_id"] for m in matches if m.get("knowledge_id")]
    existing = (
        supabase.table("page_matches")
        .select("knowledge_id")
        .in_("knowledge_id", knowledge_ids)
        .execute()
    )
    existing_ids = {row["knowledge_id"] for row in existing.data or [] if row.get("knowledge_id")}
    new_matches = []
    for m in matches:
        if m.get("knowledge_id") not in existing_ids:
            new_matches.append(m)
    if not new_matches:
        print("ℹ️ All matches already exist in Supabase.")
        return
    payload = []
    for m in new_matches:
        row = {
            "provider_id": m["provider_id"],
            "phrase": m["phrase"],
            "video_url": m["video_url"],
            "confidence": m["confidence"],
            "document_id": m["document_id"],
            "knowledge_id": m["knowledge_id"],
            "status": "active",
            "url": m["page_url"],
        }
        payload.append(row)
    resp = supabase.table("page_matches").insert(payload).execute()
    error = getattr(resp, "error", None)
    if error:
        raise RuntimeError(f"Failed to insert page_matches: {error}")
    print(f"💾 Persisted {len(resp.data or [])} new matches.")


def generate_matches_for_feed(feed_id: int) -> None:
    provider_docs_lookup = load_provider_documents()
    pages = fetch_pages_for_feed(feed_id)
    if not pages:
        print(f"⚠️ No tracked pages found for feed {feed_id}")
        return

    for index, page_url in enumerate(pages, start=1):
        print(f"🌍 ({index}/{len(pages)}) Fetching {page_url}")
        sentences = fetch_candidate_sentences(page_url)
        print(f"   -> {len(sentences)} candidate sentences")
        if not sentences:
            continue
        matches = match_sentences(sentences, provider_docs_lookup, page_url)
        persist_matches(matches)


def main() -> None:
    feed_arg = None
    if len(sys.argv) > 1:
        feed_arg = sys.argv[1]
    feed_id = int(feed_arg or DEFAULT_FEED_ID or 0)
    if not feed_id:
        raise SystemExit("Usage: python generate-map.py <feed_id> or set SITEMAP_FEED_ID in .env")

    generate_matches_for_feed(feed_id)


if __name__ == "__main__":
    main()
