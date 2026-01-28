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
      <div className="account-view__snippet">
        <CodeInjectionSnippet providerId={providerId ?? null} />
      </div>
      <div className="account-view__actions">
        <button
          type="button"
          className="account-view__button"
          onClick={handleSetupGuide}
          disabled={!setupUrl || loadingSetup}
        >
          {loadingSetup ? "Loading…" : "Setup Guide"}
        </button>
        <button type="button" className="account-view__button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  )
}
