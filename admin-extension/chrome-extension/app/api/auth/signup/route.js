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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  throw new Error('Missing environment configuration for auth routes');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const hashCode = (code, salt) => {
  return crypto.createHmac('sha256', salt).update(code).digest('hex');
};

const jsonResponse = (body, status = 200) =>
  NextResponse.json(body, { status, headers: defaultCorsHeaders });

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

export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 204,
    headers: defaultCorsHeaders,
  });
}

export async function POST(request) {
  if (request.method !== 'POST') {
    console.warn('[signup] received wrong method', request.method);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.warn('[signup] invalid JSON payload');
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const email = (body?.email || '').trim().toLowerCase();
  const otp = (body?.otp || '').trim();
  const displayName = (body?.display_name || '').trim();

  if (!email || !otp || !displayName) {
    console.warn('[signup] missing required fields', { email, otp, displayName });
    return jsonResponse({ error: 'Email, OTP, and display name are required' }, 400);
  }

  const otpResp = await supabase
    .from('auth_otps')
    .select('id, provider_id, email, otp_hash, salt, expires_at, used')
    .eq('email', email)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const otpEntry = otpResp.data;
  if (!otpEntry || new Date(otpEntry.expires_at) < new Date()) {
    return jsonResponse({ error: 'OTP expired or not found' }, 401);
  }

  const computedHash = hashCode(otp, otpEntry.salt);
  if (computedHash !== otpEntry.otp_hash) {
    return jsonResponse({ error: 'Invalid OTP' }, 401);
  }

  await supabase.from('auth_otps').update({ used: true }).eq('id', otpEntry.id);

  const adminResp = await supabase
    .from('provider_admins')
    .select('id, provider_id, email, role')
    .eq('email', email)
    .maybeSingle();

  const adminRow = adminResp.data;
  if (!adminRow) {
    return jsonResponse({ error: 'Admin metadata missing' }, 401);
  }

  try {
    await createSupabaseUser(email, displayName);
  } catch (creationError) {
    console.error('[signup] user creation failed', creationError);
    return jsonResponse({ error: 'Unable to create auth user' }, 500);
  }

  const payload = {
    provider_id: adminRow.provider_id,
    email: adminRow.email,
    role: adminRow.role,
    admin_id: adminRow.id,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });

  return jsonResponse({
    token,
    provider_id: payload.provider_id,
    email: payload.email,
    role: payload.role,
    expires_in: TOKEN_TTL,
  });
}
