import { SitemapFeed } from "../sitemap-feeds-table"
import { SitemapPagesTable } from "../sitemap-pages-table"

export interface SitemapFeedDetailProps {
  feed: SitemapFeed
  filter: string
  onPageToggle?: (pageId: number, tracked: boolean) => void
  onViewPage?: (pageUrl: string, feed: SitemapFeed) => void
}

export function SitemapFeedDetail({
  feed,
  filter,
  onPageToggle,
  onViewPage,
}: SitemapFeedDetailProps) {
  return (
    <div className="sitemap-feed-detail">
      <SitemapPagesTable feedId={feed.id} feed={feed} filter={filter} onPageToggle={onPageToggle} onViewPage={onViewPage} />
    </div>
  )
}
