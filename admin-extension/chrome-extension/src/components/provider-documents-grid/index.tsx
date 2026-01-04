import React, { useEffect, useState } from "react"

export interface ProviderDocument {
  id: number
  title: string
  source_url?: string
  media_type?: string
  cover_image_url?: string
  is_active?: boolean
}

export interface ProviderDocumentsGridProps {
  providerId?: number
  onDocumentSelect?: (doc: ProviderDocument) => void
}

const DEFAULT_PROVIDER_ID = 12

export function ProviderDocumentsGrid({
  providerId = DEFAULT_PROVIDER_ID,
  onDocumentSelect,
}: ProviderDocumentsGridProps) {
  const [documents, setDocuments] = useState<ProviderDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE =
      (window as any).__SL_BACKEND_URL || "http://localhost:4173"
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/provider-documents?provider_id=${providerId}`
    if (process.env.NODE_ENV !== "production") {
      console.log("[provider-documents-grid] fetching documents from", endpoint)
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
      })
      .catch((err) => {
        if (canceled) return
        console.error("[provider-documents-grid] fetch error", err)
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

  const handleSelect = (doc: ProviderDocument) => {
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
        <div className="provider-documents__grid-header">Video library</div>
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
                    <div className="doc-meta">
                      <span className="doc-media-icon" aria-label="Video available">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path fillRule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814z"/>
                        </svg>
                      </span>
                      <span>
                        <a
                          href={doc.source_url || "#"}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View
                        </a>
                      </span>
                    </div>
                  </div>
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
        }

        .provider-documents__grid-shell {
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #fff;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .provider-documents__grid-header {
          padding: 16px 20px 12px;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475467;
          font-weight: 600;
          border-bottom: 1px solid #edf2f7;
        }

        .provider-documents__grid-content {
          flex: 1;
          padding: 12px 16px 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
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
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .doc-card {
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          background: #f8fafc;
          min-height: 150px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .doc-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.15);
        }

        .doc-cover {
          width: 100%;
          height: 90px;
          background-color: #cbd5f5;
          background-size: cover;
          background-position: center;
          flex-shrink: 0;
        }

        .doc-content {
          padding: 10px 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
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
          font-size: 12px;
          color: #475467;
          display: flex;
          justify-content: space-between;
          gap: 4px;
          align-items: center;
        }

        .doc-media-icon {
          display: inline-flex;
          width: 20px;
          height: 20px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.05);
          color: #0f172a;
        }

        .doc-meta a {
          color: #0f172a;
          text-decoration: underline;
        }

        .provider-documents__empty {
          padding: 24px;
          text-align: center;
          color: #a1a1aa;
        }
      `}</style>
    </div>
  )
}
