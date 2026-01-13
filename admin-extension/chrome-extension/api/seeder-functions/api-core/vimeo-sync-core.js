const path = require("path");
const axios = require("axios");
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

const getAccessToken = async () => {
  const authString = Buffer.from(`${VIMEO_CLIENT_ID}:${VIMEO_CLIENT_SECRET}`).toString("base64");
  const response = await axios.post(
    "https://api.vimeo.com/oauth/authorize/client",
    { grant_type: "client_credentials", scope: "public" },
    {
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.access_token;
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
    const response = await axios.get(`https://api.vimeo.com/users/${externalId}/videos`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        per_page: 100,
        page,
        fields: "uri,name,link,duration,created_time,pictures.sizes",
      },
    });
    const { data, paging } = response.data;
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

const syncProviderVideos = async (client, providerId, videos) => {
  let inserted = 0;
  let skipped = 0;
  for (const video of videos) {
    let coverImage = null;
    if (video.pictures?.sizes?.length) {
      const sorted = [...video.pictures.sizes].sort((a, b) => b.width - a.width);
      coverImage = sorted[0]?.link || null;
    }
    const query = `
      INSERT INTO provider_documents
        (provider_id, title, source_url, media_type, cover_image_url, is_active)
      SELECT $1, $2, $3, 'video', $4, true
      WHERE NOT EXISTS (
        SELECT 1 FROM provider_documents
        WHERE provider_id = $1 AND source_url = $3
      )
    `;
    const values = [providerId, video.name, video.link, coverImage];
    try {
      const res = await client.query(query, values);
      if (res.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`   ⚠️ DB Error inserting ${video.link}: ${err.message}`);
    }
  }
  return { inserted, skipped };
};

const doVimeoSync = async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const accessToken = await getAccessToken();
    const providers = await fetchVimeoProviders(client);
    for (const provider of providers) {
      console.log(`▶️ Processing provider ${provider.provider_id} (${provider.external_id})`);
      const videos = await fetchVideosForUser(accessToken, provider.external_id);
      const { inserted, skipped } = await syncProviderVideos(client, provider.provider_id, videos);
      console.log(`   ✅ Updated ${inserted} new, skipped ${skipped} duplicates.`);
    }
  } catch (err) {
    console.error("Vimeo sync failed:", err);
    throw err;
  } finally {
    await client.end();
  }
};

module.exports = { doVimeoSync };
