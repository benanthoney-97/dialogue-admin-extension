import { useEffect, useMemo, useState } from "react"
import { HeaderCards } from "../header-cards"
import { MatchCard } from "../match-card"

export interface AnalyticsViewProps {
  providerId?: number | null
}

export function AnalyticsView({ providerId }: AnalyticsViewProps) {
  const [metrics, setMetrics] = useState<{
    total_impressions?: number
    total_plays?: number
    completion_rate?: number
    impressions_mom_pct?: number | string
    plays_mom_pct?: number | string
    completion_rate_mom_pct?: number | string
    best_performing_matches?: string | null
    top_5_most_played?: string | null
    top_5_most_completed?: string | null
  } | null>(null)
  const [topPlayedMatches, setTopPlayedMatches] = useState<
    {
      page_match_id: number
      count: number
      phrase?: string
      video_url?: string
      document_id?: number
      cover_image_url?: string
      documentTitle?: string | null
    }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL || ""
  const [resolvedProviderId, setResolvedProviderId] = useState<number | null>(providerId ?? null)

  const normalizeProviderId = (value: unknown) => {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? null : parsed
    }
    return null
  }

  useEffect(() => {
    setResolvedProviderId(providerId ?? null)
  }, [providerId])

  useEffect(() => {
    if (resolvedProviderId) return
    chrome.storage?.local?.get?.({ providerId: null }, (result) => {
      if (result?.providerId) {
        const normalized = normalizeProviderId(result.providerId)
        if (normalized) {
          setResolvedProviderId(normalized)
        }
      }
    })
  }, [resolvedProviderId])

  useEffect(() => {
    if (!resolvedProviderId) {
      setMetrics(null)
      setLoading(false)
      setError(null)
      return
    }

    let canceled = false
    setLoading(true)
    setError(null)

    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/provider-analytics-summary?provider_id=${resolvedProviderId}`
    console.log("[analytics-view] fetching analytics", { providerId: resolvedProviderId, endpoint })
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load analytics (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (canceled) return
      setMetrics({
        total_impressions: data?.total_impressions ?? 0,
        total_plays: data?.total_plays ?? 0,
        completion_rate: data?.completion_rate ?? 0,
        impressions_mom_pct: data?.impressions_mom_pct ?? null,
        plays_mom_pct: data?.plays_mom_pct ?? null,
        completion_rate_mom_pct: data?.completion_rate_mom_pct ?? null,
        best_performing_matches: data?.best_performing_matches ?? null,
        top_5_most_played: data?.top_5_most_played ?? null,
        top_5_most_completed: data?.top_5_most_completed ?? null,
      })
  })
      .catch((err) => {
        console.error("[analytics-view] fetch failed", err)
        if (canceled) return
        setError(err?.message ?? "Unable to load analytics")
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false)
        }
      })

    return () => {
      canceled = true
    }
  }, [backendBase, resolvedProviderId])

  const impressionsValue = metrics?.total_impressions ?? 0
  const totalPlaysValue = metrics?.total_plays ?? 0
  const completionRateValue = useMemo(() => {
    const raw = metrics?.completion_rate
    if (typeof raw === "number") {
      return `${Number.isInteger(raw) ? raw : raw.toFixed(1)}%`
    }
    return "0%"
  }, [metrics?.completion_rate])
  const normalizePct = (raw: number | string | null | undefined) => {
    if (raw == null) return null
    const parsed = typeof raw === "string" ? raw.replace(/[^\d.-]/g, "") : raw
    const value = Number(parsed)
    return Number.isNaN(value) ? null : value
  }
  const impressionsMoMPct = normalizePct(metrics?.impressions_mom_pct)
  const playsMoMPct = normalizePct(metrics?.plays_mom_pct)
  const completionRateMoMPct = normalizePct(metrics?.completion_rate_mom_pct)
  const impressionsLabel = (
    <span className="analytics-view__card-label">
      <span>Impressions</span>
      {impressionsMoMPct !== null && (
        <small
          className={
            impressionsMoMPct > 0
              ? "analytics-view__meta-positive"
              : "analytics-view__meta-neutral"
          }
        >
          {impressionsMoMPct > 0 ? "+" : ""}
          {impressionsMoMPct.toFixed(1)}%
        </small>
      )}
    </span>
  )
  const playsLabel = (
    <span className="analytics-view__card-label">
      <span>Total Plays</span>
      {playsMoMPct !== null && (
        <small
          className={
            playsMoMPct > 0 ? "analytics-view__meta-positive" : "analytics-view__meta-neutral"
          }
        >
          {playsMoMPct > 0 ? "+" : ""}
          {playsMoMPct.toFixed(1)}%
        </small>
      )}
    </span>
  )
  const completionLabelCard = (
    <span className="analytics-view__card-label">
      <span>Completed</span>
      {completionRateMoMPct !== null && (
        <small
          className={
            completionRateMoMPct > 0 ? "analytics-view__meta-positive" : "analytics-view__meta-neutral"
          }
        >
          {completionRateMoMPct > 0 ? "+" : ""}
          {completionRateMoMPct.toFixed(1)}%
        </small>
      )}
    </span>
  )

  useEffect(() => {
    if (!resolvedProviderId || !metrics?.best_performing_matches) {
      setTopPlayedMatches([])
      return
    }

    let canceled = false
    let list: any[] = []
    if (Array.isArray(metrics.best_performing_matches)) {
      list = metrics.best_performing_matches
    } else if (typeof metrics.best_performing_matches === "string") {
      try {
        const parsed = JSON.parse(metrics.best_performing_matches)
        if (Array.isArray(parsed)) {
          list = parsed
        }
      } catch (error) {
        console.error("[analytics-view] parsing top played failed", error)
      }
    }
    if (!list.length) {
      setTopPlayedMatches([])
      return
    }

    const fetchMatch = async (pageMatchId) => {
      const response = await fetch(
        `${backendBase.replace(/\/+$/, "")}/api/page-match?page_match_id=${pageMatchId}`
      )
      if (!response.ok) throw new Error("Failed to load page match")
      return response.json()
    }
    const fetchDocument = async (documentId) => {
      if (!documentId) return null
      const response = await fetch(
        `${backendBase.replace(/\/+$/, "")}/api/provider-document?provider_id=${resolvedProviderId}&document_id=${documentId}`
      )
      if (!response.ok) return null
      return response.json()
    }

    Promise.all(
          list.map(async (item) => {
            try {
              const match = await fetchMatch(item.page_match_id)
              if (canceled) return null
              let cover_image_url = null
              let documentTitle = match?.document_title ?? null
              if (match?.document_id) {
                const doc = await fetchDocument(match.document_id)
                cover_image_url = doc?.cover_image_url || null
                documentTitle = documentTitle || doc?.title ?? null
              }
              return {
                page_match_id: item.page_match_id,
                count: item.plays ?? item.count ?? 0,
                phrase: item.highlight_text || match?.phrase,
                video_url: match?.video_url,
                document_id: match?.document_id,
                cover_image_url,
                documentTitle,
              }
            } catch (error) {
              console.error("[analytics-view] top match fetch failed", error)
              return null
            }
      })
    ).then((results) => {
      if (canceled) return
      const filtered = results.filter(Boolean) as any
      console.log("[analytics-view] top played matches resolved", filtered)
      setTopPlayedMatches(filtered)
    })

    return () => {
      canceled = true
    }
  }, [metrics?.best_performing_matches, backendBase, resolvedProviderId])

  return (
    <div className="analytics-view">
      {error && <div className="analytics-view__error">{error}</div>}
      <HeaderCards
        items={[
          { label: impressionsLabel, value: loading ? "…" : String(impressionsValue) },
          { label: playsLabel, value: loading ? "…" : String(totalPlaysValue) },
          { label: completionLabelCard, value: loading ? "…" : completionRateValue },
        ]}
      />
      {topPlayedMatches.length > 0 && (
        <div className="analytics-view__most-clicked">
          <div className="analytics-view__section-title">Most clicked</div>
          <div className="analytics-view__most-clicked-grid">
            {topPlayedMatches.map((match) => {
              const playIcon =
                match.count != null ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
                  </svg>
                ) : null
              return (
                <MatchCard
                  key={match.page_match_id}
                  phrase={match.phrase || "Untitled"}
                  coverImageUrl={match.cover_image_url || undefined}
                  documentTitle={match.documentTitle}
                  confidenceLabel={undefined}
                  confidenceColor={undefined}
                  pillText={match.count ? String(match.count) : undefined}
                  pillIcon={playIcon || undefined}
                />
              )
            })}
          </div>
        </div>
      )}
      <style>{`
        .analytics-view .page-summary__overview-row {
          margin-top: 0;
        }
        .analytics-view__card-label {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .analytics-view__card-label small {
          font-size: 10px;
        }
        .analytics-view__meta-positive {
          color: #16a34a;
        }
        .analytics-view__meta-neutral {
          color: #94a3b8;
        }
        .analytics-view__most-clicked {
          margin-top: 16px;
        }
        .analytics-view__section-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          text-transform: none;
          letter-spacing: normal;
          margin-bottom: 8px;
        }
        .analytics-view__most-clicked-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .analytics-view__most-clicked-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          background: #fff;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: stretch;
        }
        .analytics-view__most-clicked-body {
          display: flex;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .analytics-view__most-clicked-image {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .analytics-view__most-clicked-copy {
          flex: 1;
          min-width: 0;
        }
        .analytics-view__most-clicked-phrase {
          margin: 0;
          font-weight: 400;
          font-size: 12px;
          color: #0f172a;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .analytics-view__phrase-label {
          font-weight: 600;
          margin-right: 4px;
        }
        .analytics-view__phrase-copy {
          font-weight: 400;
        }
        .analytics-view__most-clicked-link {
          font-size: 12px;
          color: #2563eb;
        }
        .analytics-view__most-clicked-count {
          font-weight: 600;
          color: #0f1727;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}
  
