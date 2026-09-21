import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Award, ShieldAlert,
  Sliders, UserCheck, TrendingUp, BarChart3,
  FileText, LogOut, Search, Bell, Menu, X, ChevronRight, User,
  Sparkles, Briefcase, UserPlus, CheckSquare, Settings
} from 'lucide-react';
import { authService } from '../services/api';

export const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get current logged-in user from localStorage
  const userJson = localStorage.getItem('succession_user');
  const user = userJson ? JSON.parse(userJson) : { name: 'Sarah Jenkins', role: 'HR', username: 'hr' };
  const role = user.role || 'HR';

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
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
      { name: 'My Dashboard', path: '/employee-dashboard', icon: LayoutDashboard },
      { name: 'My Profile', path: '/my-profile', icon: User },
      { name: 'My Assessments', path: '/my-assessments', icon: CheckSquare },
      { name: 'My Competencies', path: '/my-competencies', icon: Sliders },
      { name: 'Development Areas', path: '/my-development', icon: ShieldAlert },
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
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-white flex flex-col justify-between transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Logo & Title */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">
                👑
              </div>
              <div>
                <h1 className="font-extrabold text-sm tracking-tight text-white leading-none">ENTERPRISE</h1>
                <p className="text-[10px] tracking-wider text-indigo-400 font-semibold uppercase mt-0.5">
                  {role} Portal
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Pill in Sidebar */}
          <div className="p-3.5 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user.name ? user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : role.slice(0,2)}
            </div>
            <div className="overflow-hidden text-left">
              <p className="text-xs font-bold text-slate-200 truncate">{user.name || user.username}</p>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  {role}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{user.department || 'Enterprise'}</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)] scrollbar-thin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && item.path !== '/manager-dashboard' && item.path !== '/employee-dashboard' && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-200" />}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer / Team Info & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors border border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out ({user.username})</span>
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

            {/* Notification Badge */}
            <button className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white"></span>
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                {user.name ? user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : role.slice(0,2)}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">{user.name || user.username}</p>
                <p className="text-[10px] text-indigo-600 font-semibold uppercase mt-0.5">{role} Role</p>
              </div>
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
