const { Buffer } = require("buffer")
const fetch = globalThis.fetch

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

const handleError = (res, error) => {
  console.error("[vimeo-channel-videos] handler error", error)
  res.writeHead(500, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: error?.message ?? "Unable to fetch Vimeo data" }))
}

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Vimeo request failed (${response.status}): ${body}`)
  }
  return response.json()
}

const getAuthToken = async () => {
  if (!VIMEO_CLIENT_ID || !VIMEO_CLIENT_SECRET) {
    throw new Error("Missing Vimeo API credentials")
  }
  const authString = Buffer.from(`${VIMEO_CLIENT_ID}:${VIMEO_CLIENT_SECRET}`).toString("base64")
  const payload = {
    grant_type: "client_credentials",
    scope: "public",
  }
  const response = await fetchJson("https://api.vimeo.com/oauth/authorize/client", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  return response.access_token
}

const fetchVideos = async (token, endpoint, params = {}) => {
  const videos = []
  let page = 1
  let next = true
  while (next) {
    const url = new URL(endpoint)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", String(page))
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, String(value))
      }
    })
    const response = await fetchJson(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const { data, paging } = response
    if (Array.isArray(data)) {
      videos.push(...data)
    }
    if (paging?.next) {
      page++
    } else {
      next = false
    }
  }
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
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    const user = requestUrl.searchParams.get("user")
    const channel = requestUrl.searchParams.get("channel")
    if (!user && !channel) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "user or channel is required" }))
      return
    }

    const token = await getAuthToken()
    const baseUrl = user
      ? `https://api.vimeo.com/users/${encodeURIComponent(user)}/videos`
      : `https://api.vimeo.com/channels/${encodeURIComponent(channel)}/videos`
    const videos = await fetchVideos(token, baseUrl)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        source: {
          type: user ? "user" : "channel",
          id: user ?? channel,
        },
        videos,
      })
    )
  } catch (error) {
    handleError(res, error)
  }
}

module.exports = handler
