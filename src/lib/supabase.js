import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isMissingConfig = !supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'PLACEHOLDER_FOR_ANON_KEY';

if (isMissingConfig) {
  console.warn('Supabase credentials missing or invalid. Check your Vercel/Render Environment Variables.');
}

// Only create the client if we have a URL to avoid throwing an error
export const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;
export const hasSupabaseConfig = !isMissingConfig;
