const supabase = require("./supabase-client")

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const providerId = Number(requestUrl.searchParams.get("provider_id") || "")

  if (!providerId) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Missing provider_id" }))
    return
  }

  try {
    const { data, error } = await supabase
      .from("provider_analytics_summary")
      .select("total_impressions, total_plays, completion_rate")
      .eq("provider_id", providerId)
      .maybeSingle()

    if (error) throw error

    const payload = {
      total_impressions: data?.total_impressions ?? 0,
      total_plays: data?.total_plays ?? 0,
      completion_rate: data?.completion_rate ?? 0,
    }

    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify(payload))
  } catch (error) {
    console.error("[provider-analytics-summary] handler error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
