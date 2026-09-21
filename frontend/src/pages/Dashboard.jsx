import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Award, Sliders, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, Cpu } from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import ReadinessPieChart from '../charts/ReadinessPieChart';
import GapAnalysisChart from '../charts/GapAnalysisChart';
import { dashboardService } from '../services/api';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dashboardService.getSummary();
      if (res.success) {
        setSummary(res.data);
      } else {
        setError(res.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError(err.message || 'Connection error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Enterprise Analytics...</p>
      </div>
    );
  }

  const kpis = summary?.kpis || {};
  const charts = summary?.charts || {};
  const topSuccessors = summary?.top_successors || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Random Forest ML Pipeline Active</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Leadership Succession &amp; Competency Gap Engine</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Real-time automated evaluation of leadership potential, competency gaps, experience scaling, and ML readiness predictions.
          </p>
        </div>
        <button
          onClick={() => navigate('/assessments')}
          className="mt-4 md:mt-0 px-4 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl text-xs shadow-lg transition-all flex items-center space-x-2"
        >
          <span>+ New Assessment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Employees"
          value={kpis.total_employees || 0}
          subtitle="Monitored in directory"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Leadership Roles"
          value={kpis.leadership_roles || 0}
          subtitle="Defined target positions"
          icon={Award}
          color="blue"
        />
        <StatCard
          title="Potential Successors"
          value={kpis.potential_successors || 0}
          subtitle={`${kpis.high_readiness || 0} High • ${kpis.medium_readiness || 0} Medium`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Critical Gap Alerts"
          value={kpis.critical_competency_gaps || 0}
          subtitle="Gaps &gt; 20 points"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Current vs Required Competencies</h3>
              <p className="text-[11px] text-slate-500">Enterprise average current scores vs benchmark targets</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">Target Standard</span>
          </div>
          <CompetencyBarChart
            labels={charts.current_vs_required?.labels}
            currentScores={charts.current_vs_required?.current}
            requiredScores={charts.current_vs_required?.required}
          />
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Readiness Distribution</h3>
            <p className="text-[11px] text-slate-500">Successor pipeline classification</p>
          </div>
          <ReadinessPieChart
            highCount={kpis.high_readiness || 0}
            mediumCount={kpis.medium_readiness || 0}
            lowCount={kpis.low_readiness || 0}
          />
        </div>
      </div>

      {/* Row 3: Gap Severity Analysis Chart */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Enterprise Competency Gap Severity</h3>
            <p className="text-[11px] text-slate-500">Required score minus current average score per competency</p>
          </div>
          <button
            onClick={() => navigate('/gap-analysis')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Full Gap Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <GapAnalysisChart
          labels={charts.competency_gaps?.labels}
          gaps={charts.competency_gaps?.gaps}
        />
      </div>

      {/* Row 4: Top Potential Successors Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Top Potential Leadership Successors</h3>
            <p className="text-[11px] text-slate-500">Ranked candidates based on weighted 40/25/15/20 baseline score</p>
          </div>
          <button
            onClick={() => navigate('/successors')}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg text-xs transition-colors flex items-center space-x-1"
          >
            <span>View All Candidates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Competency Score</th>
                <th className="px-6 py-3">Readiness Score</th>
                <th className="px-6 py-3">Readiness Level</th>
                <th className="px-6 py-3">Major Development Gap</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {topSuccessors.map((cand, idx) => (
                <tr key={cand.employee_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-[11px] inline-flex items-center justify-center">
                      #{idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{cand.name}</p>
                      <p className="text-[10px] text-slate-500">{cand.designation} • {cand.employee_code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{cand.department}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{cand.competency_score}%</td>
                  <td className="px-6 py-4">
                    <span className="font-extrabold text-indigo-700 text-sm">{cand.readiness_score}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={cand.readiness_level} type="readiness" />
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-100">
                      {cand.major_gap}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/employees/${cand.employee_id}`)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-xs transition-colors"
                    >
                      View Profile
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

export default Dashboard;
