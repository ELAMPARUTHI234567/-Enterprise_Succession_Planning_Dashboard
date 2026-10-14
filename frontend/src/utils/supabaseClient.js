import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim().replace(/\/+$/, '') : '';
const supabaseAnonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : '';

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn(
        "[Auth] Supabase credentials not found in environment variables. Cloud Auth will be disabled.\n" +
        "Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in Vercel Project Settings."
    );
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }) 
    : null;
