export type ThresholdLevel = "high" | "medium" | "low"

export const THRESHOLD_MIN = 0.4
export const THRESHOLD_MAX = 0.75
export const THRESHOLD_STEP = 0.01
export const THRESHOLD_DEFAULT = 0.6

export const THRESHOLD_LEVELS: ThresholdLevel[] = ["low", "medium", "high"]

export const THRESHOLD_DISPLAY: Record<ThresholdLevel, { title: string; description: string }> = {
  high: {
    title: "Strict",
    description: "Shows high confidence matches only.",
  },
  medium: {
    title: "Balanced",
    description: "Balances relevance and volume of matches.",
  },
  low: {
    title: "Relaxed",
    description: "Shows a broader set of matches.",
  },
}

export const THRESHOLD_VALUE_MAP: Record<ThresholdLevel, number> = {
  high: THRESHOLD_MAX,
  medium: THRESHOLD_DEFAULT,
  low: THRESHOLD_MIN,
}

export const determineThresholdLevel = (value: number): ThresholdLevel => {
  if (value >= THRESHOLD_MAX) return "high"
  if (value <= THRESHOLD_MIN) return "low"
  return "medium"
}

export const clampThresholdValue = (value: number): number =>
  Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, value))
