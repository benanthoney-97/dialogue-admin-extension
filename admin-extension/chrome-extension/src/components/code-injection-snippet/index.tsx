import React, { useCallback, useMemo, useState } from "react"

export interface CodeInjectionSnippetProps {
  providerId?: number | null
}

export function CodeInjectionSnippet({ providerId }: CodeInjectionSnippetProps) {
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
    } catch (error) {
      console.error("[code-injection-snippet] copy failed", error)
    }
  }, [])

  const ariaLabel = useMemo(() => (copied ? "Snippet copied" : "Copy snippet to clipboard"), [copied])

  return (
    <div className="code-injection-snippet">
      <div className="code-injection-snippet__header">
        <span>For your website header</span>
      </div>
      <div className="code-injection-snippet__container">
        <button type="button" className="code-injection-snippet__copy" onClick={handleCopy} aria-label={ariaLabel}>
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="code-injection-snippet__code">
          <code>{snippet}</code>
        </pre>
      </div>
      <style>
        {`
        .code-injection-snippet {
          background: transparent;
          color: #0f172a;
          border-radius: 16px;
          padding: 16px 0;
        }
        .code-injection-snippet__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-weight: 600;
          font-family: inherit;
        }
        .code-injection-snippet__copy {
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          background: #f8fafc;
          color: #0f172a;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;
          position: absolute;
          top: 8px;
          right: 8px;
        }
        .code-injection-snippet__copy:active {
          transform: translateY(1px);
        }
        .code-injection-snippet__container {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(248, 250, 252, 0.4);
          border-radius: 12px;
          padding: 12px;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
          text-align: left;
          position: relative;
        }
        .code-injection-snippet__code {
          font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
          margin: 0;
          background: transparent;
          padding-right: 12px;
          max-height: 160px;
          overflow: auto;
        }
        `}
      </style>
    </div>
  )
}
