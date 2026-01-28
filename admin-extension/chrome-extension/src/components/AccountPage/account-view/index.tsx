import { CodeInjectionSnippet } from "../../Auth/code-injection-snippet"
import { useEffect, useState } from "react"

export interface AccountViewProps {
  email: string | null
  logoUrl: string | null
  providerId?: number | null
  onLogout: () => void
}

export function AccountView({ email, logoUrl, providerId, onLogout }: AccountViewProps) {
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [snippetOpen, setSnippetOpen] = useState(false)

  useEffect(() => {
    if (!providerId) {
      setSetupUrl(null)
      return
    }
    let canceled = false
    setLoadingSetup(true)
    const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL || ""
    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/provider-docs-sites?provider_id=${providerId}`
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (canceled) return
        setSetupUrl(data?.site_url ?? null)
      })
      .catch(() => {
        if (!canceled) setSetupUrl(null)
      })
      .finally(() => {
        if (!canceled) setLoadingSetup(false)
      })
    return () => {
      canceled = true
    }
  }, [providerId])

  const handleSetupGuide = () => {
    if (!setupUrl) return
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url: setupUrl })
    } else {
      window.open(setupUrl, "_blank", "noopener,noreferrer")
    }
  }

  const toggleSnippet = () => setSnippetOpen((prev) => !prev)

  return (
    <div className="account-view">
      <div className="account-view__avatar">
        {logoUrl ? (
          <img src={logoUrl} alt="Provider logo" />
        ) : (
          <span aria-hidden="true"></span>
        )}
      </div>
      <div className="account-view__email" title={email || ""}>
        {email || "No email available"}
      </div>
      <div className="account-view__actions">
        <button
          type="button"
          className="account-view__button"
          onClick={toggleSnippet}
          aria-expanded={snippetOpen}
        >
          <span className="account-view__button-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-braces" viewBox="0 0 16 16">
              <path d="M2.114 8.063V7.9c1.005-.102 1.497-.615 1.497-1.6V4.503c0-1.094.39-1.538 1.354-1.538h.273V2h-.376C3.25 2 2.49 2.759 2.49 4.352v1.524c0 1.094-.376 1.456-1.49 1.456v1.299c1.114 0 1.49.362 1.49 1.456v1.524c0 1.593.759 2.352 2.372 2.352h.376v-.964h-.273c-.964 0-1.354-.444-1.354-1.538V9.663c0-.984-.492-1.497-1.497-1.6M13.886 7.9v.163c-1.005.103-1.497.616-1.497 1.6v1.798c0 1.094-.39 1.538-1.354 1.538h-.273v.964h.376c1.613 0 2.372-.759 2.372-2.352v-1.524c0-1.094.376-1.456 1.49-1.456V7.332c-1.114 0-1.49-.362-1.49-1.456V4.352C13.51 2.759 12.75 2 11.138 2h-.376v.964h.273c.964 0 1.354.444 1.354 1.538V6.3c0 .984.492 1.497 1.497 1.6"/>
            </svg>
          </span>
          Code snippet
        </button>
        <button
          type="button"
          className="account-view__button"
          onClick={handleSetupGuide}
          disabled={!setupUrl || loadingSetup}
        >
          <span className="account-view__button-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-file-earmark-text" viewBox="0 0 16 16">
              <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>
              <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
            </svg>
          </span>
          {loadingSetup ? "Loading…" : "Setup Guide"}
        </button>
        <button type="button" className="account-view__button" onClick={onLogout}>
          <span className="account-view__button-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-arrow-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0z"/>
              <path fillRule="evenodd" d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708z"/>
            </svg>
          </span>
          Logout
        </button>
      </div>
      {snippetOpen && (
        <div className="account-view__snippet-overlay" role="dialog" aria-modal="true">
          <div className="account-view__snippet-overlay__backdrop" onClick={toggleSnippet} aria-hidden="true" />
          <div className="account-view__snippet-overlay__content">
            <button
              type="button"
              className="account-view__snippet-overlay__close"
              onClick={toggleSnippet}
              aria-label="Close code snippet"
            >
              ×
            </button>
            <CodeInjectionSnippet providerId={providerId ?? null} showHeader={false} />
          </div>
        </div>
      )}
    </div>
  )
}
