import { useState } from "react"
import type { SitemapFeed } from "../sitemap-feeds-table"
import { SitemapFeedsTable } from "../sitemap-feeds-table"
import { SitemapFeedDetail } from "./sitemap-feed-detail"
import { ThresholdControls } from "../threshold-controls"

export interface SitemapViewProps {
  providerId: number
  onFeedToggle?: (feedId: number, tracked: boolean) => void
  onPageToggle?: (pageId: number, tracked: boolean) => void
  threshold: "high" | "medium" | "low"
  onThresholdChange: (value: "high" | "medium" | "low") => void
  onThresholdSave: () => void
  thresholdSaving?: boolean
}

const formatFeedUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    const prefixString = `${parsed.origin}/`
    const suffix = parsed.pathname.replace(/^\/+/, "") || "/"
    return (
      <>
        <span className="sitemap-feed-card__url-prefix">{prefixString}</span>
        <span className="sitemap-feed-card__url-suffix">{suffix}</span>
      </>
    )
  } catch {
    return <span className="sitemap-feed-card__url-prefix">{url}</span>
  }
}

export function SitemapView({
  providerId,
  onFeedToggle,
  onPageToggle,
  threshold,
  onThresholdChange,
  onThresholdSave,
  thresholdSaving
}: SitemapViewProps) {
  const [pageFilter, setPageFilter] = useState("")
  const [selectedFeed, setSelectedFeed] = useState<SitemapFeed | null>(null)

  return (
    <>
      <div className="sitemap-view__pane">
        <div className="sitemap-view__threshold">
          <ThresholdControls
            current={threshold}
            onChange={onThresholdChange}
            onSave={onThresholdSave}
            saving={thresholdSaving}
          />
        </div>
      <div className="sitemap-view__header">
        {selectedFeed ? (
          <div className="sitemap-view__header-detail">
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
            </button>
            <div className="sitemap-feed-detail__info">
              <div className="sitemap-feed-detail__url">{formatFeedUrl(selectedFeed.feed_url)}</div>
            </div>
          </div>
        ) : (
          <div className="sitemap-view__title">Site Sections</div>
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
        color: #0f172a;
        font-size: 14px;
        margin-bottom: 4px;
      }
    `}</style>
    </>
  )
}
