const crypto = require('crypto');
const supabase = require('../supabase-client');

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

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

  const token = crypto.randomBytes(32).toString('hex');

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ token, email, provider_id: otpEntry.provider_id }));
}

module.exports = handler;
