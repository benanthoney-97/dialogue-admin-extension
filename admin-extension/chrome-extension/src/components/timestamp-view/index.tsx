import { TimestampPicker } from "../timestamp-picker"
import type { ProviderDocument } from "../provider-documents-grid"

export interface TimestampViewProps {
  document: ProviderDocument
  videoUrl?: string
  onBack: () => void
  onConfirm: (seconds: number) => void
}

const extractTimestamp = (url?: string) => {
  if (!url) return 0
  const match = url.match(/#t=(\d+)/)
  if (!match) return 0
  const value = Number(match[1])
  return Number.isNaN(value) ? 0 : value
}

export function TimestampView({ document, videoUrl, onBack, onConfirm }: TimestampViewProps) {
  const initialTimestamp = extractTimestamp(videoUrl)

  return (
    <div className="timestamp-view">
      <div className="timestamp-view__header">
        <button type="button" className="timestamp-view__back" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
            />
          </svg>
        </button>
        <span>Select starting point for "{document.title}"</span>
      </div>
      <TimestampPicker
        videoUrl={document.source_url || ""}
        initialTimestamp={initialTimestamp}
        onConfirm={onConfirm}
      />
    </div>
  )
}
