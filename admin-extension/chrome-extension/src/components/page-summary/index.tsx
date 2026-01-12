import React, { useEffect, useState } from "react"
import { ConfidenceChip } from "../confidence-chip"

export interface PageSummaryProps {
  pageUrl: string
  providerId: number
  onMatchSelect?: (matchId: number) => void
  showBackToList?: boolean
  onReturnToSitemap?: () => void
  onRefresh?: () => void
}

interface PageMatchSummary {
  page_match_id: number
  phrase: string
  document_title?: string
  confidence?: number
  status?: string
  document_id?: number
  cover_image_url?: string
  confidence_label?: string
  confidence_color?: string
  tracked?: boolean | null
}

export function PageSummary({
  pageUrl,
  providerId,
  onMatchSelect,
  showBackToList,
  onReturnToSitemap,
  onRefresh,
}: PageSummaryProps) { 
  const [matches, setMatches] = useState<PageMatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageSupported, setPageSupported] = useState(true)
  const [pageTracked, setPageTracked] = useState<boolean | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const backendBase = (window as any).__SL_BACKEND_URL || "http://localhost:4173"

  useEffect(() => {
    if (!pageUrl) {
      setMatches([])
      setError(null)
      return
    }

    let canceled = false
    setLoading(true)
    setError(null)

    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/page-matches?provider_id=${providerId}&page_url=${encodeURIComponent(
      pageUrl
    )}`


    fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load matches (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (canceled) return
        const payload =
          Array.isArray(data) || !data
            ? {
                matches: Array.isArray(data) ? data : [],
                page_supported: typeof data?.page_supported === "boolean" ? data.page_supported : true,
                tracked:
                  typeof data?.tracked === "boolean"
                    ? data.tracked
                    : Array.isArray(data) && data.length
                    ? data[0]?.tracked ?? null
                    : null,
              }
            : data
        const normalized = Array.isArray(payload.matches) ? payload.matches : []
        normalized.sort((a, b) => a.page_match_id - b.page_match_id)
        if (process.env.NODE_ENV !== "production") {

        }
        setPageSupported(Boolean(payload.page_supported))
        const resolvedTracked = payload.tracked ?? null

        setPageTracked(resolvedTracked)
        setMatches(normalized)
      })
      .catch((err) => {
        if (canceled) return
        setError(err?.message ?? "Unable to load matches")
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false)
        }
      })

    return () => {
      canceled = true
    }
  }, [pageUrl, backendBase, providerId, refreshKey])

  const matchesCount = matches.length
  const documentIds = matches
    .filter((match) => match.document_id != null)
    .map((match) => match.document_id)
  const uniqueDocumentIds = new Set(documentIds)
  const videosCount = uniqueDocumentIds.size
  const statusText =
    pageTracked === null ? "Unknown" : pageTracked ? "Live" : "Inactive"
  const statusClass =
    pageTracked === null
      ? "page-summary__status-unknown"
      : pageTracked
      ? "page-summary__status-showing"
      : "page-summary__status-hidden"
  useEffect(() => {
    if (!matches.length) return
    const missingImages = matches.filter((match) => !match.cover_image_url)

  }, [matches])
  if (matchesCount && documentIds.length === 0) {

  } else {

  }


  const previewPhrase = (phrase: string) => {
    const words = (phrase || "").trim().split(/\s+/)
    if (words.length <= 14) return phrase
    return words.slice(0, 14).join(" ") + "…"
  }

const formatConfidence = (value?: number) => {
  if (typeof value !== "number") return "—"
  return `${Math.round(value * 100)}%`
}

const formatPagePath = (value: string) => {
  if (!value) return ""
  try {
    const parsed = new URL(value)
    let pathname = parsed.pathname || "/"
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.replace(/\/+$/, "")
    }
    const segments = pathname.split("/").filter((segment) => segment.length > 0)
    const search = parsed.search || ""
    if (segments.length <= 1) {
      return `${pathname}${search}`
    }
    return `${segments.join("/")}${search}`
  } catch {
    return value
  }
}

const formatTitleFromPath = (path: string) => {
  const normalized = path.replace(/^\/+|\/+$/g, "")
  if (!normalized) return "Home"
  const segments = normalized.split("/").filter((segment) => segment.length > 0)
  const target = segments[segments.length - 1] || ""
  const words = target
    .split(/[-_]+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  if (!words.length) {
    return segments
      .map((segment) =>
        segment
          .split(/[-_]+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ")
      )
      .join(" / ")
  }
  return words.join(" ")
}

const parseHexColor = (value?: string) => {
  if (!value) return null
  let hex = value.trim()
  if (hex.startsWith("#")) {
    hex = hex.slice(1)
  }
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("")
  }
  if (hex.length !== 6) return null
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some((value) => Number.isNaN(value))) return null
  return { r, g, b }
}

const tierBackgroundMap: Record<string, string> = {
  "Great Match": "#ede9fe",
  "Good Match": "#dcfce7",
  "Potential Match": "#f1f5f9",
};

const tierColorMap: Record<
  string,
  { color: string; borderColor: string }
> = {
  "Great Match": { color: "#7c3aed", borderColor: "rgba(124,58,237,0.35)" },
  "Good Match": { color: "#166534", borderColor: "rgba(16,185,129,0.55)" },
  "Potential Match": { color: "#334155", borderColor: "rgba(15,23,42,0.35)" },
}

const rgbaFromHex = (value?: string, alpha = 0.12) => {
  const rgb = parseHexColor(value)
  if (!rgb) return null
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

const formatMatchLabel = (match: PageMatchSummary) => {
  const label = match.confidence_label?.trim()
  if (label) return label
  const formatted = formatConfidence(match.confidence)
  return formatted === "—" ? "Match" : `${formatted} match`
}

const pillStyle = (label?: string, color?: string) => {
  const defaultText = "#047857"
  const textColor = color || defaultText
  const normalizedLabel = label?.trim()

  if (normalizedLabel && tierColorMap[normalizedLabel]) {
    return {
      color: tierColorMap[normalizedLabel].color,
      background: tierBackgroundMap[normalizedLabel] || "#f0fdf4",
      borderColor: tierColorMap[normalizedLabel].borderColor,
    }
  }

  const background =
    (normalizedLabel && tierBackgroundMap[normalizedLabel]) ||
    rgbaFromHex(color, 0.12) ||
    "rgba(4, 120, 87, 0.08)"
  const borderColor =
    rgbaFromHex(color, 0.35) || "rgba(4, 120, 87, 0.35)"
  return { color: textColor, background, borderColor }
}

  const sendHoverMessage = (match: PageMatchSummary, hovered: boolean) => {
    if (!match?.page_match_id) return
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return
    const message = {
      action: "setMatchHover",
      page_match_id: match.page_match_id,
      hovered,
    }
    chrome.runtime.sendMessage(message)
  }

  return (
    <div className="page-summary">
      <div className="page-summary__summary">
        {showBackToList && onReturnToSitemap && (
          <button className="page-summary__breadcrumb" onClick={onReturnToSitemap}>
            Back to list
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="page-summary__breadcrumb-icon" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/>
            </svg>
          </button>
        )}
        {pageSupported && (
          <>
            <div className="page-summary__header-row">
              <div className="page-summary__header">
                <div className="page-summary__header-title">
                  {formatTitleFromPath(formatPagePath(pageUrl))}
                </div>
                <div className="page-summary__header-chips">
                  {!pageSupported && (
                    <span className="page-summary__unsupported-chip">
                      Unsupported page
                    </span>
                  )}
                </div>
              </div>
          <button
            type="button"
            className="page-summary__refresh"
            aria-label="Refresh matches"
            onClick={() => {
              onRefresh?.()
              setRefreshKey((prev) => prev + 1)
            }}
          >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path
                    fillRule="evenodd"
                    d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"
                  />
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
                </svg>
              </button>
            </div>
            <div className="page-summary__full-url" title={pageUrl}>
              {formatPagePath(pageUrl)}
            </div>
          </>
        )}
        {pageSupported && (
          <div className="page-summary__overview-row">
            <div
              className={`page-summary__overview-card page-summary__overview-card--status ${statusClass}`}
            >
              <strong className={statusClass}>{statusText}</strong>
              <span className={`page-summary__overview-label ${statusClass}`}>Status</span>
            </div>
            <div className="page-summary__overview-card">
              <strong>{matchesCount}</strong>
              <span className="page-summary__overview-label">Matches</span>
            </div>
            <div className="page-summary__overview-card">
              <strong>{videosCount}</strong>
              <span className="page-summary__overview-label">Videos</span>
            </div>
          </div>
        )}
        <div className="page-summary__matches-header">
          <div>Matches</div>
          {error && <span className="page-summary__matches-error">{error}</span>}
        </div>
      </div>
        {loading && <div className="page-summary__matches-state">Loading matches…</div>}
        {!loading && !matches.length && !error && pageSupported && (
          <div className="page-summary__matches-state">No matches for this page yet.</div>
        )}
        {!pageSupported && (
          <div className="page-summary__unsupported-state">
            <p>
              This page is outside your registered site. The summary will update once you return
              to a supported URL.
            </p>
            <button
              type="button"
              className="page-summary__button"
              onClick={() => setRefreshKey((prev) => prev + 1)}
            >
              Check again
            </button>
          </div>
        )}
        <div className="page-summary__match-list">
          {matches.map((match) => (
            <article
              key={match.page_match_id}
              className="page-summary__match-card"
              role="button"
              tabIndex={0}
              aria-label="Open match decision card"
              onClick={() => onMatchSelect?.(match.page_match_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onMatchSelect?.(match.page_match_id)
                }
              }}
            onMouseEnter={() => sendHoverMessage(match, true)}
            onMouseLeave={() => sendHoverMessage(match, false)}
            onFocus={() => sendHoverMessage(match, true)}
            onBlur={() => sendHoverMessage(match, false)}
          >
              <div className="page-summary__match-title">
                <p className="page-summary__match-phrase">{previewPhrase(match.phrase)}</p>
              </div>
                <div className="page-summary__match-row">
                  <div className="page-summary__match-arrow" aria-hidden="true">
                    <span>▼</span>
                  </div>
                <ConfidenceChip
                  className="page-summary__match-pill"
                  label={match.confidence_label}
                  color={match.confidence_color}
                  text={formatMatchLabel(match)}
                />
                </div>
              <div className="page-summary__match-video">
                <div className="page-summary__match-video-thumb">
                  {match.cover_image_url ? (
                    <img src={match.cover_image_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="page-summary__match-video-placeholder">▶</span>
                  )}
                </div>
                <div className="page-summary__match-video-details">
                  <span className="page-summary__match-video-title">
                    {match.document_title || "Untitled video"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      <style>{`
        .page-summary {
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 12px;
          background: #f6f7fb;
          color: #0f172a;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        .page-summary__summary {
          position: sticky;
          top: 0;
          background: #f6f7fb;
          z-index: 2;
          padding-top: 0;
          padding-bottom: 0px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .page-summary__breadcrumb {
          align-self: flex-end;
          border: none;
          background: transparent;
          color: #0f172a;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .page-summary__breadcrumb-icon {
          width: 16px;
          height: 16px;
        }
        .page-summary__header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .page-summary__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-summary__header-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          text-transform: none;
          letter-spacing: normal;
        }
        .page-summary__header-chips {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .page-summary__unsupported-chip {
          background: rgba(148, 163, 184, 0.16);
          color: #475467;
          border: 1px solid rgba(148, 163, 184, 0.4);
          margin-left: 4px;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .page-summary__full-url {
          font-size: 10px;
          color: #475467;
          word-break: keep-all;
          white-space: normal;
          width: 100%;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          hyphens: none;
          overflow-wrap: normal;
          margin-top: -8px;
        }
        .page-summary__refresh {
          background: transparent;
          border: none;
          color: #0f172a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
        }
        .page-summary__refresh svg {
          width: 18px;
          height: 18px;
        }
        .page-summary__matches {
          padding-top: 0;
        }
        .page-summary__matches-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #0f172a;
          margin-bottom: 6px;
          font-weight: 600;
          letter-spacing: normal;
          text-transform: none;
        }
        .page-summary__matches-error {
          color: #e11d48;
          font-size: 11px;
        }
        .page-summary__matches-state {
          font-size: 12px;
          color: #475467;
          margin-bottom: 8px;
        }
        .page-summary__unsupported-state {
          padding: 12px;
          border-radius: 12px;
          background: #fef3c7;
          color: #92400e;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid rgba(113, 63, 18, 0.35);
        }
        .page-summary__button {
          align-self: flex-start;
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          background: #6366f1;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .page-summary__match-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
          min-height: 0;
        }
        .page-summary__overview-row {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }
        .page-summary__overview-card {
          flex: 1;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 8px 0;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-height: 72px;
          justify-content: center;
        }
        .page-summary__overview-card--status {
          justify-content: center;
          position: relative;
        }
        .page-summary__overview-card strong {
          font-size: 18px;
          color: #0f172a;
        }
        .page-summary__overview-card--status strong.page-summary__status-showing {
          color: #15803d;
        }
        .page-summary__overview-card--status strong.page-summary__status-hidden {
          color: #dc2626;
        }
        .page-summary__overview-label {
          font-size: 11px;
          color: #475467;
          letter-spacing: 0.08em;
          text-transform: none;
          margin-top: 0;
        }
        .page-summary__status-showing {
          color: #15803d;
        }
        .page-summary__status-hidden {
          color: #dc2626;
        }
        .page-summary__status-unknown {
          color: #475467;
        }
        .page-summary__overview-card--status.page-summary__status-showing {
          background: #ecfdf5;
          border-color: rgba(34, 197, 94, 0.4);
        }
        .page-summary__overview-card--status.page-summary__status-hidden {
          background: #fef2f2;
          border-color: rgba(220, 38, 38, 0.35);
        }
        .page-summary__overview-card--status.page-summary__status-unknown {
          background: #f3f4f6;
          border-color: rgba(148, 163, 184, 0.35);
        }
        .page-summary__overview-card--status strong {
          font-size: 14px;
        }
        .page-summary__match-card {
          padding: 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e2e8f0;
          transition: border-color 0.2s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .page-summary__match-card:hover {
          border-color: #94a3b8;
        }
        .page-summary__match-phrase {
          margin: 0;
          font-weight: 600;
          font-size: 12px;
          color: #0f172a;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-summary__match-title {
          padding-right: 4px;
        }
        .page-summary__match-row {
          position: relative;
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }
        .page-summary__match-pill {
          font-size: 10px;
          font-weight: 600;
          border-radius: 999px;
          padding: 0 10px;
          white-space: nowrap;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 20px;
          margin-left: 18px;
          border: 1px solid transparent;
        }
        .page-summary__match-arrow {
          text-align: center;
          color: #9ca3af;
          font-size: 18px;
          line-height: 1;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }
        .page-summary__match-video {
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 12px;
          padding: 10px;
          background: #f4f6fb;
        }
        .page-summary__match-video-thumb {
          width: 64px;
          height: 44px;
          border-radius: 10px;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .page-summary__match-video-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .page-summary__match-video-placeholder {
          font-size: 18px;
          color: #9ca3af;
        }
        .page-summary__match-video-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
        }
        .page-summary__match-video-title {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
        }
        .page-summary-panel {
          overflow: hidden;
        }
        .page-summary-panel .page-summary {
          transition: transform 0.35s ease, opacity 0.35s ease;
        }
        .page-summary-panel--animate .page-summary {
          animation: page-summary-slide-up 0.35s ease forwards;
        }
        @keyframes page-summary-slide-up {
          from {
            transform: translateY(24px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
