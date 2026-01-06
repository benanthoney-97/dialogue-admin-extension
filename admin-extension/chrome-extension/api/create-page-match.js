const supabase = require("./supabase-client")

const readRequestBody = (req) =>
  new Promise((resolve) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => resolve(body))
  })

const setCorsHeaders = (res) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== "POST") {
    setCorsHeaders(res)
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  try {
    const rawBody = await readRequestBody(req)
    const { phrase, document_id, provider_id, url, video_url, status, confidence } = JSON.parse(rawBody || "{}")
    const docId = Number(document_id || 0)
    const providerId = Number(provider_id || 0)
    const phraseText = (phrase || "").trim()
    const pageUrl = (url || "").toString().trim()

    if (!phraseText || !docId || !providerId || !pageUrl) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          error: "phrase, document_id, provider_id, and url are required",
        })
      )
      return
    }

    const payload = {
      phrase: phraseText,
      document_id: docId,
      provider_id: providerId,
      url: pageUrl,
      status: status || "active",
      confidence: Number(confidence ?? 0),
    }
    if (typeof video_url === "string" && video_url.trim()) {
      payload.video_url = video_url.trim()
    }

    const { data, error } = await supabase
      .from("page_matches")
      .insert(payload)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Failed to create match" }))
      return
    }

    setCorsHeaders(res)
    const normalized = { ...data, page_match_id: data.id }
    res.end(JSON.stringify(normalized))
  } catch (err) {
    console.error("[create-page-match] error", err)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: err.message }))
  }
}

module.exports = handler
