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
  console.log(`[decision-data] fetched knowledge ${knowledgeId}`, payload);
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
      source_url: ''
    };

    if (documentId && providerId) {
      const doc = await getProviderDocument(documentId, providerId);
      console.log("[decision-data] provider_documents row", doc);

      if (doc) {
        payload.title = doc.title || '';
        payload.cover_image_url = doc.cover_image_url || '';
        payload.is_active = doc.is_active ?? null;
        payload.source_url = doc.source_url || '';
      }
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
    if (!pageMatch && documentId && providerId && phraseParam) {
      const normalized = phraseParam.replace(/\s+/g, ' ').trim();
      const { data, error } = await supabase
        .from('page_matches')
        .select('*')
        .eq('document_id', documentId)
        .eq('provider_id', providerId)
        .ilike('phrase', `%${normalized}%`)
        .order('confidence', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      pageMatch = data;
    }

    payload.confidence = pageMatch?.confidence ?? null;
    payload.phrase = pageMatch?.phrase || payload.phrase;
    payload.page_match_id = pageMatch?.id ?? null;
    payload.video_url = pageMatch?.video_url || payload.video_url;
    payload.content = pageMatch?.transcript || payload.content;

    if (!payload.video_url && knowledgeMeta?.metadata) {
      payload.video_url =
        knowledgeMeta.metadata.video_url ||
        knowledgeMeta.metadata.source ||
        knowledgeMeta.metadata.source_url ||
        payload.video_url;
    }

    console.log(
      `[decision-data] provider_id=${providerId} document_id=${documentId} page_match_id=${payload.page_match_id} knowledge_id=${knowledgeId} -> title='${payload.title}' video='${payload.video_url}' confidence='${payload.confidence}' phrase='${payload.phrase}' content='${payload.content}'`
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
