import os
import re
import sys
import time
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from llama_index.embeddings.openai import OpenAIEmbedding

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(parent_dir, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("PLASMO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embed_model = OpenAIEmbedding(model="text-embedding-3-small")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SiteContentSeeder/1.0; +https://example.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

SITEMAP_FETCH_TIMEOUT = int(os.getenv("SITEMAP_FETCH_TIMEOUT", "15"))
CHUNK_MIN_LENGTH = int(os.getenv("SITE_CHUNK_MIN_LENGTH", "30"))
CHUNK_MAX_LENGTH = int(os.getenv("SITE_CHUNK_MAX_LENGTH", "150"))
CHUNK_LIMIT = int(os.getenv("SITE_CHUNK_LIMIT", "50"))


def fetch_sitemap_urls(sitemap_url: str) -> list[str]:
    try:
        resp = requests.get(sitemap_url, headers=HEADERS, timeout=SITEMAP_FETCH_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        print(f"⚠️ Failed to fetch sitemap {sitemap_url}: {exc}")
        return []
    soup = BeautifulSoup(resp.text, "xml")
    return [node.text.strip() for node in soup.find_all("loc") if node.text.strip()]


def extract_page_text(page_url: str) -> str:
    try:
        response = requests.get(page_url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except Exception as exc:
        print(f"⚠️ Failed to fetch {page_url}: {exc}")
        return ""
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "header", "footer", "nav", "form", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text)


def chunk_sentences(
    text: str, min_length: int, max_length: int, limit: int
) -> list[str]:
    if not text:
        return []
    potential_sentences = re.split(r"(?<=[.!?])\s+", text)
    seen = set()
    sentences = []
    for sentence in potential_sentences:
        clean = sentence.strip()
        if not clean:
            continue
        if len(clean) < min_length or len(clean) > max_length:
            continue
        if clean in seen:
            continue
        seen.add(clean)
        sentences.append(clean)
        if len(sentences) >= limit:
            break
    return sentences


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    if not chunks:
        return []
    try:
        return embed_model.get_text_embedding_batch(chunks)
    except Exception as exc:
        print(f"⚠️ Embedding error: {exc}")
        return []


def discover_new_pages(provider_id: int, feed_id: int) -> list[dict]:
    page_resp = (
        supabase.table("sitemap_pages")
        .select("id, page_url")
        .eq("feed_id", feed_id)
        .execute()
    )
    existing_urls = {row["page_url"] for row in (page_resp.data or []) if row.get("page_url")}
    feed_resp = (
        supabase.table("sitemap_feeds")
        .select("id, feed_url")
        .eq("provider_id", provider_id)
        .eq("id", feed_id)
        .maybe_single()
        .execute()
    )
    feed_url = feed_resp.data and feed_resp.data.get("feed_url")
    if not feed_url:
        print(f"⚠️ Feed {feed_id} missing feed_url")
        return []
    sitemap_urls = fetch_sitemap_urls(feed_url)
    new_urls = [url for url in sitemap_urls if url not in existing_urls]
    if not new_urls:
        return []
    payload = [{"feed_id": feed_id, "page_url": url, "tracked": True} for url in new_urls]
    insert_resp = supabase.table("sitemap_pages").insert(payload).select("id, page_url").execute()
    if insert_resp.error:
        raise RuntimeError(f"Failed to insert sitemap pages: {insert_resp.error}")
    return insert_resp.data or []


def build_metadata(page_url: str, title: str | None) -> dict:
    meta = {"source": page_url}
    if title:
        meta["title"] = title
    return meta


def persist_site_chunks(
    provider_id: int,
    sitemap_page_id: int,
    page_url: str,
    chunks: list[str],
    embeddings: list[list[float]],
    metadata: dict,
) -> None:
    if not chunks or not embeddings:
        return
    payload = []
    for idx, chunk in enumerate(chunks):
        payload.append(
            {
                "provider_id": provider_id,
                "sitemap_page_id": sitemap_page_id,
                "page_url": page_url,
                "chunk_index": idx,
                "chunk_text": chunk,
                "embedding": embeddings[idx],
                "metadata": {**metadata, "chunk_index": idx},
            }
        )
    resp = supabase.table("site_content").insert(payload).execute()
    error = getattr(resp, "error", None)
    if error:
        raise RuntimeError(f"Site content insert failed: {error}")


def fetch_page_title(page_url: str) -> str | None:
    try:
        resp = requests.get(page_url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception:
        return None
    soup = BeautifulSoup(resp.text, "html.parser")
    title_tag = soup.find("title")
    return title_tag.text.strip() if title_tag else None


def process_provider(provider_id: int, feed_ids: list[int], force: bool) -> None:
    for feed_id in feed_ids:
        print(f"🔁 Syncing provider {provider_id} feed {feed_id}")
        new_pages = (
            discover_new_pages(provider_id, feed_id) if not force else fetch_all_pages_for_feed(feed_id)
        )
        for page in new_pages:
            page_url = page.get("page_url")
            page_id = page.get("id")
            if not page_url or not page_id:
                continue
            print(f"🌐 Chunking {page_url}")
            text = extract_page_text(page_url)
            chunks = chunk_sentences(text, CHUNK_MIN_LENGTH, CHUNK_MAX_LENGTH, CHUNK_LIMIT)
            if not chunks:
                print(f"⚠️ No chunkable text for {page_url}")
                continue
            embeddings = embed_chunks(chunks)
            if len(embeddings) != len(chunks):
                print(f"⚠️ Embedding count mismatch for {page_url}")
                continue
            metadata = build_metadata(page_url, fetch_page_title(page_url))
            persist_site_chunks(provider_id, page_id, page_url, chunks, embeddings, metadata)
            print(f"🧱 Stored {len(chunks)} chunks for {page_url}")
            time.sleep(1)


def fetch_all_pages_for_feed(feed_id: int) -> list[dict]:
    resp = (
        supabase.table("sitemap_pages")
        .select("id, page_url")
        .eq("feed_id", feed_id)
        .execute()
    )
    return resp.data or []


def main() -> None:
    force = "--rebuild" in sys.argv
    args = [arg for arg in sys.argv[1:] if arg != "--rebuild"]
    if len(args) < 2:
        raise SystemExit("Usage: python site-content-seeder.py <provider_id> <feed_id> [<feed_id> ...] [--rebuild]")
    provider_id = int(args[0])
    feed_ids = [int(fid) for fid in args[1:]]
    process_provider(provider_id, feed_ids, force)


if __name__ == "__main__":
    main()
