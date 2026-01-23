const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const outputPath = path.resolve(process.cwd(), 'web-platform', 'config.json');

function parseDotenv(envFile) {
  if (!fs.existsSync(envFile)) {
    return {};
  }
  const raw = fs.readFileSync(envFile, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const data = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    if (!key) continue;
    const value = rest.join('=').trim();
    data[key.trim()] = value.replace(/^["']|["']$/g, '');
  }
  return data;
}

const env = parseDotenv(envPath);
const supabaseUrl = env.SUPABASE_URL || env.PLASMO_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_KEY || env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or key missing in .env; config.json will still be emitted but missing values.');
}

const config = {
  supabaseUrl: supabaseUrl || '',
  supabaseKey: supabaseKey || ''
};

fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
console.log(`Generated config.json with supabaseUrl=${config.supabaseUrl ? '***' : 'missing'}`);
