const supabase = require("./supabase-client")

async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    const providerId = Number(requestUrl.searchParams.get("provider_id") || "")
    if (!providerId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "provider_id is required" }))
      return
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("sitemap_feed_summary")
        .select(
          "feed_id, provider_id, feed_url, last_modified, tracked, tracked_page_count, pages_with_matches, all_page_count"
        )
        .eq("provider_id", providerId)
        .order("feed_url", { ascending: true })

      if (process.env.NODE_ENV !== "production") {
        console.log("[sitemap-feeds] raw summary rows", data)
      }

      const normalized = (data || []).map((row) => ({
        id: row.feed_id,
        provider_id: row.provider_id,
        feed_url: row.feed_url,
        last_modified: row.last_modified,
        tracked: row.tracked,
        tracked_page_count: row.tracked_page_count,
        pages_with_matches: row.pages_with_matches,
        all_page_count: row.all_page_count,
      }))

      if (error) throw error
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.end(JSON.stringify(normalized))
      return
    }

    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
  } catch (error) {
    console.error("[sitemap-feeds] handler error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
