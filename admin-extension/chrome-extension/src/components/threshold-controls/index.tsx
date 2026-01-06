import { useState } from "react"
import { ThresholdSelector } from "../threshold-selector"
import { ConfirmAction } from "../confirm-action"

export interface ThresholdControlsProps {
  current: "high" | "medium" | "low"
  onChange: (value: "high" | "medium" | "low") => void
  onSave: () => void
  saving?: boolean
}

export function ThresholdControls({ current, onChange, onSave, saving = false }: ThresholdControlsProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSaveClick = () => setShowConfirm(true)
  const handleCancel = () => setShowConfirm(false)
  const handleConfirm = () => {
    setShowConfirm(false)
    onSave()
  }

  return (
    <>
      <ThresholdSelector current={current} onChange={onChange} />
      <div className="threshold-save-footer">
        <button
          type="button"
          className="threshold-save-footer__button"
          onClick={handleSaveClick}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save threshold"}
        </button>
      </div>
      <ConfirmAction
        visible={showConfirm}
        title="Persist threshold"
        message="This will mark every active match below the selected threshold as hidden. It will overwrite any previous manual changes."
        confirmLabel="Save"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}
