import argparse
import json
from datetime import datetime
from typing import Dict, List

from match_refresh_utils import (
    MATCH_COUNT,
    MATCH_THRESHOLD,
    fetch_deleted_pairs,
    fetch_existing_matches,
    fetch_site_chunks,
    find_matches,
    fetch_knowledge_row,
    insert_page_match,
)


def parse_args():
    parser = argparse.ArgumentParser(description="Refresh page matches for a JSON list of pages")
    parser.add_argument("provider_id", type=int, help="ID of the provider to process")
    parser.add_argument(
        "pages_file",
        type=str,
        help="JSON file with an array of pages (each object must include at least `id`)",
    )
    parser.add_argument("--limit", "-l", type=int, default=200, help="Chunks per page to fetch")
    parser.add_argument(
        "--after-id",
        type=int,
        default=None,
        help="Skip chunks with site_content.id <= after_id for every page",
    )
    return parser.parse_args()


def load_pages(path: str) -> List[Dict]:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("Pages JSON must be an array of objects")
    pages = []
    for entry in data:
        if not isinstance(entry, dict) or "id" not in entry:
            raise ValueError("Each page entry must be an object with an `id` field")
        pages.append(entry)
    return pages


def main():
    args = parse_args()
    provider_id = args.provider_id
    limit = args.limit
    after_id = args.after_id
    pages = load_pages(args.pages_file)

    existing_matches, approved_ids = fetch_existing_matches(provider_id)
    deleted_pairs = fetch_deleted_pairs(provider_id)

    inserted = 0
    skipped_deleted = 0
    skipped_approved = 0

    for page in pages:
        page_id = page["id"]
        page_chunks = fetch_site_chunks(provider_id, page_id, limit=limit, after_id=after_id)
        if not page_chunks:
            print(f"[refresh-pages] no chunks for page {page_id} ({page.get('page_url')})")
            continue
        print(f"[refresh-pages] processing page {page_id} ({page.get('page_url')}), chunks={len(page_chunks)}")
        for chunk in page_chunks:
            site_id = chunk.get("id")
            if not site_id or site_id in approved_ids:
                skipped_approved += bool(site_id)
                continue
            embedding = chunk.get("embedding")
            if not embedding:
                continue
            matches = find_matches(embedding, provider_id, MATCH_THRESHOLD, MATCH_COUNT)
            if not matches:
                print(f"[refresh-pages] no knowledge candidates for chunk {site_id}")
                continue
            top_match = matches[0]
            print(
                f"[refresh-pages] best candidate for chunk {site_id}: knowledge_id={top_match.get('id')}, "
                f"confidence={top_match.get('confidence') or top_match.get('similarity') or 0:.4f}"
            )
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
                    print(
                        f"[refresh-pages] inserted match {match_id} for chunk {site_id} (knowledge_id={knowledge_id})"
                    )
                    break

    print(
        f"[refresh-pages] completed={datetime.utcnow().isoformat()} provider={provider_id} inserted={inserted} "
        f"skipped_deleted={skipped_deleted} skipped_approved={skipped_approved}"
    )


if __name__ == "__main__":
    main()
