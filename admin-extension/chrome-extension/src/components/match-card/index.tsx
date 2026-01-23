import React from "react"
import { ConfidenceChip } from "../confidence-chip"
import "./match-card.css"

export interface MatchCardProps {
  phrase: string
  coverImageUrl?: string | null
  documentTitle?: string | null
  confidenceLabel?: string
  confidenceColor?: string
  pillText?: string
  count?: number
  showArrow?: boolean
  pillIcon?: React.ReactNode
  onClick?: () => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onFocus?: () => void
  onBlur?: () => void
}

export function MatchCard({
  phrase,
  coverImageUrl,
  documentTitle,
  confidenceLabel,
  confidenceColor,
  pillText,
  count,
  pillIcon,
  showArrow = true,
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: MatchCardProps) {
  return (
    <article
      className="match-card"
      role="button"
      tabIndex={0}
      aria-label="Open match decision card"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className="match-card__title">
        <p className="match-card__phrase">
          <strong className="match-card__phrase-label">Site text:</strong>
          <span className="match-card__phrase-copy">{phrase}</span>
        </p>
      </div>
      <div className="match-card__row">
        {showArrow && (
          <div className="match-card__arrow" aria-hidden="true">
            <span>▼</span>
          </div>
        )}
        <ConfidenceChip
          className="match-card__pill"
          label={confidenceLabel}
          color={confidenceColor}
          text={pillText}
          icon={pillIcon}
        />
      </div>
      <div className="match-card__video">
        <div className="match-card__video-thumb">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="match-card__video-placeholder">▶</span>
          )}
        </div>
        <div className="match-card__video-details">
          <span className="match-card__video-title">
            <strong className="match-card__video-label">Video:</strong>{" "}
            {documentTitle || "Untitled video"}
          </span>
        </div>
      </div>
      {typeof count === "number" && (
        <span className="analytics-view__most-clicked-count">×{count}</span>
      )}
    </article>
  )
}
