import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  User, CheckSquare, Clock, ShieldAlert, Award, TrendingUp, RefreshCw, 
  ArrowRight, Play, CheckCircle2, Sparkles, Mail, Building2, Calendar, 
  Star, ChevronRight, Target, BookOpen, Activity, Mountain, Layers, FileText, ExternalLink
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ProjectExperienceSection from '../components/ProjectExperienceSection';
import EmploymentHistorySection from '../components/EmploymentHistorySection';
import SkillsCompetenciesSection from '../components/SkillsCompetenciesSection';
import { authService, assessmentService, employeeService, gapService } from '../services/api';

export const EmployeeDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [myAssessments, setMyAssessments] = useState([]);
  const [gapData, setGapData] = useState(null);
  const [readinessData, setReadinessData] = useState(null);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  const userJson = localStorage.getItem('succession_user');
  const user = userJson ? JSON.parse(userJson) : null;

  // Determine active view tab based on route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/my-profile') return 'profile';
    if (path === '/my-projects') return 'projects';
    if (path === '/my-experience') return 'experience';
    if (path === '/my-skills') return 'skills';
    if (path === '/my-competencies') return 'competencies';
    if (path === '/my-assessments') return 'assessments';
    if (path === '/assessment-history') return 'history';
    if (path === '/my-results') return 'results';
    if (path === '/my-gaps') return 'gaps';
    if (path === '/my-readiness') return 'readiness';
    if (path === '/my-development') return 'development';
    if (path === '/resources') return 'resources';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const fetchEmployeeData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Get authenticated user profile & linked employee info
      const meRes = await authService.getMe();
      let empData = null;
      if (meRes?.success && meRes?.data) {
        empData = meRes.data.employee_profile || meRes.data;
      }

      const targetRoleId = empData?.target_role_id || 1;

      // 1b. Fetch full employee profile if linked ID exists
      if (empData?.id) {
        try {
          const fullRes = await employeeService.getById(empData.id, targetRoleId);
          if (fullRes?.success && fullRes.data) {
            empData = fullRes.data;
          }
        } catch (e) {
          console.warn('Could not load extended profile:', e);
        }
      }
      setEmployeeProfile(empData);

      // 2. Get assigned assessments for authenticated employee
      const assRes = await assessmentService.getMyAssessments();
      if (assRes?.success) {
        setMyAssessments(assRes.data || []);
      }

      // 3. Get competency gap analysis for authenticated employee
      const gapRes = await gapService.getMyGaps(targetRoleId);
      if (gapRes?.success) {
        setGapData(gapRes.data);
      }

      // 4. Get readiness details for authenticated employee
      const readRes = await gapService.getMyReadiness(targetRoleId);
      if (readRes?.success) {
        setReadinessData(readRes.data);
      }
    } catch (err) {
      setError(err.message || 'Error loading employee dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Personal Portal...</p>
      </div>
    );
  }

  const displayAssessments = myAssessments || [];
  const pendingAssessments = displayAssessments.filter(a => a.status !== 'Completed');
  const completedAssessments = displayAssessments.filter(a => a.status === 'Completed');
  
  // Real gap calculations
  const rawGaps = gapData?.competencies?.filter(c => (c.gap || 0) > 0) || [];
  const gapCount = rawGaps.length;

  // Display name: prefer verified stored name, fall back to email, then username
  const rawName = employeeProfile?.name || user?.name || null;
  const displayEmail = employeeProfile?.email || user?.email || 'Not provided';
  const displayName = (rawName && rawName.trim()) ? rawName.trim() : (displayEmail !== 'Not provided' ? displayEmail : (user?.username || 'User'));
  
  // Generate initials: from name words if available, otherwise from email local part
  const getInitialsFromValue = (val) => {
    if (!val) return 'U';
    if (val.includes('@')) return val.split('@')[0].slice(0, 2).toUpperCase();
    return val.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };
  const initials = getInitialsFromValue(displayName);

  const displayDepartment = employeeProfile?.department || 'Not provided';
  const displayDesignation = employeeProfile?.designation || 'Not provided';
  const displayManager = employeeProfile?.manager_name || 'Not provided';

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="max-w-2xl relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[11px] font-semibold">
            <User className="w-3.5 h-3.5" />
            <span>Employee Self-Service Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {activeTab === 'profile' && 'My Employee Profile'}
            {activeTab === 'competencies' && 'My Competencies'}
            {activeTab === 'assessments' && 'My Assigned Assessments'}
            {activeTab === 'history' && 'Assessment Completion History'}
            {activeTab === 'results' && 'My Performance Results'}
            {activeTab === 'gaps' && 'Competency Gap Analysis'}
            {activeTab === 'readiness' && 'Leadership Readiness Score'}
            {activeTab === 'development' && 'Individual Development Plan'}
            {activeTab === 'resources' && 'Learning & Growth Resources'}
            {activeTab === 'dashboard' && `Welcome, ${displayName}!`}
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed font-normal">
            Track your assigned competency assessments, view individual performance scores, review gap analysis, and focus on recommended leadership development areas.
          </p>
        </div>

        {/* Motivation Card */}
        <div className="mt-6 md:mt-0 relative z-10 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl max-w-xs text-right hidden lg:block">
          <div className="flex items-center justify-end space-x-2 text-indigo-300 mb-1">
            <Mountain className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold italic text-white">
            "Develop your skills today for a stronger tomorrow."
          </p>
        </div>

        <div className="absolute right-0 bottom-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-2xl">
          {error}
        </div>
      )}

      {/* View Switcher Tabs Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        {[
          { label: 'Overview', tab: 'dashboard', path: '/employee-dashboard' },
          { label: 'Profile', tab: 'profile', path: '/my-profile' },
          { label: 'Projects', tab: 'projects', path: '/my-projects' },
          { label: 'Experience', tab: 'experience', path: '/my-experience' },
          { label: 'Skills', tab: 'skills', path: '/my-skills' },
          { label: 'Competencies', tab: 'competencies', path: '/my-competencies' },
          { label: 'Assessments', tab: 'assessments', path: '/my-assessments' },
          { label: 'History', tab: 'history', path: '/assessment-history' },
          { label: 'Results', tab: 'results', path: '/my-results' },
          { label: 'Gaps', tab: 'gaps', path: '/my-gaps' },
          { label: 'Readiness', tab: 'readiness', path: '/my-readiness' },
          { label: 'Development', tab: 'development', path: '/my-development' },
          { label: 'Resources', tab: 'resources', path: '/resources' },
        ].map((item) => (
          <button
            key={item.tab}
            onClick={() => navigate(item.path)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
              activeTab === item.tab
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB / DEFAULT OVERVIEW */}
      {(activeTab === 'dashboard' || activeTab === 'assessments' || activeTab === 'history') && (
        <>
          {/* Top 3 Stat Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div
              onClick={() => navigate('/my-assessments')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CheckSquare className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Assessments</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{displayAssessments.length}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Total assessments assigned</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div
              onClick={() => navigate('/my-assessments')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pending Action</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{pendingAssessments.length}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Awaiting your submission</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div
              onClick={() => navigate('/assessment-history')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Completed History</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{completedAssessments.length}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Completed assessments</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Profile Column (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center space-x-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-indigo-600/30">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-extrabold text-slate-900">{displayName}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                        • Active
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{displayDesignation}</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="flex items-center space-x-2 text-slate-500 font-medium">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Email</span>
                    </span>
                    <span className="font-semibold text-slate-800">{displayEmail}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="flex items-center space-x-2 text-slate-500 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Department</span>
                    </span>
                    <span className="font-semibold text-slate-800">{displayDepartment}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="flex items-center space-x-2 text-slate-500 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Manager</span>
                    </span>
                    <span className="font-semibold text-slate-800">{displayManager}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="flex items-center space-x-2 text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Experience</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                      {employeeProfile?.experience_years != null ? `${employeeProfile.experience_years} years` : 'Not recorded'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="flex items-center space-x-2 text-slate-500 font-medium">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Performance Score</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                      {employeeProfile?.performance_score != null ? `${employeeProfile.performance_score} / 100` : 'Pending evaluation'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                onClick={() => navigate('/my-readiness')}
                className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2 cursor-pointer hover:bg-indigo-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Leadership Readiness Score</p>
                    <p className="text-2xl font-extrabold text-indigo-950 mt-0.5">
                      {readinessData?.readiness_score != null ? `${readinessData.readiness_score}%` : 'Pending'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    readinessData?.readiness_level === 'High' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : readinessData?.readiness_level === 'Medium'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    • {readinessData?.readiness_level ? `${readinessData.readiness_level} Readiness` : 'Evaluation Pending'}
                  </span>
                </div>

                <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${readinessData?.readiness_score || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Assessments List Column (8 cols) */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">My Assigned Competency Assessments</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Complete your assigned assessments before the due date</p>
                  </div>
                  <button
                    onClick={() => navigate('/my-assessments')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Assessments Listing or Empty State */}
                {((activeTab === 'history' ? completedAssessments : displayAssessments).length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                      <CheckSquare className="w-6 h-6 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">No Assessments Assigned Yet</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        You currently have no pending competency assessments assigned. Your direct manager or HR administrator will assign relevant assessments for your leadership track.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {(activeTab === 'history' ? completedAssessments : displayAssessments).map((ass) => (
                      <div
                        key={ass.id}
                        className="p-4 bg-slate-50/70 hover:bg-slate-100/60 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-start space-x-3.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold mt-0.5 ${
                            ass.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-600'
                              : ass.status === 'In Progress'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            <CheckSquare className="w-5 h-5 stroke-[2]" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-slate-900 text-sm">{ass.assessment_title}</span>
                              {ass.status === 'In Progress' && (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                  In Progress
                                </span>
                              )}
                              {ass.status === 'Assigned' && (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                  Assigned
                                </span>
                              )}
                              {ass.status === 'Completed' && (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  Completed
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{ass.description || `Assigned evaluation for ${ass.role_name}`}</p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2 font-medium">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                <span>HR-Assigned Date: <strong className="text-slate-800">{ass.scheduled_date || ass.due_date || 'Standard'}</strong></span>
                              </span>
                              {ass.start_time && (
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Window: <strong className="text-slate-800">{ass.start_time} - {ass.end_time || 'End'} ({ass.time_zone || 'IST'})</strong></span>
                                </span>
                              )}
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Duration: <strong className="text-slate-800">{ass.duration_minutes || ass.duration || 30} mins</strong></span>
                              </span>
                            </div>
                            {ass.instructions && (
                              <p className="text-[10px] text-slate-400 italic mt-1">
                                Instructions: {ass.instructions}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          {ass.status === 'Completed' ? (
                            <button
                              onClick={() => navigate(`/take-assessment/${ass.id}`)}
                              className="px-4 py-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl text-xs transition-colors"
                            >
                              View Results
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/take-assessment/${ass.id}`)}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all"
                            >
                              Start Assessment
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* PROFILE VIEW TAB */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center space-x-4 pb-6 border-b border-slate-100">
            <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-lg shadow-indigo-600/30">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{displayName}</h2>
              <p className="text-sm font-semibold text-slate-500">{displayDesignation}</p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {user?.role || 'Employee'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Active Account
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <h4 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">Personal & Employment Information</h4>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Full Name</span>
                <span className="font-bold text-slate-800">{displayName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Corporate Email</span>
                <span className="font-bold text-slate-800">{displayEmail}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Department</span>
                <span className="font-bold text-slate-800">{displayDepartment}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Reporting Manager</span>
                <span className="font-bold text-slate-800">{displayManager}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-extrabold text-slate-900 border-b border-slate-100 pb-2">Experience & Metrics</h4>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Years of Experience</span>
                <span className="font-bold text-slate-800">
                  {employeeProfile?.experience_years != null ? `${employeeProfile.experience_years} Years` : 'Not recorded'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Performance Score</span>
                <span className="font-bold text-slate-800">
                  {employeeProfile?.performance_score != null ? `${employeeProfile.performance_score} / 100` : 'Pending evaluation'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Leadership Readiness Score</span>
                <span className="font-bold text-indigo-600">
                  {readinessData?.readiness_score != null ? `${readinessData.readiness_score}%` : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Embedded Profile Sections: Projects, Experience, Skills */}
          <div className="pt-6 border-t border-slate-100 space-y-8">
            <ProjectExperienceSection
              employeeId={employeeProfile?.id}
              projects={employeeProfile?.projects || []}
              onRefresh={fetchEmployeeData}
              canEdit={true}
              canVerify={false}
            />

            <EmploymentHistorySection
              employeeId={employeeProfile?.id}
              employeeProfile={employeeProfile}
              history={employeeProfile?.employment_history || []}
              onRefresh={fetchEmployeeData}
              canEdit={true}
              canVerify={false}
            />

            <SkillsCompetenciesSection
              employeeId={employeeProfile?.id}
              skills={employeeProfile?.skills || []}
              skillGaps={employeeProfile?.skill_gaps || {}}
              onRefresh={fetchEmployeeData}
              canEdit={true}
              canVerify={false}
            />
          </div>
        </div>
      )}

      {/* DEDICATED PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <ProjectExperienceSection
            employeeId={employeeProfile?.id}
            projects={employeeProfile?.projects || []}
            onRefresh={fetchEmployeeData}
            canEdit={true}
            canVerify={false}
          />
        </div>
      )}

      {/* DEDICATED EMPLOYMENT HISTORY TAB */}
      {activeTab === 'experience' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <EmploymentHistorySection
            employeeId={employeeProfile?.id}
            employeeProfile={employeeProfile}
            history={employeeProfile?.employment_history || []}
            onRefresh={fetchEmployeeData}
            canEdit={true}
            canVerify={false}
          />
        </div>
      )}

      {/* DEDICATED TECHNICAL SKILLS TAB */}
      {activeTab === 'skills' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <SkillsCompetenciesSection
            employeeId={employeeProfile?.id}
            skills={employeeProfile?.skills || []}
            skillGaps={employeeProfile?.skill_gaps || {}}
            onRefresh={fetchEmployeeData}
            canEdit={true}
            canVerify={false}
          />
        </div>
      )}

      {/* COMPETENCIES & GAPS TAB */}
      {(activeTab === 'competencies' || activeTab === 'gaps') && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Competency & Gap Analysis</h3>
              <p className="text-xs text-slate-500">Comparison between your current competency ratings and target role requirements</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
              {gapCount} Improvement Areas Identified
            </span>
          </div>

          {(!gapData?.competencies || gapData.competencies.length === 0) ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Competency Data Recorded</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Complete assigned leadership assessments to automatically populate your competency evaluations and gap analysis.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gapData.competencies.map((comp, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-xs">{comp.name}</span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      comp.status === 'Strength'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {comp.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>Current: {comp.current_score}%</span>
                      <span>Target: {comp.target_score}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${comp.current_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RESULTS TAB */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Completed Assessment Results</h3>
              <p className="text-xs text-slate-500">Detailed scores and evaluation feedback from your completed assessments</p>
            </div>
            <Award className="w-6 h-6 text-indigo-600" />
          </div>

          <div className="space-y-4">
            {completedAssessments.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                  <Award className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">No Completed Assessments Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Once you complete an assessment, detailed score breakdowns and role readiness evaluations will be visible here.
                  </p>
                </div>
              </div>
            ) : (
              completedAssessments.map((ass) => (
                <div key={ass.id} className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">Evaluation Completed</span>
                    <h4 className="text-base font-extrabold text-slate-900">{ass.assessment_title}</h4>
                    <p className="text-xs text-slate-500">Evaluated for role: {ass.role_name || 'Target Leadership Role'}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-3xl font-extrabold text-indigo-600">{ass.overall_score || ass.result?.overall_score || 0}<span className="text-sm font-semibold text-slate-500">%</span></p>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Completed
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/take-assessment/${ass.id}`)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                    >
                      View Results
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* READINESS TAB */}
      {activeTab === 'readiness' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Leadership Readiness Score Breakdown</h3>
              <p className="text-xs text-slate-500">AI-computed succession readiness score based on experience, performance, and competencies</p>
            </div>
            <TrendingUp className="w-6 h-6 text-indigo-600" />
          </div>

          <div className="p-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Overall Succession Readiness</p>
              <h2 className="text-4xl font-extrabold text-white mt-1">
                {readinessData?.readiness_score != null ? `${readinessData.readiness_score}%` : 'Pending'}
              </h2>
              <p className="text-xs text-indigo-200 mt-1">
                {readinessData?.readiness_level 
                  ? `${readinessData.readiness_level} readiness candidate for leadership consideration` 
                  : 'Complete assigned assessments to determine readiness ranking'}
              </p>
            </div>
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Succession Threshold</span>
                <span>{readinessData?.readiness_score || 0}% vs 75% Target</span>
              </div>
              <div className="w-full h-3 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800">
                <div 
                  className="h-full bg-emerald-400 rounded-full" 
                  style={{ width: `${Math.min(100, readinessData?.readiness_score || 0)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPMENT TAB */}
      {activeTab === 'development' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Individual Development Plan (IDP)</h3>
              <p className="text-xs text-slate-500">Actionable learning goals assigned by HR and your Manager</p>
            </div>
            <BookOpen className="w-6 h-6 text-purple-600" />
          </div>

          {rawGaps.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">No Critical Skill Gaps Identified</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  All current evaluated competencies meet required role benchmarks. Continue maintaining your excellent standards!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {rawGaps.map((gap, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">Skill Improvement: {gap.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Current Score: {gap.current_score}% | Required Target: {gap.target_score}% (Gap: {gap.gap}%)</p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      In Development
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 rounded-full" 
                      style={{ width: `${Math.min(100, Math.round((gap.current_score / (gap.target_score || 100)) * 100))}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RESOURCES TAB */}
      {activeTab === 'resources' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Learning & Leadership Resources</h3>
              <p className="text-xs text-slate-500">Curated training materials, documentation, and skill building modules</p>
            </div>
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Enterprise Leadership Framework', desc: 'Guide to leadership competencies and successor benchmarks' },
              { name: 'Technical Leadership & Architecture Mastery', desc: 'Best practices for scalable system architecture and design' },
              { name: 'Strategic Alignment & Stakeholder Collaboration', desc: 'Guidelines for cross-functional communication and team execution' },
              { name: 'AI Succession Readiness Documentation', desc: 'Methodology behind gap analysis models and machine learning readiness' }
            ].map((res, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">{res.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{res.desc}</p>
                </div>
                <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom 3 Column Cards Row for Dashboard View */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            onClick={() => navigate('/my-gaps')}
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Target className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">My Competency Gaps</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{gapCount}</p>
                <p className="text-[11px] text-slate-500 font-medium">Areas needing improvement</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-600" />
          </div>

          <div
            onClick={() => navigate('/my-development')}
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Development Plan</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{gapCount}</p>
                <p className="text-[11px] text-slate-500 font-medium">Active skill goals</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-600" />
          </div>

          <div
            onClick={() => navigate('/assessment-history')}
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                <Activity className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Assessment Status</p>
                <p className="text-xs font-bold text-slate-800 mt-1">
                  {completedAssessments.length > 0 
                    ? `${completedAssessments.length} assessment${completedAssessments.length > 1 ? 's' : ''} completed` 
                    : 'No assessments completed'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {pendingAssessments.length > 0 ? `${pendingAssessments.length} pending action` : 'Up to date'}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-600" />
          </div>
        </div>
      )}

    </div>
  );
};

export default EmployeeDashboard;
