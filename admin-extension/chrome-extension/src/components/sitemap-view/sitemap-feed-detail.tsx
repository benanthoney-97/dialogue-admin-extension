import { SitemapFeed } from "../sitemap-feeds-table"
import { SitemapPagesTable } from "../sitemap-pages-table"

export interface SitemapFeedDetailProps {
  feed: SitemapFeed
  filter: string
  onPageToggle?: (pageId: number, tracked: boolean) => void
}

export function SitemapFeedDetail({ feed, filter, onPageToggle }: SitemapFeedDetailProps) {
  return (
    <div className="sitemap-feed-detail">
      <SitemapPagesTable feedId={feed.id} filter={filter} onPageToggle={onPageToggle} />
    </div>
  )
}
