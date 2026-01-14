const supabase = require('./supabase-client');

async function handler(req, res) {
    // --- FIX START: Set CORS headers immediately for ALL requests ---
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // --- FIX START: Handle the Preflight (OPTIONS) check ---
  if (req.method === "OPTIONS") {
    res.writeHead(200)
    return res.end()
  }
  // --- FIX END ---
  
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const providerId = Number(requestUrl.searchParams.get('provider_id') || '');
  if (!providerId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'provider_id is required' }));
    return;
  }

  try {
    const { data, error } = await supabase
      .from('provider_documents')
      .select('id, title, source_url, media_type, cover_image_url, is_active')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })

    if (error) throw error;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(data || []));
  } catch (err) {
    console.error('[provider-documents-list] handler error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = handler;
