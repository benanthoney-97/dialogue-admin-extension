const crypto = require('crypto');
const supabase = require('../supabase-client');

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const SPECIAL_AUTH_EMAIL = (process.env.SPECIAL_AUTH_EMAIL || '').trim().toLowerCase();
const SPECIAL_AUTH_CODE = process.env.SPECIAL_AUTH_CODE || '';

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
};

const setCors = (res) => {
  for (const [key, value] of Object.entries(defaultCorsHeaders)) {
    res.setHeader(key, value);
  }
};

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    setCors(res);
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  setCors(res);

  let body;
  try {
    body = JSON.parse(await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    }));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const email = (body?.email || '').trim().toLowerCase();
  const code = (body?.otp || '').trim();
  if (!email || !code) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Email and OTP are required' }));
    return;
  }

  const isSpecialTest = SPECIAL_AUTH_EMAIL && SPECIAL_AUTH_CODE && email === SPECIAL_AUTH_EMAIL && code === SPECIAL_AUTH_CODE;
  let providerId = null;

  if (isSpecialTest) {
    const { data: admin, error: adminError } = await supabase
      .from('provider_admins')
      .select('provider_id')
      .eq('email', email)
      .maybeSingle();

    if (adminError || !admin?.provider_id) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin not found' }));
      return;
    }

    providerId = admin.provider_id;
  } else {
    const { data: otpEntry, error } = await supabase
      .from('auth_otps')
      .select('*')
      .eq('email', email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !otpEntry) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OTP not found' }));
      return;
    }

    if (new Date(otpEntry.expires_at) < new Date()) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OTP expired' }));
      return;
    }

    const computedHash = hashCode(code, otpEntry.salt);
    if (computedHash !== otpEntry.otp_hash) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OTP mismatch' }));
      return;
    }

    await supabase
      .from('auth_otps')
      .update({ used: true })
      .eq('id', otpEntry.id);

    providerId = otpEntry.provider_id;
  }

  const token = crypto.randomBytes(32).toString('hex');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ token, email, provider_id: providerId }));
}

module.exports = handler;
