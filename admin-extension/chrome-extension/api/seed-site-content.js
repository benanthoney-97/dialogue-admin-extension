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

  const pageUrl = payload?.page_url || payload?.pageUrl;
  const providerId = payload?.provider_id || payload?.providerId;

  if (!pageUrl || !providerId) {
    res.status(400).json({ error: "page_url and provider_id are required" });
    return;
  }

  try {
    const { data: pageRow, error: pageError } = await supabase
      .from("sitemap_pages")
      .select("id,page_url,provider_id")
      .eq("page_url", pageUrl)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!pageRow) {
      res.status(404).json({ error: "Sitemap page not found" });
      return;
    }

    if (Number(pageRow.provider_id) !== Number(providerId)) {
      res.status(400).json({ error: "provider_id does not match sitemap page" });
      return;
    }

    const insertedChunks = await processPage({
      pageUrl: pageRow.page_url,
      providerId: pageRow.provider_id,
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
