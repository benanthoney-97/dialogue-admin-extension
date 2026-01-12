const supabase = require('./supabase-client')

const readRequestBody = (req) =>
  new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
  })

const setCorsHeaders = (res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

const fetchEmbedding = async (text) => {
  if (!text || !OPENAI_API_KEY) return null
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: OPENAI_EMBEDDING_MODEL,
    }),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Failed to fetch embedding')
  }
  return payload.data?.[0]?.embedding || null
}

const parseMetadata = (metadata) => {
  if (!metadata) return {}
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata)
    } catch {
      return {}
    }
  }
  return metadata
}

const normalizeSourceUrl = (value) => {
  if (!value) return ''
  try {
    const parsed = new URL(value, 'http://example.com')
    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`
    return normalized.replace(/\/$/, '')
  } catch {
    const [base] = value.split('#')
    return base.trim()
  }
}

const toVimeoPlayerUrl = (value) => {
  if (!value) return ''
  const match = value.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (match) {
    const embed = new URL(`https://player.vimeo.com/video/${match[1]}`)
    embed.searchParams.set('autoplay', '0')
    embed.searchParams.set('title', '0')
    embed.searchParams.set('byline', '0')
    embed.searchParams.set('portrait', '0')
    return embed.toString()
  }
  return value
}

const buildVideoUrl = (source, start) => {
  if (!source) return ''
  const raw = source.split('#')[0].trim()
  const base = toVimeoPlayerUrl(raw)
  if (typeof start === 'number' && Number.isFinite(start) && start >= 0) {
    return `${base}#t=${Math.round(start)}`
  }
  return base
}

const resolveTimestamp = (metadata, keys) => {
  if (!metadata || typeof metadata !== 'object') return null
  for (const key of keys) {
    const candidate = metadata[key]
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }
  return null
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    setCorsHeaders(res)
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const rawBody = await readRequestBody(req)
    const {
      text,
      provider_id,
      match_count,
      match_threshold,
    } = JSON.parse(rawBody || '{}')
    const providerId = Number(provider_id || 0)
    const trimmedText = (text || '').trim()

    if (!trimmedText || !providerId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'text and provider_id are required' }))
      return
    }

    const embedding = await fetchEmbedding(trimmedText)
    if (!embedding) {
      res.writeHead(422, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to compute embedding' }))
      return
    }

    const desiredCount = Math.min(20, Math.max(6, Number(match_count || 12)))
    const desiredThreshold = Math.max(0, Number(match_threshold ?? 0.01))
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('match_provider_knowledge', {
        query_embedding: embedding,
        match_threshold: desiredThreshold,
        match_count: desiredCount,
        filter_provider_id: providerId,
      })
      .limit(desiredCount)

    if (rpcError) {
      throw rpcError
    }

    const matches = Array.isArray(rpcData) ? rpcData : []
    const knowledgeIds = [...new Set(matches.map((entry) => entry.id).filter(Boolean))]
    let knowledgeMetaMap = {}
    if (knowledgeIds.length) {
      const { data: knowledgeRows, error: knowledgeError } = await supabase
        .from('provider_knowledge')
        .select('id, metadata')
        .in('id', knowledgeIds)
      if (!knowledgeError && Array.isArray(knowledgeRows)) {
        knowledgeMetaMap = knowledgeRows.reduce(
          (acc, row) => ({ ...acc, [row.id]: parseMetadata(row.metadata) }),
          {}
        )
      }
    }
    const docIds = [...new Set(matches.map((item) => item.document_id).filter(Boolean))]
    let documentMap = {}
    if (docIds.length) {
      const { data: docs } = await supabase
        .from('provider_documents')
        .select('id, title, cover_image_url, source_url')
        .in('id', docIds)
      documentMap = Array.isArray(docs)
        ? docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc }), {})
        : {}
    }

    const normalizedResults = matches
      .map((entry) => {
        const metadata =
          knowledgeMetaMap[entry.id] || parseMetadata(entry.metadata)
        const normalizedSource = normalizeSourceUrl(metadata.source || metadata.source_url || '')
        const start =
          resolveTimestamp(metadata, [
            'timestampStart',
            'timestamp_start',
            'start',
            'start_time',
            'timestampStartSeconds',
            'begin',
          ]) ?? 0
        const end =
          resolveTimestamp(metadata, [
            'timestampEnd',
            'timestamp_end',
            'end',
            'end_time',
            'timestampEndSeconds',
            'stop',
          ]) ?? 0
        const maxTimestamp = Math.max(start, end)
        const suggestedTimestamp = Number.isFinite(maxTimestamp) ? maxTimestamp : start
        const document = entry.document_id ? documentMap[entry.document_id] : null
        const fallbackSource = document?.source_url || ''
        return {
          knowledge_id: entry.id,
          document_id: entry.document_id,
          document_title: document?.title || '',
          cover_image_url: document?.cover_image_url || '',
          video_url: buildVideoUrl(normalizedSource || fallbackSource, suggestedTimestamp),
          source_url: normalizedSource || normalizeSourceUrl(fallbackSource),
          timestamp_start: start,
          timestamp_end: end,
          suggested_timestamp: suggestedTimestamp,
          confidence: Number(entry.confidence ?? entry.similarity ?? 0),
          similarity: Number(entry.similarity ?? entry.confidence ?? 0),
          snippet: entry.content || '',
        }
      })
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .filter(
        (entry, index, all) =>
          !!entry.knowledge_id &&
          all.findIndex((item) => item.knowledge_id === entry.knowledge_id) === index
      )
      .slice(0, 10)
    normalizedResults.forEach((result) => {

    })

    setCorsHeaders(res)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ results: normalizedResults }))
  } catch (err) {
    console.error('[match-suggestions] handler error', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
}

module.exports = handler
