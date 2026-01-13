import argparse
from datetime import datetime

from match_refresh_utils import (
    MATCH_COUNT,
    MATCH_THRESHOLD,
    fetch_deleted_pairs,
    fetch_existing_matches,
    fetch_site_chunks,
    fetch_tracked_page_ids,
    find_matches,
    fetch_knowledge_row,
    insert_page_match,
)


def parse_args():
    parser = argparse.ArgumentParser(description="Refresh page matches for a provider")
    parser.add_argument("provider_id", type=int, help="ID of the provider to process")
    parser.add_argument("--limit", "-l", type=int, default=200, help="Max chunks to fetch per page")
    parser.add_argument(
        "--after-id",
        type=int,
        default=None,
        help="Resume after this site_content.id (skips chunks <= after_id)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    provider_id = args.provider_id
    limit = args.limit
    after_id = args.after_id

    existing_matches, approved_ids = fetch_existing_matches(provider_id)
    deleted_pairs = fetch_deleted_pairs(provider_id)
    tracked_pages = fetch_tracked_page_ids(provider_id)

    if not tracked_pages:
        print(f"[refresh] no tracked pages for provider {provider_id}, skipping")
        return

    inserted = 0
    skipped_deleted = 0
    skipped_approved = 0

    for page_id in tracked_pages:
        page_chunks = fetch_site_chunks(provider_id, page_id, limit=limit, after_id=after_id)
        if not page_chunks:
            print(f"[refresh] no chunks for page {page_id}, skipping")
            continue
        print(f"[refresh] processing page {page_id}, chunks={len(page_chunks)}")
        for chunk in page_chunks:
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
            if not matches:
                print(f"[refresh] no knowledge candidates for chunk {site_id}")
                continue
            top_match = matches[0]
            print(
                f"[refresh] best candidate for chunk {site_id}: knowledge_id={top_match.get('id')}, "
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
                        f"[refresh] inserted match {match_id} for chunk {site_id} (knowledge_id={knowledge_id})"
                    )
                    break

    print(
        f"[refresh] completed={datetime.utcnow().isoformat()} provider={provider_id} inserted={inserted} "
        f"skipped_deleted={skipped_deleted} skipped_approved={skipped_approved}"
    )


if __name__ == "__main__":
    main()
