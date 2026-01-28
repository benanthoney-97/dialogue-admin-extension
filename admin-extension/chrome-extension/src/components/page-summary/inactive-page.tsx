import React, { useEffect, useMemo, useState } from "react"
import "./page-summary.css"

type SitemapPage = {
  id: number
  page_url: string
  tracked: boolean | null
}

type ProviderInfo = {
  name?: string
  website_url?: string
}

type InactivePageProps = {
  providerId?: number
  feedId?: number
  onRefresh: () => void
}

export function InactivePage({ providerId, feedId, onRefresh }: InactivePageProps) {
  const [pages, setPages] = useState<SitemapPage[]>([])
  const [loading, setLoading] = useState(true)
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null)
  const fetchTargetId =
    typeof feedId === "number"
      ? feedId
      : typeof providerId === "number"
      ? providerId
      : 33

  const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL || ""

  useEffect(() => {
    let canceled = false
    setLoading(true)
    const endpoint = `${backendBase.replace(
      /\/+$/,
      ""
    )}/api/inactive-view-pagelist?provider_id=${encodeURIComponent(providerId ?? feedId ?? 0)}`
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (canceled) return
        setPages(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [fetchTargetId, backendBase, providerId, feedId])

  useEffect(() => {
    if (!providerId) {
      setProviderInfo(null)
      return
    }

    let canceled = false
    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/provider-info?provider_id=${providerId}`
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (canceled) return
        setProviderInfo(data || null)
      })
      .catch(() => {
        if (!canceled) setProviderInfo(null)
      })
    return () => {
      canceled = true
    }
  }, [backendBase, providerId])

  const deriveRootUrl = (value?: string) => {
    if (!value) return ""
    try {
      const parsed = new URL(value)
      return `${parsed.protocol}//${parsed.hostname}`
    } catch {
      return value
    }
  }

  const fallbackUrl = pages[0]?.page_url
  const providerRootUrl = providerInfo?.website_url || fallbackUrl
  const targetUrl = deriveRootUrl(providerRootUrl) || ""

  const buttonLabel = providerInfo?.name
    ? `Return to ${providerInfo.name}`
    : targetUrl
    ? "Return to your site"
    : "Return to supported site"

  const handleNavigate = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!targetUrl) return
    console.log("[inactive-page] navigating to", targetUrl)
    if (typeof chrome !== "undefined" && chrome.tabs?.update) {
      chrome.tabs.update({ url: targetUrl })
    } else {
      window.location.href = targetUrl
    }
  }

  const hostnameLabel = useMemo(() => {
    if (providerInfo?.name) return providerInfo.name
    if (targetUrl) {
      try {
        return new URL(targetUrl).hostname
      } catch {
        return targetUrl
      }
    }
    return "your site"
  }, [providerInfo, targetUrl])

  return (
    <div className="inactive-page">
      <div className="inactive-page__heading-row">
        <div className="inactive-page__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pause" viewBox="0 0 16 16">
            <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5M10 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5"/>
          </svg>
        </div>
        <h3>Dialogue paused</h3>
      </div>
      <p className="inactive-page__body">
        Dialogue is currently inactive. Return to {hostnameLabel} to resume.
      </p>
      <div className="inactive-page__button-row">
        <button
          type="button"
          className="inactive-page__button"
          onClick={handleNavigate}
          disabled={!targetUrl}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
