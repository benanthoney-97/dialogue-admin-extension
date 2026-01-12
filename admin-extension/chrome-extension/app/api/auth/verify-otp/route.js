import path from 'path';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PLASMO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.AUTH_JWT_SECRET;
const TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '4h';

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (body, status = 200) =>
  NextResponse.json(body, { status, headers: defaultCorsHeaders });
const SPECIAL_AUTH_EMAIL = (process.env.SPECIAL_AUTH_EMAIL || '').trim().toLowerCase();
const SPECIAL_AUTH_CODE = process.env.SPECIAL_AUTH_CODE || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  throw new Error('Missing environment for auth routes');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
};

export async function POST(request) {
  if (request.method === 'OPTIONS') {
    return NextResponse.json(null, {
      status: 204,
      headers: defaultCorsHeaders,
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const otp = (body.otp || '').trim();
  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
  }

  const isSpecialTest = SPECIAL_AUTH_EMAIL && SPECIAL_AUTH_CODE && email === SPECIAL_AUTH_EMAIL && otp === SPECIAL_AUTH_CODE;
  let otpRow = null;
  if (!isSpecialTest) {
    const resp = await supabase
      .from('auth_otps')
      .select('id,provider_id,email,otp_hash,salt,expires_at,used')
      .eq('email', email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    otpRow = resp.data;
    if (!otpRow || new Date(otpRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'OTP expired or not found' }, { status: 401 });
    }

    const computedHash = hashCode(otp, otpRow.salt);
    if (computedHash !== otpRow.otp_hash) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
    }

    await supabase.from('auth_otps').update({ used: true }).eq('id', otpRow.id);
  }

  const adminResp = await supabase
    .from('provider_admins')
    .select('id,provider_id,email,role')
    .eq('email', email)
    .maybeSingle();

  const adminRow = adminResp.data;
  if (!adminRow) {
    return NextResponse.json({ error: 'Admin metadata missing' }, { status: 401 });
  }

  const payload = {
    provider_id: adminRow.provider_id,
    email: adminRow.email,
    role: adminRow.role,
    admin_id: adminRow.id,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });

  return NextResponse.json({
    token,
    provider_id: payload.provider_id,
    email: payload.email,
    role: payload.role,
    expires_in: TOKEN_TTL,
  });
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 204,
    headers: defaultCorsHeaders,
  });
}
