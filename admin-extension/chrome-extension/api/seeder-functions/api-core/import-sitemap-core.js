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
  if (!feedId || !pages.length) return [];
  const { data: existing = [] } = await supabase
    .from("sitemap_pages")
    .select("page_url")
    .eq("feed_id", feedId)
    .in_("page_url", pages);
  const existingSet = new Set(existing.map((row) => row.page_url));
  const toInsert = pages.filter((pageUrl) => !existingSet.has(pageUrl));
  if (!toInsert.length) return [];
  const rows = toInsert.map((pageUrl) => ({
    feed_id: feedId,
    page_url: pageUrl,
    tracked: true,
  }));
  const { data, error } = await supabase
    .from("sitemap_pages")
    .insert(rows)
    .select("id,page_url");
  if (error) throw error;
  return data || [];
};

const fetchXml = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  return res.text();
};

const insertFeed = async (feedUrl, lastModified, providerId) => {
  const existing = await supabase
    .from("sitemap_feeds")
    .select("id")
    .eq("feed_url", feedUrl)
    .maybeSingle();
  if (existing.data?.id) {
    return { feedId: existing.data.id, created: false };
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
  return { feedId: data?.id, created: true };
};

const runImportForProvider = async (providerId, indexXml, sitemapList, indexUrl) => {
  console.log(`[import-sitemap] processing provider ${providerId}`);
  const feedResults = [];
  if (sitemapList.length) {
    for (const sitemap of sitemapList) {
      const feedUrl = extractTagValue(sitemap, "loc");
      if (!feedUrl) continue;
      const lastmod = extractTagValue(sitemap, "lastmod");
      const { feedId, created } = await insertFeed(feedUrl, lastmod, providerId);
      if (!feedId) continue;
      try {
        const feedXml = await fetchXml(feedUrl);
        const urlEntries = getEntries(feedXml, "url");
        const urls = urlEntries
          .map((entry) => extractTagValue(entry, "loc"))
          .filter(Boolean);
        const newPages = await insertPages(feedId, urls);
        feedResults.push({
          providerId,
          feedUrl,
          feedCreated: created,
          pagesAdded: newPages.length,
          newPages,
        });
      } catch (error) {
        console.warn(`Skipping feed ${feedUrl}:`, error.message);
      }
    }
  } else {
    const { feedId, created } = await insertFeed(indexUrl, null, providerId);
    if (!feedId) return feedResults;
    const urlEntries = getEntries(indexXml, "url");
    const urls = urlEntries
      .map((entry) => extractTagValue(entry, "loc"))
      .filter(Boolean);
    const newPages = await insertPages(feedId, urls);
    feedResults.push({
      providerId,
      feedUrl: indexUrl,
      feedCreated: created,
      pagesAdded: newPages.length,
      newPages,
    });
  }
  return feedResults;
};

const fetchSitemapIndexes = async () => {
  const resp = await supabase
    .from("sitemap_indexes")
    .select("id,provider_id,index_url")
    .order("id");
  return resp.data || [];
};

const updateIndexTimestamp = async (indexId) => {
  if (!indexId) return;
  await supabase
    .from("sitemap_indexes")
    .update({ last_imported_at: new Date().toISOString() })
    .eq("id", indexId);
};

const importIndexUrl = async (providerId, indexUrl) => {
  const indexXml = await fetchXml(indexUrl);
  const sitemapList = getEntries(indexXml, "sitemap");
  return await runImportForProvider(providerId, indexXml, sitemapList, indexUrl);
};

const doImport = async (indexUrl) => {
  if (indexUrl) {
    const targetProvider = DEFAULT_PROVIDER_ID;
    if (!targetProvider) {
      throw new Error("Provider ID must be set when calling doImport with an indexUrl");
    }
    return await importIndexUrl(targetProvider, indexUrl);
  }

  const indexes = await fetchSitemapIndexes();
  const summary = [];
  for (const indexEntry of indexes) {
    const feeds = await importIndexUrl(indexEntry.provider_id, indexEntry.index_url);
    summary.push({
      indexId: indexEntry.id,
      providerId: indexEntry.provider_id,
      indexUrl: indexEntry.index_url,
      feeds,
    });
    await updateIndexTimestamp(indexEntry.id);
  }
  return summary;
};

module.exports = {
  doImport,
};
