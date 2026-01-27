const supabase = require("./supabase-client")

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  let body = ""
  req.on("data", (chunk) => {
    body += chunk
  })

  await new Promise((resolve) => req.on("end", resolve))

  let payload
  try {
    payload = JSON.parse(body || "{}")
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Invalid JSON" }))
    return
  }

  const providerId = Number(payload.provider_id)
  const documents = Array.isArray(payload.documents) ? payload.documents : []

  if (!providerId) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "provider_id is required" }))
    return
  }

  const validDocs = documents
    .map((doc) => ({
      provider_id: providerId,
      title: doc.title ?? null,
      source_url: doc.source_url ?? null,
      media_type: doc.media_type ?? "video",
      cover_image_url: doc.cover_image_url ?? null,
      is_active: doc.is_active ?? true,
      created_at: doc.created_at ?? null,
    }))
    .filter((doc) => doc.source_url)

  if (validDocs.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "No valid documents provided" }))
    return
  }

  const { error } = await supabase
    .from("provider_documents")
    .upsert(validDocs, { onConflict: "provider_id,source_url" })

  if (error) {
    console.error("[import-provider-documents] error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
    return
  }

  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ inserted: validDocs.length }))
}

module.exports = handler
