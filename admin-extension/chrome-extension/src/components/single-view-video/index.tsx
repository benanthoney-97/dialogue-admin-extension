import { useEffect, useMemo, useState } from "react"
import { TimestampPicker } from "../MatchSelector/timestamp-picker"
import type { LibraryDocument } from "../LibraryPage/library-documents-grid"

export interface PageMatchSummary {
  page_match_id: number
  phrase: string
  confidence?: number
  confidence_label?: string
  status?: string
  video_url?: string
  confidence_color?: string
}

export interface SingleViewVideoProps {
  document: LibraryDocument
  providerId: number
  pageUrl?: string
  videoUrl?: string
  onBack: () => void
  onConfirm?: (seconds: number) => void
  onMatchSelect?: (matchId: number) => void
}

const extractTimestamp = (url?: string) => {
  if (!url) return 0
  const match = url.match(/#t=(\d+)/)
  if (!match) return 0
  const value = Number(match[1])
  return Number.isNaN(value) ? 0 : value
}


export function SingleViewVideo({
  document,
  providerId,
  pageUrl,
  videoUrl,
  onBack,
  onConfirm,
  onMatchSelect,
}: SingleViewVideoProps) {
  useEffect(() => {
    if (!document) return
    console.log("[SingleViewVideo] opening document", {
      id: document.id,
      title: document.title,
      sourceUrl: document.source_url,
    })
  }, [document])

  useEffect(() => {
    console.log("[SingleViewVideo] view rendered", {
      visible: true,
      documentId: document?.id,
    })
  }, [document?.id])
  const initialTimestamp = extractTimestamp(videoUrl)
  const [matches, setMatches] = useState<PageMatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL;
  useEffect(() => {
    const docId = document?.id
    if (!docId || !providerId) {
      setMatches([])
      setError(null)
      return
    }
    let canceled = false
    setLoading(true)
    setError(null)
    const cleanedBase = backendBase.replace(/\/+$/, "")
    const searchParams = new URLSearchParams({
      provider_id: String(providerId),
      document_id: String(docId),
    })
    fetch(`${cleanedBase}/api/page-matches?${searchParams.toString()}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch matches (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (canceled) return
        const payload = Array.isArray(data) ? data : data?.matches || []
        setMatches((payload as PageMatchSummary[]).slice().sort((a, b) => a.page_match_id - b.page_match_id))
      })
      .catch((fetchError) => {
        if (canceled) return
        setError(fetchError?.message ?? "Unable to load matches")
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false)
        }
      })

    return () => {
      canceled = true
    }
  }, [document?.id, providerId, backendBase, pageUrl])

  const matchCount = matches.length
  const matchList = useMemo(() => matches, [matches])
  const handleMatchClick = (matchId: number) => {
    if (!matchId) return
    onMatchSelect?.(matchId)
  }

  return (
    <div className="timestamp-view single-view-video">
      <div className="timestamp-view__back-row">
        <button type="button" className="timestamp-view__back" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
            />
          </svg>
          <span className="timestamp-view__back-label">Back</span>
        </button>
      </div>
      <div className="timestamp-view__section-heading">
        {document.title || "Preview video"}
      </div>
      <TimestampPicker
        videoUrl={document.source_url || ""}
        initialTimestamp={initialTimestamp}
        onConfirm={onConfirm}
        showActions={false}
        originUrl={pageUrl}
      />
        <div className="single-view-video__matches">
          <div className="single-view-video__matches-header">
            <span>Matches ({matchCount})</span>
          {loading && <span>Loading…</span>}
          {error && <span className="single-view-video__error">{error}</span>}
        </div>
        {!loading && !matches.length && !error && (
          <div className="single-view-video__empty">No matches are associated with this video yet.</div>
        )}
        <div className="single-view-video__match-list">
          {matchList.map((match) => (
            <article
              key={match.page_match_id}
              className="single-view-video__match-card single-view-video__match-card--interactive"
              role="button"
              tabIndex={0}
              onClick={() => handleMatchClick(match.page_match_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  handleMatchClick(match.page_match_id)
                }
              }}
            >
              <p>{match.phrase}</p>
              <div className="single-view-video__match-footer">
                <span
                  className={`single-view-video__match-status status-chip ${
                    match.status === "inactive" ? "status-chip--inactive" : "status-chip--active"
                  }`}
                >
                  {match.status === "inactive" ? "Inactive" : "Live"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <style>{`
        .single-view-video {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
                    background: #f6f7fb;

        }
        .timestamp-view__back-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 12px;
        }
        .timestamp-view__back {
          background: transparent;
          border: none;
          color: #0f172a;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 0;
        }
        .timestamp-view__back-label {
          margin-left: 4px;
        }
        .single-view-video .timestamp-picker {
          flex: 0 0 auto;
        }
        .single-view-video__matches {
          flex: 1;
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
        }
        .single-view-video__matches-header {
          display: block;
          color: #0f172a;
          font-size: 14px;
          text-align: left;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .single-view-video__error {
          color: #dc2626;
          text-transform: none;
          letter-spacing: normal;
        }
        .single-view-video__empty {
          font-size: 13px;
          color: #6b7280;
          padding: 8px 0;
        }
        .single-view-video__match-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .single-view-video__match-card {
          padding: 10px 12px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .single-view-video__match-card--interactive {
          cursor: pointer;
                    background: white;

        }
        .single-view-video__match-card p {
          margin: 0;
          font-weight: 600;
          font-size: 12px;
          color: #0f172a;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          background: white;
        }
        .single-view-video__match-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          background: white;
        }
        .single-view-video__match-status {
          font-size: 11px;
          text-transform: none;
        }
      `}</style>
    </div>
  )
}
