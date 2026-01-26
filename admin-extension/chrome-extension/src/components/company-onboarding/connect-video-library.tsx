import { useState } from "react"
import "../login-form/login-form.css"

type ConnectVideoLibraryProps = {
  onNext: (libraryUrl: string) => void
}

export function ConnectVideoLibrary({ onNext }: ConnectVideoLibraryProps) {
  const [libraryUrl, setLibraryUrl] = useState("")
  const [info, setInfo] = useState<string | null>(null)

  const isValidUrl = () => {
    try {
      const parsed = new URL(libraryUrl.trim())
      return !!parsed.protocol && !!parsed.hostname
    } catch {
      return false
    }
  }

  const handleNext = async () => {
    if (!isValidUrl()) {
      setInfo("Enter a valid video library URL.")
      return
    }
    setInfo(null)
    try {
      await onNext(libraryUrl.trim())
    } catch (error: any) {
      setInfo(error?.message || "Unable to connect library")
    }
  }

  return (
    <div className="login-form">
      <div className="login-form__header">Connect your video library</div>
      <div className="login-form__subtitle">
        Paste in your YouTube, Vimeo, or other library URL.
      </div>
      <label className="login-form__label">
        Video library URL
        <input
          type="url"
          placeholder="https://www.youtube.com/channel/..."
          value={libraryUrl}
          onChange={(event) => setLibraryUrl(event.target.value)}
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
          Connect
        </button>
      </div>
    </div>
  )
}
