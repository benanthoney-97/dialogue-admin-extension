import React, { useEffect, useMemo, useState } from "react"
import { formatHumanReadableDate } from "../../utils/format-date"

export interface SitemapPage {
  id: number
  feed_id: number
  page_url: string
  tracked?: boolean
  status?: string
  last_modified?: string
}

export interface SitemapPagesTableProps {
  feedId?: number
  filter?: string
  onPageToggle?: (pageId: number, tracked: boolean) => void
}

const renderPageUrl = (url: string) => {
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

export function SitemapPagesTable({ feedId, filter = "", onPageToggle }: SitemapPagesTableProps) {
  const [pages, setPages] = useState<SitemapPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handlePageToggleClick = (page: SitemapPage) => {
    console.log(
      `[sitemap-page-card] toggling page ${page.id} (${page.page_url}) tracked=${page.tracked}`
    )
    onPageToggle?.(page.id, !page.tracked)
    setPages((prev) =>
      prev.map((item) =>
        item.id === page.id ? { ...item, tracked: !item.tracked } : item
      )
    )
  }

  useEffect(() => {
    if (!onPageToggle && process.env.NODE_ENV !== "production") {
      console.warn("[sitemap-page-card] toggle handler missing; page cards will not respond to track/hide actions.")
    }
  }, [onPageToggle])

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

  const normalizedFilter = (filter || "").trim().toLowerCase()
  const filteredPages = useMemo(() => {
    if (!normalizedFilter) return pages
    return pages.filter((page) =>
      (page.page_url || "").toLowerCase().includes(normalizedFilter)
    )
  }, [normalizedFilter, pages])

  return (
    <div className="sitemap-pages-table">
      <div className="sitemap-pages-table__shell">
        <div className="sitemap-pages-table__header" />
        <div className="sitemap-pages-table__content">
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
              {filteredPages.map((page) => {
                const formattedLastModified = formatHumanReadableDate(page.last_modified)
                return (
                  <article key={page.id} className="sitemap-feed-card">
                    <div className="sitemap-feed-card__url">{renderPageUrl(page.page_url)}</div>
                    <div className="sitemap-feed-card__summary">
                      <span>{formattedLastModified ?? "No date available"}</span>
                    </div>
                    <div className="sitemap-feed-card__meta sitemap-feed-card__meta--page">
                      <span className="sitemap-feed-card__processed-label">
                        {page.processed ? page.processed : "not processed"}
                      </span>
                      <div className="sitemap-feed-card__status-group sitemap-feed-card__status-group--page">
                        <span
                          className={`status-chip ${
                            page.tracked ? "status-chip--active" : "status-chip--inactive"
                          }`}
                        >
                          {page.tracked ? "Tracked" : "Hidden"}
                        </span>
                        <button
                          type="button"
                          className={`sitemap-feed-card__track-toggle${page.tracked ? " is-tracked" : ""}`}
                          onClick={() => handlePageToggleClick(page)}
                          aria-pressed={page.tracked}
                          aria-label={
                            page.tracked
                              ? `Hide page ${page.page_url}`
                              : `Track page ${page.page_url}`
                          }
                        />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .sitemap-pages-table__content {
          padding: 12px 16px 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
        }

        .sitemap-pages-table__list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sitemap-pages-table__empty {
          font-size: 13px;
          color: #475467;
        }
      `}</style>
    </div>
  )
}
