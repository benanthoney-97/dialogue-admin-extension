const supabase = require("./supabase-client")

async function handler(req, res) {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    const providerId = Number(requestUrl.searchParams.get("provider_id") || "")

    if (!providerId) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: "provider_id is required" }))
      return
    }

    if (req.method === "GET") {
      const { data: feeds, error: feedError } = await supabase
        .from("sitemap_feeds")
        .select("id")
        .eq("provider_id", providerId)
      if (feedError) throw feedError

      const feedIds = (feeds || []).map((feed) => feed.id).filter(Boolean)
      console.log("[inactive-view-pagelist] provider", providerId, "feedIds", feedIds)
      if (!feedIds.length) {
        res.writeHead(200)
        res.end(JSON.stringify([]))
        return
      }

      const { data: pages, error: pageError } = await supabase
        .from("sitemap_pages")
        .select("id, feed_id, page_url, tracked, processed, last_modified")
        .in("feed_id", feedIds)
        .order("page_url", { ascending: true })
      if (pageError) throw pageError

      console.log("[inactive-view-pagelist] pages", pages)
      res.writeHead(200)
      res.end(JSON.stringify(pages || []))
      return
    }

    res.writeHead(405)
    res.end(JSON.stringify({ error: "Method not allowed" }))
  } catch (error) {
    console.error("[inactive-view-pagelist] handler error", error)
    res.writeHead(500)
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
