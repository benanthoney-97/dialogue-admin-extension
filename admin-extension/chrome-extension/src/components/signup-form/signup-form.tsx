import { useState } from "react"
import "../login-form/login-form.css"

type SignUpFormProps = {
  onRequestOtp: (email: string) => Promise<void>
  onVerifyOtp: (email: string, otp: string, displayName: string) => Promise<void>
  onSwitchAuthMode: (mode: "login" | "signup") => void
}

export function SignUpForm({ onRequestOtp, onVerifyOtp, onSwitchAuthMode }: SignUpFormProps) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [otp, setOtp] = useState("")
  const [stage, setStage] = useState<"email" | "otp">("email")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const handleSendOtp = async () => {
    setError(null)
    if (!email) {
      setError("Enter your email")
      return
    }
    if (!displayName) {
      setError("Add a name so we can personalize your experience")
      return
    }
    try {
      await onRequestOtp(email)
      setStage("otp")
      setInfo("OTP sent—check your inbox to finish signing up")
    } catch (err: any) {
      setError(err?.message || "Unable to request OTP")
    }
  }

  const handleVerify = async () => {
    setError(null)
    if (!otp) {
      setError("Enter the OTP you received")
      return
    }
    try {
      await onVerifyOtp(email, otp, displayName)
    } catch (err: any) {
      setError(err?.message || "OTP verification failed")
    }
  }

  return (
    <div className="login-form">
      <div className="login-form__header">Sign up</div>
      <div className="login-form__subtitle">
        Enter your details to get started.
      </div>
      <label className="login-form__label">
        Display name
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={stage === "otp"}
        />
      </label>
      <label className="login-form__label">
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={stage === "otp"}
        />
      </label>
      {stage === "otp" && (
        <label className="login-form__label">
          OTP
          <input type="text" value={otp} onChange={(event) => setOtp(event.target.value)} />
        </label>
      )}
      {error && <div className="login-form__error">{error}</div>}
      {info && <div className="login-form__info">{info}</div>}
      <div className="login-form__actions">
        {stage === "email" ? (
          <button type="button" onClick={handleSendOtp}>
            <span className="login-form__button-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z"/>
              </svg>
            </span>
            Send OTP
          </button>
        ) : (
          <button type="button" onClick={handleVerify}>
            Verify OTP &amp; create account
          </button>
        )}
      </div>
      <div className="login-form__footer">
        <span>Already have an account?</span>
        <button
          type="button"
          className="login-form__link"
          onClick={() => onSwitchAuthMode("login")}
        >
          Log in
        </button>
      </div>
    </div>
  )
}
