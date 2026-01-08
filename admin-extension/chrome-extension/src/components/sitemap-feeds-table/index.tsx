import React, { useEffect, useState } from "react"
import { formatHumanReadableDate } from "../../utils/format-date"
import { ConfirmAction } from "../confirm-action"

export interface SitemapFeed {
  id: number
  provider_id: number
  feed_url: string
  last_modified?: string
  tracked?: boolean | null
  tracked_page_count?: number
  pages_with_matches?: number
  all_page_count?: number
}

export interface SitemapFeedsTableProps {
  providerId: number
  onFeedSelect?: (feed: SitemapFeed) => void
  filter?: string
  onFeedToggle?: (feedId: number, tracked: boolean) => void
}

export function SitemapFeedsTable({
  providerId,
  onFeedSelect,
  filter = "",
  onFeedToggle,
}: SitemapFeedsTableProps) {
  const resolvedProviderId = providerId
  const [feeds, setFeeds] = useState<SitemapFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizedFilter = filter.trim().toLowerCase()
  if (process.env.NODE_ENV !== "production") {
    console.log("[sitemap-feeds-table] filter values", { filter, normalizedFilter, feedCount: feeds.length })
  }
  const filteredFeeds = feeds.filter((feed) => {
    if (!normalizedFilter) return true
    return feed.feed_url.toLowerCase().includes(normalizedFilter)
  })
  if (process.env.NODE_ENV !== "production") {
    console.log("[sitemap-feeds-table] filtered count", filteredFeeds.length)
  }

  const [pendingFeedToggle, setPendingFeedToggle] = useState<{
    feed: SitemapFeed
    tracked: boolean
  } | null>(null)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE = (window as any).__SL_BACKEND_URL || "http://localhost:4173"
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/sitemap-feeds?provider_id=${resolvedProviderId}`
    if (process.env.NODE_ENV !== "production") {
      console.log("[sitemap-feeds-table] fetching feeds from", endpoint, { providerId: resolvedProviderId })
    }
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load sitemap feeds (${res.status})`)
        }
        return res.json()
      })
        .then((data) => {
        if (canceled) return
        if (!Array.isArray(data)) {
          throw new Error("Unexpected sitemap feed payload")
        }
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[sitemap-feeds-table] fetched normalized feeds",
            data.map((item) => ({
              feed_id: item.id,
              tracked: item.tracked,
              all_page_count: item.all_page_count,
              tracked_page_count: item.tracked_page_count,
              pages_with_matches: item.pages_with_matches,
            }))
          )
        }
        setFeeds(data)
        })
      .catch((err) => {
        if (canceled) return
        console.error("[sitemap-feeds-table] fetch error", err)
        setError(err?.message ?? "Unable to load sitemap feeds")
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false)
        }
      })
    return () => {
      canceled = true
    }
  }, [providerId])

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[sitemap-feeds-table] feeds state change",
        feeds.map((feed) => ({
          id: feed.id,
          tracked: feed.tracked,
          all_page_count: feed.all_page_count,
          tracked_page_count: feed.tracked_page_count,
          pages_with_matches: feed.pages_with_matches,
        }))
      )
    }
  }, [feeds])

  const handleSelect = (feed: SitemapFeed) => {
    if (!onFeedSelect) return
    onFeedSelect(feed)
  }

  useEffect(() => {
    if (!onFeedToggle && process.env.NODE_ENV !== "production") {
      console.warn("[sitemap-feed-card] toggle handler missing; feed cards will not respond to track/hide actions.")
    }
  }, [onFeedToggle])

  const handleToggle = (event: React.MouseEvent, feed: SitemapFeed) => {
    event.stopPropagation()
    setPendingFeedToggle({ feed, tracked: !feed.tracked })
  }

  const handleConfirmToggle = () => {
    if (!pendingFeedToggle) return
    const { feed, tracked } = pendingFeedToggle
    setPendingFeedToggle(null)
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[sitemap-feed-card] confirming toggle for feed ${feed.id} (${feed.feed_url}) tracked=${tracked}`
      )
    }
    onFeedToggle?.(feed.id, tracked)
    setFeeds((prev) =>
      prev.map((item) =>
        item.id === feed.id ? { ...item, tracked } : item
      )
    )
  }

  const handleCancelToggle = () => {
    setPendingFeedToggle(null)
  }

  return (
    <div className="sitemap-feeds-table">
      <div className="sitemap-feeds-table__shell">
        <div className="sitemap-feeds-table__content">
          {loading && <div className="sitemap-feeds-table__empty">Loading feeds…</div>}
          {error && <div className="sitemap-feeds-table__empty">Error: {error}</div>}
          {!loading && !error && feeds.length === 0 && (
            <div className="sitemap-feeds-table__empty">No sitemap feeds configured.</div>
          )}
          {!loading && !error && filteredFeeds.length > 0 && (
            <div className="sitemap-feeds-table__list">
              {filteredFeeds.map((feed) => {
                const formattedLastModified = formatHumanReadableDate(feed.last_modified)
                return (
                  <article
                    key={feed.id}
                    className="sitemap-feed-card"
                    onClick={() => handleSelect(feed)}
                  >
                    <div className="sitemap-feed-card__url">
                      {(() => {
                        try {
                          const parsed = new URL(feed.feed_url)
                          const prefixString = `${parsed.origin}/`
                          const suffix = parsed.pathname.replace(/^\/+/, "") || "/"
                          return (
                            <>
                              <span className="sitemap-feed-card__url-prefix">{prefixString}</span>
                              <span className="sitemap-feed-card__url-suffix">{suffix}</span>
                            </>
                          )
                        } catch {
                          return (
                            <>
                              <span className="sitemap-feed-card__url-prefix">{feed.feed_url}</span>
                            </>
                          )
                        }
                      })()}
                    </div>
                    <div className="sitemap-feed-card__summary">
                      {formattedLastModified && <span>Last updated {formattedLastModified}</span>}
                    </div>
                    <div className="sitemap-feed-card__meta">
                      <span className="sitemap-feed-card__tracking-label">
                        {(() => {
                          const tracked = feed.tracked_page_count ?? 0
                          const total = feed.all_page_count ?? tracked
                          if (total && tracked === total) {
                            return `Tracking all ${total} pages`
                          }
                          return `Tracking ${tracked} / ${total} pages`
                        })()}
                      </span>
                      <div className="sitemap-feed-card__status-group">
                        {process.env.NODE_ENV !== "production" &&
                          feed.tracked === null &&
                          (console.log(
                            `[sitemap-feed-card] feed ${feed.id} rendered in mixed state`,
                            feed
                          ),
                          null)}
                        <span
                          className={`status-chip ${
                            feed.tracked === null
                              ? "status-chip--partial"
                              : feed.tracked
                              ? "status-chip--active"
                              : "status-chip--inactive"
                          }`}
                        >
                          {feed.tracked === null ? "Partial" : feed.tracked ? "Tracked" : "Hidden"}
                        </span>
                        <button
                          type="button"
                          className={`sitemap-feed-card__track-toggle${
                            feed.tracked === null
                              ? " is-indeterminate"
                              : feed.tracked
                              ? " is-tracked"
                              : ""
                          }`}
                          onClick={(event) => handleToggle(event, feed)}
                          aria-pressed={
                            feed.tracked === null ? "mixed" : feed.tracked ? "true" : "false"
                          }
                          aria-label={
                            feed.tracked === null
                              ? `Partially tracked feed ${feed.feed_url}`
                              : feed.tracked
                              ? `Hide feed ${feed.feed_url}`
                              : `Track feed ${feed.feed_url}`
                          }
                        />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!loading && !error && feeds.length > 0 && filteredFeeds.length === 0 && (
            <div className="sitemap-feeds-table__empty">No feeds match that filter.</div>
          )}
        </div>
      </div>
      <ConfirmAction
        visible={Boolean(pendingFeedToggle)}
        title="Toggle entire feed?"
        message={
          pendingFeedToggle
            ? `This will ${pendingFeedToggle.tracked ? "track" : "hide"} every page from ${
                pendingFeedToggle.feed.feed_url
              }.`
            : ""
        }
        confirmLabel="Apply"
        cancelLabel="Cancel"
        onConfirm={handleConfirmToggle}
        onCancel={handleCancelToggle}
      />
      <style>{`
        .sitemap-feeds-table__shell {
          border-radius: 16px;
          width: 100%;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .sitemap-feeds-table__header {
          padding: 16px 20px 12px;
          border-bottom: 1px solid #edf2f7;
        }

        .sitemap-feeds-table__header h3 {
          margin: 0;
          font-size: 15px;
        }

        .sitemap-feeds-table__content {
          padding: 12px 16px 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }

        .sitemap-feeds-table__list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sitemap-feeds-table__empty {
          font-size: 13px;
          color: #475467;
        }
      `}</style>
    </div>
  )
}
