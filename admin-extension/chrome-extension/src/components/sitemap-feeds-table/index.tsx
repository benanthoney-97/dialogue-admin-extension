import React, { useEffect, useState } from "react"

export interface SitemapFeed {
  id: number
  provider_id: number
  feed_url: string
  last_modified?: string
  tracked?: boolean
}

export interface SitemapFeedsTableProps {
  providerId?: number
  onFeedSelect?: (feed: SitemapFeed) => void
}

const DEFAULT_PROVIDER_ID = 12

export function SitemapFeedsTable({
  providerId = DEFAULT_PROVIDER_ID,
  onFeedSelect,
}: SitemapFeedsTableProps) {
  const [feeds, setFeeds] = useState<SitemapFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE = (window as any).__SL_BACKEND_URL || "http://localhost:4173"
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/sitemap-feeds?provider_id=${providerId}`
    if (process.env.NODE_ENV !== "production") {
      console.log("[sitemap-feeds-table] fetching feeds from", endpoint)
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

  const handleSelect = (feed: SitemapFeed) => {
    if (!onFeedSelect) return
    onFeedSelect(feed)
  }

  return (
    <div className="sitemap-feeds-table">
      <div className="sitemap-feeds-table__shell">
        <div className="sitemap-feeds-table__header">
          <div>
            <h3>Sitemap feeds</h3>
            <p>Manage which feeds are available for matching.</p>
          </div>
        </div>
        <div className="sitemap-feeds-table__content">
          {loading && <div className="sitemap-feeds-table__empty">Loading feeds…</div>}
          {error && <div className="sitemap-feeds-table__empty">Error: {error}</div>}
          {!loading && !error && feeds.length === 0 && (
            <div className="sitemap-feeds-table__empty">No sitemap feeds configured.</div>
          )}
          {!loading && !error && feeds.length > 0 && (
            <div className="sitemap-feeds-table__list">
              {feeds.map((feed) => (
                <article
                  key={feed.id}
                  className="sitemap-feed-card"
                  onClick={() => handleSelect(feed)}
                >
                  <div className="sitemap-feed-card__url">{feed.feed_url}</div>
                  <div className="sitemap-feed-card__meta">
                    <span>
                      {feed.last_modified
                        ? new Date(feed.last_modified).toLocaleString()
                        : "Not published yet"}
                    </span>
                    <span
                      className={`status-chip ${
                        feed.tracked ? "status-chip--active" : "status-chip--inactive"
                      }`}
                    >
                      {feed.tracked ? "Tracked" : "Hidden"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .sitemap-feeds-table__shell {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
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

        .sitemap-feed-card {
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }

        .sitemap-feed-card:hover {
          border-color: #94a3b8;
          transform: translateY(-1px);
        }

        .sitemap-feed-card__url {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 6px;
          color: #0f172a;
        }

        .sitemap-feed-card__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #475467;
        }

        .status-chip {
          padding: 2px 10px;
          border-radius: 999px;
          background: #e2e8f0;
          font-size: 11px;
          font-weight: 600;
          color: #1e293b;
        }

        .status-chip--active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-chip--inactive {
          background: #fee2e2;
          color: #b91c1c;
        }

        .sitemap-feeds-table__empty {
          font-size: 13px;
          color: #475467;
        }
      `}</style>
    </div>
  )
}
