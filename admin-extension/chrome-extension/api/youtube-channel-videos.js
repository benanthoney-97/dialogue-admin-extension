const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

const fetchJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `YouTube request failed (${response.status} ${response.statusText}): ${body}`
    )
  }
  return response.json()
}

const fetchPlaylists = async (channelId) => {
  const playlists = []
  let nextPageToken = undefined
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists")
    url.searchParams.set("part", "snippet,contentDetails")
    url.searchParams.set("channelId", channelId)
    url.searchParams.set("maxResults", "50")
    url.searchParams.set("key", YOUTUBE_API_KEY)
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken)
    }
    const payload = await fetchJson(url.toString())
    nextPageToken = payload.nextPageToken
    if (Array.isArray(payload.items)) {
      playlists.push(...payload.items)
    }
  } while (nextPageToken)
  return playlists
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

  if (!YOUTUBE_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Missing YouTube API key" }))
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const channelId = requestUrl.searchParams.get("channel_id")
  const username = requestUrl.searchParams.get("username")
  if (!channelId && !username) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "channel_id or username is required" }))
    return
  }

  try {
    const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels")
    channelsUrl.searchParams.set("part", "snippet,contentDetails")
    channelsUrl.searchParams.set("key", YOUTUBE_API_KEY)
    if (channelId) {
      channelsUrl.searchParams.set("id", channelId)
    } else {
      channelsUrl.searchParams.set("forUsername", username)
    }

    let channelPayload = await fetchJson(channelsUrl.toString())
    if (!Array.isArray(channelPayload.items) || channelPayload.items.length === 0) {
      if (username) {
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search")
        searchUrl.searchParams.set("part", "snippet")
        searchUrl.searchParams.set("type", "channel")
        searchUrl.searchParams.set("maxResults", "1")
        searchUrl.searchParams.set("q", username.startsWith("@") ? username.slice(1) : username)
        searchUrl.searchParams.set("key", YOUTUBE_API_KEY)

        const searchPayload = await fetchJson(searchUrl.toString())
        const firstResult = Array.isArray(searchPayload.items) ? searchPayload.items[0] : null
        const resolvedId = firstResult?.id?.channelId ?? firstResult?.snippet?.channelId
        if (!resolvedId) {
          throw new Error("Channel not found")
        }

        channelsUrl.searchParams.delete("forUsername")
        channelsUrl.searchParams.set("id", resolvedId)
        channelPayload = await fetchJson(channelsUrl.toString())
      } else {
        throw new Error("Channel not found")
      }
    }

    if (!Array.isArray(channelPayload.items) || channelPayload.items.length === 0) {
      throw new Error("Channel not found")
    }

    const channel = channelPayload.items[0]
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      throw new Error("Unable to resolve uploads playlist")
    }

    const videos = []
    let nextPageToken = undefined

    do {
      const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems")
      playlistUrl.searchParams.set("part", "snippet,contentDetails")
      playlistUrl.searchParams.set("maxResults", "50")
      playlistUrl.searchParams.set("playlistId", uploadsPlaylistId)
      playlistUrl.searchParams.set("key", YOUTUBE_API_KEY)
      if (nextPageToken) {
        playlistUrl.searchParams.set("pageToken", nextPageToken)
      }

      const playlistPayload = await fetchJson(playlistUrl.toString())
      nextPageToken = playlistPayload.nextPageToken
      if (Array.isArray(playlistPayload.items)) {
        videos.push(
          ...playlistPayload.items.map((item) => ({
            videoId: item.contentDetails?.videoId,
            title: item.snippet?.title,
            description: item.snippet?.description,
            publishedAt: item.snippet?.publishedAt,
            thumbnails: item.snippet?.thumbnails ?? null,
            playlistId: item.snippet?.playlistId ?? null,
            playlistTitle: item.snippet?.playlistTitle ?? null,
            position: item.snippet?.position,
          }))
        )
      }
    } while (nextPageToken)

    const playlistIds = new Set(
      videos.map((video) => video.playlistId).filter(Boolean)
    )
    const playlists = playlistIds.size > 0 ? await fetchPlaylists(channel.id) : []
    const playlistMeta = playlists
      .filter((pl) => playlistIds.has(pl.id))
      .map((pl) => ({
        id: pl.id,
        title: pl.snippet?.title ?? null,
        description: pl.snippet?.description ?? null,
        thumbnails: pl.snippet?.thumbnails ?? null,
        itemCount: pl.contentDetails?.itemCount ?? null,
      }))

    if (uploadsPlaylistId && !playlistMeta.find((entry) => entry.id === uploadsPlaylistId)) {
      playlistMeta.unshift({
        id: uploadsPlaylistId,
        title: "Uploads",
        description: null,
        thumbnails: null,
        itemCount: null,
      })
    }

    const videosByPlaylist = {}
    videos.forEach((video) => {
      const pid = video.playlistId ?? uploadsPlaylistId ?? "uploads"
      if (!videosByPlaylist[pid]) {
        videosByPlaylist[pid] = []
      }
      videosByPlaylist[pid].push(video)
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        channel: {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          thumbnails: channel.snippet?.thumbnails ?? null,
        },
        videos,
        playlists: playlistMeta,
        videosByPlaylist,
      })
    )
  } catch (error) {
    console.error("[youtube-channel-videos] handler error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error?.message ?? "Unable to fetch YouTube data" }))
  }
}

module.exports = handler
