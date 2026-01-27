import { useState } from "react"
import "../login-form/login-form.css"

type ConnectVideoLibraryProps = {
  onNext: (libraryUrl: string) => void
}

type LibrarySource =
  | { provider: "youtube"; channelId?: string; username?: string }
  | { provider: "vimeo"; user?: string; channel?: string }

const parseYouTube = (parsed: URL): LibrarySource | null => {
  const pathname = parsed.pathname || ""
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 0) {
    const first = segments[0]
    if (first === "channel" && segments[1]) {
      return { provider: "youtube", channelId: segments[1] }
    }
    if (first === "user" && segments[1]) {
      return { provider: "youtube", username: segments[1] }
    }
    if (first === "c" && segments[1]) {
      return { provider: "youtube", username: segments[1] }
    }
    if (first.startsWith("@")) {
      return { provider: "youtube", username: first.slice(1) }
    }
  }
  const channelId = parsed.searchParams.get("channel_id")
  if (channelId) {
    return { provider: "youtube", channelId }
  }
  return null
}

const parseVimeo = (parsed: URL): LibrarySource | null => {
  const pathname = parsed.pathname || ""
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null
  if (segments[0] === "channels" && segments[1]) {
    return { provider: "vimeo", channel: segments[1] }
  }
  if (segments[0] === "users" && segments[1]) {
    return { provider: "vimeo", user: segments[1] }
  }
  return { provider: "vimeo", user: segments[0] }
}

const parseLibrarySource = (value: string): LibrarySource | null => {
  try {
    const normalized = value.trim()
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase()
    if (host.includes("youtube.com") || host === "youtu.be") {
      return parseYouTube(parsed)
    }
    if (host.includes("vimeo.com")) {
      return parseVimeo(parsed)
    }
    return null
  } catch {
    return null
  }
}

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value.trim())
    return !!parsed.protocol && !!parsed.hostname
  } catch {
    return false
  }
}

export function ConnectVideoLibrary({ onNext }: ConnectVideoLibraryProps) {
  const [libraryUrl, setLibraryUrl] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleNext = async () => {
    if (!isValidUrl(libraryUrl)) {
      setInfo("Enter a valid video library URL.")
      return
    }
    const source = parseLibrarySource(libraryUrl)
    if (!source) {
      setInfo("Unable to determine the video library provider from that URL.")
      return
    }

    setInfo(null)
    setSubmitting(true)
    try {
      const base =
        (process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co").replace(/\/+$/, "")
      const endpoint =
        source.provider === "youtube" ? "/api/youtube-channel-videos" : "/api/vimeo-channel-videos"
      const channelUrl = new URL(endpoint, base)

      if (source.provider === "youtube") {
        if (!source.channelId && !source.username) {
          throw new Error("Unable to determine the YouTube channel identifier.")
        }
        channelUrl.searchParams.set(
          source.channelId ? "channel_id" : "username",
          source.channelId ?? source.username!
        )
      } else {
        if (!source.user && !source.channel) {
          throw new Error("Unable to determine the Vimeo channel identifier.")
        }
        channelUrl.searchParams.set(
          source.user ? "user" : "channel",
          source.user ?? source.channel!
        )
      }

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
          disabled={!isValidUrl(libraryUrl) || submitting}
          className="login-form__cta login-form__cta--full"
          onClick={handleNext}
        >
          Connect
        </button>
      </div>
    </div>
  )
}
