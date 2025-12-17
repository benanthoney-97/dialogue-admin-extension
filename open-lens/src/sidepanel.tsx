import { useState } from "react"
import "./style.css"
import { useGeminiNano } from "./hooks/useGeminiNano"
import { Send, Sparkles, BookOpen, Search } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./components/ui/conversation"
import { Response } from "./components/ui/response"

function SidePanel() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [input, setInput] = useState("")
  const { status, downloadProgress, generate } = useGeminiNano()

  // --- 1. PAGE SCANNER ---
  const getPageContent = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return ""

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Grab visible text and limit length to prevent token overflow
          return document.body.innerText.replace(/\s+/g, " ").slice(0, 15000) 
        }
      })
      
      return results[0]?.result || ""
    } catch (e) {
      console.error("Scanning failed:", e)
      return ""
    }
  }

  // --- 2. SEND HANDLER ---
  const handleSend = async (text: string = input) => {
    if (!text.trim() || status !== "ready") return

    // Add User Message
    const userMsg = { role: "user" as const, content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    // Add Placeholder for AI
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])
    
    // Determine Context (Scan page if it's the start or explicit request)
    let context = ""
    if (messages.length === 0 || text.toLowerCase().includes("page") || text.toLowerCase().includes("summarize")) {
      context = await getPageContent()
      console.log("📄 Scanned Page Context:", context.length, "chars")
    }

    // Construct Prompt
    const fullPrompt = context 
      ? `Based on this webpage content: "${context}"\n\nQuestion: ${text}`
      : text

    // Streaming Logic
    let accumulatedText = "" 

    await generate(fullPrompt, (chunk) => {
      // Logic to handle "deltas" vs "full text"
      if (chunk.startsWith(accumulatedText)) {
        accumulatedText = chunk
      } else {
        accumulatedText += chunk
      }

      setMessages((prev) => {
        const newHistory = [...prev]
        const lastIndex = newHistory.length - 1
        if (lastIndex >= 0) {
          newHistory[lastIndex] = { role: "assistant", content: accumulatedText }
        }
        return newHistory
      })
    })
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white text-gray-900 font-sans">
      
      {/* CONVERSATION AREA */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="OpenLens"
                description="I can read this page to answer questions or summarize content."
                icon={<div className="bg-blue-600 p-3 rounded-full"><Sparkles className="h-6 w-6 text-white" /></div>}
              />
            ) : (
              messages.map((msg, i) => {
                // Don't render assistant message until it has content
                if (msg.role === "assistant" && !msg.content) return null

                // Debug Log to check data flow
                if (msg.role === "assistant") {
                   // console.log(`📝 Rendering Msg #${i} (Assistant):`, msg.content.slice(0, 20) + "...")
                }

                return (
                <div
                  key={i}
                  className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >

<div
  className={`max-w-[90%] text-sm leading-relaxed animate-message ${ // <--- ADD animate-message HERE
    msg.role === "user"
      ? "bg-blue-600 text-white shadow-sm rounded-2xl px-4 py-2.5" 
      : "text-gray-800 px-1 py-1" 
  }`}
>
  {msg.role === "assistant" ? (
    <Response>{msg.content}</Response>
  ) : (
    msg.content
  )}
</div>
                </div>
              )})
            )}
            
            {/* Download Progress Bar */}
            {status === "downloading" && (
              <div className="flex justify-center p-4">
                 <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                   Downloading AI Model... {downloadProgress}%
                 </span>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bottom-20" />
        </Conversation>
      </div>

      {/* INPUT AREA */}
      <div className="border-t bg-white p-4">
        {messages.length === 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { label: "Summarize this page", icon: BookOpen },
              { label: "Key points of this page", icon: Search },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.label)}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
              >
                <action.icon className="h-3 w-3" />
                {action.label.replace(" this page", "")}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question..."
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || status !== 'ready'}
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SidePanel