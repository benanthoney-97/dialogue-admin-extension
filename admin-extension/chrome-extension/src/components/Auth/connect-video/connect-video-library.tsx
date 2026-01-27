import { useState } from "react"
import "../login-form/login-form.css"

type ConnectVideoLibraryProps = {
  onNext: (libraryUrl: string) => void
  providerId: number | null
}

type LibrarySource =
  | { provider: "youtube"; channelId?: string; username?: string }
  | { provider: "vimeo"; user?: string; channel?: string }

type VideoPreview = {
  id: string
  title: string
  description?: string
  thumbnail?: string | null
  sourceUrl: string
  createdAt?: string
  provider: "youtube" | "vimeo"
}

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

export function ConnectVideoLibrary({ onNext, providerId }: ConnectVideoLibraryProps) {
  const [libraryUrl, setLibraryUrl] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewVideos, setPreviewVideos] = useState<VideoPreview[]>([])
  const [stage, setStage] = useState<"idle" | "preview">("idle")

  const convertYouTubePayload = (payload: any): VideoPreview[] => {
    if (!Array.isArray(payload?.videos)) return []
    return payload.videos
      .filter((video: any) => !!video.videoId)
      .map((video: any) => ({
        id: video.videoId,
        title: video.title ?? "Untitled video",
        description: video.description,
        thumbnail:
          video.thumbnails?.maxres?.url ??
          video.thumbnails?.high?.url ??
          video.thumbnails?.medium?.url ??
          video.thumbnails?.default?.url ??
          null,
        sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        createdAt: video.publishedAt,
        provider: "youtube",
      }))
  }

  const convertVimeoPayload = (payload: any): VideoPreview[] => {
    if (!Array.isArray(payload?.videos)) return []
    return payload.videos.map((video: any) => ({
      id: video.uri ?? video.link ?? Math.random().toString(36).slice(2),
      title: video.name ?? "Untitled video",
      description: video.description ?? undefined,
      thumbnail:
        Array.isArray(video.pictures?.sizes) && video.pictures.sizes.length > 0
          ? video.pictures.sizes[video.pictures.sizes.length - 1].link
          : null,
      sourceUrl: video.link ?? "",
      createdAt: video.created_time,
      provider: "vimeo",
    }))
  }

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

    if (!providerId) {
      setInfo("Provider context is required")
      return
    }

    setInfo(null)
    setIsFetching(true)
    setPreviewVideos([])
    setStage("idle")
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
      const payload = await response.json()
      const previews =
        source.provider === "youtube"
          ? convertYouTubePayload(payload)
          : convertVimeoPayload(payload)

      if (previews.length === 0) {
        throw new Error("No videos were returned for that library")
      }
      setPreviewVideos(previews)
      setStage("preview")
    } catch (error: any) {
      setInfo(error?.message || "Unable to connect library")
    } finally {
      setIsFetching(false)
    }
  }

  const handleSave = async () => {
    if (!providerId || previewVideos.length === 0) return
    setIsSaving(true)
    try {
      const base =
        (process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co").replace(/\/+$/, "")
      const response = await fetch(`${base}/api/import-provider-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          documents: previewVideos.map((video) => ({
            title: video.title,
            source_url: video.sourceUrl,
            media_type: "video",
            cover_image_url: video.thumbnail ?? null,
            created_at: video.createdAt ?? null,
            is_active: true,
          })),
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Unable to save to library")
      }
      await onNext(libraryUrl.trim())
      setStage("idle")
      setPreviewVideos([])
    } catch (error: any) {
      setInfo(error?.message || "Unable to save to library")
    } finally {
      setIsSaving(false)
    }
  }

  const resetPreview = () => {
    setPreviewVideos([])
    setStage("idle")
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
      {stage === "preview" && (
        <div className="connect-video-preview">
          <div className="connect-video-preview__header">
            <div>
              <strong>{previewVideos.length} videos ready</strong>
              <p className="connect-video-preview__subtitle">
                Review before saving to your library.
              </p>
            </div>
            <button
              type="button"
              className="connect-video-preview__reset"
              onClick={resetPreview}
            >
              Start over
            </button>
          </div>
          <div className="connect-video-preview__grid">
            {previewVideos.map((video) => (
              <article key={video.id} className="connect-video-preview__card">
                {video.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="connect-video-preview__thumb"
                  />
                )}
                <div className="connect-video-preview__content">
                  <div className="connect-video-preview__title">{video.title}</div>
                  <p className="connect-video-preview__meta">{video.provider}</p>
                </div>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="login-form__cta login-form__cta--full"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Saving…" : "Save to my library"}
          </button>
        </div>
      )}
      {info && <div className="login-form__info">{info}</div>}
      <div className="login-form__actions login-form__actions--full">
        <button
          type="button"
          disabled={!isValidUrl(libraryUrl) || isFetching || stage === "preview"}
          className="login-form__cta login-form__cta--full"
          onClick={handleNext}
        >
          {isFetching ? "Loading…" : "Connect"}
        </button>
      </div>
    </div>
  )
}
