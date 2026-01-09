import React, { useEffect, useMemo, useState } from "react"
import type { SitemapFeed } from "../sitemap-feeds-table"
import { formatHumanReadableDate } from "../../utils/format-date"

export interface SitemapPage {
  id: number
  feed_id: number
  page_url: string
  tracked?: boolean
  status?: string
  last_modified?: string
  processed?: string | null
}

export interface SitemapPagesTableProps {
  feedId?: number
  feed?: SitemapFeed
  filter?: string
  onPageToggle?: (pageId: number, tracked: boolean) => void
  onViewPage?: (pageUrl: string, feed: SitemapFeed) => void
}

const renderPageUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    const suffix = `${parsed.pathname}${parsed.search || ""}${parsed.hash || ""}`
    const trimmed = suffix.replace(/^\/+/, "") || "/"
    return <span className="sitemap-feed-card__url-unique">{trimmed}</span>
  } catch {
    return <span className="sitemap-feed-card__url-unique">{url}</span>
  }
}

export function SitemapPagesTable({ feedId, feed, filter = "", onPageToggle, onViewPage }: SitemapPagesTableProps) {
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

  const openPageInTab = (url: string) => {
    chrome.tabs?.query?.({ active: true, lastFocusedWindow: true }, (tabs) => {
      const target = tabs?.[0]
      if (target?.id) {
        chrome.tabs?.update?.(target.id, { url })
      }
    })
  }

  const handleViewPageClick = (event: React.MouseEvent, page: SitemapPage) => {
    event.stopPropagation()
    openPageInTab(page.page_url)
    if (feed) {
      onViewPage?.(page.page_url, feed)
    }
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
                <div
                  className="sitemap-feed-card__url-row"
                  onClick={(event) => handleViewPageClick(event, page)}
                >
                  <div className="sitemap-feed-card__url">{renderPageUrl(page.page_url)}</div>
                  <button
                    type="button"
                    className="sitemap-feed-card__open-page sitemap-feed-card__open-page--after"
                    aria-label="View page"
                    onClick={(event) => handleViewPageClick(event, page)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M7.364 3.5a.5.5 0 0 1 .5-.5H14.5A1.5 1.5 0 0 1 16 4.5v10a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 14.5V7.864a.5.5 0 1 1 1 0V14.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5H7.864a.5.5 0 0 1-.5-.5"/>
                      <path fillRule="evenodd" d="M0 .5A.5.5 0 0 1 .5 0h5a.5.5 0 0 1 0 1H1.707l8.147 8.146a.5.5 0 0 1-.708.708L1 1.707V5.5a.5.5 0 0 1-1 0z"/>
                    </svg>
                  </button>
                </div>
                <div className="sitemap-feed-card__summary">
                  <span>
                    {formattedLastModified ? `Updated ${formattedLastModified}` : "No date available"}
                  </span>
                    </div>
                    <div className="sitemap-feed-card__meta sitemap-feed-card__meta--page">
                      <div className="sitemap-feed-card__status-group sitemap-feed-card__status-group--page">
                        <span
                          className={`status-chip ${
                            page.tracked ? "status-chip--active" : "status-chip--inactive"
                          }`}
                        >
                          {page.tracked ? "Live" : "Inactive"}
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
        .sitemap-pages-table {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .sitemap-pages-table__shell {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

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
        .sitemap-feed-card {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 12px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .sitemap-feed-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
        }

        .sitemap-feed-card__url-unique {
          font-size: 14px;
          color: #0f172a;
          font-weight: 600;
          word-break: break-word;
        }
        .sitemap-feed-card__url-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sitemap-feed-card__url {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sitemap-feed-card__open-page {
          width: 24px;
          height: 24px;
          padding: 0;
          border: none;
          background: transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          transition: none;
          line-height: 0;
        }
        .sitemap-feed-card__open-page svg {
          width: 12px;
          height: 12px;
          display: block;
        }
        .sitemap-feed-card__open-page:hover,
        .sitemap-feed-card__open-page:focus-visible {
          background: transparent;
        }

        .sitemap-feed-card__meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .sitemap-feed-card__status-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-chip {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }

        .status-chip--active {
          color: #15803d;
        }

        .status-chip--inactive {
          color: #dc2626;
        }

        .sitemap-feed-card__track-toggle {
          width: 36px;
          height: 24px;
          border-radius: 999px;
          border: none;
          background: #e5e7eb;
          cursor: pointer;
          position: relative;
        }

        .sitemap-feed-card__track-toggle::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 4px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2);
          transform: translate(0, -50%);
        }

        .sitemap-feed-card__track-toggle.is-indeterminate {
          background: #f59e0b;
          border-color: transparent;
        }

        .sitemap-feed-card__open-page:hover {
          transform: translateY(-1px);
          opacity: 0.75;
        }

        .sitemap-feed-card__track-toggle.is-tracked::after {
          transform: translate(12px, -50%);
        }
      `}</style>
    </div>
  )
}
