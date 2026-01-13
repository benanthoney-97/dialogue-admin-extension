const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const dotenvPath = path.resolve(__dirname, "../../../.env");
require("dotenv").config({ path: dotenvPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PLASMO_SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PROVIDER_ID = process.env.SITEMAP_PROVIDER_ID
  ? Number(process.env.SITEMAP_PROVIDER_ID)
  : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const getEntries = (xml, tagName) => {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const entries = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
};

const extractTagValue = (fragment, tagName) => {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = regex.exec(fragment);
  return match ? match[1].trim() : null;
};

const insertPages = async (feedId, pages) => {
  if (!feedId || !pages.length) return;
  const rows = pages.map((pageUrl) => ({
    feed_id: feedId,
    page_url: pageUrl,
    tracked: true,
  }));
  const { error } = await supabase
    .from("sitemap_pages")
    .upsert(rows, { onConflict: "feed_id,page_url" });
  if (error) throw error;
};

const fetchXml = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  return res.text();
};

const fetchProviderIds = async () => {
  if (DEFAULT_PROVIDER_ID) {
    return [DEFAULT_PROVIDER_ID];
  }
  const resp = await supabase.from("providers").select("id");
  const data = resp.data || [];
  return data.map((row) => row.id).filter(Boolean);
};

const insertFeed = async (feedUrl, lastModified, providerId) => {
  const existing = await supabase
    .from("sitemap_feeds")
    .select("id")
    .eq("feed_url", feedUrl)
    .maybeSingle();
  if (existing.data?.id) {
    return existing.data.id;
  }
  const { data, error } = await supabase
    .from("sitemap_feeds")
    .insert({
      provider_id: providerId,
      feed_url: feedUrl,
      last_modified: lastModified || null,
      tracked: true,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id;
};

const runImportForProvider = async (providerId, indexXml, sitemapList, indexUrl) => {
  console.log(`[import-sitemap] processing provider ${providerId}`);
  if (sitemapList.length) {
    for (const sitemap of sitemapList) {
      const feedUrl = extractTagValue(sitemap, "loc");
      if (!feedUrl) continue;
      const lastmod = extractTagValue(sitemap, "lastmod");
      const feedId = await insertFeed(feedUrl, lastmod, providerId);
      if (!feedId) continue;
      try {
        const feedXml = await fetchXml(feedUrl);
        const urlEntries = getEntries(feedXml, "url");
        const urls = urlEntries
          .map((entry) => extractTagValue(entry, "loc"))
          .filter(Boolean);
        await insertPages(feedId, urls);
      } catch (error) {
        console.warn(`Skipping feed ${feedUrl}:`, error.message);
      }
    }
  } else {
    const feedId = await insertFeed(indexUrl, null, providerId);
    if (!feedId) return;
    const urlEntries = getEntries(indexXml, "url");
    const urls = urlEntries
      .map((entry) => extractTagValue(entry, "loc"))
      .filter(Boolean);
    await insertPages(feedId, urls);
  }
};

const doImport = async (indexUrl) => {
  const indexXml = await fetchXml(indexUrl);
  const sitemapList = getEntries(indexXml, "sitemap");
  const providerIds = await fetchProviderIds();
  for (const providerId of providerIds) {
    await runImportForProvider(providerId, indexXml, sitemapList, indexUrl);
  }
};

module.exports = {
  doImport,
};
