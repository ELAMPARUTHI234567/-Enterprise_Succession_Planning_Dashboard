import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Loader2,
  KeyRound,
  Building2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  Sparkles,
  X
} from 'lucide-react';
import { authService } from '../services/api';
import { supabase } from '../utils/supabaseClient';

const GoogleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export const Login = () => {
  const [username, setUsername] = useState(() => localStorage.getItem('succession_remember_user') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Onboarding States for Unregistered Google Accounts
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState('');
  const [onboardToken, setOnboardToken] = useState('');
  const [onboardData, setOnboardData] = useState({
    email: '',
    name: '',
    department: 'Engineering',
    designation: 'Software Engineer',
    employee_code: ''
  });

  // Pending Approval Modal State
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const navigate = useNavigate();
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    // Check for existing session in localStorage
    const existingToken = localStorage.getItem('succession_token');
    const existingUserJson = localStorage.getItem('succession_user');
    const hasOAuthParams = window.location.hash.includes('access_token') || 
                           window.location.search.includes('code=') ||
                           window.location.search.includes('error=');

    if (existingToken && existingUserJson && !hasOAuthParams) {
      try {
        const user = JSON.parse(existingUserJson);
        const userRole = (user.role || '').toString().toLowerCase();
        if (userRole === 'hr' || userRole === 'admin') {
          navigate('/dashboard', { replace: true });
          return;
        } else if (userRole === 'manager') {
          navigate('/manager-dashboard', { replace: true });
          return;
        } else {
          navigate('/employee-dashboard', { replace: true });
          return;
        }
      } catch (e) {
        // Ignore invalid local JSON
      }
    }

    // Inspect URL for OAuth cancellation or errors from Google/Supabase
    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
    const hashParams = new URLSearchParams(hashString);

    const oauthError = searchParams.get('error_description') || searchParams.get('error') || 
                       hashParams.get('error_description') || hashParams.get('error');

    if (oauthError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setError(`Google Sign-In was cancelled or failed: ${decodeURIComponent(oauthError.replace(/\+/g, ' '))}`);
      return;
    }

    if (!supabase) return;

    const processOAuthSession = async (session) => {
      if (!session?.access_token || hasExchangedRef.current) return;
      hasExchangedRef.current = true;
      setGoogleLoading(true);
      setError('');

      try {
        localStorage.removeItem('succession_token');
        localStorage.removeItem('succession_user');

        const metadata = session?.user?.user_metadata || {};
        const res = await authService.loginSupabase(session.access_token, metadata);
        if (res.success) {
          // Clear hash & search parameters to avoid re-triggering on browser refresh
          window.history.replaceState({}, document.title, window.location.pathname);

          const userData = res.data.user;
          const token = res.data.token;

          localStorage.setItem('succession_token', token);
          localStorage.setItem('succession_user', JSON.stringify(userData));

          const userRole = (userData.role || '').toString().toLowerCase();
          if (userRole === 'hr' || userRole === 'admin') {
            navigate('/dashboard', { replace: true });
          } else if (userRole === 'manager') {
            navigate('/manager-dashboard', { replace: true });
          } else {
            navigate('/employee-dashboard', { replace: true });
          }
        }
      } catch (err) {
        window.history.replaceState({}, document.title, window.location.pathname);
        const respData = err.response?.data || {};
        const statusCode = err.response?.status;
        const rawMsg = respData.message || err.message || '';
        const cleanMsg = rawMsg.replace(/^\[HTTP \d+\]\s*/, '');

        if (statusCode === 404 || respData.needs_onboarding) {
          // Unregistered Google email -> Trigger Onboarding Flow!
          const verifiedEmail = respData.verified_email || session?.user?.email || '';
          const verifiedName = respData.verified_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '';
          
          setOnboardToken(session.access_token);
          setOnboardData({
            email: verifiedEmail,
            name: verifiedName,
            department: 'Engineering',
            designation: 'Software Engineer',
            employee_code: ''
          });
          setOnboardError('');
          setShowOnboardModal(true);
          setError('');
        } else if (statusCode === 403 && (respData.status === 'Pending' || cleanMsg.toLowerCase().includes('pending hr approval'))) {
          setPendingEmail(session?.user?.email || respData.verified_email || '');
          setShowPendingModal(true);
          await supabase?.auth?.signOut();
        } else if (cleanMsg.toLowerCase().includes('deactivated')) {
          setError('Your enterprise account is deactivated. Contact HR admin.');
          await supabase?.auth?.signOut();
        } else {
          setError(cleanMsg || 'Google authentication exchange failed. Please try again.');
          await supabase?.auth?.signOut();
        }
        hasExchangedRef.current = false;
      } finally {
        setGoogleLoading(false);
      }
    };


    // Check if session is already stored or detected in URL
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        processOAuthSession(session);
      }
    });

    // Listen for OAuth completion
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        processOAuthSession(session);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setError('');
    if (!supabase) {
      setError('Google Sign-In is unavailable because Supabase Auth is not configured.');
      return;
    }

    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      setError(err.message || 'Failed to initiate Google Sign-In.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both Email/Username and Password.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.login({
        username: username.trim(),
        password: password.trim()
      });

      if (res.success) {
        const userData = res.data.user;
        const token = res.data.token;
        
        localStorage.setItem('succession_token', token);
        localStorage.setItem('succession_user', JSON.stringify(userData));

        if (rememberMe) {
          localStorage.setItem('succession_remember_user', username.trim());
        } else {
          localStorage.removeItem('succession_remember_user');
        }

        const userRole = (userData.role || '').toString().toLowerCase();

        // Redirect based on authoritative backend database role
        if (userRole === 'hr' || userRole === 'admin') {
          navigate('/dashboard');
        } else if (userRole === 'manager') {
          navigate('/manager-dashboard');
        } else {
          navigate('/employee-dashboard');
        }
      } else {
        setError(res.message || 'Invalid email/username or password');
      }
    } catch (err) {
      const rawMsg = err.message || '';
      const cleanMsg = rawMsg.replace(/^\[HTTP \d+\]\s*/, '');
      if (cleanMsg.toLowerCase().includes('deactivated')) {
        setError('Your enterprise account is deactivated. Contact HR admin.');
      } else if (cleanMsg.toLowerCase().includes('not registered') || cleanMsg.toLowerCase().includes('not mapped')) {
        setError('Your employee account is not registered. Please contact HR to request access.');
      } else {
        setError(cleanMsg || 'Invalid email/username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSubmitted(true);
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    setOnboardError('');

    if (!onboardData.name.trim()) {
      setOnboardError('Please enter your full name.');
      return;
    }
    if (!onboardData.department.trim()) {
      setOnboardError('Please select a department.');
      return;
    }
    if (!onboardData.designation.trim()) {
      setOnboardError('Please enter your designation.');
      return;
    }

    setOnboardLoading(true);

    try {
      const res = await authService.onboardEmployee({
        access_token: onboardToken,
        name: onboardData.name.trim(),
        department: onboardData.department.trim(),
        designation: onboardData.designation.trim(),
        employee_code: onboardData.employee_code.trim()
      });

      if (res.success) {
        setShowOnboardModal(false);
        setPendingEmail(onboardData.email);
        setShowPendingModal(true);
        await supabase?.auth?.signOut();
      } else {
        setOnboardError(res.message || 'Failed to submit registration.');
      }
    } catch (err) {
      const statusCode = err.response?.status;
      const respData = err.response?.data || {};
      const serverMsg = respData.message || (typeof respData === 'string' ? respData : '') || err.message || 'Registration failed.';
      const cleanServerMsg = serverMsg.replace(/^\[HTTP \d+\]\s*/, '');

      if (statusCode) {
        setOnboardError(`[HTTP ${statusCode}] ${cleanServerMsg}`);
      } else {
        setOnboardError(err.message || 'Unable to communicate with the server. Please verify backend service health.');
      }
    } finally {
      setOnboardLoading(false);
    }
  };

  const handleCancelOnboard = async () => {
    setShowOnboardModal(false);
    setOnboardToken('');
    setOnboardError('');
    await supabase?.auth?.signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 font-sans relative overflow-hidden">
      {/* Background Soft Lighting Circles */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-12 w-72 h-72 bg-purple-200/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/4 right-8 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-16 -right-16 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Single Centered Login Card */}
      <div className="w-full max-w-md mx-auto z-10">
        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl shadow-indigo-900/10 border border-slate-100 relative space-y-6">
          
          {/* Header Icon & Title */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm border border-indigo-100">
              <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise Succession Portal
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Sign in to access your enterprise dashboard
            </p>
          </div>

          {/* Error Message Box */}
          {error && (
            <div
              id="login-error-alert"
              role="alert"
              className={`p-4 rounded-2xl border text-xs flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-1 ${
                error.toLowerCase().includes('pending hr approval') || error.toLowerCase().includes('is pending')
                  ? 'bg-amber-50 border-amber-200/80 text-amber-900'
                  : 'bg-rose-50 border-rose-200/80 text-rose-800'
              }`}
            >
              {error.toLowerCase().includes('pending hr approval') || error.toLowerCase().includes('is pending') ? (
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-semibold leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Login Form: Email/Username -> Password -> Forgot Password -> Sign In -> OR -> Google */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Email or Username Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="block text-xs font-bold text-slate-700">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@company.com or username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* 2. Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                {/* 3. Forgot Password Link */}
                <button
                  type="button"
                  id="login-forgot-password-link"
                  onClick={() => {
                    setForgotSubmitted(false);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  id="login-password-toggle-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="login-remember-me-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition"
                />
                <span className="font-medium text-slate-600">Remember me on this device</span>
              </label>
            </div>

            {/* 4. Primary Sign In Button */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading || googleLoading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 5. Subtle Separator OR */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
                OR
              </span>
            </div>
          </div>

          {/* 6. Continue with Google Button at the Bottom */}
          <div>
            <button
              type="button"
              id="login-google-btn"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50/90 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-center space-x-2.5 transition-all transform active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-slate-600">Connecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="w-4 h-4" />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2 font-medium">
              Registered corporate or authorized Google workspace accounts
            </p>
          </div>

          {/* System Footer Note */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              Enterprise Succession Planning Dashboard • Secure RBAC
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reset Account Password</h3>
                <p className="text-xs text-slate-500">Corporate identity security</p>
              </div>
            </div>

            {forgotSubmitted ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-800 text-xs space-y-2">
                <div className="flex items-center space-x-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Password Reset Request Received</span>
                </div>
                <p>
                  Instructions to reset credentials have been dispatched to <strong>{forgotEmail}</strong> if an active employee account exists.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotSubmitted(false);
                      setForgotEmail('');
                    }}
                    className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered corporate email address. Your system administrator or HR officer will verify the request to restore dashboard access.
                </p>
                <div>
                  <label htmlFor="forgot-email-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    id="forgot-email-input"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="employee@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                  >
                    Request Reset
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Employee Onboarding Modal for Unregistered Google Accounts */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-sm border border-indigo-100">
                  <UserPlus className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Employee Registration</h3>
                  <p className="text-xs text-slate-500">Corporate onboarding for your Google identity</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelOnboard}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Authenticated Google Account Badge */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs flex-shrink-0">
                <GoogleIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authenticated Google Account</span>
                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200">Verified</span>
                </div>
                <p className="text-xs font-bold text-slate-800 truncate">{onboardData.email}</p>
              </div>
            </div>

            {/* Error in Onboarding */}
            {onboardError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{onboardError}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={onboardData.name}
                  onChange={(e) => setOnboardData({ ...onboardData, name: e.target.value })}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Department & Designation in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={onboardData.department}
                    onChange={(e) => setOnboardData({ ...onboardData, department: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Operations">Operations</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="Product">Product</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Designation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardData.designation}
                    onChange={(e) => setOnboardData({ ...onboardData, designation: e.target.value })}
                    placeholder="e.g. Software Engineer"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Employee Code (Optional) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Employee Code / ID
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-generated if left blank</span>
                </div>
                <input
                  type="text"
                  value={onboardData.employee_code}
                  onChange={(e) => setOnboardData({ ...onboardData, employee_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. EMP045"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>

              {/* RBAC Role Security Notice */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>Access Policy: Standard Employee Role</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Self-registration automatically grants standard <strong>Employee</strong> status pending HR approval. Manager and HR permissions are strictly assigned by organization administrators.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelOnboard}
                  disabled={onboardLoading}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-60 cursor-pointer"
                >
                  {onboardLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit for Approval</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Approval Modal */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm border border-amber-100">
              <Clock className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-lg">Registration Pending Approval</h3>
              <p className="text-xs text-slate-500">Corporate security verification in progress</p>
            </div>

            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-amber-900 text-left space-y-2">
              <p className="leading-relaxed">
                Your employee account registration for <strong>{pendingEmail || 'your Google account'}</strong> has been submitted.
              </p>
              <p className="leading-relaxed text-amber-800">
                An authorized <strong>HR Administrator</strong> must review and approve your account before you can access the Employee Dashboard.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPendingModal(false);
                  setPendingEmail('');
                  setError('');
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
