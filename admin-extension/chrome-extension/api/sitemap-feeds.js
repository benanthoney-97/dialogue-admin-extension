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
        .from("sitemap_feeds")
        .select("id, provider_id, feed_url, last_modified, tracked")
        .eq("provider_id", providerId)
        .order("last_modified", { ascending: false })

      if (error) throw error
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.end(JSON.stringify(data || []))
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
