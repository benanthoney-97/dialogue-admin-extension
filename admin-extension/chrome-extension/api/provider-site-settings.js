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
        .from("provider_site_settings")
        .select("provider_id, match_threshold")
        .eq("provider_id", providerId)
        .maybeSingle()

      if (error) throw error
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.end(JSON.stringify(data || null))
      return
    }

    if (req.method === "POST") {
      let body = ""
      req.on("data", (chunk) => {
        body += chunk
      })
      await new Promise((resolve) => req.on("end", resolve))
      const payload = JSON.parse(body || "{}")
      const { match_threshold } = payload
      if (typeof match_threshold === "undefined") {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "match_threshold is required" }))
        return
      }

      const { data, error } = await supabase
        .from("provider_site_settings")
        .upsert(
          {
            provider_id: providerId,
            match_threshold,
          },
          { onConflict: "provider_id" }
        )
        .select()
        .maybeSingle()

      if (error) throw error
      if (typeof match_threshold === "number") {
        await supabase
          .from("page_matches")
          .update({ status: "inactive" })
          .eq("provider_id", providerId)
          .lt("confidence", match_threshold)
        await supabase
          .from("page_matches")
          .update({ status: "active" })
          .eq("provider_id", providerId)
          .gte("confidence", match_threshold)
      }

      if (error) throw error
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.end(JSON.stringify(data || null))
      return
    }

    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
  } catch (error) {
    console.error("[provider-site-settings] handler error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
