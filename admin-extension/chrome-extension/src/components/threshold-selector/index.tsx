import React from "react"

export interface ThresholdSelectorProps {
  current: "high" | "medium" | "low"
  onChange?: (value: "high" | "medium" | "low") => void
}

const LABELS: Record<ThresholdSelectorProps["current"], { title: string; description: string }> = {
  high: { title: "High", description: "Only show very confident matches" },
  medium: { title: "Medium", description: "Balance recall and precision" },
  low: { title: "Low", description: "Surface more matches across the site" },
}

export function ThresholdSelector({ current, onChange }: ThresholdSelectorProps) {
  return (
    <div className="threshold-selector">
      <div className="threshold-selector__label">
        <strong>Match threshold</strong>
        <p>{LABELS[current].description}</p>
      </div>
      <div className="threshold-selector__options">
        {(["high", "medium", "low"] as ThresholdSelectorProps["current"][]).map((value) => (
          <button
            type="button"
            key={value}
            className={`threshold-selector__option ${current === value ? "is-active" : ""}`}
            onClick={() => onChange?.(value)}
          >
            {LABELS[value].title}
          </button>
        ))}
      </div>
      <style>{`
        .threshold-selector {
          padding: 12px 16px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .threshold-selector__label {
          font-size: 13px;
          color: #475467;
        }
        .threshold-selector__label strong {
          display: block;
          color: #0f172a;
          font-size: 14px;
        }
        .threshold-selector__options {
          display: flex;
          gap: 6px;
        }
        .threshold-selector__option {
          flex: 1;
          border: 1px solid #cbd5f5;
          border-radius: 999px;
          padding: 6px 12px;
          background: #fff;
          color: #0f172a;
          cursor: pointer;
          transition: background 0.2s ease, border 0.2s ease;
        }
        .threshold-selector__option.is-active {
          background: #eef2ff;
          border-color: #7c5afe;
          color: #3b20a8;
        }
        .threshold-selector__option:hover {
          border-color: #7c5afe;
        }
      `}</style>
    </div>
  )
}
