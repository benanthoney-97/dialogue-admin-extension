import React, { useEffect, useState } from "react"

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
}

export function LibraryDocumentsGrid({
  providerId,
  onDocumentSelect,
}: LibraryDocumentsGridProps) {
  const resolvedProviderId = providerId
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    let canceled = false
    setLoading(true)
    setError(null)
    const API_BASE =
      (window as any).__SL_BACKEND_URL || "http://localhost:4173"
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/provider-documents?provider_id=${resolvedProviderId}`
    if (process.env.NODE_ENV !== "production") {
      console.log("[library-documents-grid] fetching documents from", endpoint)
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
        console.error("[library-documents-grid] fetch error", err)
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
          background: #f6f7fb;
        }

        .provider-documents__grid-shell {
          border-radius: 16px;
          background: #f6f7fb;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 0 16px;
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
          flex: 1;
          padding: 12px 0px 16px;
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
          background: white;
          min-height: 150px;
          cursor: pointer;
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
