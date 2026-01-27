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
  const channel = payload.channel ?? {}

  if (!providerId) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "provider_id is required" }))
    return
  }

  const platform = channel.platform
  const channelUrl = channel.channel_url?.trim()
  if (!platform || !channelUrl) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "channel platform and URL are required" }))
    return
  }

  const validDocs = documents
    .map((doc) => ({
      provider_id: providerId,
      channel_id: null,
      playlist_id: doc.playlist_id ?? null,
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

  const channelPayload = {
    provider_id: providerId,
    platform,
    channel_url: channelUrl,
    channel_description: channel.channel_description ?? null,
    video_count: Number(channel.video_count ?? null),
    cover_image: channel.cover_image ?? null,
  }
  const { data: channelData, error: channelError } = await supabase
    .from("provider_channels")
    .upsert(channelPayload, { onConflict: "provider_id,platform,channel_url" })
    .select("id")
    .single()

  if (channelError) {
    console.error("[import-provider-documents] channel upsert error", channelError)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: channelError.message }))
    return
  }

  const channelId = channelData?.id
  if (!channelId) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Unable to resolve channel entry" }))
    return
  }

  const docsWithChannel = validDocs.map((doc) => ({
    ...doc,
    channel_id: channelId,
  }))

  const playlistsInput = Array.isArray(channel.playlists) ? channel.playlists : []
  const playlistPayloads = playlistsInput
    .map((pl) => ({
      id: pl.id,
      provider_channel_id: channelId,
      title: pl.title ?? null,
      cover_image: pl.cover_image ?? null,
      video_count: Number(pl.itemCount ?? null),
      description: pl.description ?? null,
    }))
    .filter((pl) => pl.id)

  if (playlistPayloads.length > 0) {
    const { error: playlistError } = await supabase
      .from("channel_playlists")
      .upsert(playlistPayloads, { onConflict: "id,provider_channel_id" })

    if (playlistError) {
      console.error("[import-provider-documents] playlist upsert error", playlistError)
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: playlistError.message }))
      return
    }
  }

  const { error } = await supabase
    .from("provider_documents")
    .upsert(docsWithChannel, { onConflict: "provider_id,source_url" })

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
