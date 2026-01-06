const supabase = require("./supabase-client")

async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    const feedId = Number(requestUrl.searchParams.get("feed_id") || "")
    if (!feedId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "feed_id is required" }))
      return
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("sitemap_pages")
        .select("id, feed_id, page_url, tracked, processed, last_modified")
        .eq("feed_id", feedId)
        .order("page_url", { ascending: true })

      if (error) throw error
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.end(JSON.stringify(data || []))
      return
    }

    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
  } catch (error) {
    console.error("[sitemap-pages] handler error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
