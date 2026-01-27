const ENDPOINTS = {
  requestOtp: "/api/auth/request-otp",
  verifyOtp: "/api/auth/verify-otp",
}

const buildUrl = (base, path) => {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`
  if (!base) {
    return sanitizedPath
  }
  const trimmedBase = base.replace(/\/+$/, "")
  return `${trimmedBase}${sanitizedPath}`
}

const jsonFetch = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMessage = `${response.status} ${response.statusText}`
    try {
      const errorBody = await response.json()
      if (errorBody && errorBody.error) {
        errorMessage = errorBody.error
      } else if (errorBody && errorBody.message) {
        errorMessage = errorBody.message
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage)
  }

  return response.json()
}

const setMessage = (element, message) => {
  if (!element) return
  element.textContent = message || ""
}

const setButtonState = (button, disabled) => {
  if (!button) return
  button.disabled = disabled
  if (disabled) {
    button.setAttribute("aria-busy", "true")
  } else {
    button.removeAttribute("aria-busy")
  }
}

const persistAuth = (data) => {
  if (!data || !data.token) return
  try {
    localStorage.setItem("dialogue-web-auth-token", data.token)
    localStorage.setItem("dialogue-web-auth-email", data.email || "")
    if (data.provider_id) {
      localStorage.setItem("dialogue-web-auth-provider-id", String(data.provider_id))
    }
  } catch (error) {
    console.warn("Unable to persist auth data in localStorage", error)
  }
}

export function setupOtpForm(options) {
  const {
    formId,
    apiBase,
    successCopy = "You're authenticated and can now return to the admin tools.",
    onSuccess,
    successRedirect,
  } = options || {}

  if (!formId) {
    console.warn("setupOtpForm requires a formId")
    return
  }

  const form = document.getElementById(formId)
  if (!form) {
    console.warn(`OTP form "${formId}" not found`)
    return
  }

  const emailInput = form.querySelector('input[name="email"]')
  const otpInput = form.querySelector('input[name="otp"]')
  const sendButton = form.querySelector('[data-action="send-otp"]')
  const verifyButton = form.querySelector('[data-action="verify-otp"]')
  const errorEl = form.querySelector('[data-role="error"]')
  const infoEl = form.querySelector('[data-role="info"]')
  const otpGroup = form.querySelector(".auth-form__otp-group")

  if (!emailInput || !otpInput || !sendButton || !verifyButton || !otpGroup) {
    console.warn("OTP form is missing required fields")
    return
  }

  const datasetBase = typeof form.dataset.apiBase !== "undefined" ? form.dataset.apiBase : ""
  const globalBase = (typeof window !== "undefined" && window.__WEB_PLATFORM_API_BASE__) || ""
  const resolvedBase = apiBase || datasetBase || globalBase

  let stage = "email"

  const setStage = (nextStage) => {
    stage = nextStage
    const isOtpStage = stage === "otp"
    otpGroup.classList.toggle("visible", isOtpStage)
    verifyButton.classList.toggle("hidden", !isOtpStage)
    sendButton.textContent = isOtpStage ? "Resend OTP" : "Send OTP"
  }

  const clearMessages = () => {
    setMessage(errorEl, "")
    setMessage(infoEl, "")
  }

  const handleSendOtp = async () => {
    clearMessages()
    const email = (emailInput.value || "").trim().toLowerCase()
    if (!email) {
      setMessage(errorEl, "Enter your email")
      return
    }
    setButtonState(sendButton, true)
    try {
      const payload = await jsonFetch(buildUrl(resolvedBase, ENDPOINTS.requestOtp), { email })
      const ttl = payload && payload.expires_in
      const ttlMinutes = ttl ? ` · expires in ${Math.max(1, Math.round(ttl / 60))} minutes` : ""
      setMessage(infoEl, `Code sent—check your inbox${ttlMinutes}`)
      setStage("otp")
      otpInput.focus()
    } catch (error) {
      setMessage(errorEl, (error && error.message) || "Unable to request OTP")
    } finally {
      setButtonState(sendButton, false)
    }
  }

  const handleVerifyOtp = async () => {
    clearMessages()
    const email = (emailInput.value || "").trim().toLowerCase()
    const otp = (otpInput.value || "").trim()
    if (!email) {
      setMessage(errorEl, "Enter your email before verifying")
      return
    }
    if (!otp) {
      setMessage(errorEl, "Enter the OTP you received")
      return
    }
    setButtonState(verifyButton, true)
    try {
      const payload = await jsonFetch(buildUrl(resolvedBase, ENDPOINTS.verifyOtp), { email, otp })
      persistAuth(payload)
      setMessage(infoEl, successCopy)
      if (typeof onSuccess === "function") {
        onSuccess(payload, email, otp)
      }
      if (successRedirect) {
        window.location.href = successRedirect
      }
    } catch (error) {
      setMessage(errorEl, (error && error.message) || "OTP verification failed")
      otpInput.focus()
    } finally {
      setButtonState(verifyButton, false)
    }
  }

  sendButton.addEventListener("click", handleSendOtp)
  verifyButton.addEventListener("click", handleVerifyOtp)

  setStage("email")
}
