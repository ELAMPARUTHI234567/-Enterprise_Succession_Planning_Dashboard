import { createClient } from '@supabase/supabase-js';

const KNOWN_SUPABASE_URL = 'https://livemvqdyupoipuajury.supabase.co';
const KNOWN_SUPABASE_ANON_KEY = 'sb_publishable_WrkMC4kfEAQC7dAfpmln-Q_CKfrm6_0';
const CANONICAL_PRODUCTION_URL = 'https://enterprise-succession-planning-dash.vercel.app';

const rawUrl = (
    import.meta.env.VITE_SUPABASE_URL || 
    import.meta.env.SUPABASE_URL || 
    KNOWN_SUPABASE_URL
);
const rawAnonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY || 
    import.meta.env.SUPABASE_ANON_KEY || 
    KNOWN_SUPABASE_ANON_KEY
);

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim().replace(/\/+$/, '') : '';
const supabaseAnonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : '';

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
 * - Production: canonical Vercel production domain (https://enterprise-succession-planning-dash.vercel.app).
 * - Local development: dynamically uses the active local origin (e.g. http://localhost:3000 or http://localhost:5173).
 * - Preview / Staging: dynamically uses active Vercel preview domain.
 * - Env Override: supports VITE_AUTH_REDIRECT_URL or VITE_SITE_URL if defined.
 */
export const getOAuthRedirectUrl = () => {
    // 1. Explicit override via environment variable if configured
    const configuredRedirect = (
        import.meta.env.VITE_AUTH_REDIRECT_URL || 
        import.meta.env.VITE_SITE_URL || 
        ''
    ).trim();
    if (configuredRedirect) {
        return configuredRedirect.replace(/\/+$/, '');
    }

    // 2. Browser runtime resolution
    if (typeof window !== 'undefined' && window.location) {
        const origin = window.location.origin ? window.location.origin.replace(/\/+$/, '') : '';
        const hostname = window.location.hostname || '';

        // Localhost development server: dynamically use active port/host (e.g. http://localhost:3000)
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
            return origin || 'http://localhost:3000';
        }

        // Canonical production Vercel domain
        if (hostname === 'enterprise-succession-planning-dash.vercel.app') {
            return CANONICAL_PRODUCTION_URL;
        }

        // Vercel preview deployments (e.g. *.vercel.app)
        if (hostname.endsWith('.vercel.app')) {
            return origin || CANONICAL_PRODUCTION_URL;
        }

        return origin || CANONICAL_PRODUCTION_URL;
    }

    // 3. Fallback for SSR / static build execution
    return CANONICAL_PRODUCTION_URL;
};
