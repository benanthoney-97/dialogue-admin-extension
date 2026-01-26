import { useEffect, useState } from "react"
import "./page-summary.css"

type SitemapPage = {
  id: number
  page_url: string
  tracked: boolean | null
}

type InactivePageProps = {
  providerId?: number
  feedId?: number
  onRefresh: () => void
}

export function InactivePage({ providerId, feedId, onRefresh }: InactivePageProps) {
  const [pages, setPages] = useState<SitemapPage[]>([])
  const [loading, setLoading] = useState(true)
  const fetchTargetId =
    typeof feedId === "number"
      ? feedId
      : typeof providerId === "number"
      ? providerId
      : 33

  useEffect(() => {
    let canceled = false
    setLoading(true)
    const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL || ""
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
  }, [fetchTargetId])

  return (
    <div className="inactive-page">
      <div className="inactive-page__heading-row">
        <div className="inactive-page__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pause-btn-fill" viewBox="0 0 16 16">
            <path d="M0 12V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2m6.25-7C5.56 5 5 5.56 5 6.25v3.5a1.25 1.25 0 1 0 2.5 0v-3.5C7.5 5.56 6.94 5 6.25 5m3.5 0c-.69 0-1.25.56-1.25 1.25v3.5a1.25 1.25 0 1 0 2.5 0v-3.5C11 5.56 10.44 5 9.75 5"/>
          </svg>
        </div>
        <h3>Dialogue paused</h3>
      </div>
      <p className="inactive-page__body">
        Dialogue is currently inactive. Jump to one of your supported sites to resume:
      </p>
      <div className="inactive-page__list">
        {loading && <div className="inactive-page__message">Loading supported sites…</div>}
        {!loading &&
          pages.map((page) => {
            let hostname = page.page_url
            try {
              hostname = new URL(page.page_url).hostname
            } catch {
              hostname = page.page_url
            }
            return (
              <a
                key={page.id}
                className="inactive-page__card"
                href={page.page_url}
                rel="noreferrer"
                onClick={(event) => {
                  console.log("[inactive-page] navigating to", page.page_url)
                  event.preventDefault()
                  if (typeof chrome !== "undefined" && chrome.tabs?.update) {
                    chrome.tabs.update({ url: page.page_url })
                  } else {
                    window.location.href = page.page_url
                  }
                }}
              >
                <span className="inactive-page__url">{hostname}</span>
                <span className="inactive-page__arrow">→</span>
              </a>
            )
          })}
        {!loading && pages.length === 0 && (
          <div className="inactive-page__message">No supported sites available.</div>
        )}
      </div>
    </div>
  )
}
