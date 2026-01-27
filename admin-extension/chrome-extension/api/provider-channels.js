const supabase = require("./supabase-client")

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

async function handler(req, res) {
  setCorsHeaders(res)
  if (req.method === "OPTIONS") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end()
    return
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const providerId = Number(requestUrl.searchParams.get("provider_id"))
  if (!providerId) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "provider_id is required" }))
    return
  }

  const { data, error } = await supabase
    .from("provider_channels")
    .select(
      "id,provider_id,platform,channel_url,name,channel_description,video_count,cover_image,channel_playlists(id,title,cover_image,video_count,description)"
    )
    .eq("provider_id", providerId)
    .order("id")

  if (error) {
    console.error("[provider-channels] error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
    return
  }

  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ channels: data ?? [] }))
}

module.exports = handler
