const supabase = require("./supabase-client")
const { getProviderDocument } = require("./provider-documents-web-embed")

async function handler(req, res) {
  // --- FIX START: Set CORS headers immediately for ALL responses ---
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS") // Only GET is supported here
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // Handle the "Preflight" check
  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }
  // --- FIX END ---

  // Now we can enforce GET-only for the actual logic
  if (req.method !== "GET") {
    // Headers are already set, so this 405 will be visible to the browser
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const providerId = Number(requestUrl.searchParams.get("provider_id") || "")
  const pageUrl = (requestUrl.searchParams.get("page_url") || "").trim()
  const documentIdRaw = requestUrl.searchParams.get("document_id")
  const documentId = Number(documentIdRaw || "")
  const hasDocumentId = Number.isFinite(documentId) && documentId > 0
  const hasPageUrl = Boolean(pageUrl)

  if (!providerId || (!hasDocumentId && !hasPageUrl)) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        error: "provider_id is required and at least one of document_id or page_url must be provided",
      })
    )
    return
  }

  try {
    let query = supabase
      .from("page_matches")
      .select("id, phrase, confidence, status, document_id, url, created_at")
      .eq("provider_id", providerId)
      .order("id", { ascending: true })
      .limit(50)
    if (hasDocumentId) {
      query = query.eq("document_id", documentId)
    } else {
      query = query.eq("url", pageUrl)
    }
    const { data, error } = await query

    if (error) throw error

    const documentIds = Array.from(
      new Set((data || []).map((row) => row.document_id).filter((id) => id))
    )

    const documents = {}

    // Helper functions moved/kept here as per your snippet
    async function getConfidenceTiers(providerId) {
      if (!providerId) return [];
      const { data, error } = await supabase
        .from("confidence_tiers")
        .select("display_label, color_theme, min_score")
        .eq("provider_id", providerId)
        .order("min_score", { ascending: false });

      if (error) throw error;
      return Array.isArray(data) ? data : [];
    }

    const normalizeNumber = (value) => {
      if (typeof value === "number" && !Number.isNaN(value)) {
        return value;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const findTierForScore = (score, tiers) => {
      const normalizedScore = normalizeNumber(score);
      return tiers.find((tier) => normalizedScore >= normalizeNumber(tier.min_score)) || null;
    };

    await Promise.all(
      documentIds.map(async (documentId) => {
        const doc = await getProviderDocument(documentId, providerId)
        if (doc) {
          documents[documentId] = doc
        }
      })
    )

    const tiers = await getConfidenceTiers(providerId)
    let pageRow = null
    
    if (hasPageUrl && !hasDocumentId) {
      const { data } = await supabase
        .from("sitemap_pages")
        .select("tracked")
        .eq("page_url", pageUrl)
        .maybeSingle()
      pageRow = data
    }

    const matches = (data || []).map((row) => {
      const tier = findTierForScore(row.confidence, tiers)
      return {
        page_match_id: row.id,
        phrase: row.phrase || "",
        document_title: documents[row.document_id]?.title || "",
        cover_image_url: documents[row.document_id]?.cover_image_url || "",
        document_id: row.document_id,
        confidence: row.confidence,
        status: row.status,
        confidence_label: tier?.display_label || "",
        confidence_color: tier?.color_theme || "",
        url: row.url,
        created_at: row.created_at,
        tracked: pageRow?.tracked ?? null,
      }
    })

    const payload = {
      matches,
      page_supported: hasDocumentId ? true : Boolean(pageRow),
      tracked: pageRow?.tracked ?? null,
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(payload))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
