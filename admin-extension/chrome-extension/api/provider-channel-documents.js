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
  const channelId = Number(requestUrl.searchParams.get("channel_id"))
  if (!providerId || !channelId) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({ error: "provider_id and channel_id are required" })
    )
    return
  }

  const { data: channelData, error: channelError } = await supabase
    .from("provider_channels")
    .select(
      "id,platform,channel_url,name,channel_description,video_count,cover_image,channel_playlists(id,title,cover_image,video_count,description)"
    )
    .eq("provider_id", providerId)
    .eq("id", channelId)
    .single()

  if (channelError) {
    console.error("[provider-channel-documents] channel lookup failed", channelError)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: channelError.message }))
    return
  }

  const { data: documents, error: docsError } = await supabase
    .from("provider_documents")
    .select("*")
    .eq("provider_id", providerId)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })

  if (docsError) {
    console.error("[provider-channel-documents] documents error", docsError)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: docsError.message }))
    return
  }

  const playlistLatest = new Map()
  documents?.forEach((doc) => {
    if (!doc.playlist_id) return
    const current = playlistLatest.get(doc.playlist_id)
    const created = doc.created_at ? new Date(doc.created_at).getTime() : 0
    if (!current || created > current) {
      playlistLatest.set(doc.playlist_id, created)
    }
  })

  const playlists = Array.isArray(channelData?.channel_playlists)
    ? [...channelData.channel_playlists]
    : []
  playlists.sort((a, b) => {
    const aTime = playlistLatest.get(a.id) ?? 0
    const bTime = playlistLatest.get(b.id) ?? 0
    return bTime - aTime
  })

  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(
    JSON.stringify({
      channel: channelData ?? null,
      playlists,
      documents: documents ?? [],
    })
  )
}

module.exports = handler
