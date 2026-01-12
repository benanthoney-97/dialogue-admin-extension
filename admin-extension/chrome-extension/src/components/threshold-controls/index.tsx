import { useState } from "react"
import { ThresholdSelector } from "../threshold-selector"
import { ConfirmAction } from "../confirm-action"

export interface ThresholdControlsProps {
  value: number
  onChange: (value: number) => void
}

export function ThresholdControls({ value, onChange }: ThresholdControlsProps) {
  return <ThresholdSelector value={value} onChange={(next) => onChange(next)} />
}
