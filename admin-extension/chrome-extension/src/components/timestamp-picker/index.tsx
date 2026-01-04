import React, { useEffect, useRef, useState } from "react"

export interface TimestampPickerProps {
  videoUrl: string
  initialTimestamp?: number
  maxTimestamp?: number
  onTimestampChange?: (seconds: number) => void
  onConfirm?: (seconds: number) => void
}

const DEFAULT_MAX_TIMESTAMP = 600

const toVimeoPlayerUrl = (value: string | undefined) => {
  if (!value) return ""
  try {
    const parsed = new URL(value, window.location.href)
    const videoHost = "https://player.vimeo.com"
    const pathMatch = parsed.pathname.match(/\/video\/(\d+)/) || parsed.pathname.match(/\/(\d+)/)
    if (!pathMatch) {
      return value
    }
    const videoId = pathMatch[1]
    const embedUrl = new URL(`${videoHost}/video/${videoId}`)
    const playerId = "dialogue-timestamp-player"
    embedUrl.searchParams.set("api", "1")
    embedUrl.searchParams.set("player_id", playerId)
    if (parsed.hash) {
      embedUrl.hash = parsed.hash
    }
    return embedUrl.toString()
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
  maxTimestamp = DEFAULT_MAX_TIMESTAMP,
  onTimestampChange,
  onConfirm,
}: TimestampPickerProps) {
  const sanitizedMax = Math.max(1, maxTimestamp)
  const [currentValue, setCurrentValue] = useState(() => {
    return Math.min(Math.max(0, initialTimestamp), sanitizedMax)
  })
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setCurrentValue((prev) => {
      const next = Math.min(Math.max(0, initialTimestamp), sanitizedMax)
      if (next !== prev) {
        onTimestampChange?.(next)
      }
      return next
    })
  }, [initialTimestamp, sanitizedMax])

  useEffect(() => {
    onTimestampChange?.(currentValue)
  }, [currentValue])

  const requestCurrentTime = async () => {
    if (!iframeRef.current?.contentWindow) {
      throw new Error("Vimeo iframe not available")
    }
    return new Promise<number>((resolve, reject) => {
      const expectedOrigin = "https://player.vimeo.com"
      const listener = (event: MessageEvent) => {
        if (typeof event.data !== "object") {
          try {
            event.data = JSON.parse(event.data)
          } catch {
            return
          }
        }
        const payload = event.data
        console.log("[timestamp-picker] message data", payload, event.origin)
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
        resolve(Math.min(Math.max(0, reported), sanitizedMax))
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
  }

  const handleConfirm = async () => {
    try {
      const seconds = await requestCurrentTime()
      setCurrentValue(seconds)
      onConfirm?.(seconds)
    } catch (error) {
      console.error("[timestamp-picker] current time request failed", error)
      onConfirm?.(currentValue)
    }
  }

  return (
    <div className="timestamp-picker">
      <div className="timestamp-picker__player">
        <iframe
          ref={iframeRef}
          title="preview"
          src={toVimeoPlayerUrl(videoUrl)}
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
      <div className="timestamp-picker__actions">
        <span className="timestamp-picker__current">
          Start at <strong>{formatTime(currentValue)}</strong>
        </span>
        <button
          type="button"
          className="timestamp-picker__button"
          onClick={handleConfirm}
        >
          Set timestamp
        </button>
      </div>
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
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .timestamp-picker__current {
          font-size: 13px;
          color: #0f172a;
        }

        .timestamp-picker__button {
          border-radius: 999px;
          border: none;
          background: #0f172a;
          color: #fff;
          padding: 8px 16px;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .timestamp-picker__button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
        }
      `}</style>
    </div>
  )
}
