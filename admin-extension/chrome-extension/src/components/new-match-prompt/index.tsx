import React from "react"

export interface NewMatchPromptProps {
  selectedText?: string | null
  onGetMatches: () => void
  onChooseManually: () => void
}

export function NewMatchPrompt({
  selectedText,
  onGetMatches,
  onChooseManually,
}: NewMatchPromptProps) {
  return (
    <div className="new-match-prompt">
      <div className="new-match-prompt__card">
        {!selectedText && (
          <>
            <div className="new-match-prompt__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#047857" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/>
              </svg>
            </div>
            <h2>New match</h2>
            <p>Highlight text to start creating a new match.</p>
          </>
        )}
        <div className="new-match-prompt__selection">
          {selectedText ? (
            <>
              <span className="new-match-prompt__selection-label">Selected text</span>
              <p className="new-match-prompt__selection-text">{selectedText}</p>
            </>
          ) : null}
        </div>
        {selectedText && (
          <div className="new-match-prompt__actions">
            <button
              type="button"
              className="new-match-prompt__button new-match-prompt__button--primary"
              onClick={onGetMatches}
            >
              Get matches
            </button>
            <button
              type="button"
              className="new-match-prompt__button new-match-prompt__button--secondary"
              onClick={onChooseManually}
            >
              Choose manually
            </button>
          </div>
        )}
      </div>
      <style>{`
        .new-match-prompt {
          padding: 32px 24px;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
        }
        .new-match-prompt__card {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          max-width: 360px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .new-match-prompt__icon {
          width: 48px;
          height: 48px;
          margin: 0 auto;
          border-radius: 50%;
          background: rgba(4, 120, 87, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .new-match-prompt__card h2 {
          margin: 0;
          font-size: 18px;
          color: #0f172a;
        }
        .new-match-prompt__card p {
          margin: 0;
          color: #475467;
          font-size: 14px;
          line-height: 1.6;
        }
        .new-match-prompt__hint {
          font-size: 12px;
          color: #94a3b8;
        }
        .new-match-prompt__selection {
          margin-top: 12px;
          text-align: left;
          width: 100%;
        }
        .new-match-prompt__selection-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: none;
          color: #94a3b8;
        }
        .new-match-prompt__selection-text {
          margin: 6px 0 0;
          padding: 12px;
          background: #f8fafc;
          border-radius: 12px;
          font-size: 14px;
          color: #0f172a;
          max-height: 96px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .new-match-prompt__actions {
          margin-top: 16px;
          display: flex;
          gap: 8px;
        }
        .new-match-prompt__button {
          flex: 1;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 600;
        }
        .new-match-prompt__button--primary {
          background: #047857;
          color: #fff;
          border: none;
        }
        .new-match-prompt__button--secondary {
          background: #f1f5f9;
          color: #0f172a;
          border: none;
        }
      `}</style>
    </div>
  )
}
