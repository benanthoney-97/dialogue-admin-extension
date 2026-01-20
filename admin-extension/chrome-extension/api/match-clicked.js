const { logEngagementEvent } = require("./lib/engagement-events");

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let payload = {}
  try {
    payload = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const providerId = Number(payload.provider_id || payload.providerId || "");
  if (!providerId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing provider_id" }));
    return;
  }

  try {
    console.log(`[match-clicked] logging play provider=${providerId} page_url=${payload.page_url || payload.pageUrl}`);
    await logEngagementEvent({
      providerId,
      eventType: "play",
      pageUrl: payload.page_url || payload.pageUrl || null,
      metadata: payload.page_match_id ? { page_match_id: payload.page_match_id } : undefined,
    });
    console.log("[match-clicked] engagement event logged");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    console.error("[match-clicked] log error", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unable to record event" }));
  }
}

module.exports = handler;
