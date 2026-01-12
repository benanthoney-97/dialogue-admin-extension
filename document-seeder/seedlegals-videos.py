import os
import re
from typing import Dict
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import Client, create_client

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

load_dotenv()

VIMEO_ROOT = "https://vimeo.com/seedlegals"
VIDEO_ID_RE = re.compile(
    r"(?:https?://(?:www\.)?vimeo\.com)?/(\d+)(?:[/?#].*)?$"
)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SCROLL_STEPS = int(os.environ.get("SEEDLEGALS_SCROLL_STEPS", "20"))
SCROLL_PAUSE_MS = int(os.environ.get("SEEDLEGALS_SCROLL_PAUSE_MS", "3000"))
API_PER_PAGE = int(os.environ.get("SEEDLEGALS_API_PER_PAGE", "100"))
API_MAX_PAGES = int(os.environ.get("SEEDLEGALS_API_MAX_PAGES", "5"))
API_CHANNEL = os.environ.get("SEEDLEGALS_CHANNEL", "seedlegals")
LOAD_MORE_CLICKS = int(os.environ.get("SEEDLEGALS_LOAD_MORE_CLICKS", "5"))
VIMEO_ACCESS_TOKEN = os.environ.get("SEEDLEGALS_VIMEO_TOKEN")

PROVIDER_ID = 12
SUPABASE_CLIENT = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    else None
)


def _extract_cover_image(anchor):
    cover = anchor.get("data-thumbnail") or anchor.get("data-thumb")
    if not cover:
        img = anchor.find("img")
        if img:
            cover = (
                img.get("data-srcset")
                or img.get("data-src")
                or img.get("data-lazy-src")
                or img.get("src")
            )
    return cover


def _extract_videos_from_html(html):
    soup = BeautifulSoup(html, "html.parser")
    videos = {}

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        match = VIDEO_ID_RE.match(href)
        if not match:
            continue

        video_id = match.group(1)
        full_url = urljoin(VIMEO_ROOT, f"/{video_id}")
        title = (
            anchor.get("aria-label")
            or anchor.get("data-title")
            or anchor.get_text(strip=True)
            or "Untitled video"
        )
        cover = _extract_cover_image(anchor)

        videos[full_url] = {"title": title, "cover_image": cover}

    return videos


def fetch_seedlegals_video_links():
    auth_videos = fetch_seedlegals_authenticated_videos()
    if auth_videos:
        return auth_videos
    api_videos = fetch_seedlegals_api_videos()
    if api_videos:
        return api_videos
    if sync_playwright:
        html = _fetch_with_playwright()
        if html:
            videos = _extract_videos_from_html(html)
            if videos:
                print(f"Found {len(videos)} unique video links (Playwright).")
                return videos
    return _fetch_with_requests()


def _fetch_with_playwright():
    print("Fetching Vimeo channel page via Playwright rendering...")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        page.goto(VIMEO_ROOT, wait_until="domcontentloaded", timeout=60_000)
        _scroll_vimeo_channel(page, SCROLL_STEPS, SCROLL_PAUSE_MS)
        _click_load_more_button(page, LOAD_MORE_CLICKS, SCROLL_PAUSE_MS)
        html = page.content()
        context.close()
        browser.close()
    return html


def _scroll_vimeo_channel(page, steps, pause_ms):
    for _ in range(steps):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(pause_ms)


def _click_load_more_button(page, attempts, pause_ms):
    for _ in range(attempts):
        locator = page.locator("button:has-text('Load more')")
        if locator.count() == 0:
            break
        try:
            locator.first.click()
        except Exception:
            break
        page.wait_for_timeout(pause_ms)


def _fetch_with_requests():
    print(f"Fetching Vimeo channel page: {VIMEO_ROOT}")
    response = requests.get(
        VIMEO_ROOT, headers={"User-Agent": "SeedLegalsVideoCollector/1.0"}
    )
    response.raise_for_status()

    videos = _extract_videos_from_html(response.text)
    print(
        f"Found {len(videos)} unique video links (requests). "
        "Playwright not available or returned no results."
    )
    return videos


def fetch_seedlegals_api_videos() -> dict[str, dict]:
    print("Fetching Vimeo video metadata from API...")
    videos: Dict[str, dict] = {}
    API_BASE = f"https://vimeo.com/api/v2/channel/{API_CHANNEL}/videos.json"
    headers = {"User-Agent": "SeedLegalsVideoCollector/1.0"}
    for page in range(1, API_MAX_PAGES + 1):
        params = {"page": page, "per_page": API_PER_PAGE, "sort": "date", "direction": "desc"}
        try:
            response = requests.get(API_BASE, headers=headers, params=params, timeout=15)
            response.raise_for_status()
        except requests.exceptions.HTTPError as exc:
            print(f"  API request failed (status={response.status_code}): {exc}")
            return {}
        except requests.exceptions.RequestException as exc:
            print(f"  API request failed: {exc}")
            return {}
        data = response.json()
        if not isinstance(data, list) or not data:
            break
        for entry in data:
            url = (entry.get("url") or entry.get("link") or "").strip()
            if not url:
                continue
            title = entry.get("title") or entry.get("name") or "Untitled video"
            cover = entry.get("thumbnail_large") or entry.get("thumbnail_medium") or entry.get("thumbnail_small")
            videos[url] = {
                "title": title,
                "cover_image": cover,
            }
        if len(data) < API_PER_PAGE:
            break
    if videos:
        print(f"Found {len(videos)} video links via Vimeo API.")
    return videos


