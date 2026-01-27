import React, { useCallback, useEffect, useRef, useState } from "react"

export interface TimestampPickerProps {
  videoUrl: string
  initialTimestamp?: number
  onTimestampChange?: (seconds: number) => void
  onConfirm?: (seconds: number) => void | Promise<void>
  showActions?: boolean
}

const parseHashTimestamp = (hash?: string) => {
  if (!hash) return 0
  const trimmed = hash.replace(/^#/, "")
  const timeValue = trimmed.startsWith("t=") ? trimmed.slice(2) : trimmed
  if (!timeValue) return 0
  const regex = /(\d+)(h|m|s)?/g
  let total = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(timeValue))) {
    const value = Number(match[1])
    if (Number.isNaN(value)) continue
    switch (match[2]) {
      case "h":
        total += value * 3600
        break
      case "m":
        total += value * 60
        break
      case "s":
      default:
        total += value
        break
    }
  }
  if (total === 0 && /^\d+$/.test(timeValue)) {
    total = Number(timeValue)
  }
  return total
}

const parseYouTubeId = (parsed: URL): string | null => {
  const host = parsed.hostname.toLowerCase()
  if (host.endsWith("youtu.be")) {
    const id = parsed.pathname.slice(1).split("/")[0]
    return id || null
  }
  const searchId = parsed.searchParams.get("v")
  if (searchId) return searchId
  const embedMatch = parsed.pathname.match(/\/embed\/([A-Za-z0-9_-]+)/)
  if (embedMatch) return embedMatch[1]
  const shortsMatch = parsed.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/)
  if (shortsMatch) return shortsMatch[1]
  return null
}

const buildVimeoEmbedUrl = (parsed: URL, startSeconds: number) => {
  const videoHost = "https://player.vimeo.com"
  const pathMatch =
    parsed.pathname.match(/\/video\/(\d+)/) || parsed.pathname.match(/\/(\d+)/)
  if (!pathMatch) {
    return ""
  }
  const videoId = pathMatch[1]
  const embedUrl = new URL(`${videoHost}/video/${videoId}`)
  const playerId = "dialogue-timestamp-player"
  embedUrl.searchParams.set("api", "1")
  embedUrl.searchParams.set("player_id", playerId)
  embedUrl.searchParams.set("autoplay", "1")
  embedUrl.searchParams.set("muted", "1")
  embedUrl.searchParams.set("background", "0")
  if (startSeconds) {
    embedUrl.searchParams.set("start", String(startSeconds))
  }
  if (parsed.hash) {
    embedUrl.hash = parsed.hash
  }
  return embedUrl.toString()
}

