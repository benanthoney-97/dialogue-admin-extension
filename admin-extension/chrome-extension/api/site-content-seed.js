const { spawn } = require('child_process');
const path = require('path');

const SITE_SEEDER_SECRET = process.env.SITE_SEEDER_SECRET;
const SITE_SEEDER_PATH = path.join(__dirname, '..', '..', 'document-seeder', 'site-content-seeder.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function runSiteSeeder(providerId, feedIds, force) {
  const args = [SITE_SEEDER_PATH, String(providerId), ...feedIds.map(String)];
  if (force) {
    args.push('--rebuild');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`site-content-seeder exited with ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}

async function handler(req, res) {
  if (!SITE_SEEDER_SECRET) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'SITE_SEEDER_SECRET not configured' }));
    return;
  }

  const providedSecret = req.headers['x-site-secret'];
  if (!providedSecret || providedSecret !== SITE_SEEDER_SECRET) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let payload;
  try {
    payload = await parseRequestBody(req);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const providerId = Number(payload.providerId || payload.provider_id);
  const feedIds = (payload.feedIds || payload.feed_ids || []).map(Number).filter(Boolean);
  const force = Boolean(payload.force || payload.rebuild);

  if (!providerId || feedIds.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'providerId and feedIds are required' }));
    return;
  }

  try {
    await runSiteSeeder(providerId, feedIds, force);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[site-content-seed] failed', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = handler;
