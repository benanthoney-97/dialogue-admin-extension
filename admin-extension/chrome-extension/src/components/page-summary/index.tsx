import React from "react"

export interface PageSummaryProps {
  pageUrl: string
  activeMatches: number
  inactiveMatches: number
}

export function PageSummary({ pageUrl, activeMatches, inactiveMatches }: PageSummaryProps) {
  return (
    <div className="page-summary">
      <div className="page-summary__url">
        <span className="page-summary__label">Page</span>
        <div title={pageUrl}>{pageUrl}</div>
      </div>
      <div className="page-summary__stats">
        <div>
          <span className="page-summary__label">Active</span>
          <strong>{activeMatches}</strong>
        </div>
        <div>
          <span className="page-summary__label">Inactive</span>
          <strong>{inactiveMatches}</strong>
        </div>
      </div>
      <style>{`
        .page-summary {
          padding: 14px 16px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          margin-bottom: 12px;
        }
        .page-summary__url {
          font-size: 13px;
          color: #475467;
          margin-bottom: 6px;
        }
        .page-summary__url div {
          font-size: 13px;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-summary__stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #475467;
        }
        .page-summary__label {
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 11px;
          margin-bottom: 2px;
        }
        .page-summary__stats strong {
          font-size: 16px;
          color: #0f172a;
        }
      `}</style>
    </div>
  )
}
