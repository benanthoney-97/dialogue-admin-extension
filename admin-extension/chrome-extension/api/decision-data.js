const supabase = require('./supabase-client');
const { getProviderDocument } = require('./provider-documents-web-embed');

const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata;
};

async function lookupKnowledge(knowledgeId) {
  if (!knowledgeId) return null;
  const { data, error } = await supabase
    .from('provider_knowledge')
    .select('metadata, content')
    .eq('id', knowledgeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const metadata = parseMetadata(data?.metadata);
  const payload = {
    metadata,
    content: data?.content || ''
  };
  return payload;
}

async function getPageMatchById(pageMatchId) {
  if (!pageMatchId) return null;
  const { data, error } = await supabase
    .from('page_matches')
    .select('*')
    .eq('id', pageMatchId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getConfidenceTier(providerId, score) {
  if (!providerId) return null;
  const normalizedScore = typeof score === "number" ? score : Number(score);
  const { data, error } = await supabase
    .from("confidence_tiers")
    .select("display_label, color_theme, min_score")
    .eq("provider_id", providerId)
    .order("min_score", { ascending: false });

  if (error) {
    throw error;
  }

  const tiers = Array.isArray(data) ? data : [];
  return tiers.find((tier) => normalizedScore >= tier.min_score) || null;
}

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
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    const hostHeader = req.headers.host;
    const baseOrigin = hostHeader ? `${forwardedProto}://${hostHeader}` : 'http://localhost';
    const requestUrl = new URL(req.url, baseOrigin);
    const providerId = Number(requestUrl.searchParams.get('provider_id') || '');
    const documentId = Number(requestUrl.searchParams.get('document_id') || '');
    const knowledgeId = Number(requestUrl.searchParams.get('knowledge_id') || '');

    // Note: Headers are already set at the top, so we don't need to set them here again.
    // res.setHeader('Content-Type', 'application/json'); // Moved to writeHead or handled automatically

    const payload = {
      title: '',
      video_url: '',
      cover_image_url: '',
      is_active: null,
      source_url: '',
      document_id: null,
      confidence_label: '',
      confidence_color: ''
    };

    let documentRow = null;
    const applyDocumentInfo = (doc) => {
      if (!doc) return;
      payload.title = payload.title || doc.title || '';
      payload.cover_image_url = payload.cover_image_url || doc.cover_image_url || '';
      payload.is_active = payload.is_active ?? doc.is_active ?? null;
      payload.source_url = payload.source_url || doc.source_url || '';
      payload.document_id = doc.id ?? payload.document_id;
    };

    if (documentId && providerId) {
      documentRow = await getProviderDocument(documentId, providerId);
      applyDocumentInfo(documentRow);
    }

    let knowledgeMeta = null;
    if (knowledgeId) {
      knowledgeMeta = await lookupKnowledge(knowledgeId);
      if (knowledgeMeta?.metadata) {
        payload.video_url =
          knowledgeMeta.metadata.video_url ||
          knowledgeMeta.metadata.source ||
          knowledgeMeta.metadata.source_url ||
          payload.video_url;
      }
      payload.content = knowledgeMeta?.content || '';
    }

    const pageMatchId = Number(requestUrl.searchParams.get('page_match_id') || '');
    let pageMatch = await getPageMatchById(pageMatchId);
    if (!pageMatch) {
      // (Empty block preserved)
    }

    payload.confidence = pageMatch?.confidence ?? null;
    payload.phrase = pageMatch?.phrase || payload.phrase;
    payload.page_match_id = pageMatch?.id ?? null;
    payload.video_url = pageMatch?.video_url || payload.video_url;
    payload.content = pageMatch?.transcript || payload.content;

    if (providerId) {
      try {
        const tier = await getConfidenceTier(providerId, payload.confidence ?? 0);
        if (tier) {
          payload.confidence_label = tier.display_label || '';
          payload.confidence_color = tier.color_theme || '';
        }
      } catch (err) {
        // (Silent catch preserved)
      }
    }

    const matchDocumentId = pageMatch?.document_id ?? documentId;
    if (matchDocumentId && providerId) {
      if (!documentRow || documentRow.id !== matchDocumentId) {
        documentRow = await getProviderDocument(matchDocumentId, providerId);
      }
      applyDocumentInfo(documentRow);
    } else if (matchDocumentId) {
      payload.document_id = payload.document_id ?? matchDocumentId;
    }

    if (!payload.video_url && knowledgeMeta?.metadata) {
      payload.video_url =
        knowledgeMeta.metadata.video_url ||
        knowledgeMeta.metadata.source ||
        knowledgeMeta.metadata.source_url ||
        payload.video_url;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (err) {
    console.error('decision-data handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = handler;
