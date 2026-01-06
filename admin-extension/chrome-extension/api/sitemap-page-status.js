const supabase = require("./supabase-client")

async function handler(req, res) {
  try {
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
    const { page_id, tracked } = payload
    if (!page_id || typeof tracked !== "boolean") {
      res.writeHead(400, { "Content-Type": "application/json" })
      return res.end(
        JSON.stringify({ error: "page_id (number) and tracked (boolean) are required" })
      )
    }

    const { data: pageRow, error: pageFetchError } = await supabase
      .from("sitemap_pages")
      .select("id, feed_id, page_url")
      .eq("id", page_id)
      .maybeSingle()

    if (pageFetchError) throw pageFetchError
    if (!pageRow) {
      res.writeHead(404, { "Content-Type": "application/json" })
      return res.end(JSON.stringify({ error: "Page not found" }))
    }

    const { data: updatedData, error } = await supabase
      .from("sitemap_pages")
      .update({ tracked })
      .eq("id", page_id)
      .select("feed_id")

    if (error) throw error
    const updatedCount = Array.isArray(updatedData) ? updatedData.length : (updatedData ? 1 : 0)

    const status = tracked ? "active" : "inactive"
    const { error: matchError } = await supabase
      .from("page_matches")
      .update({ status })
      .eq("url", pageRow.page_url)

    if (matchError) throw matchError

    const { data: pagesForFeed, error: pagesError } = await supabase
      .from("sitemap_pages")
      .select("tracked")
      .eq("feed_id", pageRow.feed_id)

    if (pagesError) throw pagesError

    const totalPages = Array.isArray(pagesForFeed) ? pagesForFeed.length : 0
    const trackedCount = Array.isArray(pagesForFeed)
      ? pagesForFeed.filter((page) => page?.tracked).length
      : 0
    let feedTracked = null
    if (totalPages > 0) {
      if (trackedCount === 0) {
        feedTracked = false
      } else if (trackedCount === totalPages) {
        feedTracked = true
      }
    }

    const { error: feedError } = await supabase
      .from("sitemap_feeds")
      .update({ tracked: feedTracked })
      .eq("id", pageRow.feed_id)

    if (feedError) throw feedError

    res.setHeader("Content-Type", "application/json")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.end(JSON.stringify({ success: true, updated: updatedCount }))
  } catch (error) {
    console.error("[sitemap-page-status] error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
