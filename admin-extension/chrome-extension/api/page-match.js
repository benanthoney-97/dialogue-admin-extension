const supabase = require('./supabase-client');

const readRequestBody = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });

const normalizeMatch = (row) => (row ? { ...row, page_match_id: row.id } : row)

async function handler(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET') {
    const pageMatchId = Number(requestUrl.searchParams.get('page_match_id') || '');
    if (!pageMatchId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'page_match_id is required' }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('page_matches')
        .select('*')
        .eq('id', pageMatchId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page match not found' }));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(normalizeMatch(data)));
    } catch (err) {
      console.error('[page-match] handler error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const {
        page_match_id,
        document_id,
        video_url,
        status,
        phrase,
        provider_id,
        url: pageUrlRaw,
      } = JSON.parse(rawBody || '{}');
      const matchId = Number(page_match_id || 0);

      if (matchId) {
        const updates = {};
        if (typeof document_id !== 'undefined') {
          updates.document_id = document_id || null;
        }
        if (typeof video_url === 'string') {
          updates.video_url = video_url;
        }
        if (typeof status === 'string' && status.trim()) {
          updates.status = status;
        }

        if (Object.keys(updates).length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No updatable fields provided' }));
          return;
        }

        const { data, error } = await supabase
          .from('page_matches')
          .update(updates)
          .eq('id', matchId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Page match not found for update' }));
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(normalizeMatch(data)));
        return;
      }

      const pageUrl = (pageUrlRaw || '').toString().trim();
      const docId = Number(document_id || 0);
      const providerId = Number(provider_id || 0);
      const phraseText = (phrase || '').trim();
      if (!phraseText || !docId || !providerId || !pageUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'phrase, document_id, provider_id, and url are required to create a match',
          })
        );
        return;
      }

      const insertPayload = {
        phrase: phraseText,
        document_id: docId,
        provider_id: providerId,
        url: pageUrl,
        status: status || 'active',
        ...(video_url ? { video_url } : {}),
      };

      const { data, error } = await supabase
        .from('page_matches')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to create match' }));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(normalizeMatch(data)));
      return;
    } catch (err) {
      console.error('[page-match] update error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'DELETE') {
    const pageMatchId = Number(requestUrl.searchParams.get('page_match_id') || '');
    if (!pageMatchId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'page_match_id is required' }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('page_matches')
        .delete()
        .select()
        .eq('id', pageMatchId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page match not found for delete' }));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ success: true, deleted: data }));
    } catch (err) {
      console.error('[page-match] delete error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}

module.exports = handler;
