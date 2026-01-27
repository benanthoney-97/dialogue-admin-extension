import { useState } from "react"
import "../login-form/login-form.css"

type ConnectVideoLibraryProps = {
  onNext: (libraryUrl: string) => void
}

export function ConnectVideoLibrary({ onNext }: ConnectVideoLibraryProps) {
  const [libraryUrl, setLibraryUrl] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isValidUrl = () => {
    try {
      const parsed = new URL(libraryUrl.trim())
      return !!parsed.protocol && !!parsed.hostname
    } catch {
      return false
    }
  }

  const parseYoutubeChannelParams = (value: string) => {
    try {
      const normalized = value.trim()
      const parsed = new URL(normalized)
      const pathname = parsed.pathname || ""
      const segments = pathname.split("/").filter(Boolean)
      if (segments.length > 0) {
        const first = segments[0]
        if (first === "channel" && segments[1]) {
          return { channel_id: segments[1] }
        }
        if (first === "user" && segments[1]) {
          return { username: segments[1] }
        }
        if (first === "c" && segments[1]) {
          return { username: segments[1] }
        }
        if (first.startsWith("@")) {
          return { username: first.slice(1) }
        }
      }
      const channelId = parsed.searchParams.get("channel_id")
      if (channelId) {
        return { channel_id: channelId }
      }
      return null
    } catch {
      return null
    }
  }

  const handleNext = async () => {
    if (!isValidUrl()) {
      setInfo("Enter a valid video library URL.")
      return
    }
    setInfo(null)
    setSubmitting(true)
    try {
      const params = parseYoutubeChannelParams(libraryUrl)
      if (!params) {
        setInfo("Unable to determine the YouTube channel from that URL.")
        return
      }

      const base =
        (process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co").replace(/\/+$/, "")
      const channelUrl = new URL("/api/youtube-channel-videos", base)
      channelUrl.searchParams.set(params.channel_id ? "channel_id" : "username", params.channel_id ?? params.username ?? "")
      const response = await fetch(channelUrl.toString())
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Unable to look up that channel")
      }
      await response.json()
      await onNext(libraryUrl.trim())
    } catch (error: any) {
      setInfo(error?.message || "Unable to connect library")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-form connect-video-library">
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
          disabled={!isValidUrl() || submitting}
          className="login-form__cta login-form__cta--full"
          onClick={handleNext}
        >
          Connect
        </button>
      </div>
    </div>
  )
}
