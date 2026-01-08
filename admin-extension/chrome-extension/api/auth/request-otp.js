const crypto = require('crypto');
const supabase = require('../supabase-client');

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 600);
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const sendResendEmail = async (email, code) => {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured');
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@dialogue-ai.co',
      to: email,
      subject: 'Your Dialogue OTP',
      html: `<p>Your login code is <strong>${code}</strong>. It expires in ${Math.floor(
        OTP_TTL_SECONDS / 60
      )} minutes.</p>`,
    }),
  });
};
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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
  if (!email) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Email is required' }));
    return;
  }

  const { data: admin, error } = await supabase
    .from('provider_admins')
    .select('provider_id, email')
    .eq('email', email)
    .maybeSingle();

  if (error || !admin) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Email not authorized' }));
    return;
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const { error: insertError } = await supabase.from('auth_otps').insert({
    provider_id: admin.provider_id,
    email,
    otp_hash: otpHash,
    salt,
    expires_at: expiresAt,
    used: false,
  });

  if (insertError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unable to generate OTP' }));
    return;
  }

  console.log(`[auth] OTP for ${email}: ${code}`);
  await sendResendEmail(email, code);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, expires_in: OTP_TTL_SECONDS }));
}

module.exports = handler;
