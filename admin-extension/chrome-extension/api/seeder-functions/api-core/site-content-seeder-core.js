const path = require("path");
const fetch = globalThis.fetch || require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");
const supabaseModule = require("../../supabase-client");
const supabase = supabaseModule?.default ?? supabaseModule;

const dotenvPath = path.resolve(__dirname, "../../../../.env");
require("dotenv").config({ path: dotenvPath });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!supabase || !OPENAI_API_KEY) {
  throw new Error("Missing Supabase or OpenAI credentials for site-content seeder");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const EMBED_MODEL = "text-embedding-3-small";
const CHUNK_MIN_LENGTH = Number(process.env.SITE_CHUNK_MIN_LENGTH || 30);
const CHUNK_MAX_LENGTH = Number(process.env.SITE_CHUNK_MAX_LENGTH || 150);
const CHUNK_LIMIT = Number(process.env.SITE_CHUNK_LIMIT || 50);

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SiteContentSeeder/1.0; +https://example.com)",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

const extractBlocks = (html) => {
  const $ = cheerio.load(html);
  $("script, style, header, footer, nav, form, noscript").remove();
  const body = $("body").length ? $("body") : $.root();
  const blockTags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"];
  const blocks = [];
  blockTags.forEach((tag) => {
    body.find(tag).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (!text) return;
      blocks.push({ text, isHeader: tag.startsWith("h") });
    });
  });
  return blocks;
};

const chunkSentences = (blocks = []) => {
  const seen = new Set();
  const sentences = [];
  for (const block of blocks) {
    if (!block || sentences.length >= CHUNK_LIMIT) break;
    const text = block.text.trim();
    if (!text) continue;
    const limitReached = sentences.length >= CHUNK_LIMIT;
    if (block.isHeader) {
      const clean = text.replace(/\s+([.,!?;:])/g, "$1");
      if (clean.length >= CHUNK_MIN_LENGTH && clean.length <= CHUNK_MAX_LENGTH && !seen.has(clean)) {
        seen.add(clean);
        sentences.push(clean);
      }
      continue;
    }
    const parts = text.split(/(?<=[.!?])\s+/);
    for (const sentence of parts) {
      if (sentences.length >= CHUNK_LIMIT) break;
      const clean = sentence.trim().replace(/\s+([.,!?;:])/g, "$1");
      if (!clean) continue;
      if (clean.length < CHUNK_MIN_LENGTH || clean.length > CHUNK_MAX_LENGTH) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      sentences.push(clean);
    }
  }
  return sentences;
};

const embedChunks = async (chunks) => {
  if (!chunks.length) return [];
  try {
    const response = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: chunks,
    });
    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("Embedding error:", error);
    return [];
  }
};

const persistSiteChunks = async (providerId, sitemapPageId, pageUrl, chunks, embeddings, title) => {
  if (!chunks.length || !embeddings.length) return [];
  
  const allPayloads = chunks.map((chunkText, idx) => ({
    provider_id: providerId,
    sitemap_page_id: sitemapPageId,
    page_url: pageUrl,
    chunk_index: idx,
    chunk_text: chunkText,
    embedding: embeddings[idx] || [],
    metadata: { source: pageUrl, title, chunk_index: idx },
  }));

  // OPTIMISATION: Insert in batches of 10 to avoid 8s timeout
  const BATCH_SIZE = 10;
  const results = [];
  
  for (let i = 0; i < allPayloads.length; i += BATCH_SIZE) {
    const batch = allPayloads.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from("site_content").insert(batch).select("id, chunk_index");
    
    if (error) {
      console.error("Site content insert error:", error);
      throw error;
    }
    if (data) results.push(...data);
  }

  return results;
};

const processPage = async ({ pageUrl, providerId, sitemapPageId }) => {
  const response = await fetch(pageUrl, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${pageUrl}: ${response.status}`);
  }
  const html = await response.text();
  const title = extractBlocks(html)[0]?.text || null;
  const blocks = extractBlocks(html);
  const chunks = chunkSentences(blocks);
  if (!chunks.length) return [];
  const embeddings = await embedChunks(chunks);
  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count mismatch");
  }
  return await persistSiteChunks(providerId, sitemapPageId, pageUrl, chunks, embeddings, title);
};

module.exports = {
  processPage,
};
