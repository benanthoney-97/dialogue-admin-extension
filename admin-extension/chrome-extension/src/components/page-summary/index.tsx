import React, { useEffect, useState } from "react"
import { ConfidenceChip } from "../confidence-chip"
import { HeaderCards } from "../header-cards"
import { MatchCard } from "../match-card"
import { InactivePage } from "./inactive-page"
import "./page-summary.css"

export interface PageSummaryProps {
  pageUrl: string
  providerId: number
  onMatchSelect?: (matchId: number, context?: string) => void
  showBackToList?: boolean
  onReturnToSitemap?: () => void
  onRefresh?: () => void
  onNewMatch?: () => void
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
  onNewMatch,
}: PageSummaryProps) { 
  const [matches, setMatches] = useState<PageMatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageSupported, setPageSupported] = useState(true)
  const [pageTracked, setPageTracked] = useState<boolean | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL;  

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
  "Great Match": "none",
  "Good Match": "none",
  "Match": "none",
};

const tierColorMap: Record<
  string,
  { color: string; borderColor: string }
> = {
  "Great Match": { color: "#7c3aed", borderColor: "rgba(124,58,237,0.35)" },
  "Good Match": { color: "#16a34a", borderColor: "#16a34a" },
  "Match": { color: "#334155", borderColor: "rgba(15,23,42,0.35)" },
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
  const defaultText = "#16a34a"
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
              <div className="page-summary__header-content">
                <div className="page-summary__header-title">
                  {formatTitleFromPath(formatPagePath(pageUrl))}
                </div>
                <div className="page-summary__header-path" title={pageUrl}>
                  <strong>Path:</strong> {formatPagePath(pageUrl)}
                </div>
                <div className="page-summary__header-chips">
                  {!pageSupported && (
                    <span className="page-summary__unsupported-chip">
                      Unsupported page
                    </span>
                  )}
                </div>
              </div>
              <div className="page-summary__new-match-container">
                <button
                  type="button"
                  className="page-summary__new-match"
                  onClick={() => {
                    console.log("[page-summary] new match button clicked")
                    if (onNewMatch) {
                      onNewMatch()
                    } else {
                      onRefresh?.()
                      setRefreshKey((prev) => prev + 1)
                    }
                  }}
                >
                  <span className="page-summary__new-match-icon" aria-hidden="true">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="bi bi-plus-lg"
                      viewBox="0 0 16 16"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"
                      />
                    </svg>
                  </span>
                  <span>New match</span>
                </button>
              </div>
            </div>
          </>
        )}
        {pageSupported && (
          <HeaderCards
            items={[
              {
                label: "Status",
                value: statusText,
                isStatus: true,
                statusClass,
              },
              {
                label: "Matches",
                value: matchesCount,
              },
              {
                label: "Videos",
                value: videosCount,
              },
            ]}
          />
        )}
        {pageSupported ? (
          <div className="page-summary__matches-section">
            <div className="page-summary__matches-header">
              <div>Matches</div>
              {error && <span className="page-summary__matches-error">{error}</span>}
            </div>
            {loading && <div className="page-summary__matches-state">Loading matches…</div>}
            {!loading && !matches.length && !error && (
              <div className="page-summary__matches-state">No matches for this page yet.</div>
            )}
            <div className="page-summary__match-list-wrapper">
              <div className="page-summary__match-list">
                {matches.map((match) => (
                  <MatchCard
                    key={match.page_match_id}
                    phrase={previewPhrase(match.phrase)}
                    coverImageUrl={match.cover_image_url}
                    documentTitle={match.document_title}
                    confidenceLabel={match.confidence_label}
                    confidenceColor={match.confidence_color}
                    pillText={formatMatchLabel(match)}
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
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="page-summary__inactive-wrapper">
            <InactivePage
              providerId={providerId}
              onRefresh={() => setRefreshKey((prev) => prev + 1)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
