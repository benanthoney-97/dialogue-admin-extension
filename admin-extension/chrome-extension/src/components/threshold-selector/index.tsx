import React from "react"
import {
  THRESHOLD_DISPLAY,
  THRESHOLD_LEVELS,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  THRESHOLD_STEP,
  determineThresholdLevel,
} from "../../utils/threshold"

export interface ThresholdSelectorProps {
  value: number
  onChange?: (value: number) => void
}

export function ThresholdSelector({ value, onChange }: ThresholdSelectorProps) {
  const level = determineThresholdLevel(value)
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value)
    if (!Number.isNaN(parsed)) {
      onChange?.(parsed)
    }
  }

  return (
    <div className="threshold-selector">
      <div className="threshold-selector__label">
        <strong>Match sensitivity</strong>
        <p>Decide the volume of matches on active pages</p>
      </div>
      <div className="threshold-selector__slider">
        <input
          type="range"
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          step={THRESHOLD_STEP}
          value={value}
          onChange={handleChange}
        />
        <div className="threshold-selector__levels">
          {THRESHOLD_LEVELS.map((levelKey) => (
            <span key={levelKey} className={levelKey === level ? "is-active" : ""}>
              {THRESHOLD_DISPLAY[levelKey].title}
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
          color: #1f2937;
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
          background: #172554;
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
          flex: 0;
          font-weight: 600;
        }
        .threshold-selector__levels span:first-child {
          text-align: left;
        }
        .threshold-selector__levels span:nth-child(2) {
          text-align: center;
          flex: 1;
        }
        .threshold-selector__levels span:last-child {
          text-align: right;
        }
        .threshold-selector__levels span.is-active {
          color: #5f61fb;
        }
      `}</style>
    </div>
  )
}
