import { useState } from "react"
import { ThresholdSelector } from "../threshold-selector"
import { ConfirmAction } from "../confirm-action"

export interface ThresholdControlsProps {
  current: "high" | "medium" | "low"
  hasPendingChanges: boolean
  onChange: (value: "high" | "medium" | "low") => void
  onSave: () => void
  saving?: boolean
}

export function ThresholdControls({ current, hasPendingChanges, onChange, onSave, saving = false }: ThresholdControlsProps) {
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
      {(hasPendingChanges || saving) && (
        <div className="threshold-save-footer">
          <button
            type="button"
            className="threshold-save-footer__button"
            onClick={handleSaveClick}
            disabled={saving || !hasPendingChanges}
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
                </svg>
                <span>Save threshold</span>
              </>
            )}
          </button>
        </div>
      )}
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
