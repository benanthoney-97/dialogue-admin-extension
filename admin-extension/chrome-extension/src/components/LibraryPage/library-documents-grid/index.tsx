import React, { useEffect, useState } from "react"

export interface LibraryDocument {
  id: number
  title: string
  source_url?: string
  media_type?: string
  cover_image_url?: string
  is_active?: boolean
  provider_id?: number
  channel_id?: number
  playlist_id?: string | null
}

export interface LibraryDocumentsGridProps {
  providerId: number
  channelId?: number | null
  onDocumentSelect?: (doc: LibraryDocument) => void
  showChooseTime?: boolean
  refreshKey?: number
  onDocumentsLoaded?: (count: number) => void
  renderEmptyState?: () => React.ReactNode
  showSearchBar?: boolean
}

export function LibraryDocumentsGrid({
  providerId,
  channelId,
  onDocumentSelect,
  showChooseTime,
  refreshKey,
  onDocumentsLoaded,
  renderEmptyState,
  showSearchBar = true,
}: LibraryDocumentsGridProps) {
  const resolvedProviderId = providerId
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [playlists, setPlaylists] = useState<
    {
      id: string
      title: string
      cover_image?: string | null
      video_count?: number | null
    }[]
  >([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)

  useEffect(() => {
    if (!channelId) {
      setDocuments([])
      setPlaylists([])
      setError(null)
      setLoading(false)
      return
    }
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE =
      process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co"
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/provider-channel-documents`
    const url = new URL(endpoint)
    url.searchParams.set("provider_id", String(resolvedProviderId))
    url.searchParams.set("channel_id", String(channelId))
    fetch(url.toString())
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load documents (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (canceled) return
        if (!data || !Array.isArray(data.documents)) {
          throw new Error("Unexpected payload")
        }
        setDocuments(data.documents)
        const playlistList = Array.isArray(data.playlists) ? data.playlists : []
        setPlaylists(playlistList)
        setSelectedPlaylistId(playlistList[0]?.id ?? null)
        onDocumentsLoaded?.(data.documents.length)
      })
      .catch((err) => {
        if (canceled) return
        setError(err?.message ?? "Unable to load documents")
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [providerId, refreshKey, channelId, resolvedProviderId, onDocumentsLoaded])

  const handleSelect = (doc: LibraryDocument) => {
    if (!onDocumentSelect) return
    onDocumentSelect(doc)
  }

  const normalizedFilter = filter.trim().toLowerCase()
  const playlistFilteredDocs = selectedPlaylistId
    ? documents.filter((doc) => doc.playlist_id === selectedPlaylistId)
    : documents
  const filteredDocs = playlistFilteredDocs.filter((doc) => {
    if (!normalizedFilter) return true
    return (
      (doc.title || "").toLowerCase().includes(normalizedFilter) ||
      (doc.media_type || "").toLowerCase().includes(normalizedFilter)
    )
  })

  const handlePlaylistSelect = (playlistId: string | null) => {
    setSelectedPlaylistId(playlistId)
  }

  return (
    <div className="provider-documents">
      <div className="provider-documents__grid-shell">
        <div className="provider-documents__grid-content">
          {showSearchBar && (
            <div className="provider-documents__search">
              <input
                type="search"
                placeholder="Search by title or media type"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
          )}
          {playlists.length > 0 && (
            <div className="provider-documents__playlist-row">
              <button
                type="button"
                className={`provider-documents__playlist-card${!selectedPlaylistId ? " provider-documents__playlist-card--active" : ""}`}
                onClick={() => handlePlaylistSelect(null)}
              >
                All videos
              </button>
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className={`provider-documents__playlist-card${selectedPlaylistId === playlist.id ? " provider-documents__playlist-card--active" : ""}`}
                  onClick={() => handlePlaylistSelect(playlist.id)}
                >
                  {playlist.cover_image && (
                    <span
                      className="provider-documents__playlist-card-thumb"
                      style={{ backgroundImage: `url(${playlist.cover_image})` }}
                    />
                  )}
                  <div className="provider-documents__playlist-card-text">
                    <div className="provider-documents__playlist-card-title">{playlist.title}</div>
                    {typeof playlist.video_count === "number" && (
                      <div className="provider-documents__playlist-card-meta">
                        {playlist.video_count} videos
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {loading && <div className="provider-documents__empty">Loading documents…</div>}
          {error && <div className="provider-documents__empty">Error: {error}</div>}
          {!loading && !error && documents.length === 0 && (
            renderEmptyState ? (
              renderEmptyState()
            ) : (
              <div className="provider-documents__empty">No documents available.</div>
            )
          )}
          {!loading && !error && documents.length > 0 && filteredDocs.length === 0 && (
            <div className="provider-documents__empty">No documents match your search.</div>
          )}
          {!loading && !error && filteredDocs.length > 0 && (
            <div className="provider-documents__grid">
              {filteredDocs.map((doc) => (
                <article
                  key={doc.id}
                  className="doc-card"
                  onClick={() => handleSelect(doc)}
                >
                  <div
                    className="doc-cover"
                    style={{ backgroundImage: `url(${doc.cover_image_url || ""})` }}
                  />
                  <div className="doc-content">
                    <h3 className="doc-title">{doc.title || "Untitled document"}</h3>
                  </div>
                  {showChooseTime && (
                    <div className="doc-card__overlay">
                      <button
                        type="button"
                        className="doc-card__choose-time"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleSelect(doc)
                        }}
                      >
                        Choose a starting point
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .provider-documents {
          width: 100%;
          height: 100%;
          background: #f6f7fb;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .provider-documents__grid-shell {
          border-radius: 16px;
          background: #f6f7fb;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 0 0px;
        }

        .provider-documents__grid-content {
          flex: 1 1 auto;
          min-height: 0;
          padding: 4px 0px 0px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
        }

        .provider-documents__search input {
          width: 100%;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          padding: 8px 14px;
          font-size: 13px;
          font-family: inherit;
        }

        .provider-documents__playlist-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .provider-documents__playlist-card {
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 12px;
          padding: 6px 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .provider-documents__playlist-card--active {
          border-color: #0f172a;
          background: #eef2ff;
        }

        .provider-documents__playlist-card-thumb {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background-size: cover;
          background-position: center;
        }

        .provider-documents__playlist-card-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .provider-documents__playlist-card-title {
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 2px;
        }

        .provider-documents__playlist-card-meta {
          font-size: 11px;
          color: #475467;
        }

        .provider-documents__grid {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 12px;
          overflow-y: auto;
          align-items: flex-start;
          align-content: flex-start;
          grid-auto-rows: minmax(auto, auto);
        }

        .doc-card {
          display: flex;
          flex-direction: column;
          border-radius: 10px;
          background: #fff;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          cursor: pointer;
        }

        .doc-cover {
          width: 100%;
          padding-top: 56%;
          background-size: cover;
          background-position: center;
        }

        .doc-content {
          padding: 12px;
        }

        .doc-title {
          font-size: 13px;
          margin: 0;
          font-weight: 600;
        }

        .doc-card__overlay {
          position: absolute;
          top: 0;
          left: 0;
        }

        .doc-card__choose-time {
          border: none;
        }
      `}</style>
    </div>
  )
}
