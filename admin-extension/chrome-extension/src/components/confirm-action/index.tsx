import React from "react"

export interface ConfirmActionProps {
  visible: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  confirmDisabled?: boolean
  confirmLoadingLabel?: string
}

export function ConfirmAction({
  visible,
  title,
  message,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmDisabled = false,
  confirmLoadingLabel,
}: ConfirmActionProps) {
  if (!visible) return null
  return (
    <div className="confirm-action">
      <div className="confirm-action__backdrop" onClick={onCancel} />
      <div className="confirm-action__card">
        {title && <strong>{title}</strong>}
        <p>{message}</p>
        <div className="confirm-action__controls">
          <button type="button" className="confirm-action__button confirm-action__button--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-action__button confirm-action__button--confirm"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmDisabled ? confirmLoadingLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        .confirm-action {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .confirm-action__backdrop {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
        }
        .confirm-action__card {
          position: relative;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 65px rgba(15, 23, 42, 0.2);
          padding: 24px;
          max-width: 320px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          text-align: left;
        }
        .confirm-action__card strong {
          font-size: 16px;
          color: #0f172a;
        }
        .confirm-action__card p {
          margin: 0;
          color: #475467;
          font-size: 14px;
        }
        .confirm-action__controls {
          display: flex;
          gap: 8px;
        }
        .confirm-action__button {
          flex: 1;
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 8px 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .confirm-action__button--confirm {
          color: #fff;
          cursor: pointer;
          white-space: nowrap;
          background: #1f2937;
          border: none;
          border-radius: 8px;
          align-items: center;
          gap: 6px;
          display: inline-flex;
          padding: 8px 16px;
          font-size: 13px;
          transition: transform 0.2s, box-shadow 0.2s;
          justify-content: center;
        }
        .confirm-action__button--cancel {
          background: #f8fafc;
          color: #0f172a;
          border-color: #cbd5f5;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}
