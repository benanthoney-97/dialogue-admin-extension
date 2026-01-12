require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// Configuration
const VIMEO_USER_ID = 'seedlegals'; // The vanity URL part
const OUTPUT_FILE = 'seedlegals_videos.json';

// 1. Authenticate to get Access Token
const getAccessToken = async () => {
  try {
    const authString = Buffer.from(
      `${process.env.VIMEO_CLIENT_ID}:${process.env.VIMEO_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      'https://api.vimeo.com/oauth/authorize/client',
      {
        grant_type: 'client_credentials',
        scope: 'public',
      },
      {
        headers: {
          Authorization: `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Authenticated successfully.');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
};

// 2. Fetch Videos (Handling Pagination)
const fetchAllVideos = async (token) => {
  let allVideos = [];
  let page = 1;
  let hasMore = true;

  console.log(`\n🔍 Starting fetch for user: ${VIMEO_USER_ID}...`);

  while (hasMore) {
    try {
      console.log(`   Fetching page ${page}...`);
      
      const response = await axios.get(
        `https://api.vimeo.com/users/${VIMEO_USER_ID}/videos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            per_page: 100, // Max allowed per request
            page: page,
            // Request specific fields to keep the file size manageable
            fields: 'uri,name,description,link,duration,created_time,pictures.sizes',
          },
        }
      );

      const { data, paging } = response.data;
      
      if (data && data.length > 0) {
        allVideos = [...allVideos, ...data];
      }

      // Check if there is a next page
      if (paging && paging.next) {
        page++;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error.response ? error.response.data : error.message);
      hasMore = false; // Stop on error
    }
  }

  return allVideos;
};

// Main Execution
const run = async () => {
  if (!process.env.VIMEO_CLIENT_ID || !process.env.VIMEO_CLIENT_SECRET) {
    console.error('❌ Missing API Credentials. Please check your .env file.');
    return;
  }

  const token = await getAccessToken();
  const videos = await fetchAllVideos(token);

  console.log(`\n🎉 Success! Retrieved ${videos.length} videos.`);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(videos, null, 2));
  console.log(`💾 Data saved to: ${OUTPUT_FILE}`);
};

run();