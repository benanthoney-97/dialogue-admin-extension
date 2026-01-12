import path from 'path';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PLASMO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 600);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials for auth routes');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
};

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (body, status = 200) =>
  NextResponse.json(body, { status, headers: defaultCorsHeaders });

export async function POST(request) {
  if (request.method !== 'POST') {
    console.warn('[request-otp] received wrong method', request.method);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    console.warn('[request-otp] invalid JSON payload');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    console.warn('[request-otp] missing email', body);
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  const { data: admin, error } = await supabase
    .from('provider_admins')
    .select('provider_id, email')
    .eq('email', email)
    .maybeSingle();

  if (error || !admin) {
    console.warn('[request-otp] admin lookup failed', { error: error?.message, email });
    return jsonResponse({ error: 'Email not authorized' }, 401);
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const { error: insertError } = await supabase.from('auth_otps').insert({
    provider_id: admin.provider_id,
    email,
    otp_hash: codeHash,
    salt,
    expires_at: expiresAt,
    used: false,
  });

  if (insertError) {
    console.error('[request-otp] failed to insert OTP', insertError);
    return jsonResponse({ error: 'Unable to generate OTP' }, 500);
  }
  console.log('[request-otp] generated otp for', admin.email);

  return jsonResponse({ ok: true, expires_in: OTP_TTL_SECONDS }, 200);
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 204,
    headers: defaultCorsHeaders,
  });
}
