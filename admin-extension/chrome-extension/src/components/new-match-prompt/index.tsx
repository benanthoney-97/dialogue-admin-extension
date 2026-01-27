import React from "react"

export interface SelectedTextBlockProps {
  text?: string | null
  onReset?: () => void
  className?: string
}

export function SelectedTextBlock({
  text,
  onReset,
  className,
}: SelectedTextBlockProps) {
  if (!text) return null
  const classes = ["new-match-documents__selection"]
  if (className) {
    classes.push(className)
  }

  return (
    <div className={classes.join(" ")}>
      <div className="new-match-documents__header-row">
        <div className="new-match-documents__header-row-title">
          <div className="new-match-documents__header">Selected text</div>
        </div>
        {onReset && (
          <button
            type="button"
            className="page-summary__new-match page-summary__new-match--icon-only"
            aria-label="Reset new match overlay"
            onClick={onReset}
          >
            <span className="page-summary__new-match-icon" aria-hidden="true">
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
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
              </svg>
            </span>
            <span className="sr-only">Start over</span>
          </button>
        )}
      </div>
      <div className="new-match-documents__phrase">{text}</div>
    </div>
  )
}

export interface NewMatchPromptProps {
  selectedText?: string | null
  onGetMatches: () => void
  onChooseManually: () => void
  onReset?: () => void
  matchResults?: Array<{
    knowledge_id?: number
    document_id?: number
    document_title?: string
    video_url?: string
    coverage?: string
    timestamp_start?: number
    timestamp_end?: number
    confidence?: number
    similarity?: number
    snippet?: string
    source_url?: string
  }>
  loadingMatches?: boolean
  onSelectMatch?: (result: any) => void
}

