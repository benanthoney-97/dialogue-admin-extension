import React, { useEffect, useMemo, useState } from "react"

export interface SitemapPage {
  id: number
  feed_id: number
  page_url: string
  tracked?: boolean
  status?: string
  created_at?: string
}

export interface SitemapPagesTableProps {
  feedId?: number
}

export function SitemapPagesTable({ feedId }: SitemapPagesTableProps) {
  const [pages, setPages] = useState<SitemapPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    if (!feedId) {
      setPages([])
      return
    }
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE = (window as any).__SL_BACKEND_URL || "http://localhost:4173"
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/sitemap-pages?feed_id=${feedId}`
    if (process.env.NODE_ENV !== "production") {
      console.log("[sitemap-pages-table] fetching pages from", endpoint)
    }
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load sitemap pages (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (canceled) return
        if (!Array.isArray(data)) {
          throw new Error("Unexpected sitemap pages payload")
        }
        setPages(data)
      })
      .catch((err) => {
        if (canceled) return
        console.error("[sitemap-pages-table] fetch error", err)
        setError(err?.message ?? "Unable to load sitemap pages")
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false)
        }
      })
    return () => {
      canceled = true
    }
  }, [feedId])

  const normalizedFilter = filter.trim().toLowerCase()
  const filteredPages = useMemo(() => {
    if (!normalizedFilter) return pages
    return pages.filter((page) =>
      (page.page_url || "").toLowerCase().includes(normalizedFilter)
    )
  }, [normalizedFilter, pages])

  return (
    <div className="sitemap-pages-table">
      <div className="sitemap-pages-table__shell">
        <div className="sitemap-pages-table__header">
          <div>
            <h3>Sitemap pages</h3>
            {feedId ? (
              <p>Tracks every page inside the currently selected feed.</p>
            ) : (
              <p>Select a feed to see its tracked pages.</p>
            )}
          </div>
        </div>
        <div className="sitemap-pages-table__content">
          <div className="sitemap-pages-table__actions">
            <input
              type="search"
              placeholder="Filter by URL"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              disabled={!feedId}
            />
          </div>
          {!feedId && (
            <div className="sitemap-pages-table__empty">
              Choose a feed to start viewing pages.
            </div>
          )}
          {feedId && loading && (
            <div className="sitemap-pages-table__empty">Loading pages…</div>
          )}
          {feedId && error && (
            <div className="sitemap-pages-table__empty">Error: {error}</div>
          )}
          {feedId && !loading && !error && filteredPages.length === 0 && (
            <div className="sitemap-pages-table__empty">No pages found.</div>
          )}
          {feedId && !loading && !error && filteredPages.length > 0 && (
            <div className="sitemap-pages-table__list">
              {filteredPages.map((page) => (
                <article key={page.id} className="sitemap-page-card">
                  <div className="sitemap-page-card__url">{page.page_url}</div>
                  <div className="sitemap-page-card__meta">
                    <span className="sitemap-page-card__status">{page.status || "pending"}</span>
                    <span
                      className={`status-chip ${
                        page.tracked ? "status-chip--active" : "status-chip--inactive"
                      }`}
                    >
                      {page.tracked ? "Tracked" : "Hidden"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .sitemap-pages-table__actions {
          padding: 12px 0;
        }

        .sitemap-pages-table__actions input {
          width: 100%;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          padding: 8px 14px;
          font-size: 13px;
          font-family: inherit;
        }

        .sitemap-pages-table__list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sitemap-page-card {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sitemap-page-card__url {
          font-size: 13px;
          color: #0f172a;
          font-weight: 600;
        }

        .sitemap-page-card__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #475467;
        }

        .sitemap-page-card__status {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #475467;
        }

        .sitemap-pages-table__empty {
          font-size: 13px;
          color: #475467;
        }
      `}</style>
    </div>
  )
}
