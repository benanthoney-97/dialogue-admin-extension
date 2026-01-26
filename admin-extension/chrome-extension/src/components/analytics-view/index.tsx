import { useEffect, useMemo, useState } from "react"
import { HeaderCards } from "../header-cards"
import { MatchCard } from "../match-card"

type AnalyticsGroup = {
  group_key: string
  title: string
  description: string
}

const DEFAULT_GROUPS: AnalyticsGroup[] = [
  {
    group_key: "best_performing",
    title: "Top matches",
    description: "High clicks and high watch time. Your best content.",
  },
  {
    group_key: "needs_attention",
    title: "Update",
    description: "High clicks but users stop watching early. Consider replacing.",
  },
  {
    group_key: "low_value",
    title: "Low value",
    description: "Rarely clicked or watched. Consider removing.",
  },
] as const

type AnalyticsMetrics = {
  total_impressions?: number
  total_plays?: number
  completion_rate?: number
  impressions_mom_pct?: number | string
  plays_mom_pct?: number | string
  completion_rate_mom_pct?: number | string
  best_performing_matches?: string | null
  needs_attention_matches?: string | null
  low_value_matches?: string | null
  top_5_most_played?: string | null
  top_5_most_completed?: string | null
  analytics_groups?: AnalyticsGroup[] | null
}

const GROUP_FIELD_MAP: Record<string, keyof AnalyticsMetrics> = {
  best_performing: "best_performing_matches",
  needs_attention: "needs_attention_matches",
  low_value: "low_value_matches",
}

const GROUP_COLOR_MAP: Record<string, string> = {
  best_performing: "#16a34a",
  needs_attention: "#ef4444",
  low_value: "#ef4444",
}

const parseGroupMatches = (field: unknown) => {
  if (!field) return []
  if (Array.isArray(field)) return field
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      return []
    }
  }
  return []
}

export interface AnalyticsViewProps {
  providerId?: number | null
}

