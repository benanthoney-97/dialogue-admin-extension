import { useEffect, useMemo, useState } from "react"
import { HeaderCards } from "../header-cards"

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
    top_5_most_played?: string | null
    top_5_most_completed?: string | null
  } | null>(null)
  const [topPlayedMatches, setTopPlayedMatches] = useState<
    { page_match_id: number; count: number; phrase?: string; video_url?: string }[]
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
    if (!resolvedProviderId || !metrics?.top_5_most_played) {
      setTopPlayedMatches([])
      return
    }
    let canceled = false
    const list = []
    try {
      const parsed = JSON.parse(metrics.top_5_most_played)
      if (Array.isArray(parsed)) {
        list.push(...parsed)
      }
    } catch (error) {
      console.error("[analytics-view] parsing top played failed", error)
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

    Promise.all(
      list.map(async (item) => {
        try {
          const match = await fetchMatch(item.page_match_id)
          if (canceled) return null
          return {
            page_match_id: item.page_match_id,
            count: item.count,
            phrase: match?.phrase,
            video_url: match?.video_url,
          }
        } catch (error) {
          console.error("[analytics-view] top match fetch failed", error)
          return null
        }
      })
    ).then((results) => {
      if (canceled) return
      setTopPlayedMatches(results.filter(Boolean) as any)
    })

    return () => {
      canceled = true
    }
  }, [metrics?.top_5_most_played, backendBase, resolvedProviderId])

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
            {topPlayedMatches.map((match) => (
              <div className="analytics-view__most-clicked-card" key={match.page_match_id}>
                <div className="analytics-view__most-clicked-body">
                  <p className="analytics-view__most-clicked-phrase">{match.phrase || "Untitled"}</p>
                  {match.video_url && (
                    <a
                      href={match.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="analytics-view__most-clicked-link"
                    >
                      View video preview
                    </a>
                  )}
                </div>
                <span className="analytics-view__most-clicked-count">×{match.count}</span>
              </div>
            ))}
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
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
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
        }
        .analytics-view__most-clicked-phrase {
          font-size: 14px;
          line-height: 1.4;
          margin: 0 0 6px;
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
  