def fetch_seedlegals_authenticated_videos() -> dict[str, dict]:
    if not VIMEO_ACCESS_TOKEN:
        return {}
    print("Fetching Vimeo video metadata via authenticated API...")
    videos: Dict[str, dict] = {}
    endpoint = f"https://api.vimeo.com/channels/{API_CHANNEL}/videos"
    headers = {
        "Authorization": f"Bearer {VIMEO_ACCESS_TOKEN}",
        "Accept": "application/vnd.vimeo.*+json;version=3.4",
    }
    for page in range(1, API_MAX_PAGES + 1):
        params = {"page": page, "per_page": API_PER_PAGE, "sort": "date", "direction": "desc"}
        try:
            response = requests.get(endpoint, headers=headers, params=params, timeout=15)
            response.raise_for_status()
        except requests.exceptions.HTTPError as exc:
            print(f"  Auth API request failed (status={response.status_code}): {exc}")
            break
        except requests.exceptions.RequestException as exc:
            print(f"  Auth API request failed: {exc}")
            break
        payload = response.json()
        data = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(data, list) or not data:
            break
        for entry in data:
            url = (entry.get("link") or "").strip()
            if not url:
                continue
            title = entry.get("name") or entry.get("title") or "Untitled video"
            pictures = entry.get("pictures", {})
            cover = pictures.get("base_link") or pictures.get("sizes", [{}])[-1].get("link")
            videos[url] = {
                "title": title,
                "cover_image": cover,
            }
        if len(data) < API_PER_PAGE:
            break
    if videos:
        print(f"Found {len(videos)} video links via authenticated Vimeo API.")
    return videos


def normalize_source_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    try:
        parsed = urlparse(raw_url)
        scheme = parsed.scheme or "https"
        path = parsed.path.rstrip("/")
        if path == "":
            path = "/"
        normalized = parsed._replace(scheme=scheme, path=path, query="", fragment="")
        return urlunparse(normalized)
    except Exception:
        return raw_url


def fetch_existing_source_urls() -> set[str]:
    if not SUPABASE_CLIENT:
        raise RuntimeError("Supabase credentials are required to fetch existing documents")
    response = SUPABASE_CLIENT.table("provider_documents").select("source_url").execute()
    data = getattr(response, "data", None)
    error = getattr(response, "error", None)
    if error:
        raise error
    urls = {
        normalize_source_url(row.get("source_url") or "")
        for row in (data or [])
        if row.get("source_url")
    }
    return urls


def find_new_videos(videos: dict[str, dict], seen_urls: set[str]) -> list[tuple[str, dict]]:
    results = []
    for url, payload in videos.items():
        normalized = normalize_source_url(url)
        if normalized and normalized not in seen_urls:
            payload["source_url"] = normalized
            results.append((normalized, payload))
            seen_urls.add(normalized)
    return results


def insert_new_provider_documents(entries: list[tuple[str, dict]]):
    if not SUPABASE_CLIENT:
        print("⚠️  Supabase credentials missing; skipping document insert.")
        return
    for normalized_url, payload in entries:
        response = SUPABASE_CLIENT.table("provider_documents").insert(
            {
                "provider_id": PROVIDER_ID,
                "title": payload["title"],
                "source_url": normalized_url,
                "media_type": "video",
                "cover_image_url": payload.get("cover_image"),
                "is_active": False,
            }
        ).execute()
        error = getattr(response, "error", None)
        if error:
            print(f"⚠️  Failed to insert {payload['title']} ({normalized_url}): {error}")
        else:
            print(f"✅ Inserted {payload['title']} into provider_documents.")


def main():
    existing_urls = set()
    try:
        existing_urls = fetch_existing_source_urls()
    except Exception as error:
        print(f"⚠️  Unable to load existing documents: {error}")
    videos = fetch_seedlegals_video_links()
    new_videos = find_new_videos(videos, existing_urls)
    if new_videos:
        print(f"✅ Found {len(new_videos)} new SeedLegals videos:")
        for idx, (url, payload) in enumerate(new_videos, start=1):
            title = payload["title"]
            cover = payload.get("cover_image")
            print(f"{idx:02d}: {title}")
            print(f"    URL: {url}")
            if cover:
                print(f"    Cover: {cover}")
            else:
                print("    Cover: (none found)")
        insert_new_provider_documents(new_videos)
    else:
        print("ℹ️  All discovered SeedLegals videos already exist in provider_documents.")


if __name__ == "__main__":
    main()
