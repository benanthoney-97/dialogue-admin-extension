const supabase = require("./supabase-client")

const readRequestBody = (req) =>
  new Promise((resolve) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => resolve(body))
  })

// Helper to set CORS headers consistently
const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*") // Or your specific extension ID if preferred
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  // Note: Content-Type for the response is usually set when writing the body, but good to have here if we send JSON
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"

const parseMetadata = (value) => {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  return typeof value === "object" ? value : {}
}

const normalizeSourceUrl = (value) => {
  if (!value) return ""
  try {
    const parsed = new URL(value, "http://example.com")
    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`
    return normalized.replace(/\/$/, "")
  } catch {
    const [base] = value.split("#")
    return base.trim()
  }
}

const extractVideoId = (value) => {
  if (!value) return null
  try {
    const url = new URL(value, "http://example.com")
    const host = url.hostname.toLowerCase()
    if (host.includes("vimeo.com")) {
      const pathParts = url.pathname.split("/").filter(Boolean)
      return pathParts[pathParts.length - 1]
    }
  } catch {}
  const match = value.match(/(\d{7,})/)
  return match ? match[1] : null
}

const computeCosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    const ai = Number(a[i]) || 0
    const bi = Number(b[i]) || 0
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  if (normA === 0 || normB === 0) return null
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))))
}

const fetchEmbedding = async (text) => {
  if (!text || !OPENAI_API_KEY) return null
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: OPENAI_EMBEDDING_MODEL,
    }),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || "Failed to fetch embedding")
  }
  return payload.data?.[0]?.embedding || null
}

const normalizeEmbedding = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

const normalizeText = (value) => {
  if (typeof value !== "string") return ""
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

const extractFirstSentence = (value) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  const match = trimmed.match(/^(.*?[.?!])(\s|$)/u)
  if (match && match[1]) {
    return match[1]
  }
  return trimmed
}

const findMatchingSiteContent = async (providerId, normalizedPhrase) => {
  if (!providerId || !normalizedPhrase) return null
  const { data: contentRows, error: contentError } = await supabase
    .from("site_content")
    .select("id, chunk_text")
    .eq("provider_id", providerId)
  if (contentError || !Array.isArray(contentRows)) return null
  for (const chunk of contentRows) {
    const chunkText = chunk.chunk_text
    if (!chunkText) continue
    const normalizedChunkText = normalizeText(chunkText)
    if (normalizedChunkText && normalizedChunkText === normalizedPhrase) {
      return chunk.id
    }
  }
  return null
}

const findMatchingChunk = (chunks, normalizedSource, timestamp) => {
  if (!Array.isArray(chunks)) return null
  const requestedId = extractVideoId(normalizedSource)
  for (const chunk of chunks) {
    const metadata = parseMetadata(chunk.metadata)
    const sourceValue = normalizeSourceUrl(metadata.source || metadata.source_url)
    const chunkVideoId = extractVideoId(sourceValue)
    if (!sourceValue || sourceValue !== normalizedSource) {
      if (!requestedId || !chunkVideoId || requestedId !== chunkVideoId) {
        continue
      }
    }
    if (typeof timestamp === "number") {
      const start = Number(metadata.timestampStart ?? metadata.timestamp_start ?? 0)
      const end = Number(metadata.timestampEnd ?? metadata.timestamp_end ?? 0)
      if (start || end) {
        const paddedEnd = end || start
        if (timestamp < start || (paddedEnd && timestamp > paddedEnd + 1)) {
          continue
        }
      }
    }
    const embeddingArray = normalizeEmbedding(chunk.embedding)
    if (embeddingArray && embeddingArray.length) {
      chunk.embedding = embeddingArray
      return chunk
    }
  }
  return null
}

async function handler(req, res) {
  // --- FIX START: Set CORS headers immediately for ALL requests ---
  setCorsHeaders(res)

  // --- FIX START: Handle the Preflight (OPTIONS) check ---
  if (req.method === "OPTIONS") {
    res.writeHead(200) // 200 OK says "Yes, you can proceed"
    res.end()
    return
  }
  // --- FIX END ---

  // Basic method check for the actual request
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  try {
    const rawBody = await readRequestBody(req)
    const {
      phrase,
      document_id,
      provider_id,
      url,
      video_url,
      status,
      confidence,
      selected_timestamp,
    } = JSON.parse(rawBody || "{}")

    const docId = Number(document_id || 0)
    const providerId = Number(provider_id || 0)
    const phraseText = (phrase || "").trim()
    const pageUrl = (url || "").toString().trim()
    const baseVideoUrl = normalizeSourceUrl(video_url || "")
    const parsedTimestamp =
      typeof selected_timestamp === "number"
        ? selected_timestamp
        : selected_timestamp
        ? Number(selected_timestamp)
        : null
    const timestampValue = Number.isFinite(parsedTimestamp) ? parsedTimestamp : null

    if (!phraseText || !docId || !providerId || !pageUrl) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          error: "phrase, document_id, provider_id, and url are required",
        })
      )
      return
    }

    let knowledgeChunk = null
    let manualConfidence = null

    if (baseVideoUrl) {
      const { data: chunkRows, error: chunkError } = await supabase
        .from("provider_knowledge")
        .select("id, embedding, metadata")
        .eq("document_id", docId)
        .eq("provider_id", providerId)
        .limit(100)
      if (chunkError) {
        // silently ignore or log error if needed
      } else {
        knowledgeChunk = findMatchingChunk(chunkRows, baseVideoUrl, timestampValue)
      }
    }

    if (knowledgeChunk && OPENAI_API_KEY) {
      try {
        const queryEmbedding = await fetchEmbedding(phraseText)
        if (queryEmbedding) {
          manualConfidence = computeCosineSimilarity(queryEmbedding, knowledgeChunk.embedding)
        }
      } catch (err) {
        console.warn("[create-page-match] embedding error", err.message || err)
      }
    }

    const normalizedPhraseText = normalizeText(phraseText)
    const normalizedFirstSentence = normalizeText(extractFirstSentence(phraseText))
    const targetNormalizedPhrase = normalizedFirstSentence || normalizedPhraseText
    const matchedSiteContentId =
      targetNormalizedPhrase && providerId
        ? await findMatchingSiteContent(providerId, targetNormalizedPhrase)
        : null

    const payload = {
      phrase: phraseText,
      document_id: docId,
      provider_id: providerId,
      url: pageUrl,
      status: status || "active",
      confidence: Number(confidence ?? manualConfidence ?? 0),
      match_source: "user-created",
    }
    if (typeof video_url === "string" && video_url.trim()) {
      payload.video_url = video_url.trim()
    }
    if (knowledgeChunk?.id) {
      payload.knowledge_id = knowledgeChunk.id
    }
    if (matchedSiteContentId) {
      payload.site_content_id = matchedSiteContentId
    }

    console.log("[create-page-match] inserting page match payload", payload)
    const { data, error } = await supabase
      .from("page_matches")
      .insert(payload)
      .select()
      .maybeSingle()

    console.log("[create-page-match] inserted page_match payload", {
      payload,
      matched: data,
    })

    if (error) throw error
    if (!data) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Failed to create match" }))
      return
    }

    // setCorsHeaders(res) <-- Removed this duplicate call since we did it at the top
    const normalized = { ...data, page_match_id: data.id }
    
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(normalized))
  } catch (err) {
    console.error("[create-page-match] error", err)
    // CORS headers are already set, so browser will allow the frontend to read this error
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: err.message }))
  }
}

module.exports = handler