const buildYouTubeEmbedUrl = (parsed: URL, startSeconds: number) => {
  const videoId = parseYouTubeId(parsed)
  if (!videoId) return ""
  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`)
  embedUrl.searchParams.set("autoplay", "1")
  embedUrl.searchParams.set("mute", "1")
  embedUrl.searchParams.set("rel", "0")
  const origin = window.location.origin || ""
  if (origin) {
    embedUrl.searchParams.set("origin", origin)
  }
  embedUrl.searchParams.set("enablejsapi", "1")
  if (startSeconds) {
    embedUrl.searchParams.set("start", String(startSeconds))
  }
  return embedUrl.toString()
}

const toEmbeddedPlayerUrl = (value: string | undefined) => {
  if (!value) return ""
  try {
    const parsed = new URL(value, window.location.href)
    const startSeconds = parseHashTimestamp(parsed.hash)
    const host = parsed.hostname.toLowerCase()
    if (host.includes("vimeo.com")) {
      return buildVimeoEmbedUrl(parsed, startSeconds) || value
    }
    if (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("youtube-nocookie.com")
    ) {
      const embed = buildYouTubeEmbedUrl(parsed, startSeconds)
      if (embed) return embed
    }
    return value
  } catch {
    return value
  }
}

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds % 60))
  const m = Math.max(0, Math.floor((seconds / 60) % 60))
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function TimestampPicker({
  videoUrl,
  initialTimestamp = 0,
  onTimestampChange,
  onConfirm,
  showActions = true,
}: TimestampPickerProps) {
  const [currentValue, setCurrentValue] = useState(() => {
    return Math.max(0, initialTimestamp)
  })
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const requestIdRef = useRef(0)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    setCurrentValue((prev) => {
      const next = Math.max(0, initialTimestamp)
      if (next !== prev) {
        onTimestampChange?.(next)
      }
      return next
    })
  }, [initialTimestamp])

  useEffect(() => {
    onTimestampChange?.(currentValue)
  }, [currentValue])

  const requestCurrentTime = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) {
      throw new Error("Vimeo iframe not available")
    }
    return new Promise<number>((resolve, reject) => {
      const expectedOrigin = "https://player.vimeo.com"
      const listener = (event: MessageEvent) => {
        let payload = event.data
        if (typeof payload !== "object") {
          try {
            payload = JSON.parse(payload)
          } catch {
            return
          }
        }
        if (!payload || payload.method !== "getCurrentTime") return
        const reported =
          payload.value ??
          payload.seconds ??
          payload.currentTime ??
          payload.data?.currentTime ??
          payload.data?.seconds
        if (reported === undefined || reported === null) return
        if (!String(event.origin).startsWith(expectedOrigin)) return
        window.removeEventListener("message", listener)
        clearTimeout(timeout)
        resolve(Math.max(0, reported))
      }
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", listener)
        reject(new Error("Timed out waiting for current time"))
      }, 2000)
      window.addEventListener("message", listener)
      iframeRef.current?.contentWindow?.postMessage(
        { method: "getCurrentTime", value: "", player_id: "dialogue-timestamp-player", request_id: ++requestIdRef.current },
        "*"
      )
    })
  }, [iframeRef])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onLoad = () => {
      requestCurrentTime()
        .then((seconds) => {
          setCurrentValue(seconds)
          onTimestampChange?.(seconds)
        })
        .catch((error) => {
        })
    }
    iframe.addEventListener("load", onLoad)
    return () => {
      iframe.removeEventListener("load", onLoad)
    }
  }, [videoUrl, onTimestampChange, requestCurrentTime])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      requestCurrentTime()
        .then((seconds) => {
          setCurrentValue(seconds)
          onTimestampChange?.(seconds)
        })
        .catch(() => {})
    }, 2000)
    return () => window.clearInterval(intervalId)
  }, [requestCurrentTime, onTimestampChange])

  const handleConfirm = useCallback(async () => {
    if (isCreating) return
    setIsCreating(true)
    const finalize = async (seconds: number) => {
      if (!onConfirm) return
      await Promise.resolve(onConfirm(seconds))
    }
    try {
      const seconds = await requestCurrentTime()
      setCurrentValue(seconds)
      await finalize(seconds)
    } catch (error) {
      await finalize(currentValue)
    } finally {
      setIsCreating(false)
    }
  }, [currentValue, isCreating, onConfirm, requestCurrentTime])

  return (
    <div className="timestamp-picker">
      <div className="timestamp-picker__player">
        <iframe
          ref={iframeRef}
          title="preview"
          src={toEmbeddedPlayerUrl(videoUrl)}
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
      {showActions && (
        <div className="timestamp-picker__actions">
          <button
            type="button"
            className="timestamp-picker__button"
            onClick={handleConfirm}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
            </svg>
            Create match at {formatTime(currentValue)}
          </button>
          {isCreating && <div className="timestamp-picker__status">Creating...</div>}
        </div>
      )}
      <style>{`
        .timestamp-picker {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .timestamp-picker__player {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          padding-top: 56.25%;
        }

        .timestamp-picker__player iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        .timestamp-picker__actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
        }

        .timestamp-picker__current {
          font-size: 13px;
          color: #0f172a;
        }

        .timestamp-picker__button {
          border-radius: 8px;
          border: none;
          background: #0f172a;
          color: #fff;
          padding: 8px 16px;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .timestamp-picker__button svg {
          display: inline-flex;
          margin-right: 6px;
        }

        .timestamp-picker__button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
        }
        .timestamp-picker__status {
          font-size: 12px;
          color: #475467;
          text-align: right;
          margin-top: 2px;
        }
      `}</style>
    </div>
  )
}
