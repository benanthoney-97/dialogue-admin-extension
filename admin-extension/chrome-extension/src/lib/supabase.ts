import { createClient } from '@supabase/supabase-js'
import { ADMIN_CONFIG } from './admin-config.generated'

const supabaseUrl =
  ADMIN_CONFIG.supabaseUrl ||
  import.meta.env.PLASMO_PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL
const supabaseAnonKey =
  ADMIN_CONFIG.supabaseAnonKey ||
  import.meta.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
