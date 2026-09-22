import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, KeyRound, Building2, Briefcase, Users, Home } from 'lucide-react';
import { authService } from '../services/api';

export const Login = () => {
  const [selectedRole, setSelectedRole] = useState('Manager'); // Default matching mockup
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('manager123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    if (role === 'HR') {
      setUsername('hr');
      setPassword('hr123');
    } else if (role === 'Manager') {
      setUsername('manager');
      setPassword('manager123');
    } else if (role === 'Employee') {
      setUsername('arun.kumar');
      setPassword('employee123');
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
      const res = await authService.login({ username, password, role: selectedRole });
      if (res.success) {
        const userData = res.data.user;
        const token = res.data.token;
        
        localStorage.setItem('succession_token', token);
        localStorage.setItem('succession_user', JSON.stringify(userData));

        if (rememberMe) {
          localStorage.setItem('succession_remember_user', username);
        }

        const userRole = (userData.role || selectedRole || '').toString().toLowerCase();

        // Redirect based on role
        if (userRole === 'hr' || userRole === 'admin') {
          navigate('/dashboard');
        } else if (userRole === 'manager') {
          navigate('/manager-dashboard');
        } else {
          navigate('/employee-dashboard');
        }
      } else {
        setError(res.message || 'Invalid username or password');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the server. Please check the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Background Floating Soft Translucent Circles matching screenshot */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-200/40 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-12 w-64 h-64 bg-purple-200/30 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute top-1/4 right-8 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-16 -right-16 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Centered Login Card */}
      <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-2xl shadow-indigo-900/10 border border-slate-100 z-10 relative space-y-6">
        
        {/* Card Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
            <Users className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Enterprise HR Portal
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Role Selection Segmented Control */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Select User Role
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleRoleSelect('HR')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                selectedRole === 'HR'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>HR</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('Manager')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                selectedRole === 'Manager'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Manager</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('Employee')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                selectedRole === 'Employee'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Employee</span>
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email / Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                placeholder={`Enter ${selectedRole.toLowerCase()} username or email`}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
              />
              <span>Remember me on this device</span>
            </label>
          </div>

          {/* Submit Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm tracking-wide transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 mt-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* OR Divider & Back to Home */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={() => handleRoleSelect('HR')}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>

      {/* Footer Meta Text */}
      <div className="text-center z-10 pt-6 space-y-1">
        <p className="text-xs font-semibold text-slate-500">
          Enterprise Succession Planning Dashboard
        </p>
        <p className="text-[11px] font-medium text-slate-400">
          Role-Based Authentication Enabled
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Account Password</h3>
                <p className="text-xs text-slate-500">Enterprise HR Security Recovery</p>
              </div>
            </div>

            {forgotSubmitted ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <p className="text-xs font-bold text-emerald-800">Password Reset Instructions Sent!</p>
                <p className="text-[11px] text-emerald-700">
                  If an enterprise account exists for <strong>{forgotEmail}</strong>, instructions have been sent.
                </p>
                <button
                  onClick={() => { setShowForgotModal(false); setForgotSubmitted(false); }}
                  className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Enter your registered work email address to receive a secure password reset link.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Enterprise Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="name@company.com"
                    required
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md"
                  >
                    Send Recovery Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
