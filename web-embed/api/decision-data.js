const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { getProviderDocument } = require('./provider-documents');

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env')
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PLASMO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

const vimeoEmbedUrl = (originalUrl = '', timestamp = 0) => {
  if (!originalUrl) return originalUrl;
  const matches = [
    new RegExp('vimeo\\.com/(\\d+)'),
    new RegExp('player\\.vimeo\\.com/video/(\\d+)')
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
  const tsSuffix = timestamp ? `#t=${timestamp}s` : '';
  return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0${tsSuffix}`;
};

async function lookupKnowledge(knowledgeId) {
  if (!knowledgeId) return null;
  const { data, error } = await supabase
    .from('provider_knowledge')
    .select('metadata, content, document_id')
    .eq('id', knowledgeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const metadata = parseMetadata(data?.metadata);
  const payload = {
    metadata,
    content: data?.content || '',
    document_id: data?.document_id || null
  };
  console.log(`[decision-data] fetched knowledge ${knowledgeId}`, payload);
  return payload;
}

async function findPageMatchByPhrase(documentId, providerId, phrase) {
  if (!documentId || !providerId || !phrase) return null;
  const normalized =
    typeof phrase === 'string' ? phrase.replace(/\s+/g, ' ').trim() : '';
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('page_matches')
    .select('confidence, phrase, document_id, id')
    .eq('document_id', documentId)
    .eq('provider_id', providerId)
    .ilike('phrase', `%${normalized}%`)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    confidence: data.confidence ?? null,
    phrase: data.phrase || '',
    id: data.id ?? null,
  };
}

async function getPageMatchMetadata(documentId, providerId, phrase) {
  if (!documentId || !providerId) return null;
  const fromPhrase = await findPageMatchByPhrase(documentId, providerId, phrase);
  if (fromPhrase) return fromPhrase;

  const { data, error } = await supabase
    .from('page_matches')
    .select('confidence, phrase, document_id, id')
    .eq('document_id', documentId)
    .eq('provider_id', providerId)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    confidence: data?.confidence ?? null,
    phrase: data?.phrase || '',
    id: data?.id ?? null,
  };
}

async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const providerId = Number(requestUrl.searchParams.get('provider_id') || '');
    const documentId = Number(requestUrl.searchParams.get('document_id') || '');
    const knowledgeId = Number(requestUrl.searchParams.get('knowledge_id') || '');
    const phraseParam = requestUrl.searchParams.get('phrase') || '';

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const payload = {
      title: '',
      video_url: '',
      cover_image_url: '',
      is_active: null,
      source_url: '',
      document_id: null
    };

    let knowledgeMeta = null;
    if (knowledgeId) {
      knowledgeMeta = await lookupKnowledge(knowledgeId);
      if (knowledgeMeta?.metadata) {
        const rawVideoUrl =
          knowledgeMeta.metadata.video_url ||
          knowledgeMeta.metadata.source ||
          knowledgeMeta.metadata.source_url ||
          '';
        const timestamp =
          knowledgeMeta.metadata.timestampStart ||
          knowledgeMeta.metadata.timestamp ||
          0;
        payload.video_url = vimeoEmbedUrl(rawVideoUrl, timestamp) || rawVideoUrl || payload.video_url;
      }
      payload.content = knowledgeMeta?.content || '';
    }

    const pageMatchMeta = await getPageMatchMetadata(documentId, providerId, phraseParam);
    let resolvedDocumentId = pageMatchMeta?.document_id || 0;
    if (!resolvedDocumentId && knowledgeMeta?.document_id) {
      resolvedDocumentId = Number(knowledgeMeta.document_id) || 0;
    }
    if (!resolvedDocumentId && knowledgeId) {
      const { data: pageMatchByKnowledge } = await supabase
        .from('page_matches')
        .select('document_id')
        .eq('knowledge_id', knowledgeId)
        .maybeSingle();
      if (pageMatchByKnowledge?.document_id) {
        resolvedDocumentId = pageMatchByKnowledge.document_id;
      }
    }
    if (!resolvedDocumentId && knowledgeMeta?.metadata?.source) {
      const { data: matchByUrl } = await supabase
        .from('page_matches')
        .select('document_id')
        .ilike('video_url', `%${knowledgeMeta.metadata.source}%`)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (matchByUrl?.document_id) {
        resolvedDocumentId = matchByUrl.document_id;
      }
    }
    if (resolvedDocumentId) {
      payload.document_id = resolvedDocumentId;
const doc = await getProviderDocument(resolvedDocumentId, providerId);
console.log("[decision-data] provider_documents row", doc);
      if (doc) {
        payload.title = doc.title || '';
        payload.cover_image_url = doc.cover_image_url || '';
        payload.is_active = doc.is_active ?? null;
        payload.source_url = doc.source_url || '';
        console.log(
          `[decision-data] provider_documents hit document_id=${resolvedDocumentId} title='${payload.title}'`
        );
      }
    }
    payload.confidence = pageMatchMeta?.confidence ?? payload.confidence ?? null;
    payload.phrase = pageMatchMeta?.phrase || '';
    payload.page_match_id = pageMatchMeta?.id ?? null;
    console.log(
      `[decision-data] payload page_match_id=${payload.page_match_id} knowledge_id=${knowledgeId}`
    );
    payload.page_match_id = pageMatchMeta?.id ?? null;
    console.log(
      `[decision-data] provider_id=${providerId} document_id=${documentId} knowledge_id=${knowledgeId} -> title='${payload.title}' video='${payload.video_url}' confidence='${payload.confidence}' phrase='${payload.phrase}' content='${payload.content}'`
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (err) {
    console.error('decision-data handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = handler;