export function AnalyticsView({ providerId }: AnalyticsViewProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [topPlayedMatches, setTopPlayedMatches] = useState<
    {
      page_match_id: number
      count: number
      phrase?: string
      video_url?: string
      document_id?: number
      cover_image_url?: string
      documentTitle?: string | null
      completion_rate?: number | string
    }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL || ""
  const [resolvedProviderId, setResolvedProviderId] = useState<number | null>(providerId ?? null)
  const [groupDefinitions, setGroupDefinitions] = useState<AnalyticsGroup[]>(DEFAULT_GROUPS)
  const [selectedGroupKey, setSelectedGroupKey] = useState("best_performing")

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

    const fetchData = async () => {
      try {
        const res = await fetch(endpoint)
        if (!res.ok) {
          throw new Error(`Failed to load analytics (${res.status})`)
        }
        const data = await res.json()
        if (canceled) return
        setMetrics({
          total_impressions: data?.total_impressions ?? 0,
          total_plays: data?.total_plays ?? 0,
          completion_rate: data?.completion_rate ?? 0,
          impressions_mom_pct: data?.impressions_mom_pct ?? null,
          plays_mom_pct: data?.plays_mom_pct ?? null,
          completion_rate_mom_pct: data?.completion_rate_mom_pct ?? null,
          best_performing_matches: data?.best_performing_matches ?? null,
          needs_attention_matches: data?.needs_attention_matches ?? null,
          low_value_matches: data?.low_value_matches ?? null,
          top_5_most_played: data?.top_5_most_played ?? null,
          top_5_most_completed: data?.top_5_most_completed ?? null,
        })
        const groups = Array.isArray(data?.analytics_groups) && data.analytics_groups.length
          ? data.analytics_groups
          : DEFAULT_GROUPS
        setGroupDefinitions(groups)
      } catch (err) {
        console.error("[analytics-view] fetch failed", err)
        if (canceled) return
        setError((err as Error)?.message ?? "Unable to load analytics")
      } finally {
        if (!canceled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      canceled = true
    }
  }, [backendBase, resolvedProviderId])

  useEffect(() => {
    if (!groupDefinitions.length) return
    if (!groupDefinitions.some((group) => group.group_key === selectedGroupKey)) {
      setSelectedGroupKey(groupDefinitions[0].group_key)
    }
  }, [groupDefinitions, selectedGroupKey])

  const impressionsValue = metrics?.total_impressions ?? 0
  const totalPlaysValue = metrics?.total_plays ?? 0
  const completionRateValue = useMemo(() => {
    const raw = metrics?.completion_rate
    if (typeof raw === "number") {
      return `${Number.isInteger(raw) ? raw : raw.toFixed(1)}%`
    }
    return "0%"
  }, [metrics?.completion_rate])
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    Object.entries(GROUP_FIELD_MAP).forEach(([key, field]) => {
      counts[key] = parseGroupMatches(metrics?.[field]).length
    })
    return counts
  }, [metrics])
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
    if (!resolvedProviderId) {
      setTopPlayedMatches([])
      return
    }

    let canceled = false
    const fieldKey = GROUP_FIELD_MAP[selectedGroupKey] ?? "best_performing_matches"
    const list = parseGroupMatches(metrics?.[fieldKey])
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
                completion_rate: item.completion_rate ?? match?.confidence ?? undefined,
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
  }, [metrics, backendBase, resolvedProviderId, selectedGroupKey])

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
      <div className="analytics-view__most-clicked">
        <div className="analytics-view__section-title">
        <div className="analytics-view__section-chip-bar">
              {(groupDefinitions.length ? groupDefinitions : DEFAULT_GROUPS).map((group) => (
                <span
                  key={group.group_key}
                  className={`analytics-view__section-chip ${
                    selectedGroupKey === group.group_key ? "analytics-view__section-chip--active" : ""
                  }`}
                  onClick={() => setSelectedGroupKey(group.group_key)}
                  title={group.description}
                >
                  {group.title} ({groupCounts[group.group_key] ?? 0})
                </span>
              ))}
          </div>
        </div>
        {topPlayedMatches.length > 0 ? (
          <div className="analytics-view__match-grid-shell">
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
              const completionPct =
                typeof match.completion_rate === "number"
                  ? `${match.completion_rate.toFixed(0)}%`
                  : match.completion_rate
                    ? String(match.completion_rate)
                    : undefined
              const completionText = completionPct
                ? `${completionPct} completion`
                : "High completion"
              const chipText = match.count
                ? `${match.count} plays · ${completionText}`
                : completionText
              const statsColor = GROUP_COLOR_MAP[selectedGroupKey] ?? "#0f1727"
              return (
                <MatchCard
                  key={match.page_match_id}
                  phrase={match.phrase || "Untitled"}
                  coverImageUrl={match.cover_image_url || undefined}
                  documentTitle={match.documentTitle}
                  confidenceLabel={undefined}
                  confidenceColor={statsColor}
                  chipText={chipText}
                />
              )
            })}
            </div>
          </div>
        ) : (
          <div className="analytics-view__empty-state">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              fill="currentColor"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z"/>
            </svg>
            <p>No matches here right now</p>
          </div>
        )}
      </div>
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
          font-size: 0;
          margin-bottom: 12px;
        }
        .analytics-view__section-chip-bar {
          display: inline-flex;
          align-items: stretch;
          border: 1px solid #1f2937;
          border-radius: 999px;
          overflow: hidden;
          background: #fff;
          width: 100%;
        }
        .analytics-view__section-chip {
          flex: 1;
          border: none;
          border-radius: 0;
          margin: 0;
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 600;
          color: #1f2937;
          background: transparent;
          text-align: center;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .analytics-view__section-chip + .analytics-view__section-chip {
          border-left: 1px solid rgba(15, 23, 42, 0.08);
        }
        .analytics-view__section-chip--active {
          background: #1f2937;
          color: #fff;
        }
        .analytics-view__empty-state {
          margin-top: 20px;
          padding: 24px;
          border: 1px dashed #cbd5f5;
          border-radius: 12px;
          text-align: center;
          color: #0f172a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 180px;
        }
        .analytics-view__most-clicked-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          max-height: 620px;
          overflow-y: auto;
          padding: 0 0px 72px;
          box-sizing: content-box;
          margin-top: 12px;
        }
        .analytics-view__match-grid-shell {
          max-height: 560px;
          overflow-y: auto;
        }
        .analytics-view {
          overflow: hidden;
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
  
