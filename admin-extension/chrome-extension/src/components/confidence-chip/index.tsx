import React from "react"
import { computeConfidenceChipStyle } from "./metadata"

export interface ConfidenceChipProps {
  label?: string
  color?: string
  text?: string
  className?: string
}

export function ConfidenceChip({ label, color, text, className = "" }: ConfidenceChipProps) {
  const style = computeConfidenceChipStyle(label, color)

  return (
    <span className={`confidence-chip ${className}`} style={style}>
      {text ?? label ?? "Match"}
      <style>{`
        .confidence-chip {
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
        }
      `}</style>
    </span>
  )
}
