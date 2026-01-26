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
      .select("*")
      .eq("provider_id", providerId)
      .maybeSingle()

    if (error) throw error

    const { data: groupData, error: groupError } = await supabase
      .from("analytics_groups")
      .select("group_key, title, description")
      .in("group_key", ["best_performing", "needs_attention", "low_value"])
      .order("id", { ascending: true })

    if (groupError) throw groupError

    const payload = {
      total_impressions: data?.total_impressions ?? 0,
      total_plays: data?.total_plays ?? 0,
      completion_rate: data?.completion_rate ?? 0,
      impressions_mom_pct: data?.impressions_mom_pct ?? null,
      plays_mom_pct: data?.plays_mom_pct ?? null,
      completion_rate_mom_pct: data?.completion_rate_mom_pct ?? null,
      best_performing_matches: data?.best_performing_matches ?? null,
      needs_attention_matches: data?.needs_attention_matches ?? null,
      low_value_matches: data?.low_value_matches ?? null,
      top_5_most_played: data?.top_5_most_played ?? null,
      top_5_most_completed: data?.top_5_most_completed ?? null,
      analytics_groups: groupData ?? [],
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
