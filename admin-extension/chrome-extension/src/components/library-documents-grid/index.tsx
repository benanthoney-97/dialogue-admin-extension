import React, { useEffect, useState } from "react"
import { ConnectVideoLibrary } from "../company-onboarding/connect-video-library"

export interface LibraryDocument {
  id: number
  title: string
  source_url?: string
  media_type?: string
  cover_image_url?: string
  is_active?: boolean
  provider_id?: number
}

export interface LibraryDocumentsGridProps {
  providerId: number
  onDocumentSelect?: (doc: LibraryDocument) => void
  showChooseTime?: boolean
}

export function LibraryDocumentsGrid({
  providerId,
  onDocumentSelect,
  showChooseTime,
}: LibraryDocumentsGridProps) {
  const resolvedProviderId = providerId
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [hasDocuments, setHasDocuments] = useState(false)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE =
process.env.PLASMO_PUBLIC_BACKEND_URL || "https://app.dialogue-ai.co";
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/provider-documents?provider_id=${resolvedProviderId}`
    if (process.env.NODE_ENV !== "production") {
    }
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load documents (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (canceled) return
        if (!Array.isArray(data)) {
          throw new Error("Unexpected payload")
        }
        setDocuments(data)
        setHasDocuments(data.length > 0)
      })
      .catch((err) => {
        if (canceled) return
        setError(err?.message ?? "Unable to load documents")
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false)
        }
      })
    return () => {
      canceled = true
    }
  }, [providerId])

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

  return (
    <div className="provider-documents">
      <div className="provider-documents__grid-shell">
        <div className="provider-documents__grid-content">
          <div className="provider-documents__search">
            <input
              type="search"
              placeholder="Search by title or media type"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          {loading && <div className="provider-documents__empty">Loading documents…</div>}
          {error && <div className="provider-documents__empty">Error: {error}</div>}
          {!loading && !error && documents.length === 0 && (
            <div className="provider-documents__empty">No documents available.</div>
          )}
          {!loading && !error && documents.length > 0 && filteredDocs.length === 0 && (
            <div className="provider-documents__empty">No documents match your search.</div>
          )}
          {!loading && !error && !hasDocuments && (
            <div className="provider-documents__overlay">
              <ConnectVideoLibrary onNext={() => setHasDocuments(true)} />
            </div>
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
          position: relative;
        }

        .provider-documents__grid-header {
          padding: 16px 0px 0px;
          text-align: left;
          color: #0f172a;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
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

        .provider-documents__grid {
          flex: 1 1 auto;
          min-height: 0;
          height: 0;
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 12px;
          overflow-y: auto;
          align-items: flex-start;
          align-content: flex-start;
          grid-auto-rows: minmax(auto, auto);
        }
        .provider-documents__overlay {
          position: absolute;
          inset: 0;
          background: rgba(246, 247, 251, 0.95);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
        }


        .doc-card {
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          background: white;
          min-height: 150px;
          cursor: pointer;
          position: relative;
        }
        .doc-card:hover {
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.15);
        }

        .doc-cover {
          background-size: cover;
          background-position: center;
          height: 100px;
        }

        .doc-content {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .doc-card__overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .doc-card:hover .doc-card__overlay {
          opacity: 1;
          pointer-events: auto;
        }

        .doc-card__choose-time {
          border-radius: 8px;
          border: none;
          background: #0f172a;
          color: #fff;
          padding: 8px 16px;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .doc-card__choose-time:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
        }

        .doc-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.3;
          margin: 0;
          flex: 1;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          text-overflow: ellipsis;
        }

        .doc-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #475467;
        }

        .doc-meta a {
          color: #5f61fb;
          font-weight: 600;
          text-decoration: none;
        }
      `}</style>
    </div>
  )
}
