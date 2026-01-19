const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '..');
const envPath = path.join(projectRoot, '.env');
const outputPath = path.join(projectRoot, 'src', 'lib', 'admin-config.generated.ts');

dotenv.config({ path: envPath });

const supabaseUrl =
  process.env.PLASMO_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  '';
const supabaseAnonKey =
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';

const fileContents = `export const ADMIN_CONFIG = {
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)}
} as const;
`;

fs.writeFileSync(outputPath, fileContents);
console.log(`Generated admin-config.generated.ts with supabaseUrl=${supabaseUrl ? '***' : 'missing'}`);
