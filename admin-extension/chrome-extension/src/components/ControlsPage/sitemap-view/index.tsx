import { useEffect, useState } from "react"
import type { SitemapFeed } from "../sitemap-feeds-table"
import { SitemapFeedsTable } from "../sitemap-feeds-table"
import { SitemapFeedDetail } from "./sitemap-feed-detail"
import { ThresholdControls } from "../../threshold-controls"

export interface SitemapViewProps {
  providerId: number
  onFeedToggle?: (feedId: number, tracked: boolean) => void
  onPageToggle?: (pageId: number, tracked: boolean) => void
  onViewPage?: (pageUrl: string, feed: SitemapFeed) => void
  initialSelectedFeed?: SitemapFeed | null
  thresholdValue: number
  onThresholdChange: (value: number) => void
}

const formatFeedUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    const suffix = `${parsed.pathname}${parsed.search || ""}${parsed.hash || ""}`
    return suffix.replace(/^\/+/, "") || "/"
  } catch {
    return url
  }
}

export function SitemapView({
  providerId,
  onFeedToggle,
  onPageToggle,
  onViewPage,
  initialSelectedFeed,
  thresholdValue,
  onThresholdChange,
}: SitemapViewProps) {
  const [pageFilter, setPageFilter] = useState("")
  const [selectedFeed, setSelectedFeed] = useState<SitemapFeed | null>(initialSelectedFeed ?? null)
  const isDetailView = Boolean(selectedFeed)

  useEffect(() => {
    if (initialSelectedFeed) {
      setSelectedFeed(initialSelectedFeed)
    }
  }, [initialSelectedFeed])

  return (
    <>
      <div className="sitemap-view__pane">
        <div
          className={`sitemap-view__threshold${isDetailView ? " sitemap-view__threshold--hidden" : ""}`}
          aria-hidden={isDetailView}
        >
          <ThresholdControls value={thresholdValue} onChange={onThresholdChange} />
        </div>
      <div className="sitemap-view__header">
        {selectedFeed ? (
          <div className="sitemap-view__header-detail sitemap-view__header-detail--stack">
            <div className="sitemap-view__header-row">
              <button
                type="button"
                className="sitemap-view__header-back"
                onClick={() => setSelectedFeed(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path
                    fillRule="evenodd"
                    d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
                  />
                </svg>
                <span>Back</span>
              </button>
            </div>
            <div className="sitemap-feed-detail__info">
              <div className="sitemap-feed-detail__url">
                {formatFeedUrl(selectedFeed.feed_url)}
              </div>
            </div>
          </div>
        ) : (
          <div className="sitemap-view__title">Page visibility</div>
        )}
      </div>
      <div className="sitemap-feeds-search">
        <input
          id="sitemap-page-filter"
          type="search"
          placeholder="Filter by URL"
          value={pageFilter}
          onChange={(event) => {
            const value = event.target.value
            console.log("[sitemap] filter change", value)
            setPageFilter(value)
          }}
        />
      </div>
      <div className="sitemap-view__content">
        {selectedFeed ? (
          <SitemapFeedDetail
            feed={selectedFeed}
            filter={pageFilter}
            onPageToggle={onPageToggle}
            onViewPage={(pageUrl) => onViewPage?.(pageUrl, selectedFeed)}
          />
        ) : (
          <SitemapFeedsTable
            providerId={providerId}
            filter={pageFilter}
            onFeedSelect={(feed) => setSelectedFeed(feed)}
            onFeedToggle={onFeedToggle}
          />
        )}
      </div>
      </div>
      <style>{`
      .sitemap-view__title {
        text-align: left;
        font-weight: 600;
        color: #1f2937;
        font-size: 14px;
        margin-bottom: 0px;
      }
    `}</style>
    </>
  )
}
