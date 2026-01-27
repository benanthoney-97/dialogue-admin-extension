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

type ChannelPreview = {
  provider: "youtube" | "vimeo"
  title: string
  description?: string | null
  thumbnail?: string | null
  videoCount: number
  latestVideoDate?: string | null
  videos: VideoPreview[]
}

const parseYouTube = (parsed: URL): LibrarySource | null => {
  const pathname = parsed.pathname || ""
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 0) {
    const first = segments[0]
    if (first === "channel" && segments[1]) {
      return { provider: "youtube", channelId: segments[1] }
    }
    if ((first === "user" || first === "c") && segments[1]) {
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

const toVideoPreview = (
  data: any,
  provider: "youtube" | "vimeo"
): VideoPreview => ({
  id: data.id ?? data.videoId ?? Math.random().toString(36).slice(2),
  title: data.title ?? data.name ?? "Untitled video",
  description: data.description ?? null,
  thumbnail:
    data.thumbnail ??
    data.thumbnails?.maxres?.url ??
    data.thumbnails?.high?.url ??
    data.thumbnails?.medium?.url ??
    data.thumbnails?.default?.url ??
    (Array.isArray(data.pictures?.sizes) && data.pictures.sizes.length
      ? data.pictures.sizes[data.pictures.sizes.length - 1].link
      : null),
  sourceUrl:
    data.sourceUrl ??
    data.link ??
    (data.videoId ? `https://www.youtube.com/watch?v=${data.videoId}` : ""),
  createdAt: data.createdAt ?? data.publishedAt ?? data.created_time ?? null,
  provider,
})

const getLatestVideoDate = (videos: VideoPreview[]): string | null => {
  const parsed = videos
    .map((video) => {
      if (!video.createdAt) return null
      const date = new Date(video.createdAt)
      return Number.isNaN(date.getTime()) ? null : date
    })
    .filter((date): date is Date => date !== null)

  if (parsed.length === 0) return null
  const latest = parsed.reduce((mostRecent, candidate) =>
    candidate > mostRecent ? candidate : mostRecent
  )
  return latest.toISOString()
}

const formatPreviewDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

const convertYouTubePayload = (payload: any): ChannelPreview => {
  const channel = payload?.channel
  const videos = Array.isArray(payload?.videos) ? payload.videos : []
  if (!channel) {
    throw new Error("Channel metadata missing from YouTube response")
  }
  const videoEntries = videos.map((video) => toVideoPreview(video, "youtube"))
  if (videoEntries.length === 0) {
    throw new Error("No videos were returned for that library")
  }
  const thumbnail =
    channel.thumbnails?.high?.url ??
    channel.thumbnails?.medium?.url ??
    channel.thumbnails?.default?.url ??
    null

  return {
    provider: "youtube",
    title: channel.title ?? "YouTube channel",
    description: channel.description ?? null,
    thumbnail,
    videoCount: videoEntries.length,
    latestVideoDate: getLatestVideoDate(videoEntries),
    videos: videoEntries,
  }
}

const extractVimeoThumbnail = (pictures?: any): string | null => {
  if (!pictures?.sizes?.length) return null
  const entry = pictures.sizes[pictures.sizes.length - 1]
  return entry?.link ?? null
}

const convertVimeoPayload = (payload: any): ChannelPreview => {
  const videos = Array.isArray(payload?.videos) ? payload.videos : []
  if (videos.length === 0) {
    throw new Error("No videos were returned for that library")
  }
  const videoEntries = videos.map((video) => toVideoPreview(video, "vimeo"))
  const thumbnail =
    extractVimeoThumbnail(payload.sourceInfo?.pictures) ??
    videoEntries[0]?.thumbnail ??
    null

  return {
    provider: "vimeo",
    title:
      payload.sourceInfo?.name ??
      payload.source?.id ??
      payload.source?.type ??
      "Vimeo channel",
    description: payload.sourceInfo?.description ?? null,
    thumbnail,
    videoCount: videoEntries.length,
    latestVideoDate: getLatestVideoDate(videoEntries),
    videos: videoEntries,
  }
}

export function ConnectVideoLibrary({ onNext, providerId }: ConnectVideoLibraryProps) {
  const [libraryUrl, setLibraryUrl] = useState("")
  const [info, setInfo] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewChannel, setPreviewChannel] = useState<ChannelPreview | null>(null)
  const [stage, setStage] = useState<"idle" | "preview">("idle")

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
    setPreviewChannel(null)
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
      const channelPreview =
        source.provider === "youtube"
          ? convertYouTubePayload(payload)
          : convertVimeoPayload(payload)
      setPreviewChannel(channelPreview)
      setStage("preview")
    } catch (error: any) {
      setInfo(error?.message || "Unable to connect library")
    } finally {
      setIsFetching(false)
    }
  }

  const handleSave = async () => {
    if (!providerId || !previewChannel) return
    setIsSaving(true)
    try {
      const base =
        (process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co").replace(/\/+$/, "")
      const response = await fetch(`${base}/api/import-provider-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          documents: previewChannel.videos.map((video) => ({
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
      setPreviewChannel(null)
    } catch (error: any) {
      setInfo(error?.message || "Unable to save to library")
    } finally {
      setIsSaving(false)
    }
  }

  const resetPreview = () => {
    setPreviewChannel(null)
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
      {stage === "preview" && previewChannel && (
        <div className="connect-video-preview">
          <div className="connect-video-preview__header">
            <div>
              <strong>{previewChannel.videoCount} videos ready</strong>
              <p className="connect-video-preview__subtitle">
                Confirm the channel before saving to your library.
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
          <article className="connect-video-preview__card connect-video-preview__card--summary">
            {previewChannel.thumbnail && (
              <img
                src={previewChannel.thumbnail}
                alt={previewChannel.title}
                className="connect-video-preview__thumb"
              />
            )}
            <div className="connect-video-preview__content">
              <div className="connect-video-preview__title">
                {previewChannel.title}
              </div>
              <p className="connect-video-preview__meta">
                {previewChannel.provider} • {previewChannel.videoCount} videos
                {previewChannel.latestVideoDate && (
                  <> • Latest video {formatPreviewDate(previewChannel.latestVideoDate)}</>
                )}
              </p>
              {previewChannel.description && (
                <p className="connect-video-preview__description">
                  {previewChannel.description}
                </p>
              )}
            </div>
          </article>
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
