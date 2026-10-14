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

/**
 * Resolves the trusted OAuth redirect URL for the active environment.
 * Production: strictly redirects to the production Vercel domain.
 * Local development: dynamically uses the active development server origin.
 */
export const getOAuthRedirectUrl = () => {
    if (typeof window === 'undefined') {
        return 'https://enterprise-succession-planning-dash.vercel.app/';
    }

    const origin = window.location.origin;
    const hostname = window.location.hostname;

    // Production Vercel domain
    if (hostname === 'enterprise-succession-planning-dash.vercel.app' || hostname.endsWith('.vercel.app')) {
        return 'https://enterprise-succession-planning-dash.vercel.app/';
    }

    // Localhost development server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${origin}/`;
    }

    // Default trusted fallback
    return 'https://enterprise-succession-planning-dash.vercel.app/';
};
