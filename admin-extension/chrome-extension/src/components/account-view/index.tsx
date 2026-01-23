import { CodeInjectionSnippet } from "../code-injection-snippet"

export interface AccountViewProps {
  email: string | null
  logoUrl: string | null
  providerId?: number | null
}

export function AccountView({ email, logoUrl, providerId }: AccountViewProps) {
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
        <button type="button" className="account-view__button">
          Settings
        </button>
        <button type="button" className="account-view__button">
          Billing
        </button>
      </div>
    </div>
  )
}
