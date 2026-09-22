import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, KeyRound, CheckSquare, Sparkles, Building2, UserCheck, Briefcase } from 'lucide-react';
import { authService } from '../services/api';

export const Login = () => {
  const [selectedRole, setSelectedRole] = useState('HR'); // HR, Manager, Employee
  const [username, setUsername] = useState('hr');
  const [password, setPassword] = useState('hr123');
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
      setUsername('employee');
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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans relative overflow-hidden">
      {/* Background Decorative Gradient Blurs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Brand Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-600/20 text-white font-bold">
            👑
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-slate-900 leading-none">ENTERPRISE HR</h1>
            <p className="text-[10px] tracking-wider text-indigo-600 font-semibold uppercase mt-0.5">Succession &amp; Leadership Gap Engine</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Role-Based Access Control Active</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white z-10 my-auto">
        
        {/* Left Branding Panel */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-[11px] font-semibold text-indigo-300 mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>AI Competency Gap Models</span>
            </div>

            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight text-white">
              Leadership Succession Platform
            </h2>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Automated evaluation models, readiness analytics, and AI role replacement for enterprise talent pipelines.
            </p>
          </div>

          <div className="relative z-10 mt-8 space-y-4">
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 backdrop-blur-md">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Demo User Accounts:</span>
                <span className="text-emerald-400 font-normal text-[9px] bg-emerald-500/20 px-2 py-0.5 rounded-full">Ready</span>
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <button 
                  onClick={() => handleRoleSelect('HR')} 
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${selectedRole === 'HR' ? 'bg-indigo-600/40 border-indigo-400 text-white' : 'hover:bg-slate-700/50 border-slate-700'}`}
                >
                  <span className="font-semibold flex items-center"><Building2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> HR Admin</span>
                  <span className="text-[10px] opacity-80">hr / hr123</span>
                </button>

                <button 
                  onClick={() => handleRoleSelect('Manager')} 
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${selectedRole === 'Manager' ? 'bg-indigo-600/40 border-indigo-400 text-white' : 'hover:bg-slate-700/50 border-slate-700'}`}
                >
                  <span className="font-semibold flex items-center"><UserCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Manager</span>
                  <span className="text-[10px] opacity-80">manager / manager123</span>
                </button>

                <button 
                  onClick={() => handleRoleSelect('Employee')} 
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${selectedRole === 'Employee' ? 'bg-indigo-600/40 border-indigo-400 text-white' : 'hover:bg-slate-700/50 border-slate-700'}`}
                >
                  <span className="font-semibold flex items-center"><Briefcase className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Employee</span>
                  <span className="text-[10px] opacity-80">employee / employee123</span>
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
              <span>Enterprise RBAC v2.4</span>
              <span>Team: Elamparuthi K P</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="md:col-span-7 p-8 lg:p-12 bg-white flex flex-col justify-center">
          
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Enterprise HR Portal Sign In</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Select your portal role and authenticate with credentials</p>
          </div>

          {/* Role Selector Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select User Role
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleRoleSelect('HR')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  selectedRole === 'HR'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>HR</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('Manager')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  selectedRole === 'Manager'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Manager</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('Employee')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  selectedRole === 'Employee'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Employee</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email / Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                  placeholder={`Enter ${selectedRole.toLowerCase()} username or email`}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 text-xs text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating Role &amp; Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to {selectedRole} Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center z-10 py-2">
        <p className="text-[11px] text-slate-500 font-medium">
          Enterprise Succession Planning Dashboard • Role-Based Authentication Enabled
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Account Password</h3>
                <p className="text-xs text-slate-500">Enterprise HR Security Recovery</p>
              </div>
            </div>

            {forgotSubmitted ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <p className="text-xs font-bold text-emerald-800">Password Reset Instructions Sent!</p>
                <p className="text-[11px] text-emerald-700">
                  If an enterprise account exists for <strong>{forgotEmail}</strong>, password reset instructions have been dispatched.
                </p>
                <button
                  onClick={() => { setShowForgotModal(false); setForgotSubmitted(false); }}
                  className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Enter your registered work email address to receive a secure password reset authorization token.
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
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
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
