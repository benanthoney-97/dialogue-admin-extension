const supabase = require('./supabase-client');

const readRequestBody = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });

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
      res.end(JSON.stringify(data));
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
      const { page_match_id, document_id, video_url, status } = JSON.parse(rawBody || '{}');
      const matchId = Number(page_match_id || 0);
      if (!matchId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'page_match_id is required' }));
        return;
      }

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
      res.end(JSON.stringify(data));
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
