const crypto = require('crypto');
const supabase = require('../supabase-client');

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
};

const setCors = (res) => {
  for (const [key, value] of Object.entries(defaultCorsHeaders)) {
    res.setHeader(key, value);
  }
};

const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
};

const createSupabaseUser = async (email, displayName) => {
  const password = crypto.randomBytes(32).toString('hex');
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { display_name: displayName },
  });

  if (error) {
    const message = (error.message || '').toLowerCase();
    const isDuplicate =
      message.includes('already registered') ||
      message.includes('already exists') ||
      message.includes('duplicate');

    if (!isDuplicate) {
      throw new Error(error.message || 'Unable to create signup user');
    }
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
    body = JSON.parse(await parseBody(req));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const email = (body?.email || '').trim().toLowerCase();
  const otp = (body?.otp || '').trim();
  const displayName = (body?.display_name || '').trim();

  if (!email || !otp || !displayName) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Email, OTP, and display name are required' }));
    return;
  }

  console.log('[signup-request] payload', { email, displayName });
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

  const computedHash = hashCode(otp, otpEntry.salt);
  if (computedHash !== otpEntry.otp_hash) {
    console.warn('[signup] otp mismatch', { email, otp });
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OTP mismatch' }));
    return;
  }

  await supabase.from('auth_otps').update({ used: true }).eq('id', otpEntry.id);

  const { data: admin, error: adminError } = await supabase
    .from('provider_admins')
    .select('id, provider_id, email, role')
    .eq('email', email)
    .maybeSingle();

  if (adminError || !admin) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Admin metadata missing' }));
    return;
  }

  try {
    await createSupabaseUser(email, displayName);
  } catch (creationError) {
    console.error('[signup] user creation failed', creationError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unable to create auth user' }));
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  console.log('[signup] success', { email, providerId: admin.provider_id });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ token, email, provider_id: admin.provider_id }));
}

module.exports = handler;
