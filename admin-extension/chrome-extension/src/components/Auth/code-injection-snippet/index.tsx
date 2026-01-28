import React, { useCallback, useMemo, useState } from "react"

export interface CodeInjectionSnippetProps {
  providerId?: number | null
  onCopy?: () => void
  showHeader?: boolean
}

export function CodeInjectionSnippet({ providerId, onCopy, showHeader = true }: CodeInjectionSnippetProps) {
  const [copied, setCopied] = useState(false)
  const snippet = useMemo(() => {
    const idPart = providerId ?? "YOUR_PROVIDER_ID"
    return `<script>
  window.__SL_API_ORIGIN = "https://app.dialogue-ai.co";
</script>
<script src="https://app.dialogue-ai.co/admin-script/admin-script.js"></script>
<script>
  if (window.__SL_adminScript && typeof window.__SL_adminScript.init === "function") {
    window.__SL_adminScript.init({
      providerId: ${idPart},
    });
  }
</script>`
  }, [providerId])

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = snippet
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      onCopy?.()
    } catch (error) {
      console.error("[code-injection-snippet] copy failed", error)
    }
  }, [])

  const ariaLabel = useMemo(() => (copied ? "Snippet copied" : "Copy snippet to clipboard"), [copied])

  return (
    <div className="code-injection-snippet">
      <div className="code-injection-snippet__container">
        <pre className="code-injection-snippet__code">
          <code>{snippet}</code>
        </pre>
      </div>
      <button type="button" className="code-injection-snippet__copy" onClick={handleCopy} aria-label={ariaLabel}>
        {copied ? "Copied" : "Copy"}
      </button>
      <style>
        {`
        .code-injection-snippet {
          background: #ffffff;
          color: #0f172a;
          border: none;
          border-radius: 16px;
          padding: 16px;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .code-injection-snippet__container {
          border: none;
          border-radius: 12px 12px 0 0;
          background: #e3ebff;
          padding: 12px 16px;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
          text-align: left;
          width: 100%;
          box-sizing: border-box;
        }
        .code-injection-snippet__code {
          font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
          margin: 0;
          background: transparent;
          padding: 0;
          max-height: 160px;
          overflow: auto;
          width: 100%;
          box-sizing: border-box;
        }
        .code-injection-snippet__copy {
          border: none;
          border-radius: 12px;
          padding: 12px 16px;
          background: #0f1727;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          text-align: center;
          transition: transform 0.2s ease;
        }
        .code-injection-snippet__copy:active {
          transform: translateY(1px);
        }
        `}
      </style>
    </div>
  )
}
