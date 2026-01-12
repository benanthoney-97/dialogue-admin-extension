const supabase = require("./supabase-client")

async function handler(req, res) {
  // --- FIX START: Set CORS headers immediately for ALL requests ---
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // --- FIX START: Handle the Preflight (OPTIONS) check ---
  if (req.method === "OPTIONS") {
    res.writeHead(200)
    return res.end()
  }
  // --- FIX END ---

  try {
    if (process.env.NODE_ENV !== "production") {
      // (Empty block preserved from original)
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" })
      return res.end(JSON.stringify({ error: "Method not allowed" }))
    }

    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    await new Promise((resolve) => req.on("end", resolve))

    const payload = JSON.parse(body || "{}")
    const { feed_id, tracked } = payload
    if (!feed_id || typeof tracked !== "boolean") {
      res.writeHead(400, { "Content-Type": "application/json" })
      return res.end(
        JSON.stringify({ error: "feed_id (number) and tracked (boolean) are required" })
      )
    }

    const { data: existingFeed, error: feedFetchError } = await supabase
      .from("sitemap_feeds")
      .select("id, tracked")
      .eq("id", feed_id)
      .maybeSingle()

    if (feedFetchError) throw feedFetchError

    const pageFetch = await supabase
      .from("sitemap_pages")
      .select("id, page_url, tracked")
      .eq("feed_id", feed_id)

    if (pageFetch.error) throw pageFetch.error

    if (process.env.NODE_ENV !== "production") {
    }

    if (process.env.NODE_ENV !== "production") {
    }
    const { data: feedUpdate, error: feedUpdateError } = await supabase
      .from("sitemap_feeds")
      .update({ tracked })
      .eq("id", feed_id)
      .select("id, tracked")

    if (feedUpdateError) throw feedUpdateError

    const { data: pageUpdate, error: pageUpdateError } = await supabase
      .from("sitemap_pages")
      .update({ tracked })
      .eq("feed_id", feed_id)

    if (pageUpdateError) throw pageUpdateError

    const pageUrls =
      (Array.isArray(pageFetch.data) ? pageFetch.data : [])
        .map((page) => page?.page_url)
        .filter((url) => typeof url === "string" && url.length > 0)

    const pagesUpdated = Array.isArray(pageFetch.data) ? pageFetch.data.length : 0

    let pageMatchesUpdated = 0
    if (pageUrls.length) {
      const status = tracked ? "active" : "inactive"
      if (process.env.NODE_ENV !== "production") {

      }
      const { data: matchData, error: matchError } = await supabase
        .from("page_matches")
        .update({ status })
        .in("url", pageUrls)

      if (matchError) throw matchError
      pageMatchesUpdated = Array.isArray(matchData) ? matchData.length : 0
    }

    const feedRowsUpdated = Array.isArray(feedUpdate) ? feedUpdate.length : 0
    if (process.env.NODE_ENV !== "production") {

    }

    // Headers are already set at the top.
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ success: true, updated: feedRowsUpdated }))
  } catch (error) {
    console.error("[sitemap-feed-status] error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler