import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Award, ShieldAlert, UserCheck, TrendingUp, RefreshCw, ArrowRight, 
  CheckCircle2, Clock, PlusCircle, Eye, Search, BarChart2, Cpu, X 
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import ReadinessPieChart from '../charts/ReadinessPieChart';
import AssessmentResultView from '../components/AssessmentResultView';
import { authService, dashboardService, employeeService, assessmentService } from '../services/api';

export const ManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [teamResults, setTeamResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterReadiness, setFilterReadiness] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const userJson = localStorage.getItem('succession_user');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  });

  const fetchManagerData = async () => {
    setLoading(true);
    setError('');
    try {
      let currentManager = user;
      try {
        const meRes = await authService.getMe();
        if (meRes?.success && meRes?.data) {
          currentManager = meRes.data;  // Use backend data as authoritative source
          setUser(currentManager);
          localStorage.setItem('succession_user', JSON.stringify(currentManager));
        }
      } catch {
        // Fall back to existing cached session
      }

      const queryParams = currentManager?.employee_id ? { manager_id: currentManager.employee_id } : {};

      // Get manager's team members, summary metrics, and completed results
      const [teamRes, sumRes, resultsRes] = await Promise.all([
        employeeService.getAll(queryParams),
        dashboardService.getSummary(queryParams),
        assessmentService.getCompletedResults() // Backend enforces RBAC: returns team members' results only
      ]);

      if (teamRes?.success) {
        setTeamMembers(teamRes.data || []);
      }
      if (sumRes?.success) {
        setSummary(sumRes.data);
      }
      if (resultsRes?.success) {
        setTeamResults(resultsRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Error loading manager team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
  }, []);

  // Filter team results
  const filteredTeamResults = teamResults.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (r.employee_name || '').toLowerCase().includes(q);
      const matchCode = (r.employee_code || '').toLowerCase().includes(q);
      const matchTitle = (r.assessment_title || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchTitle) return false;
    }
    if (filterRole && r.role_id !== Number(filterRole)) return false;
    if (filterReadiness && r.readiness_level !== filterReadiness) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Manager Team Dashboard...</p>
      </div>
    );
  }

  if (selectedResult) {
    return (
      <div className="font-sans">
        <AssessmentResultView
          result={selectedResult}
          onBack={() => setSelectedResult(null)}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6 bg-white rounded-2xl border border-slate-200 card-shadow text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-slate-800">Unable to Load Manager Team Dashboard</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md">
          {error}
        </p>
        <button
          onClick={fetchManagerData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Dashboard</span>
        </button>
      </div>
    );
  }

  const kpis = summary?.kpis || {};
  const charts = summary?.charts || {};

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Team Manager Access • {user?.name && !['sarah jenkins', 'sneha reddy'].includes(user.name.toLowerCase()) ? user.name : (user?.authenticated_email || user?.oauth_email || user?.email || 'Manager')}</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Team Competency &amp; Assessment Dashboard</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-indigo-200">
            <span>Email: <strong className="text-white font-semibold">{user?.authenticated_email || user?.oauth_email || user?.email || 'N/A'}</strong></span>
            {user?.department && <span>• Department: <strong className="text-white font-semibold">{user.department}</strong></span>}
            {user?.designation && <span>• Designation: <strong className="text-white font-semibold">{user.designation}</strong></span>}
          </div>
          <p className="text-xs text-indigo-200/80 mt-1.5 max-w-2xl">
            Monitor direct reports, review authorized completed assessment results, analyze competency gaps, and view AI readiness predictions.
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <button
            onClick={() => navigate('/assessments')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="My Team Members"
          value={teamMembers.length}
          subtitle="Direct reports assigned to team"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Pending Team Assessments"
          value={kpis.pending_assessments ?? 0}
          subtitle="Awaiting employee completion"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Completed Team Results"
          value={teamResults.length || kpis.completed_assessments || 0}
          subtitle="Processed results on file"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="High Readiness Team Members"
          value={kpis.high_readiness ?? 0}
          subtitle="Ready for leadership roles"
          icon={TrendingUp}
          color="blue"
        />
      </div>

      {/* SECTION 1: AUTHORIZED TEAM EMPLOYEE ASSESSMENT RESULTS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-extrabold text-slate-900">Authorized Team Member Assessment Results</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Results and AI ML readiness analysis for direct reports under your management scope.
            </p>
          </div>

          {/* Search & Filter Inputs */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team member..."
                className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none w-36"
              />
            </div>

            <select
              value={filterReadiness}
              onChange={(e) => setFilterReadiness(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="">All Readiness Levels</option>
              <option value="High">High Readiness</option>
              <option value="Medium">Medium Readiness</option>
              <option value="Low">Low Readiness</option>
            </select>
          </div>
        </div>

        {filteredTeamResults.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
            <p className="text-xs font-semibold text-slate-700">No team assessment results found.</p>
            <p className="text-[11px] font-normal text-slate-500 mt-1">Assignments completed by your direct reports will automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-5 py-3">Team Member</th>
                  <th className="px-5 py-3">Assessment Title</th>
                  <th className="px-5 py-3">Target Role</th>
                  <th className="px-5 py-3">Submission Date</th>
                  <th className="px-5 py-3">Score %</th>
                  <th className="px-5 py-3">Calculated Readiness</th>
                  <th className="px-5 py-3">AI ML Prediction</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredTeamResults.map((res) => {
                  const formattedDate = res.submission_date
                    ? new Date(res.submission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recently Completed';
                  const mlClass = res.ml_prediction?.predicted_class || res.ml_prediction?.data?.predicted_class || res.readiness_level;

                  return (
                    <tr key={res.id || res.assignment_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{res.employee_name}</p>
                          <p className="text-[10px] text-slate-500">{res.employee_code} • {res.designation || 'Specialist'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{res.assessment_title}</td>
                      <td className="px-5 py-3.5 font-bold text-indigo-700">{res.role_name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{formattedDate}</td>
                      <td className="px-5 py-3.5 font-extrabold text-indigo-700 text-sm">{res.overall_score}%</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={res.readiness_level || 'High'} type="readiness" />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                          mlClass === 'High' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          mlClass === 'Medium' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          ML: {mlClass}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedResult(res)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Results</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Team Competency Overview</h3>
              <p className="text-[11px] text-slate-500">Average team competency scores vs target leadership requirements</p>
            </div>
          </div>
          {charts.current_vs_required?.labels && charts.current_vs_required.labels.length > 0 ? (
            <CompetencyBarChart
              labels={charts.current_vs_required.labels}
              currentScores={charts.current_vs_required.current}
              requiredScores={charts.current_vs_required.required}
            />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <BarChart2 className="w-10 h-10 mb-2 opacity-30 text-indigo-500" />
              <p className="text-xs font-semibold text-slate-600">No competency scores available yet</p>
              <p className="text-[11px] text-slate-400 mt-1">Competency evaluations will be plotted as team assessments are completed.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Team Readiness Levels</h3>
            <p className="text-[11px] text-slate-500">Readiness classification for team candidates</p>
          </div>
          {(kpis.high_readiness || kpis.medium_readiness || kpis.low_readiness) ? (
            <ReadinessPieChart
              highCount={kpis.high_readiness || 0}
              mediumCount={kpis.medium_readiness || 0}
              lowCount={kpis.low_readiness || 0}
            />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <TrendingUp className="w-10 h-10 mb-2 opacity-30 text-indigo-500" />
              <p className="text-xs font-semibold text-slate-600">No readiness levels recorded</p>
              <p className="text-[11px] text-slate-400 mt-1">Readiness distribution will render as employees are evaluated.</p>
            </div>
          )}
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Assigned Team Members</h3>
            <p className="text-[11px] text-slate-500">View performance, competency scores, and assign assessments</p>
          </div>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
            {teamMembers.length} Members
          </span>
        </div>

        {teamMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
            <p className="text-xs font-semibold text-slate-700">No direct reports currently assigned</p>
            <p className="text-[11px] font-normal text-slate-500 mt-1">Direct reports assigned to you in the HR directory will automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Designation</th>
                  <th className="px-6 py-3">Experience</th>
                  <th className="px-6 py-3">Performance</th>
                  <th className="px-6 py-3">Readiness Score</th>
                  <th className="px-6 py-3">Readiness Level</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {teamMembers.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{emp.name}</p>
                        <p className="text-[10px] text-slate-500">{emp.email} • {emp.employee_code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">{emp.department}</td>
                    <td className="px-6 py-4">{emp.designation}</td>
                    <td className="px-6 py-4">
                      {emp.experience_years != null ? `${emp.experience_years} yrs` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {emp.performance_score != null ? `${emp.performance_score}/100` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-indigo-700">
                      {emp.readiness_score != null ? `${emp.readiness_score}%` : 'Pending'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={emp.readiness_level || 'Low'} type="readiness" />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-xs transition-colors"
                      >
                        Competency Gaps
                      </button>
                      <button
                        onClick={() => navigate(`/assessments`)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-xs transition-colors"
                      >
                        Assign Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
