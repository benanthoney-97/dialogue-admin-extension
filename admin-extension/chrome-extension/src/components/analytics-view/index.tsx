import { useEffect, useMemo, useState } from "react"
import { HeaderCards } from "../header-cards"

export interface AnalyticsViewProps {
  providerId?: number | null
}

export function AnalyticsView({ providerId }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<"sites" | "marketplace">("sites")
  const [metrics, setMetrics] = useState<{
    total_impressions?: number
    total_plays?: number
    completion_rate?: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL || ""

  useEffect(() => {
    if (!providerId) {
      setMetrics(null)
      setLoading(false)
      setError(null)
      return
    }

    let canceled = false
    setLoading(true)
    setError(null)

    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/provider-analytics-summary?provider_id=${providerId}`
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
        })
      })
      .catch((err) => {
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
  }, [backendBase, providerId])

  const impressionsValue = metrics?.total_impressions ?? 0
  const totalPlaysValue = metrics?.total_plays ?? 0
  const completionRateValue = useMemo(() => {
    const raw = metrics?.completion_rate
    if (typeof raw === "number") {
      return `${Number.isInteger(raw) ? raw : raw.toFixed(1)}%`
    }
    return "0%"
  }, [metrics?.completion_rate])

  return (
    <div className="analytics-view">
      <div className="library-tabs-pill">
        <button
          type="button"
          className={`library-tabs-pill__button${activeTab === "sites" ? " library-tabs-pill__button--active" : ""}`}
          onClick={() => setActiveTab("sites")}
        >
          My Sites
        </button>
        <button
          type="button"
          className={`library-tabs-pill__button${activeTab === "marketplace" ? " library-tabs-pill__button--active" : ""}`}
          onClick={() => setActiveTab("marketplace")}
        >
          Marketplace
        </button>
      </div>
      {error && <div className="analytics-view__error">{error}</div>}
      <HeaderCards
        items={[
          { label: "Impressions", value: loading ? "…" : String(impressionsValue) },
          { label: "Total Plays", value: loading ? "…" : String(totalPlaysValue) },
          { label: "Completed", value: loading ? "…" : completionRateValue },
        ]}
      />
    </div>
  )
}
