import { createClient } from '@supabase/supabase-js';

export const KNOWN_SUPABASE_URL = 'https://livemvqdyupoipuajury.supabase.co';
export const KNOWN_SUPABASE_ANON_KEY = 'sb_publishable_WrkMC4kfEAQC7dAfpmln-Q_CKfrm6_0';
export const CANONICAL_PRODUCTION_URL = 'https://enterprise-succession-planning-dash.vercel.app/';

const metaEnv = (typeof import.meta !== 'undefined' && import.meta && import.meta.env) ? import.meta.env : {};

const rawUrl = (
    metaEnv.VITE_SUPABASE_URL || 
    metaEnv.SUPABASE_URL || 
    KNOWN_SUPABASE_URL
);
const rawAnonKey = (
    metaEnv.VITE_SUPABASE_ANON_KEY || 
    metaEnv.SUPABASE_ANON_KEY || 
    KNOWN_SUPABASE_ANON_KEY
);

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim().replace(/\/+$/, '') : '';
const supabaseAnonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }) 
    : null;

/**
 * Resolves the trusted OAuth redirect URL for the active environment:
 * - Production: canonical Vercel production domain (https://enterprise-succession-planning-dash.vercel.app/).
 * - Local development: dynamically uses the actual local frontend origin and port (e.g. http://localhost:3000/ or http://localhost:5173/).
 * - Preview / Staging: dynamically uses active Vercel preview domain.
 * - Guard: prevents accidental localhost redirect leaks in production builds or deployments.
 */
export const getOAuthRedirectUrl = () => {
    // Helper to format URL with required trailing slash
    const withTrailingSlash = (url) => {
        if (!url) return '';
        const trimmed = url.trim();
        return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    };

    // 1. Browser runtime resolution
    if (typeof window !== 'undefined' && window.location) {
        const origin = window.location.origin ? window.location.origin.trim() : '';
        const hostname = (window.location.hostname || '').toLowerCase();

        // Check if active environment is local development
        const isLocalhost = (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '[::1]'
        );

        // Local development: dynamically return the actual local frontend origin and port
        if (isLocalhost) {
            if (origin) {
                return withTrailingSlash(origin);
            }
            const protocol = window.location.protocol || 'http:';
            const port = window.location.port ? `:${window.location.port}` : '';
            return withTrailingSlash(`${protocol}//${hostname}${port}`);
        }

        // Production environment (NEVER redirect to localhost!)
        const envRedirect = (
            metaEnv.VITE_AUTH_REDIRECT_URL || 
            metaEnv.VITE_SITE_URL || 
            ''
        ).trim();

        if (envRedirect) {
            const isEnvLocalhost = (
                envRedirect.includes('localhost') || 
                envRedirect.includes('127.0.0.1') || 
                envRedirect.includes('0.0.0.0')
            );
            if (!isEnvLocalhost) {
                return withTrailingSlash(envRedirect);
            }
        }

        // Canonical production Vercel domain
        if (hostname === 'enterprise-succession-planning-dash.vercel.app') {
            return CANONICAL_PRODUCTION_URL;
        }

        // Vercel preview deployments (e.g. *.vercel.app)
        if (hostname.endsWith('.vercel.app')) {
            return origin ? withTrailingSlash(origin) : CANONICAL_PRODUCTION_URL;
        }

        // Any other deployed remote origin (never localhost)
        if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
            return withTrailingSlash(origin);
        }

        return CANONICAL_PRODUCTION_URL;
    }

    // 2. Fallback for SSR / static build execution (never return localhost)
    const envRedirect = (
        metaEnv.VITE_AUTH_REDIRECT_URL || 
        metaEnv.VITE_SITE_URL || 
        ''
    ).trim();

    if (envRedirect && !envRedirect.includes('localhost') && !envRedirect.includes('127.0.0.1')) {
        return withTrailingSlash(envRedirect);
    }

    return CANONICAL_PRODUCTION_URL;
};
