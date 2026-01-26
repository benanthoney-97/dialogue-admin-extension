import React from "react"
import { computeConfidenceChipStyle } from "./metadata"

export interface ConfidenceChipProps {
  label?: string
  color?: string
  text?: string
  className?: string
  icon?: React.ReactNode
}

export function ConfidenceChip({ label, color, text, className = "", icon }: ConfidenceChipProps) {
  const style = computeConfidenceChipStyle(label, color)

  return (
    <span className={`confidence-chip ${className}`} style={style}>
      {icon && <span className="confidence-chip__icon">{icon}</span>}
      {text ?? label ?? "Match"}
      <style>{`
        .confidence-chip {
          padding: 4px 0px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: left;
          gap: 4px;
          justify-content: left;
          transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
        }
        .confidence-chip__icon {
          display: inline-flex;
          align-items: left;
          justify-content: left;
          line-height: 0;
        }
      `}</style>
    </span>
  )
}
