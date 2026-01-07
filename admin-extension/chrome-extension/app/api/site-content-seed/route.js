import { spawn } from 'child_process';
import path from 'path';

const SITE_SEEDER_SECRET = process.env.SITE_SEEDER_SECRET;
const SITE_SEEDER_PATH = path.join(process.cwd(), 'document-seeder', 'site-content-seeder.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';

function parseBody(req) {
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

export async function POST(req) {
  if (!SITE_SEEDER_SECRET) {
    return new Response(JSON.stringify({ error: 'SITE_SEEDER_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const providedSecret = req.headers.get('x-site-secret');
  if (!providedSecret || providedSecret !== SITE_SEEDER_SECRET) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const providerId = Number(payload.providerId || payload.provider_id);
  const feedIds = (payload.feedIds || payload.feed_ids || []).map(Number).filter(Boolean);
  const force = Boolean(payload.force || payload.rebuild);

  if (!providerId || feedIds.length === 0) {
    return new Response(JSON.stringify({ error: 'providerId and feedIds are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await runSiteSeeder(providerId, feedIds, force);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[site-content-seed] failed', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
