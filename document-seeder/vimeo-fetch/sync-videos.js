require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

// --- CONFIGURATION ---
const INPUT_FILE = 'seedlegals_videos.json';
const PROVIDER_ID = 28; // SeedLegals Provider ID
// ---------------------

const runSync = async () => {
  // 1. Load Data
  console.log(`📂 Reading ${INPUT_FILE}...`);
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    return;
  }
  const rawData = fs.readFileSync(INPUT_FILE);
  const videos = JSON.parse(rawData);
  console.log(`   Loaded ${videos.length} videos from file.`);

  // 2. Connect to Database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // ssl: { rejectUnauthorized: false } // Uncomment if using Supabase/Heroku/AWS
  });

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    let insertedCount = 0;
    let skippedCount = 0;

    // 3. Iterate and Sync
    console.log('🔄 Starting sync process...');

    for (const video of videos) {
      // Logic: Pick the largest available thumbnail image
      let coverImage = null;
      if (video.pictures && video.pictures.sizes && video.pictures.sizes.length > 0) {
        // Sort by width descending and pick the first one
        const sorted = video.pictures.sizes.sort((a, b) => b.width - a.width);
        coverImage = sorted[0].link;
      }

      const queryText = `
        INSERT INTO provider_documents 
          (provider_id, title, source_url, media_type, cover_image_url, is_active)
        SELECT $1, $2, $3, $4, $5, true
        WHERE NOT EXISTS (
            SELECT 1 FROM provider_documents 
            WHERE provider_id = $1 
            AND source_url = $3
        )
      `;

      const values = [
        PROVIDER_ID,            // $1
        video.name,             // $2
        video.link,             // $3 (The duplication check key)
        'video',                // $4 (media_type)
        coverImage              // $5
      ];

      const res = await client.query(queryText, values);
      
      // rowCount is 1 if inserted, 0 if it already existed (skipped)
      if (res.rowCount > 0) {
        insertedCount++;
        process.stdout.write('+'); // Visual feedback for insert
      } else {
        skippedCount++;
        process.stdout.write('.'); // Visual feedback for skip
      }
    }

    // 4. Summary
    console.log('\n\n🏁 Sync Complete!');
    console.log(`   -----------------------------`);
    console.log(`   🆕 New Videos Added:  ${insertedCount}`);
    console.log(`   ⏭️  Duplicates Skipped: ${skippedCount}`);
    console.log(`   -----------------------------`);

  } catch (err) {
    console.error('❌ Database Error:', err);
  } finally {
    await client.end();
  }
};

runSync();