const crypto = require('crypto')
const supabase = require('../supabase-client')

const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 600)
const RESEND_API_KEY = process.env.RESEND_API_KEY
const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || 'admin'

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const sendResendEmail = async (email, code) => {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured')
    return
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
      html: `<p>Your signup code is <strong>${code}</strong>. It expires in ${Math.floor(
        OTP_TTL_SECONDS / 60
      )} minutes.</p>`,
    }),
  })
}

const setCors = (res) => {
  for (const [key, value] of Object.entries(defaultCorsHeaders)) {
    res.setHeader(key, value)
  }
}

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex')
}

const createProviderForEmail = async (email) => {
  const domain = email.split('@')[1] || 'dialogue'
  const description = `${domain} signup`
  const insert = await supabase
    .from('providers')
    .insert({
      name: domain,
      description,
    })
    .select('id')
    .maybeSingle()

  if (insert.error) {
    throw new Error(insert.error.message || 'Unable to create provider')
  }

  if (!insert.data?.id) {
    throw new Error('Unable to create provider')
  }

  return insert.data.id
}

const ensureAdminRecord = async (email, providerId) => {
  const { data: admin, error } = await supabase
    .from('provider_admins')
    .select('id, provider_id')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to lookup admin record')
  }

  if (admin) {
    return admin.provider_id
  }

  const targetProviderId = providerId || (await createProviderForEmail(email))

  const { error: insertError } = await supabase.from('provider_admins').insert({
    provider_id: targetProviderId,
    email,
    role: DEFAULT_ADMIN_ROLE,
  })

  if (insertError) {
    throw new Error('Unable to create admin record')
  }

  return targetProviderId
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    setCors(res)
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  setCors(res)

  let body
  try {
    body = JSON.parse(
      await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => (data += chunk))
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
    )
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const email = (body?.email || '').trim().toLowerCase()
  const providerId = Number(body?.provider_id || 0)

  if (!email) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Email is required' }))
    return
  }

  let targetProviderId
  try {
    targetProviderId = await ensureAdminRecord(email, providerId)
  } catch (err) {
    console.error('[signup-request] admin ensure error', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unable to prepare admin record' }))
    return
  }

  const code = generateCode()
  const salt = crypto.randomBytes(16).toString('hex')
  const otpHash = hashCode(code, salt)
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString()

  const { error: insertError } = await supabase.from('auth_otps').insert({
    provider_id: targetProviderId,
    email,
    otp_hash: otpHash,
    salt,
    expires_at: expiresAt,
    used: false,
  })

  if (insertError) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unable to generate OTP' }))
    return
  }

  await sendResendEmail(email, code)
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, expires_in: OTP_TTL_SECONDS }))
}

module.exports = handler