export function NewMatchPrompt({
  selectedText,
  onGetMatches,
  onChooseManually,
  matchResults,
  loadingMatches,
  onSelectMatch,
  onReset,
}: NewMatchPromptProps) {
  return (
    <div className="new-match-prompt">
      <div className={`new-match-prompt__card ${!selectedText ? "new-match-prompt__card--centered" : ""}`}>
        {!selectedText && (
          <>
            <div className="new-match-prompt__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#fff" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/>
              </svg>
            </div>
            <h2>New match</h2>
            <p>Highlight text to start creating a new match.</p>
          </>
        )}
        <SelectedTextBlock
          text={selectedText}
          onReset={onReset}
          className="new-match-prompt__selection"
        />
        {selectedText && (
          <div className="new-match-prompt__actions">
            <button
              type="button"
              className="new-match-prompt__button new-match-prompt__button--primary"
              onClick={onGetMatches}
            >
              <span aria-hidden="true" className="new-match-prompt__star-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  className="bi bi-stars"
                  viewBox="0 0 16 16"
                >
                  <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
                </svg>
              </span>
              Match with AI
            </button>
          </div>
        )}
        {loadingMatches && (
          <div className="new-match-prompt__loading">Looking for similar clips…</div>
        )}
        {matchResults && matchResults.length > 0 && (
          <>
            <div className="new-match-prompt__matches-heading">Matches</div>
            <div className="new-match-prompt__results" data-testid="match-results">
              {matchResults.map((result, index) => {
                const score = Number(result.similarity ?? result.confidence ?? 0)
                const percent = Math.max(0, Math.min(100, Math.round(score * 100)))
                const videoSrc = result.video_url || result.source_url || ''
                const snippetText = result.snippet?.trim() || "Transcript unavailable"

                return (
                  <button
                    key={result.knowledge_id ?? `${index}-${result.document_id}`}
                    type="button"
                    className="new-match-prompt__result"
                    onClick={() => onSelectMatch?.(result)}
                  >
                <div className="new-match-prompt__video">
                  {videoSrc ? (
                    <iframe
                      src={videoSrc}
                      onLoad={() => console.log('[new-match-prompt] iframe loaded', videoSrc)}
                      title={`match-${index}`}
                      frameBorder="0"
                      allow="autoplay; fullscreen"
                    ></iframe>
                  ) : (
                    <div className="new-match-prompt__video-placeholder" aria-hidden="true" />
                  )}
                  {index === 0 && (
                    <div className="new-match-prompt__match-chip">Best match</div>
                  )}
                </div>
                    <div className="new-match-prompt__result-body">
                      <span className="new-match-prompt__result-title">
                        {result.document_title || "Suggested clip"}
                      </span>
                    <p className="new-match-prompt__result-snippet">{snippetText}</p>
                      <div className="new-match-prompt__result-meta">
                        {!result.document_title && result.source_url && (
                          <span>{result.source_url.split("#")[0]}</span>
                        )}
                      </div>
                      <div className="new-match-prompt__result-footer">
                        <div
                          role="button"
                          tabIndex={0}
                          className="new-match-prompt__result-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectMatch?.(result)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              event.stopPropagation()
                              onSelectMatch?.(result)
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
                          </svg>
                          Select match
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      <style>{`
        .new-match-prompt {
          padding: 0px 0px;
          display: flex;
          justify-content: center;
          align-items: stretch;
          height: 100%;
          overflow: auto;
          background: #f6f7fb;
        }
        .new-match-prompt__card {
          background: #f6f7fb;
          border-radius: 16px;
          padding: 0px 16px;
          max-width: 640px;
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 11px;
        }
        .new-match-prompt__card--centered {
          padding: 0px 0 40px;
          justify-content: center;
        }
        .new-match-prompt__icon {
          width: 48px;
          height: 48px;
          margin: 0 auto;
          border-radius: 50%;
          background: #1f2937;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .new-match-prompt__card h2 {
          margin: 0;
          font-size: 18px;
          color: #1f2937;
        }
        .new-match-prompt__card p {
          color: #475467;
          font-size: 11px;
        }
        .new-match-prompt__hint {
          font-size: 12px;
          color: #94a3b8;
        }
        .new-match-prompt__selection {
          margin-top: 12px;
          text-align: left;
          width: 100%;
          position: sticky;
          top: 0;
          background: #f6f7fb;
          padding: 0px 0px 12px;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .new-match-prompt__selection-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 12px;
        }
        .new-match-prompt__loading {
          margin-top: 6px;
          font-size: 12px;
          color: #475467;
        }
        .new-match-prompt__results {
          margin-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          overflow-y: auto;
          flex: 1;
          padding: 0;
        }
        .new-match-prompt__matches-heading {
          text-align: left;
          font-weight: 600;
          color: #0f172a;
          font-size: 14px;
          padding: 0 0px;
          margin-top: 4px;
          margin-bottom: 2px;
        }
        .new-match-prompt__result {
          text-align: left;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 0;
          background: #ffffff;
          color: #0f172a;
          cursor: pointer;
          font: inherit;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .new-match-prompt__video {
          position: relative;
          height: 180px;
          background: transparent;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          overflow: hidden;
          margin: -1px;
        }
        .new-match-prompt__video iframe {
          position: absolute;
          width: 100%;
          height: 100%;
          border: none;
        }
        .new-match-prompt__video-placeholder {
          width: 100%;
          height: 100%;
          background: #d9e2ec;
        }
        .new-match-prompt__match-chip {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #1f2937;
          color: #fff;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }
        .new-match-prompt__result-body {
          padding: 8px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 11px;
          align-items: flex-start;
        }
        .new-match-prompt__result-title {
          font-weight: 600;
          font-size: 14px;
        }
        .new-match-prompt__result-snippet {
          margin: 0;
          font-size: 13px;
          color: #0f172a;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .new-match-prompt__result-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #64748b;
        }
        .new-match-prompt__result-footer {
          margin-top: 8px;
          width: 100%;
          display: flex;
          justify-content: flex-end;
        }
        .new-match-prompt__result-button {
          border-radius: 8px;
          border: none;
          background: #0f172a;
          color: #fff;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .new-match-prompt__result-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
        }
        .new-match-prompt__section-heading {
          text-align: left;
          font-weight: 600;
          color: #0f172a;
          font-size: 14px;
        }
        .new-match-prompt__start-over-button {
          border-radius: 12px;
          border: none;
          background: transparent;
          color: inherit;
          font-weight: 600;
          padding: 0;
          margin: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .new-match-prompt__start-over-button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.4);
        }
        .new-match-prompt__start-icon svg {
          fill: #0f1727;
        }
        .new-match-prompt__selection-text {
          margin: 2px 0 0;
          padding: 0;
          background: transparent;
          border-radius: 0;
          font-size: 11px;
          color: #0f172a;
          height: 24px;
          line-height: 24px;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .new-match-prompt__actions {
          margin-top: 0px;
          display: flex;
          width: 100%;
        }
        .new-match-prompt__button {
          flex: 1;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .new-match-prompt__button--primary {
          background: #1f2937;
          color: #fff;
          border: none;
        }
        .new-match-prompt__button--secondary {
          background: #f1f5f9;
          color: #0f172a;
          border: 1px solid #1f2937;
        }
      `}</style>
    </div>
  )
}
