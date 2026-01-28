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

  if (req.method !== "GET") {
    res.writeHead(405)
    res.end(JSON.stringify({ error: "Method not allowed" }))
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

    const { data, error } = await supabase
      .from("provider_docs_sites")
      .select("site_url")
      .eq("provider_id", providerId)
      .limit(1)
      .maybeSingle()

    if (error) throw error

    res.writeHead(200)
    res.end(JSON.stringify({ site_url: data?.site_url ?? null }))
  } catch (error) {
    console.error("[provider-docs-sites] handler error", error)
    res.writeHead(500)
    res.end(JSON.stringify({ error: error?.message || "Unexpected error" }))
  }
}

module.exports = handler
