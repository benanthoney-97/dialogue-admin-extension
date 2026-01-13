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


def extract_page_text(page_url: str) -> list[dict]:
    try:
        response = requests.get(page_url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except Exception as exc:
        print(f"⚠️ Failed to fetch {page_url}: {exc}")
        return []
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "header", "footer", "nav", "form", "noscript"]):
        tag.decompose()
    body = soup.body or soup
    block_tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]
    blocks = []
    for element in body.find_all(block_tags):
        block_text = element.get_text(" ", strip=True)
        if not block_text:
            continue
        block_text = re.sub(r"[ \t\r\f\v]+", " ", block_text)
        tag_name = element.name.lower()
        blocks.append({"text": block_text, "is_header": tag_name.startswith("h")})
    return blocks


def chunk_sentences(
    blocks: list[dict], min_length: int, max_length: int, limit: int
) -> list[str]:
    if not blocks:
        return []
    seen = set()
    sentences = []
    for block in blocks:
        text = block.get("text", "").strip()
        if not text:
            continue
        if len(sentences) >= limit:
            break
        if block.get("is_header"):
            clean = re.sub(r"\s+([.,!?;:])", r"\1", text)
            if min_length <= len(clean) <= max_length and clean not in seen:
                seen.add(clean)
                sentences.append(clean)
            continue
        potential_sentences = re.split(r"(?<=[.!?])\s+", text)
        for sentence in potential_sentences:
            if len(sentences) >= limit:
                break
            clean = sentence.strip()
            clean = re.sub(r"\s+([.,!?;:])", r"\1", clean)
            if not clean:
                continue
            if len(clean) < min_length or len(clean) > max_length:
                continue
            if clean in seen:
                continue
            seen.add(clean)
            sentences.append(clean)
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


def process_page_entry(provider_id: int, page: dict) -> None:
    page_url = page.get("page_url")
    page_id = page.get("id")
    if not page_url or not page_id:
        return
    print(f"🌐 Chunking {page_url}")
    blocks = extract_page_text(page_url)
    chunks = chunk_sentences(blocks, CHUNK_MIN_LENGTH, CHUNK_MAX_LENGTH, CHUNK_LIMIT)
    if not chunks:
        print(f"⚠️ No chunkable text for {page_url}")
        return
    embeddings = embed_chunks(chunks)
    if len(embeddings) != len(chunks):
        print(f"⚠️ Embedding count mismatch for {page_url}")
        return
    metadata = build_metadata(page_url, fetch_page_title(page_url))
    persist_site_chunks(provider_id, page_id, page_url, chunks, embeddings, metadata)
    print(f"🧱 Stored {len(chunks)} chunks for {page_url}")
    time.sleep(1)


def process_provider(provider_id: int, feed_ids: list[int], force: bool) -> None:
    for feed_id in feed_ids:
        print(f"🔁 Syncing provider {provider_id} feed {feed_id}")
        new_pages = (
            discover_new_pages(provider_id, feed_id) if not force else fetch_all_pages_for_feed(feed_id)
        )
        for page in new_pages:
            process_page_entry(provider_id, page)


def process_feed(feed_id: int, force: bool) -> None:
    print(f"🔁 Processing feed {feed_id}")
    feed_resp = (
        supabase.table("sitemap_feeds")
        .select("id, provider_id")
        .eq("id", feed_id)
        .maybe_single()
        .execute()
    )
    feed = feed_resp.data
    if not feed or not feed.get("provider_id"):
        print(f"⚠️ Feed {feed_id} missing provider_id")
        return
    provider_id = feed["provider_id"]
    pages = fetch_all_pages_for_feed(feed_id)
    if not pages:
        print(f"⚠️ Feed {feed_id} has no sitemap pages")
        return
    if force:
        print(f"⚠️ Force rebuild enabled; reprocessing {len(pages)} pages")
    for page in pages:
        process_page_entry(provider_id, page)


def process_specific_page(page_id: int, force: bool) -> None:
    print(f"🔁 Processing specific sitemap page {page_id}")
    page_resp = (
        supabase.table("sitemap_pages")
        .select("id, page_url, feed_id")
        .eq("id", page_id)
        .maybe_single()
        .execute()
    )
    page = page_resp.data
    if not page:
        print(f"⚠️ Sitemap page {page_id} not found")
        return
    feed_id = page.get("feed_id")
    if not feed_id:
        print(f"⚠️ Sitemap page {page_id} missing feed_id")
        return
    feed_resp = (
        supabase.table("sitemap_feeds")
        .select("provider_id")
        .eq("id", feed_id)
        .maybe_single()
        .execute()
    )
    feed = feed_resp.data
    if not feed or not feed.get("provider_id"):
        print(f"⚠️ Feed {feed_id} missing provider_id")
        return
    provider_id = feed["provider_id"]
    process_page_entry(provider_id, page)


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
    page_id = None
    feed_id = None
    if "--page-id" in args:
        idx = args.index("--page-id")
        if idx == len(args) - 1:
            raise SystemExit("Usage: python site-content-seeder-dom.py --page-id <page_id>")
        try:
            page_id = int(args[idx + 1])
        except ValueError:
            raise SystemExit("page_id must be an integer")
        del args[idx : idx + 2]
    if "--feed-id" in args:
        idx = args.index("--feed-id")
        if idx == len(args) - 1:
            raise SystemExit("Usage: python site-content-seeder-dom.py --feed-id <feed_id>")
        try:
            feed_id = int(args[idx + 1])
        except ValueError:
            raise SystemExit("feed_id must be an integer")
        del args[idx : idx + 2]
    if page_id is not None:
        if args:
            raise SystemExit("Cannot mix --page-id with provider/feed arguments.")
        process_specific_page(page_id, force)
        return
    if feed_id is not None:
        if args:
            raise SystemExit("Cannot mix --feed-id with provider/feed arguments.")
        process_feed(feed_id, force)
        return
    if len(args) < 2:
        raise SystemExit(
            "Usage:\n"
            "  python site-content-seeder-dom.py <provider_id> <feed_id> [<feed_id> ...] [--rebuild]\n"
            "  python site-content-seeder-dom.py --page-id <page_id> [--rebuild]\n"
            "  python site-content-seeder-dom.py --feed-id <feed_id> [--rebuild]"
        )
    provider_id = int(args[0])
    feed_ids = [int(fid) for fid in args[1:]]
    process_provider(provider_id, feed_ids, force)


if __name__ == "__main__":
    main()
