const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env"),
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PLASMO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase config");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function handler(req, res) {
  // --- FIX START: Set CORS headers immediately for ALL requests ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // --- FIX START: Handle the Preflight (OPTIONS) check ---
  // If the browser asks "Can I send a POST?", we say "Yes" (200 OK)
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }
  // --- FIX END ---

  try {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Method not allowed" }));
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    await new Promise((resolve) => req.on("end", resolve));

    const payload = JSON.parse(body || "{}");
    const { page_match_id, status } = payload;
    if (!page_match_id || !status) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "page_match_id and status required" }));
    }

    const { data, error } = await supabase
      .from("page_matches")
      .update({ status })
      .eq("id", page_match_id);

    if (error) throw error;

    const updatedCount = Array.isArray(data) ? data.length : 0;
    
    // Headers are already set at the top, so we just send the JSON
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: true, updated: updatedCount }));

  } catch (err) {
    console.error("[page-match-status] error", err);
    // Even if it crashes, the CORS headers set at the top ensure the frontend can read the error
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = handler;
