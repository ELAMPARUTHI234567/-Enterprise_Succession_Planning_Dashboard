import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Award, ShieldAlert, UserCheck, TrendingUp, RefreshCw, ArrowRight, CheckCircle2, Clock, PlusCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import ReadinessPieChart from '../charts/ReadinessPieChart';
import { dashboardService, employeeService } from '../services/api';

export const ManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const userJson = localStorage.getItem('succession_user');
  const user = userJson ? JSON.parse(userJson) : { id: 2, name: 'Sneha Reddy', role: 'Manager' };

  const fetchManagerData = async () => {
    setLoading(true);
    setError('');
    try {
      // Get manager's team members
      const teamRes = await employeeService.getAll({ manager_id: user.employee_id || 4 });
      if (teamRes.success) {
        setTeamMembers(teamRes.data || []);
      }

      // Get manager dashboard summary
      const sumRes = await dashboardService.getSummary({ manager_id: user.employee_id || 4 });
      if (sumRes.success) {
        setSummary(sumRes.data);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Manager Team Dashboard...</p>
      </div>
    );
  }

  if (error || (!summary && teamMembers.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6 bg-white rounded-2xl border border-slate-200 card-shadow text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-slate-800">Unable to Load Manager Team Dashboard</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md">
          {error || 'Unable to connect to the server. Please check the backend connection.'}
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
  const topSuccessors = summary?.top_successors || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Team Manager Access • {user.name || 'Manager'}</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Team Competency &amp; Readiness Dashboard</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Monitor direct reports, create targeted team assessments, analyze competency gaps, and track successor readiness levels.
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

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="My Team Members"
          value={teamMembers.length || 4}
          subtitle="Direct reports assigned to team"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Pending Team Assessments"
          value={kpis.pending_assessments || 1}
          subtitle="Awaiting employee completion"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Completed Assessments"
          value={kpis.completed_assessments || 2}
          subtitle="Processed results on file"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="High Readiness Team Members"
          value={kpis.high_readiness || 1}
          subtitle="Ready for leadership roles"
          icon={TrendingUp}
          color="blue"
        />
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
          <CompetencyBarChart
            labels={charts.current_vs_required?.labels}
            currentScores={charts.current_vs_required?.current}
            requiredScores={charts.current_vs_required?.required}
          />
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Team Readiness Levels</h3>
            <p className="text-[11px] text-slate-500">Readiness classification for team candidates</p>
          </div>
          <ReadinessPieChart
            highCount={kpis.high_readiness || 1}
            mediumCount={kpis.medium_readiness || 2}
            lowCount={kpis.low_readiness || 1}
          />
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
                  <td className="px-6 py-4">{emp.experience_years} yrs</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{emp.performance_score}/100</td>
                  <td className="px-6 py-4 font-extrabold text-indigo-700">{emp.readiness_score || 82}%</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={emp.readiness_level || 'High'} type="readiness" />
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
      </div>
    </div>
  );
};

export default ManagerDashboard;
