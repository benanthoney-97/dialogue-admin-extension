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

const fetchPlaylistVideos = async (playlistId) => {
  const videos = []
  let nextPageToken = undefined
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems")
    url.searchParams.set("part", "snippet,contentDetails")
    url.searchParams.set("playlistId", playlistId)
    url.searchParams.set("maxResults", "50")
    url.searchParams.set("key", YOUTUBE_API_KEY)
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken)
    }
    const payload = await fetchJson(url.toString())
    nextPageToken = payload.nextPageToken
    if (Array.isArray(payload.items)) {
      videos.push(...payload.items)
    }
  } while (nextPageToken)
  return videos
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

    const playlistPayload = await fetchPlaylists(channel.id)
    const playlistMeta = new Map()

    const ensurePlaylistEntry = (entry) => {
      if (!entry?.id) return
      if (playlistMeta.has(entry.id)) return
      playlistMeta.set(entry.id, {
        id: entry.id,
        title: entry.snippet?.title ?? "Untitled playlist",
        description: entry.snippet?.description ?? null,
        thumbnails: entry.snippet?.thumbnails ?? null,
        itemCount: entry.contentDetails?.itemCount ?? null,
      })
    }

    playlistPayload.forEach(ensurePlaylistEntry)
    ensurePlaylistEntry({
      id: uploadsPlaylistId,
      snippet: { title: "Uploads" },
      contentDetails: {},
    })

    const videosByPlaylist = {}
    const uniqueVideos = new Map()

    for (const playlistEntry of playlistMeta.values()) {
      try {
        const playlistVideos = await fetchPlaylistVideos(playlistEntry.id)
        const normalizedVideos = playlistVideos
          .map((item) => {
            const videoId = item.contentDetails?.videoId
            if (!videoId) return null
            return {
              id: videoId,
              videoId,
              title: item.snippet?.title,
              description: item.snippet?.description,
              publishedAt: item.snippet?.publishedAt,
              thumbnails: item.snippet?.thumbnails ?? null,
              playlistId: playlistEntry.id,
              playlistTitle: playlistEntry.title,
            }
          })
          .filter(Boolean)

        videosByPlaylist[playlistEntry.id] = normalizedVideos

        normalizedVideos.forEach((video) => {
          const sourceUrl =
            video.sourceUrl ?? `https://www.youtube.com/watch?v=${video.videoId}`
          if (!sourceUrl) return
          if (!uniqueVideos.has(sourceUrl)) {
            uniqueVideos.set(sourceUrl, {
              ...video,
              sourceUrl,
            })
          }
        })
      } catch (info) {
        console.warn("[youtube-channel-videos] playlist fetch failed", playlistEntry.id, info)
      }
    }

    const videos = Array.from(uniqueVideos.values())

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        channel: {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          thumbnails: channel.snippet?.thumbnails ?? null,
        },
        playlists: Array.from(playlistMeta.values()),
        videos,
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
