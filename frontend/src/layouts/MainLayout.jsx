import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Award, ShieldAlert,
  Sliders, UserCheck, TrendingUp, BarChart3,
  FileText, LogOut, Search, Bell, Menu, X, ChevronRight, User,
  Sparkles, Briefcase, UserPlus, CheckSquare, Settings, Clock, Sprout,
  Crown, ChevronsLeft, ChevronDown
} from 'lucide-react';
import { authService, notificationService } from '../services/api';

export const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileMenuRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Get current logged-in user dynamically
  const [user, setUser] = useState(() => {
    try {
      const userJson = localStorage.getItem('succession_user');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const token = localStorage.getItem('succession_token');
    if (!token) return;

    authService.getMe()
      .then((res) => {
        if (res && res.success && res.data) {
          const freshUser = res.data;
          setUser(freshUser);
          localStorage.setItem('succession_user', JSON.stringify(freshUser));
        }
      })
      .catch((err) => {
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('401') || msg.includes('403') || msg.includes('invalid') || msg.includes('expired')) {
          localStorage.removeItem('succession_token');
          localStorage.removeItem('succession_user');
          navigate('/login', { replace: true });
        }
      });
  }, [navigate]);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getAll();
      if (res.success) {
        setNotifications(res.data || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [location.pathname]);

  // Close menus on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
      }
    };

    if (profileMenuOpen || notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen, notificationsOpen]);

  // Close menus when route changes
  useEffect(() => {
    setProfileMenuOpen(false);
    setNotificationsOpen(false);
    setSidebarOpen(false);
  }, [location.pathname]);

  const role = user?.role || 'Employee';

  const isDemoName = (name) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return lower.includes('sarah jenkins') || lower === 'hr director' || lower.includes('sneha reddy');
  };

  const isDemoEmail = (email) => {
    if (!email) return true;
    const lower = email.toLowerCase().trim();
    return lower === 'hr@company.com' || lower === 'manager@company.com';
  };

  // Display email: prioritize verified authenticated email or linked oauth_email, never use demo email
  const getDisplayEmail = (u) => {
    if (!u) return '';
    if (u.authenticated_email && !isDemoEmail(u.authenticated_email)) {
      return u.authenticated_email;
    }
    if (u.oauth_email && !isDemoEmail(u.oauth_email)) {
      return u.oauth_email;
    }
    if (u.email && !isDemoEmail(u.email)) {
      return u.email;
    }
    if (u.oauth_email) {
      return u.oauth_email;
    }
    return u.email || '';
  };

  // Display name: use verified real name if available, never demo identities or synthetic derived names
  const getDisplayName = (u) => {
    if (!u) return 'User';
    if (u.name && u.name.trim() && !isDemoName(u.name)) {
      return u.name.trim();
    }
    // Do not synthesize full name from email; display the verified email directly
    const email = getDisplayEmail(u);
    if (email) return email;
    if (u.username && u.username !== 'hr') return u.username;
    return 'User';
  };

  // Generate initials from display name or email
  const getInitials = (u) => {
    const displayName = getDisplayName(u);
    if (!displayName || displayName === 'User') return 'U';
    // If it's an email, use first 2 chars of local part
    if (displayName.includes('@')) {
      return displayName.split('@')[0].slice(0, 2).toUpperCase();
    }
    // If it's a real name with multiple words, use first letters of words
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  };

  const handleLogout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isLoggingOut) return;

    // Requirement 1: Immediately close profile dropdown and menu
    setProfileMenuOpen(false);
    setSidebarOpen(false);
    setIsLoggingOut(true);

    try {
      await authService.logout();
    } catch (err) {
      console.warn('[Logout] Error during sign out, continuing redirect:', err);
    } finally {
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  const userEmail = (user?.email || '').toLowerCase();
  const oauthEmail = (user?.oauth_email || '').toLowerCase();
  const authenticatedEmail = (user?.authenticated_email || '').toLowerCase();
  const isAuthorizedAdmin = userEmail === 'elamparuthikp@gmail.com' || 
                            oauthEmail === 'elamparuthikp@gmail.com' || 
                            authenticatedEmail === 'elamparuthikp@gmail.com' || 
                            (user?.role || '').toLowerCase() === 'admin';

  const handleSwitchRole = async (targetRole) => {
    try {
      setProfileMenuOpen(false);
      const res = await authService.switchRole(targetRole);
      if (res && res.success && res.data) {
        localStorage.setItem('succession_token', res.data.token);
        localStorage.setItem('succession_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        if (targetRole.toLowerCase() === 'hr') {
          navigate('/dashboard');
        } else {
          navigate('/manager-dashboard');
        }
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  };

  // Define navigation links according to User Role
  let navItems = [];

  if (role === 'HR' || role === 'Admin') {
    navItems = [
      { name: 'HR Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Employees', path: '/employees', icon: Users },
      { name: 'Leadership Roles', path: '/roles', icon: Award },
      { name: 'Competencies', path: '/competencies', icon: Sliders },
      { name: 'Assessments', path: '/assessments', icon: UserCheck },
      { name: 'Gap Analysis', path: '/gap-analysis', icon: ShieldAlert },
      { name: 'Successors', path: '/successors', icon: TrendingUp },
      { name: 'AI Insights & Replacement', path: '/ai-insights', icon: Sparkles },
      { name: 'Analytics', path: '/analytics', icon: BarChart3 },
      { name: 'Reports', path: '/reports', icon: FileText },
    ];
  } else if (role === 'Manager') {
    navItems = [
      { name: 'Manager Dashboard', path: '/manager-dashboard', icon: LayoutDashboard },
      { name: 'My Team', path: '/my-team', icon: Users },
      { name: 'Create Assessment', path: '/assessments', icon: UserCheck },
      { name: 'Competency Analysis', path: '/gap-analysis', icon: ShieldAlert },
      { name: 'Successor Candidates', path: '/successors', icon: TrendingUp },
      { name: 'AI Insights', path: '/ai-insights', icon: Sparkles },
      { name: 'Reports', path: '/reports', icon: FileText },
    ];
  } else {
    // Employee Role
    navItems = [
      { name: 'Dashboard', path: '/employee-dashboard', icon: LayoutDashboard },
      { name: 'My Profile', path: '/my-profile', icon: User },
      { name: 'My Competencies', path: '/my-competencies', icon: Sliders },
      { name: 'My Assessments', path: '/my-assessments', icon: CheckSquare },
      { name: 'Assessment History', path: '/assessment-history', icon: Clock },
      { name: 'My Results', path: '/my-results', icon: Award },
      { name: 'Competency Gaps', path: '/my-gaps', icon: ShieldAlert },
      { name: 'My Readiness', path: '/my-readiness', icon: TrendingUp },
      { name: 'Development Plan', path: '/my-development', icon: FileText },
      { name: 'Resources', path: '/resources', icon: Sparkles },
    ];
  }

  // Dynamic Page Title
  const currentNav = navItems.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = currentNav ? currentNav.name : `${role} Dashboard`;

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row font-sans">
      {/* Mobile Menu Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-950 text-white flex flex-col justify-between border-r border-slate-800/80 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Logo & Title */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-amber-300 font-bold">
                <Crown className="w-5 h-5 text-amber-300 fill-amber-300" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm tracking-wider text-white leading-tight">ENTERPRISE</h1>
                <p className="text-[10px] tracking-wider text-indigo-400 font-extrabold uppercase">
                  {role} PORTAL
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Badge Card in Sidebar */}
          <div className="p-3.5 mx-3 my-3 bg-slate-900/80 rounded-2xl border border-slate-800/80 flex items-center space-x-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shadow-md shadow-indigo-600/20">
              {getInitials(user)}
            </div>
            <div className="overflow-hidden text-left">
              <p className="text-xs font-extrabold text-white truncate">{getDisplayName(user)}</p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 uppercase">
                  {role.toUpperCase()}
                </span>
                {user?.department && (
                  <span className="text-[11px] text-slate-400 font-medium truncate">{user.department}</span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-thin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer / Team Info & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
          <button
            type="button"
            id="sidebar-signout-btn"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors border border-rose-500/30 bg-rose-950/20 disabled:opacity-60 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>{isLoggingOut ? 'Signing Out...' : `Sign Out (${getDisplayEmail(user) || getDisplayName(user)})`}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">{pageTitle}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Enterprise HR Leadership &amp; Gap Analysis Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Global Search Bar */}
            <div className="hidden sm:flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 w-64 focus-within:ring-2 focus-within:ring-indigo-600">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
              />
            </div>

            {/* Notification Badge & Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(prev => !prev)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 relative transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-900">In-App Notifications</span>
                    {notifications.some(n => !n.is_read) && (
                      <button
                        onClick={async () => {
                          await notificationService.markAllAsRead();
                          fetchNotifications();
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications at this time.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={async () => {
                            if (!n.is_read) {
                              await notificationService.markAsRead(n.id);
                              fetchNotifications();
                            }
                          }}
                          className={`p-3 text-xs transition-colors cursor-pointer ${
                            n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-extrabold text-slate-900 text-[11px]">{n.title}</span>
                            <span className="text-[9px] text-slate-400">
                              {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative pl-3 border-l border-slate-200" ref={profileMenuRef}>
              <button
                type="button"
                id="header-user-profile-btn"
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
                aria-label="User profile menu"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shadow-sm">
                  {getInitials(user)}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-none">{getDisplayName(user)}</p>
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase mt-0.5">{role} Role</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180 text-indigo-600' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileMenuOpen && (
                <div
                  id="header-user-profile-dropdown"
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {/* User Profile Header */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
                        {getInitials(user)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 truncate">{getDisplayName(user)}</p>
                        <p className="text-[11px] text-slate-500 truncate">{getDisplayEmail(user)}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                            {role}
                          </span>
                          {user.department && (
                            <span className="text-[10px] text-slate-400 truncate">
                              {user.department}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links in Menu */}
                  <div className="p-1.5 space-y-0.5">
                    {role === 'Employee' && (
                      <NavLink
                        to="/my-profile"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                        role="menuitem"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>My Profile</span>
                      </NavLink>
                    )}
                    <NavLink
                      to={role === 'HR' || role === 'Admin' ? '/dashboard' : (role === 'Manager' ? '/manager-dashboard' : '/employee-dashboard')}
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                      role="menuitem"
                    >
                      <LayoutDashboard className="w-4 h-4 text-slate-400" />
                      <span>{role} Dashboard</span>
                    </NavLink>
                  </div>

                  {/* Authorized Role Switch for Multi-Role Admins */}
                  {isAuthorizedAdmin && (
                    <div className="pt-1.5 mt-1 border-t border-slate-100 px-1.5">
                      <button
                        type="button"
                        id="header-switch-role-btn"
                        onClick={() => handleSwitchRole(role === 'HR' || role === 'Admin' ? 'Manager' : 'HR')}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        role="menuitem"
                      >
                        <Award className="w-4 h-4 text-indigo-500" />
                        <span>Switch to {role === 'HR' || role === 'Admin' ? 'Manager' : 'HR'} Portal</span>
                      </button>
                    </div>
                  )}

                  {/* Sign Out Action in Dropdown */}
                  <div className="pt-1.5 mt-1 border-t border-slate-100 px-1.5">
                    <button
                      type="button"
                      id="header-signout-btn"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-60"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="p-6 md:p-8 flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
