import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'PLACEHOLDER_FOR_ANON_KEY') {
  console.warn('Supabase credentials missing or invalid. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
