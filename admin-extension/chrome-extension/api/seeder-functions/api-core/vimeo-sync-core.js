const path = require("path");
const fetch = globalThis.fetch || require("node-fetch");
const { Client } = require("pg");

const dotenvPath = path.resolve(__dirname, "../../../../.env");
require("dotenv").config({ path: dotenvPath });

const VIMEO_CLIENT_ID = process.env.VIMEO_CLIENT_ID;
const VIMEO_CLIENT_SECRET = process.env.VIMEO_CLIENT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!VIMEO_CLIENT_ID || !VIMEO_CLIENT_SECRET || !DATABASE_URL) {
  throw new Error(
    "Missing Vimeo or database credentials (VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, DATABASE_URL)"
  );
}

// --- NETWORK HELPER WITH RETRY ---
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // If 429 (Rate Limit) or 5xx (Server Error), we might want to retry. 
      // For now, we throw to let the catch block handle the retry logic 
      // if it's a network error, or fail if it's a hard API error.
      const body = await response.text();
      throw new Error(`Request failed: ${response.status} ${body}`);
      
    } catch (error) {
      // Don't retry on Auth failures (401) or Bad Requests (400)
      if (error.message.includes("401") || error.message.includes("400")) {
        throw error;
      }

      if (i === retries - 1) throw error; // Throw on final attempt
      
      console.warn(`   ⚠️ Network glitch (${error.message}). Retrying ${i + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, 1500)); // Wait 1.5s before retry
    }
  }
};

const getAccessToken = async () => {
  const authString = Buffer.from(`${VIMEO_CLIENT_ID}:${VIMEO_CLIENT_SECRET}`).toString("base64");
  
  // Use retry here too, just in case
  const response = await fetchWithRetry("https://api.vimeo.com/oauth/authorize/client", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
      "User-Agent": "DialogueAdmin/1.0", // Identification
    },
    body: JSON.stringify({ grant_type: "client_credentials", scope: "public" }),
  });

  const payload = await response.json();
  return payload.access_token;
};

const fetchVimeoProviders = async (client) => {
  const res = await client.query(`
    SELECT provider_id, external_id
    FROM provider_platforms
    WHERE platform_name ILIKE 'Vimeo'
      AND external_id IS NOT NULL
  `);
  return res.rows || [];
};

const fetchVideosForUser = async (accessToken, externalId) => {
  const videos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`https://api.vimeo.com/users/${externalId}/videos`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("fields", "uri,name,link,duration,created_time,pictures.sizes");

    // Using fetchWithRetry to handle SocketErrors
    const response = await fetchWithRetry(url.toString(), {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DialogueAdmin/1.0", // Crucial for passing WAF
        "Accept": "application/vnd.vimeo.*+json;version=3.4"
      },
    });

    const payload = await response.json();
    const { data, paging } = payload;
    
    if (Array.isArray(data) && data.length) {
      videos.push(...data);
    }
    
    if (paging && paging.next) {
      page++;
    } else {
      hasMore = false;
    }
  }
  return videos;
};

const resolveChannelId = async (client, providerId, vimeoProfileUrl) => {
  // Normalize URL (strip trailing slashes for safer matching)
  const normalizedUrl = vimeoProfileUrl.replace(/\/$/, "");

  const res = await client.query(`
    SELECT id 
    FROM provider_channels
    WHERE provider_id = $1
      AND (
         channel_url = $2 
         OR channel_url = $2 || '/' -- Check for trailing slash version too
      )
  `, [providerId, normalizedUrl]);

  return res.rows[0]?.id || null;
};

const syncProviderVideos = async (client, providerId, videos, channelId = null) => {
  let inserted = 0;
  let skipped = 0;
  const newVideos = [];
  
  for (const video of videos) {
    let coverImage = null;
    if (video.pictures?.sizes?.length) {
      const sorted = [...video.pictures.sizes].sort((a, b) => b.width - a.width);
      coverImage = sorted[0]?.link || null;
    }
    
    // Canonical URL Fix
    const videoId = video.uri.replace('/videos/', '');
    const canonicalUrl = `https://vimeo.com/${videoId}`;

    // INSERT with Dynamic Channel ID
    // Note: is_active is explicitly FALSE
    const query = `
      INSERT INTO provider_documents
        (provider_id, title, source_url, media_type, cover_image_url, is_active, channel_id)
      SELECT $1, $2, $3, 'video', $4, false, $5
      WHERE NOT EXISTS (
        SELECT 1 FROM provider_documents
        WHERE provider_id = $1 AND source_url = $3
      )
    `;
    
    const values = [providerId, video.name, canonicalUrl, coverImage, channelId];
    
    try {
      const res = await client.query(query, values);
      if (res.rowCount > 0) {
        inserted++;
        newVideos.push({
          providerId,
          title: video.name,
          sourceUrl: canonicalUrl,
          channelId: channelId
        });
      } else skipped++;
    } catch (err) {
      console.error(`   ⚠️ DB Error inserting ${canonicalUrl}: ${err.message}`);
    }
  }
  return { inserted, skipped, newVideos };
};

// Add this helper to get the user profile link
const getVimeoUserLink = async (accessToken, externalId) => {
  const url = `https://api.vimeo.com/users/${externalId}`;
  const response = await fetchWithRetry(url, {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "DialogueAdmin/1.0"
    },
  });
  const data = await response.json();
  return data.link; // e.g. "https://vimeo.com/seedlegals"
};

const doVimeoSync = async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    
    console.log("🔄 Starting Vimeo Sync...");
    const accessToken = await getAccessToken();
    const providers = await fetchVimeoProviders(client);
    
    const summary = [];
for (const provider of providers) {
  console.log(`▶️ Processing provider ${provider.provider_id}`);

  // 1. Get the Profile URL from Vimeo (e.g. "https://vimeo.com/seedlegals")
  const vimeoProfileLink = await getVimeoUserLink(accessToken, provider.external_id);
  
  // 2. Find the matching Channel ID in your DB
  const channelId = await resolveChannelId(client, provider.provider_id, vimeoProfileLink);
  
  if (!channelId) {
    console.warn(`   ⚠️ No matching provider_channel found for URL: ${vimeoProfileLink}. Inserting as Orphan.`);
  }

  // 3. Fetch Videos
  const videos = await fetchVideosForUser(accessToken, provider.external_id);
  
  // 4. Sync (Passing the channelId)
  const { inserted, skipped, newVideos } = await syncProviderVideos(
    client,
    provider.provider_id,
    videos,
    channelId // <--- Pass it here
  );
      
      console.log(`   ✅ Updated ${inserted} new, skipped ${skipped} duplicates.`);
      summary.push(...newVideos);
    }
    
    return summary;
  } catch (err) {
    console.error("Vimeo sync failed:", err);
    throw err;
  } finally {
    await client.end();
  }
};

module.exports = { doVimeoSync };
