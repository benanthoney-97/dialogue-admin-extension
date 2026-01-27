import { useState } from "react"
import "../login-form/login-form.css"

type ConnectVideoLibraryProps = {
  onNext: (libraryUrl: string) => void
  providerId: number | null
}

type LibrarySource =
  | { provider: "youtube"; channelId?: string; username?: string }
  | { provider: "vimeo"; user?: string; channel?: string }

type PlaylistMetadata = {
  id: string
  title: string
  description?: string | null
  cover_image?: string | null
  itemCount?: number | null
}

type VideoPreview = {
  id: string
  title: string
  description?: string
  thumbnail?: string | null
  sourceUrl: string
  createdAt?: string
  provider: "youtube" | "vimeo"
  playlistId?: string | null
  playlistTitle?: string | null
}

type ChannelPreview = {
  provider: "youtube" | "vimeo"
  title: string
  name?: string
  description?: string | null
  thumbnail?: string | null
  videoCount: number
  latestVideoDate?: string | null
  videos: VideoPreview[]
  playlists?: PlaylistMetadata[]
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
  playlistId: data.playlistId ?? data.playlist_id ?? null,
  playlistTitle: data.playlistTitle ?? null,
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
  if (!channel) {
    throw new Error("Channel metadata missing from YouTube response")
  }
  const videosByPlaylist = payload?.videosByPlaylist ?? {}
  const aggregatedVideos: VideoPreview[] = []
  const seen = new Set<string>()

  Object.entries(videosByPlaylist).forEach(([playlistId, videos]: [string, any[]]) => {
    if (!Array.isArray(videos)) return
    videos.forEach((video: any) => {
      const normalized = toVideoPreview({ ...video, playlistId }, "youtube")
      const key = normalized.sourceUrl ?? normalized.id
      if (!key || seen.has(key)) return
      seen.add(key)
      aggregatedVideos.push(normalized)
    })
  })

  if (aggregatedVideos.length === 0 && Array.isArray(payload?.videos)) {
    payload.videos.forEach((video: any) => {
      const normalized = toVideoPreview(video, "youtube")
      const key = normalized.sourceUrl ?? normalized.id
      if (!key || seen.has(key)) {
        return
      }
      seen.add(key)
      aggregatedVideos.push(normalized)
    })
  }

  if (aggregatedVideos.length === 0) {
    throw new Error("No videos were returned for that library")
  }

  const thumbnail =
    channel.thumbnails?.high?.url ??
    channel.thumbnails?.medium?.url ??
    channel.thumbnails?.default?.url ??
    null

  const playlistMeta: PlaylistMetadata[] = (payload?.playlists ?? []).map((pl: any) => ({
    id: pl.id,
    title: pl.title ?? "Untitled playlist",
    description: pl.description ?? null,
    cover_image:
      pl.thumbnails?.high?.url ??
      pl.thumbnails?.medium?.url ??
      pl.thumbnails?.default?.url ??
      null,
    itemCount: pl.itemCount ?? null,
  }))

    return {
      provider: "youtube",
      title: channel.title ?? "YouTube channel",
      name: channel.title ?? "YouTube channel",
      description: channel.description ?? null,
    thumbnail,
    videoCount: aggregatedVideos.length,
    latestVideoDate: getLatestVideoDate(aggregatedVideos),
    videos: aggregatedVideos,
    playlists: playlistMeta,
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
      name:
        payload.sourceInfo?.name ??
        payload.source?.id ??
        payload.source?.type ??
        "Vimeo channel",
      description: payload.sourceInfo?.description ?? null,
    thumbnail,
    videoCount: videoEntries.length,
    latestVideoDate: getLatestVideoDate(videoEntries),
    videos: videoEntries,
    playlists: [],
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
      const channelPayload = {
        platform: previewChannel.provider,
        channel_url: libraryUrl.trim(),
        name: previewChannel.name ?? previewChannel.title,
        channel_description: previewChannel.description ?? null,
        video_count: previewChannel.videoCount,
        cover_image: previewChannel.thumbnail ?? null,
        playlists: previewChannel.playlists ?? [],
      }
      const response = await fetch(`${base}/api/import-provider-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          channel: channelPayload,
          documents: previewChannel.videos.map((video) => ({
            title: video.title,
            source_url: video.sourceUrl,
            media_type: "video",
            cover_image_url: video.thumbnail ?? null,
            created_at: video.createdAt ?? null,
            playlist_id: video.playlistId ?? null,
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

  const handleClearInput = () => {
    setLibraryUrl("")
    setInfo(null)
    resetPreview()
  }

  return (
    <div className="login-form connect-video-library">
      <div className="login-form__header">Connect your video library</div>
      <div className="login-form__subtitle">
        Paste in your YouTube, Vimeo, or other library URL.
      </div>
      <label className="login-form__label">
        <div className="connect-video-library__label-row">
          <span>Video library URL</span>
          <button
            type="button"
            className="connect-video-library__input-reset"
            onClick={handleClearInput}
            aria-label="Clear video library input and preview"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              className="bi bi-arrow-clockwise"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"
              />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
            </svg>
          </button>
        </div>
        <input
          type="url"
          placeholder="https://www.youtube.com/channel/..."
          value={libraryUrl}
          onChange={(event) => setLibraryUrl(event.target.value)}
        />
      </label>
      {stage === "preview" && previewChannel && (
        <div className="connect-video-preview">
          <article className="connect-video-preview__card connect-video-preview__card--summary">
            <div className="connect-video-preview__provider-badge">
              <img
                src={
                  previewChannel.provider === "youtube"
                  ? "https://lmnoftavsxqvkpcleehi.supabase.co/storage/v1/object/public/platform_logos/YouTube_full-color_icon_(2017).svg.png"
                    : "https://lmnoftavsxqvkpcleehi.supabase.co/storage/v1/object/public/platform_logos/1280px-Vimeo_Logo.svg.png"
                }
                alt={`${previewChannel.provider} logo`}
              />
            </div>
            <div className="connect-video-preview__metadata-grid">
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
                  {previewChannel.videoCount} videos
                  {previewChannel.latestVideoDate && (
                    <> • Latest video {formatPreviewDate(previewChannel.latestVideoDate)}</>
                  )}
                </p>
              </div>
            </div>
            {previewChannel.description && (
              <p className="connect-video-preview__description connect-video-preview__description--full">
                {previewChannel.description}
              </p>
            )}
          </article>
          <button
            type="button"
            className={`login-form__cta login-form__cta--full${isSaving ? " connect-video-saving" : ""}`}
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="connect-video-saving-icon"
                >
                  <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
                </svg>
                <span className="connect-video-saving-text">Saving…</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
                </svg>
                {`Connect to ${previewChannel ? previewChannel.title : "channel"}`}
              </>
            )}
          </button>
        </div>
      )}
      {info && <div className="login-form__info">{info}</div>}
      {stage !== "preview" && (
        <div className="login-form__actions login-form__actions--full">
          <button
            type="button"
            disabled={!isValidUrl(libraryUrl) || isFetching}
            className="login-form__cta login-form__cta--full"
            onClick={handleNext}
          >
            {isFetching ? "Loading…" : "Connect"}
          </button>
        </div>
      )}
    </div>
  )
}
