const supabase = require("./supabase-client")

async function handler(req, res) {
  // --- FIX START: Set CORS headers immediately for ALL responses ---
  res.setHeader("Content-Type", "application/json") // Moved here to cover errors too
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // Handle the "Preflight" check
  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }
  // --- FIX END ---

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    const feedId = Number(requestUrl.searchParams.get("feed_id") || "")
    
    if (!feedId) {
      // Headers are now already set, so this error will be readable in the browser
      res.writeHead(400)
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
      
      res.writeHead(200)
      res.end(JSON.stringify(data || []))
      return
    }

    res.writeHead(405)
    res.end(JSON.stringify({ error: "Method not allowed" }))
  } catch (error) {
    console.error("[sitemap-pages] handler error", error)
    res.writeHead(500)
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
