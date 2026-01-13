const supabase = require("./supabase-client");
const { processPage } = require("./seeder-functions/api-core/site-content-seeder-core");

const parseRequestBody = (req) =>
  new Promise((resolve, reject) => {
    if (req.body && Object.keys(req.body).length > 0) {
      resolve(req.body);
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", (error) => reject(error));
  });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }

  let payload;
  try {
    payload = await parseRequestBody(req);
  } catch (error) {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  const rawData = payload?.body ?? payload;
  const pageUrl =
    payload?.page_url ||
    payload?.pageUrl ||
    rawData?.page_url ||
    rawData?.pageUrl ||
    req.query?.page_url ||
    req.query?.pageUrl;

  if (!pageUrl) {
    res.status(400).json({ error: "page_url is required" });
    return;
  }

  try {
    const { data: pageRow, error: pageError } = await supabase
      .from("sitemap_pages")
      .select("id,page_url,feed_id")
      .eq("page_url", pageUrl)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!pageRow) {
      res.status(404).json({ error: "Sitemap page not found" });
      return;
    }

    const { data: feedRow, error: feedError } = await supabase
      .from("sitemap_feeds")
      .select("provider_id")
      .eq("id", pageRow.feed_id)
      .maybeSingle();

    if (feedError || !feedRow) {
      throw feedError || new Error("Failed to load sitemap feed");
    }

    const providerId = feedRow.provider_id;
    const insertedChunks = await processPage({
      pageUrl: pageRow.page_url,
      providerId,
      sitemapPageId: pageRow.id,
    });

    res.status(200).json({
      ok: true,
      page: pageRow,
      inserted: insertedChunks.length,
      chunks: insertedChunks,
    });
  } catch (error) {
    console.error("[seed-site-content] error", error);
    res.status(500).json({
      error: error.message || "Failed to seed site content",
    });
  }
}
