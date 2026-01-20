const supabase = require('./supabase-client');
const { getProviderDocument } = require('./provider-documents-web-embed');
const { logEngagementEvent } = require('./lib/engagement-events');
const vimeoEmbedUrl = (originalUrl = '', timestamp = 0) => {
  if (!originalUrl) return originalUrl;
  const matches = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];
  let videoId = null;
  for (const pattern of matches) {
    const found = originalUrl.match(pattern);
    if (found) {
      videoId = found[1];
      break;
    }
  }
  if (!videoId) return originalUrl;
  const suffix = timestamp ? `#t=${timestamp}s` : '';
  return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0${suffix}`;
};

const resolveThreshold = (rawValue) => {
  if (typeof rawValue === 'number') {
    return rawValue;
  }
  if (typeof rawValue === 'string' && rawValue.trim() !== '') {
    const numeric = Number(rawValue);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }
  return null;
};

const fetchProviderThreshold = async (providerId) => {
  const { data, error } = await supabase
    .from('provider_site_settings')
    .select('match_threshold')
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (!data) {
    return null;
  }

  return resolveThreshold(data.match_threshold);
};

const fetchMatches = async (providerId, limit = 50, pageUrl = '') => {
    const effectiveLimit = Number(limit) > 0 ? Number(limit) : 50;
    const threshold = await fetchProviderThreshold(providerId);
    let query = supabase
      .from('page_matches')
      .select('id, phrase, video_url, confidence, document_id, status, match_source')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (pageUrl) {
      query = query.eq('url', pageUrl);
    }
    query = query.limit(effectiveLimit);
    const { data, error } = await query;

  if (error) {
    throw error;
  }

  const matches = [];
  for (const row of data || []) {
    let timestampValue = 0;
    if (typeof row.video_url === "string") {
      const timestampMatch = row.video_url.match(/#t=(\d+)/);
      if (timestampMatch) {
        const parsed = Number(timestampMatch[1]);
        if (!Number.isNaN(parsed)) {
          timestampValue = parsed;
        }
      }
    }
    const embedUrl = vimeoEmbedUrl(row.video_url, timestampValue);

    if (typeof threshold === 'number' && row.match_source !== 'user-created' && row.confidence < threshold) {
      continue;
    }

    const match = {
      page_match_id: row.id,
      phrase: row.phrase || '',
      video_url: embedUrl,
      confidence: row.confidence,
      document_id: row.document_id,
      provider_id: providerId,
      status: row.status,
      match_source: row.match_source || 'system-created',
    };

    if (match.document_id) {
      try {
        const doc = await getProviderDocument(match.document_id, providerId);
        if (doc) {
          match.document_title = doc.title || '';
          match.cover_image_url = doc.cover_image_url || '';
        }
      } catch (err) {
      }
    }

    matches.push(match);
  }

  if (matches.length > 0) {
    console.log(
      `[match-map] logging impression event provider=${providerId} page_url=${pageUrl} matches=${matches.length}`
    );
    await logEngagementEvent({
      providerId,
      eventType: 'impression',
      pageUrl,
      metadata: { match_count: matches.length },
    });
    console.log('[match-map] engagement event logged');
  } else {
    console.log(`[match-map] no matches returned for provider=${providerId}`);
  }
  return matches;
};

async function handler(req, res) {
  // --- FIX START: Standardize CORS headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // --- FIX START: Handle Preflight OPTIONS check ---
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  // --- FIX END ---

  try {
    // Basic Method Check
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    const hostname = req.headers.host || 'localhost:4173';
    const requestUrl = new URL(req.url, `${forwardedProto}://${hostname}`);
    const providerId = Number(requestUrl.searchParams.get('provider_id') || '');
    const requestedUrl = requestUrl.searchParams.get('url') || '';
    const limitParam = Number(requestUrl.searchParams.get('limit') || '');
    const limit = limitParam > 0 ? limitParam : undefined;

    if (!providerId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing provider_id' }));
    }

    const matches = await fetchMatches(providerId, limit, requestedUrl);
    
    // Headers are already set at the top, just send the response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(matches));

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = handler;
