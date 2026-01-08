const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load shared environment variables that contain the Supabase credentials.
dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env')
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PLASMO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Fetches metadata for a single provider document.
 * @param {number|string} documentId
 * @param {number|string} providerId
 * @returns {Promise<Object|null>}
 */
async function getProviderDocument(documentId, providerId) {
  if (!documentId) {
    return null;
  }

  const { data, error } = await supabase
    .from('provider_documents')
    .select('id, provider_id, title, source_url, media_type, cover_image_url, is_active')
    .eq('id', documentId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  getProviderDocument
};
