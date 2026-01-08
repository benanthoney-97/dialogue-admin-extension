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

const ORDERED_LEVELS: ThresholdSelectorProps["current"][] = ["low", "medium", "high"]
const VALUE_MAP: Record<ThresholdSelectorProps["current"], number> = {
  low: 0,
  medium: 1,
  high: 2,
}
const LEVEL_FROM_VALUE = (value: number) => {
  if (value <= 0) return "low"
  if (value === 1) return "medium"
  return "high"
}

export function ThresholdSelector({ current, onChange }: ThresholdSelectorProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value)
    if (!Number.isNaN(parsed)) {
      onChange?.(LEVEL_FROM_VALUE(parsed))
    }
  }

  return (
    <div className="threshold-selector">
      <div className="threshold-selector__label">
        <strong>Match threshold</strong>
        <p>{LABELS[current].description}</p>
      </div>
      <div className="threshold-selector__slider">
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={VALUE_MAP[current]}
          onChange={handleChange}
        />
        <div className="threshold-selector__levels">
          {ORDERED_LEVELS.map((level) => (
            <span key={level} className={level === current ? "is-active" : ""}>
              {LABELS[level].title}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .threshold-selector {
          padding: 12px 16px;
          border-radius: 12px;
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
          text-align: left;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .threshold-selector__slider input[type="range"] {
          width: 100%;
          height: 4px;
          appearance: none;
          border-radius: 999px;
          background: linear-gradient(90deg, #c4b5fd 0%, #a855f7 100%);
          outline: none;
        }
        .threshold-selector__slider input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #5f61fb;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
          cursor: pointer;
        }
        .threshold-selector__slider input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #5f61fb;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
          cursor: pointer;
        }
        .threshold-selector__levels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #475467;
          margin-top: 6px;
        }
        .threshold-selector__levels span {
          flex: 1;
          text-align: center;
          font-weight: 600;
        }
        .threshold-selector__levels span.is-active {
          color: #5f61fb;
        }
      `}</style>
    </div>
  )
}
