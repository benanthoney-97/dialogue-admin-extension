import { useState } from "react"
import "../login-form/login-form.css"
import { CodeInjectionSnippet } from "../code-injection-snippet"

type CompanyOnboardingProps = {
  providerId?: number | null
  onNext: (websiteUrl: string) => Promise<void>
  onComplete: () => void
}

export function CompanyOnboarding({ providerId, onNext, onComplete }: CompanyOnboardingProps) {
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const [stage, setStage] = useState<"form" | "snippet">("form")
  const [hasCopied, setHasCopied] = useState(false)

  const isValidUrl = () => {
    try {
      const parsed = new URL(websiteUrl.trim())
      return !!parsed.protocol && !!parsed.hostname
    } catch {
      return false
    }
  }

  const handleNext = async () => {
    if (!isValidUrl()) {
      setInfo("Enter a valid website URL.")
      return
    }
    setInfo(null)
    try {
      await onNext(websiteUrl.trim())
      setStage("snippet")
      setHasCopied(false)
    } catch (error: any) {
      setInfo(error?.message || "Unable to save website")
    }
  }

  return (
    <div className="login-form">
      {stage === "form" ? (
        <>
          <div className="login-form__header">Add your first site</div>
          <div className="login-form__subtitle">
            Where will you show videos?
          </div>
          <label className="login-form__label">
            Website URL
            <input
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
            />
          </label>
          {info && <div className="login-form__info">{info}</div>}
          <div className="login-form__actions login-form__actions--full">
            <button
              type="button"
              disabled={!isValidUrl()}
              className="login-form__cta login-form__cta--full"
              onClick={handleNext}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="login-form__header">Add Dialogue to your site</div>
          <div className="login-form__subtitle">
            Paste this line of code into the header of { }
            {websiteUrl ? `${websiteUrl}` : "your site"}
          </div>
          <CodeInjectionSnippet providerId={providerId} onCopy={() => setHasCopied(true)} showHeader={false} />
          <div className="login-form__actions login-form__actions--full">
            <button
              type="button"
              className="login-form__cta login-form__cta--full"
              disabled={!hasCopied}
              onClick={onComplete}
            >
              All done
            </button>
          </div>
          <div className="login-form__note">
            <a
              href="https://app.dialogue-ai.co/get-started/1.-add-code-snippet-to-website"
              target="_blank"
              rel="noreferrer"
              className="login-form__note-link"
            >
              How do I do this?
            </a>
          </div>
        </>
      )}
    </div>
  )
}
