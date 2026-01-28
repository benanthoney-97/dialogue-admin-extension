import React, { useEffect, useMemo, useRef, useState } from "react"

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
  created_at?: string | null
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
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [activeView, setActiveView] = useState<"playlists" | "videos">(
    "playlists"
  )
  const hasSetInitialTab = useRef(false)

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

  useEffect(() => {
    if (!searchExpanded) return
    searchInputRef.current?.focus()
  }, [searchExpanded])

  useEffect(() => {
    if (filter && !searchExpanded) {
      setSearchExpanded(true)
    }
  }, [filter, searchExpanded])

  const handleSelect = (doc: LibraryDocument) => {
    if (!onDocumentSelect) return
    onDocumentSelect(doc)
  }

  const normalizedFilter = filter.trim().toLowerCase()
  const filteredDocs = documents.filter((doc) => {
    if (!normalizedFilter) return true
    return (
      (doc.title || "").toLowerCase().includes(normalizedFilter) ||
      (doc.media_type || "").toLowerCase().includes(normalizedFilter)
    )
  })

  useEffect(() => {
    if (playlists.length === 0) {
      hasSetInitialTab.current = false
      if (!loading && filteredDocs.length > 0 && activeView === "playlists") {
        setActiveView("videos")
      }
      return
    }
    if (!hasSetInitialTab.current) {
      setActiveView("playlists")
      hasSetInitialTab.current = true
    }
  }, [playlists, activeView, filteredDocs.length, loading])

const sortByCreatedAtDesc = (items: LibraryDocument[]) =>
    [...items].sort((a, b) => {
      const aTime =
        a.created_at && !Number.isNaN(new Date(a.created_at).getTime())
          ? new Date(a.created_at).getTime()
          : 0
      const bTime =
        b.created_at && !Number.isNaN(new Date(b.created_at).getTime())
          ? new Date(b.created_at).getTime()
          : 0
      return bTime - aTime
    })

