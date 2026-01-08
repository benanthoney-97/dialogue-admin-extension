import React, { useEffect, useState } from "react"

export interface PageSummaryProps {
  pageUrl: string
  providerId: number
  onMatchSelect?: (matchId: number) => void
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
}: PageSummaryProps) {
  const [matches, setMatches] = useState<PageMatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        const normalized = Array.isArray(data) ? data : []
        normalized.sort((a, b) => a.page_match_id - b.page_match_id)
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[page-summary] received matches ids",
            normalized.map((match) => match.page_match_id)
          )
        }
        setMatches(normalized)
      })
      .catch((err) => {
        if (canceled) return
        console.error("[page-summary] match fetch error", err)
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
  }, [pageUrl, backendBase, providerId])

  const matchesCount = matches.length
  const showingMatchesCount = matches.filter((match) => match.status !== "inactive").length
  const documentIds = matches
    .filter((match) => match.document_id != null)
    .map((match) => match.document_id)
  const uniqueDocumentIds = new Set(documentIds)
  const videosCount = uniqueDocumentIds.size
  useEffect(() => {
    if (!matches.length) return
    const missingImages = matches.filter((match) => !match.cover_image_url)
    console.debug("[page-summary] match images", {
      totalMatches: matches.length,
      matchesWithImages: matches.length - missingImages.length,
      missingImages,
    })
  }, [matches])
  if (matchesCount && documentIds.length === 0) {
    console.warn("[page-summary] matches retrieved without document_id; cannot derive videos count", {
      pageUrl,
      matchesCount,
    })
  } else {
    console.debug("[page-summary] video count derivation details", {
      matchesCount,
      documentIdsCount: documentIds.length,
      uniqueVideoDocuments: uniqueDocumentIds.size,
    })
  }

  const pageTracked: boolean | null = matches.length ? matches[0].tracked ?? null : null

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
  "Perfect Match": "#D1FAE5",
  "Good Match": "#ECFDF5",
  "Potential Match": "#F1F5F9",
};

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
  const background =
    (label && tierBackgroundMap[label.trim()]) ||
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
    console.debug("[page-summary] hover message", message)
    chrome.runtime.sendMessage(message)
  }

  return (
    <div className="page-summary">
      <div className="page-summary__summary">
        <div className="page-summary__header-row">
          <div className="page-summary__header">
            <strong>Page summary</strong>
            {pageTracked !== null && (
              <span
                className={`page-summary__tracked-chip ${
                  pageTracked ? "page-summary__tracked-chip--active" : "page-summary__tracked-chip--inactive"
                }`}
              >
                {pageTracked ? "Tracked" : "Not tracked"}
              </span>
            )}
          </div>
          <div className="page-summary__url">
            <div title={pageUrl}>{formatPagePath(pageUrl)}</div>
          </div>
        </div>
        <div className="page-summary__overview-row">
          <div className="page-summary__overview-card">
            <strong>{matchesCount}</strong>
            <span>Matches</span>
          </div>
          <div className="page-summary__overview-card">
            <strong>{showingMatchesCount}</strong>
            <span>Showing</span>
          </div>
          <div className="page-summary__overview-card">
            <strong>{videosCount}</strong>
            <span>Videos</span>
          </div>
        </div>
        <div className="page-summary__matches-header">
          <div>Matches</div>
          {error && <span className="page-summary__matches-error">{error}</span>}
        </div>
      </div>
        {loading && <div className="page-summary__matches-state">Loading matches…</div>}
        {!loading && !matches.length && !error && (
          <div className="page-summary__matches-state">No matches for this page yet.</div>
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
                  <span
                    className="page-summary__match-pill"
                    style={pillStyle(match.confidence_label, match.confidence_color)}
                  >
                    {formatMatchLabel(match)}
                  </span>
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
        }
        .page-summary__summary {
          position: sticky;
          top: 0;
          background: #ffffff;
          z-index: 2;
          padding-top: 0;
          padding-bottom: 0px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .page-summary__header-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .page-summary__header {
          font-size: 12px;
          letter-spacing: 0.1em;
          color: #6b7280;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .page-summary__tracked-chip {
          margin-left: 12px;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .page-summary__tracked-chip--active {
          background: rgba(34, 197, 94, 0.16);
          color: #15803d;
          border: 1px solid rgba(34, 197, 94, 0.4);
        }
        .page-summary__tracked-chip--inactive {
          background: rgba(248, 113, 113, 0.16);
          color: #b91c1c;
          border: 1px solid rgba(248, 113, 113, 0.35);
        }
        .page-summary__url {
          font-size: 12px;
          color: #475467;
          margin-bottom: 14px;
        }
        .page-summary__url div {
          font-size: 12px;
          color: #0f172a;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
          white-space: normal;
        }
        .page-summary__matches {
          padding-top: 0;
        }
        .page-summary__matches-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #475467;
          margin-bottom: 6px;
          font-weight: 600;
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
        .page-summary__match-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
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
          padding: 12px 0;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .page-summary__overview-card strong {
          font-size: 22px;
          color: #0f172a;
        }
        .page-summary__overview-card span {
          font-size: 11px;
          color: #475467;
          letter-spacing: 0.08em;
        }
        .page-summary__match-card {
          padding: 16px;
          border-radius: 16px;
          background: #ffffff;
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
      `}</style>
    </div>
  )
}
