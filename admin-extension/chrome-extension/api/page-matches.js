const supabase = require("./supabase-client")
const { getProviderDocument } = require("./provider-documents")

async function handler(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const providerId = Number(requestUrl.searchParams.get("provider_id") || "")
  const pageUrl = (requestUrl.searchParams.get("page_url") || "").trim()

  if (!providerId || !pageUrl) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "provider_id and page_url are required" }))
    return
  }

  try {
    const { data, error } = await supabase
      .from("page_matches")
      .select("id, phrase, confidence, status, document_id, url")
      .eq("provider_id", providerId)
      .eq("url", pageUrl)
      .order("id", { ascending: true })
      .limit(50)

    if (error) throw error

    const documentIds = Array.from(
      new Set((data || []).map((row) => row.document_id).filter((id) => id))
    )

const documents = {}
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

    documentIds.forEach((documentId) => {
      console.debug("[page-matches] document cover image", {
        documentId,
        url: documents[documentId]?.source_url,
        cover_image_url: documents[documentId]?.cover_image_url,
      })
    })

    const tiers = await getConfidenceTiers(providerId)
    const { data: pageRow } = await supabase
      .from("sitemap_pages")
      .select("tracked")
      .eq("page_url", pageUrl)
      .maybeSingle()
    console.debug("[page-matches] resolved sitemap page row", { pageUrl, pageRow })
    const matches = (data || []).map((row) => {
      const tier = findTierForScore(row.confidence, tiers)
      if (!documents[row.document_id]?.cover_image_url) {
        console.debug("[page-matches] missing cover image for match", {
          page_match_id: row.id,
          document_id: row.document_id,
        })
      }
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
        tracked: pageRow?.tracked ?? null,
      }
    })

    const payload = {
      matches,
      page_supported: Boolean(pageRow),
      tracked: pageRow?.tracked ?? null,
    }

    res.setHeader("Content-Type", "application/json")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.end(JSON.stringify(payload))
  } catch (error) {
    console.error("[page-matches] handler error", error)
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: error.message }))
  }
}

module.exports = handler