const playlistIdSet = useMemo(
    () => new Set(playlists.map((pl) => pl.id)),
    [playlists]
  )
  const playlistSections = playlists.map((playlist) => ({
    playlist,
    documents: sortByCreatedAtDesc(
      filteredDocs.filter((doc) => doc.playlist_id === playlist.id)
    ),
  }))
  const standaloneDocuments = sortByCreatedAtDesc(
    filteredDocs.filter(
      (doc) => !doc.playlist_id || !playlistIdSet.has(String(doc.playlist_id))
    )
  )
  const formatDocumentDate = (iso?: string | null) => {
    if (!iso) return null
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) return null
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed)
  }
  const showPlaylistSections =
    playlists.length > 0 && filteredDocs.length > 0 && activeView === "playlists"
  const showVideoGrid =
    filteredDocs.length > 0 && (activeView === "videos" || playlists.length === 0)
  const showPlaylistsTab = playlists.length > 0

  return (
    <div className="provider-documents">
      <div className="provider-documents__grid-shell">
        <div className="provider-documents__grid-content">
          {showSearchBar && (
            <div className="provider-documents__tabs-search-row">
              <div className="provider-documents__tab-group">
                {showPlaylistsTab && (
                  <button
                    type="button"
                    className={`provider-documents__tab${
                      activeView === "playlists" ? " provider-documents__tab--active" : ""
                    }`}
                    onClick={() => setActiveView("playlists")}
                    aria-pressed={activeView === "playlists"}
                  >
                    Playlists
                  </button>
                )}
                <button
                  type="button"
                  className={`provider-documents__tab${
                    activeView === "videos" ? " provider-documents__tab--active" : ""
                  }`}
                  onClick={() => setActiveView("videos")}
                  aria-pressed={activeView === "videos"}
                >
                  Videos
                </button>
              </div>
              <div
                className={`provider-documents__search-row${
                  searchExpanded ? " provider-documents__search-row--active" : ""
                }`}
              >
                <input
                  ref={searchInputRef}
                  className={`provider-documents__search-input${
                    searchExpanded ? " provider-documents__search-input--expanded" : ""
                  }`}
                  type="search"
                  placeholder="Search by title or media type"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
                <button
                  type="button"
                  className="provider-documents__search-toggle"
                  onClick={(event) => {
                    event.preventDefault()
                    setSearchExpanded((prev) => !prev)
                  }}
                  aria-label="Toggle search"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
          {showPlaylistSections && (
            <div className="provider-documents__playlist-sections">
              {playlistSections.map(({ playlist, documents }) => (
                <section
                  className="provider-documents__playlist-section"
                  key={`playlist-${playlist.id}`}
                >
                  <div className="provider-documents__playlist-section-header">
                    <div className="provider-documents__playlist-card provider-documents__playlist-card--header">
                      <div className="provider-documents__playlist-card-text">
                        <div className="provider-documents__playlist-card-title">
                          {playlist.title}
                        </div>
                      </div>
                    </div>
                    {typeof playlist.video_count === "number" && (
                      <div className="provider-documents__playlist-card-meta provider-documents__playlist-card-meta--right">
                        <span className="provider-documents__playlist-card-meta-icon" aria-hidden="true">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                          >
                            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
                          </svg>
                        </span>
                        {playlist.video_count} videos
                      </div>
                    )}
                  </div>
                  {documents.length > 0 ? (
                    <div className="provider-documents__playlist-doc-row">
                      {documents.map((doc) => (
                        <article
                          key={`playlist-doc-${doc.id}`}
                          className="doc-card doc-card--playlist"
                          onClick={() => handleSelect(doc)}
                        >
                          <div
                            className="doc-cover doc-cover--playlist"
                            style={{ backgroundImage: `url(${doc.cover_image_url || ""})` }}
                          />
                          <div className="doc-content doc-content--playlist">
                            <h3 className="doc-title">{doc.title || "Untitled document"}</h3>
                            {doc.created_at && (
                              <span className="doc-meta doc-meta--playlist">
                                {formatDocumentDate(doc.created_at)}
                              </span>
                            )}
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
                  ) : (
                    <div className="provider-documents__empty provider-documents__empty--inline">
                      No videos yet in this playlist.
                    </div>
                  )}
                </section>
              ))}
              {standaloneDocuments.length > 0 && (
                <section className="provider-documents__playlist-section">
                  <div className="provider-documents__playlist-section-header">
                    <div className="provider-documents__playlist-card provider-documents__playlist-card--header">
                      <div className="provider-documents__playlist-card-text">
                        <div className="provider-documents__playlist-card-title">
                          Other videos
                        </div>
                        <div className="provider-documents__playlist-card-meta">
                          {standaloneDocuments.length} videos
                        </div>
                      </div>
                    </div>
                    <div className="provider-documents__playlist-section-badge">
                      Unassigned
                    </div>
                  </div>
                  <div className="provider-documents__playlist-doc-row">
                    {standaloneDocuments.map((doc) => (
                      <article
                        key={`standalone-doc-${doc.id}`}
                        className="doc-card doc-card--playlist"
                        onClick={() => handleSelect(doc)}
                      >
                        <div
                          className="doc-cover doc-cover--playlist"
                          style={{ backgroundImage: `url(${doc.cover_image_url || ""})` }}
                        />
                        <div className="doc-content doc-content--playlist">
                          <h3 className="doc-title">{doc.title || "Untitled document"}</h3>
                          {doc.created_at && (
                            <span className="doc-meta doc-meta--playlist">
                              {formatDocumentDate(doc.created_at)}
                            </span>
                          )}
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
                </section>
              )}
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
          {!loading && !error && showVideoGrid && (
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
                    {doc.created_at && (
                      <span className="doc-meta">
                        {formatDocumentDate(doc.created_at)}
                      </span>
                    )}
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
          padding: 8px 0px 4px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
        }

        .provider-documents__tabs-search-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 4px 0;
          padding-right: 0;
        }

        .provider-documents__tab-group {
          display: flex;
          gap: 8px;
        }

        .provider-documents__tab {
          border: 1px solid #0f172a;
          border-radius: 8px;
          padding: 6px 14px;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .provider-documents__tab--active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }

        .provider-documents__tab:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .provider-documents__search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          justify-content: flex-end;
          flex: 0 0 auto;
          min-width: 0;
          max-width: 220px;
        }

        .provider-documents__search-toggle {
          border: none;
          background: none;
          padding: 6px;
          border-radius: 12px;
          cursor: pointer;
          color: #0f172a;
          transition: background 0.2s ease;
        }

        .provider-documents__search-toggle:hover {
          background: rgba(15, 23, 42, 0.05);
        }

        .provider-documents__search-input {
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 8px 14px;
          font-size: 13px;
          font-family: inherit;
          transition: width 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
          width: 0;
          opacity: 0;
          pointer-events: none;
        }

        .provider-documents__search-row--active .provider-documents__search-input {
          width: 110px;
          opacity: 1;
          pointer-events: auto;
          border-color: #e2e8f0;
          background: #fff;
        }

        .provider-documents__playlist-sections {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 8px;
          overflow-y: auto;
        }

        .provider-documents__playlist-section {
          background: transparent;
          border-radius: 0;
          border: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .provider-documents__playlist-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .provider-documents__playlist-card {
          border: 1px solid #e2e8f0;
          background: transparent;
          border-radius: 12px;
          padding: 6px 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .provider-documents__playlist-card--header {
          border-color: transparent;
          padding-left: 0;
          gap: 12px;
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
          font-size: 14px;
          margin-bottom: 2px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          text-overflow: ellipsis;
        }

        .provider-documents__playlist-card-meta {
          font-size: 12px;
          color: #475467;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .provider-documents__playlist-card-meta-icon svg {
          width: 14px;
          height: 14px;
        }

        .provider-documents__playlist-card-meta--right {
          margin-left: auto;
        }

        .provider-documents__playlist-doc-row {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
        }

        .provider-documents__playlist-doc-row::-webkit-scrollbar {
          height: 4px;
        }

        .provider-documents__playlist-doc-row::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.2);
          border-radius: 2px;
        }

        .provider-documents__grid {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          overflow-y: auto;
          align-items: flex-start;
          align-content: flex-start;
          grid-auto-rows: minmax(auto, auto);
        }

        .doc-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 10px;
          background: #fff;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          cursor: pointer;
        }

        .doc-card--playlist {
          min-width: 180px;
          width: 180px;
          flex: 0 0 auto;
        }

        .doc-cover {
          width: 100%;
          padding-top: 56%;
          background-size: cover;
          background-position: center;
        }

        .doc-cover--playlist {
          padding-top: 0;
          height: 100px;
        }

        .doc-content {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 60px;
        }

        .doc-content--playlist {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 60px;
        }

        .doc-title {
          font-size: 12px;
          margin: 0;
          font-weight: 600;
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          text-overflow: ellipsis;
          line-height: 1.3;
        }

        .doc-meta {
          font-size: 12px;
          color: #94a3b8;
        }

        .doc-meta--playlist {
          display: block;
          margin-top: 6px;
          font-size: 11px;
        }

        .doc-card__overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .doc-card__choose-time {
          border: none;
          background: rgba(15, 23, 42, 0.8);
          color: #fff;
          border-radius: 999px;
          padding: 6px 12px;
        }

        .provider-documents__empty--inline {
          margin-left: 12px;
          font-size: 12px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
