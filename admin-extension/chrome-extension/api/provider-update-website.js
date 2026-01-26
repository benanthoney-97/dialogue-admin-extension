const supabase = require("./supabase-client")

const defaultCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const setCors = (res) => {
  for (const [key, value] of Object.entries(defaultCorsHeaders)) {
    res.setHeader(key, value)
  }
}

async function handler(req, res) {
  setCors(res)
  if (req.method === "OPTIONS") {
    res.writeHead(204)
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
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Invalid JSON" }))
    return
  }

  const providerId = Number(payload.provider_id)
  const websiteUrl = (payload.website_url || "").trim()

  if (!providerId) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "provider_id is required" }))
    return
  }

  if (!websiteUrl) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "website_url is required" }))
    return
  }

  try {
  const { data, error } = await supabase
    .from("providers")
    .update({ website_url: websiteUrl })
    .eq("id", providerId)
    .select("id, website_url")
    .maybeSingle()

  if (error || !data) {
    throw error || new Error("Unable to update provider")
  }

  await ensureFeedAndPage(providerId, websiteUrl)

  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify(data))
  } catch (error) {
    console.error("[provider-update-website] error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message || "Unable to update provider" }))
  }
}

const ensureFeedAndPage = async (providerId, websiteUrl) => {
  const feedUrl = websiteUrl
  const { data: existingFeed } = await supabase
    .from("sitemap_feeds")
    .select("id")
    .eq("provider_id", providerId)
    .eq("feed_url", feedUrl)
    .maybeSingle()
  const feedId = existingFeed?.id
    ? existingFeed.id
    : (
        await supabase
          .from("sitemap_feeds")
          .insert({
            provider_id: providerId,
            feed_url: feedUrl,
            tracked: true,
          })
          .select("id")
          .maybeSingle()
      ).data?.id
  if (!feedId) {
    throw new Error("Unable to create feed record")
  }

  const { data: existingPage } = await supabase
    .from("sitemap_pages")
    .select("id")
    .eq("feed_id", feedId)
    .eq("page_url", websiteUrl)
    .maybeSingle()
  if (existingPage?.id) {
    await supabase
      .from("sitemap_pages")
      .update({ tracked: true })
      .eq("id", existingPage.id)
    return
  }

  await supabase.from("sitemap_pages").insert({
    feed_id: feedId,
    page_url: websiteUrl,
    processed: "pending",
    tracked: true,
  })
}

module.exports = handler
