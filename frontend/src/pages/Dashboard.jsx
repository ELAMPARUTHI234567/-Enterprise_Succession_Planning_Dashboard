import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Award, Sliders, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, Cpu, Briefcase, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import ReadinessPieChart from '../charts/ReadinessPieChart';
import GapAnalysisChart from '../charts/GapAnalysisChart';
import { CompanyHierarchySection } from '../components/CompanyHierarchySection';
import { dashboardService } from '../services/api';
import AIExecutiveSummarySection from '../components/AIExecutiveSummarySection';
import AITop3SuccessorsSection from '../components/AITop3SuccessorsSection';
import AICompetencyIntelligenceSection from '../components/AICompetencyIntelligenceSection';
import AIChatDrawer from '../components/AIChatDrawer';
import ErrorBoundary from '../components/ErrorBoundary';

export const Dashboard = () => {
  // Stale-While-Revalidate: Populate immediately from session cache if available
  const [summary, setSummary] = useState(() => {
    try {
      const cached = sessionStorage.getItem('hr_dashboard_summary');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('hr_dashboard_summary');
    } catch {
      return true;
    }
  });

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showHierarchy, setShowHierarchy] = useState(false);
  const abortControllerRef = useRef(null);
  const navigate = useNavigate();

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (!summary || isManualRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError('');

    // 15-second safety timeout guard to prevent indefinite hanging
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
      if (!summary) {
        setError('Dashboard analytics processing timed out. Please click retry to reload.');
      }
    }, 15000);

    try {
      const res = await dashboardService.getSummary();
      clearTimeout(timeoutId);
      if (res.success && res.data) {
        setSummary(res.data);
        try {
          sessionStorage.setItem('hr_dashboard_summary', JSON.stringify(res.data));
        } catch {
          // ignore session storage quota issues
        }
      } else {
        const rawMsg = res.message || '';
        const userFriendlyMsg = /sql|database|psycopg2|anon_1|programmingerror|column/i.test(rawMsg)
          ? 'Unable to load enterprise dashboard analytics. Please retry or contact administrator.'
          : (rawMsg || 'Failed to load dashboard data');
        if (!summary) setError(userFriendlyMsg);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      const rawMsg = err.message || '';
      const userFriendlyMsg = /sql|database|psycopg2|anon_1|programmingerror|column/i.test(rawMsg)
        ? 'A database error occurred while loading dashboard analytics. Please retry.'
        : (rawMsg || 'Unable to connect to the server. Please check the backend connection.');
      if (!summary) setError(userFriendlyMsg);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const kpis = summary?.kpis || {};
  const charts = summary?.charts || {};
  const topSuccessors = summary?.top_successors || [];

  return (
    <div className="space-y-6">
      {/* Header Banner - Always visible immediately */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Random Forest ML Pipeline Active</span>
            {refreshing && (
              <span className="flex items-center space-x-1 text-emerald-300 ml-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">Syncing live data...</span>
              </span>
            )}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Leadership Succession &amp; Competency Gap Engine</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Real-time automated evaluation of leadership potential, competency gaps, experience scaling, and ML readiness predictions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={loading || refreshing}
            className="px-3.5 py-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 border border-indigo-400/40"
            title="Refresh Live Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => navigate('/successors')}
            className="px-3.5 py-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 border border-indigo-400/40"
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-300" />
            <span>Managerial Vacancies</span>
          </button>
          <button
            onClick={() => setShowHierarchy(!showHierarchy)}
            className="px-3.5 py-2 bg-indigo-500/30 hover:bg-indigo-500/50 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 border border-indigo-400/40"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>{showHierarchy ? 'Hide Org Hierarchy' : 'Org Hierarchy'}</span>
          </button>
          <button
            onClick={() => navigate('/assessments')}
            className="px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl text-xs shadow-lg transition-all flex items-center space-x-2"
          >
            <span>+ New Assessment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && !summary && (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-rose-200 card-shadow text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-slate-800">Unable to Load Enterprise Analytics</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md">{error}</p>
          <button
            onClick={() => fetchDashboardData(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading Dashboard</span>
          </button>
        </div>
      )}

      {error && summary && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center justify-between">
          <span>{error} (Displaying cached analytics)</span>
          <button
            onClick={() => fetchDashboardData(true)}
            className="px-2 py-1 bg-amber-600 text-white font-bold rounded text-[11px] hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      )}

      {showHierarchy && (
        <div className="bg-white p-5 rounded-2xl border border-indigo-200 card-shadow space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <span>Enterprise Reporting Hierarchy &amp; Management Span</span>
            </h3>
            <button
              onClick={() => setShowHierarchy(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              ✕ Close
            </button>
          </div>
          <CompanyHierarchySection isHR={true} />
        </div>
      )}

      {/* Module 1: AI Executive Workforce & Succession Summary */}
      <ErrorBoundary isSubSection sectionTitle="AI Executive Workforce Summary">
        <AIExecutiveSummarySection 
          onNavigateAssessments={() => navigate('/assessments')} 
          onNavigateSuccessors={() => navigate('/successors')} 
        />
      </ErrorBoundary>

      {/* Row 1: KPI Cards - Skeletons or real cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-8 bg-slate-300 rounded w-1/3"></div>
              <div className="h-3 bg-slate-100 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : (
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
      )}

      {/* Row 2: Charts */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200/80 card-shadow animate-pulse h-80 flex flex-col justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-48 bg-slate-100 rounded"></div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200/80 card-shadow animate-pulse h-80 flex flex-col justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-48 bg-slate-100 rounded-full mx-auto w-48"></div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Row 3: Gap Severity Analysis Chart */}
      {loading && !summary ? (
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 card-shadow animate-pulse h-72">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="h-44 bg-slate-100 rounded"></div>
        </div>
      ) : (
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
      )}

      {/* Row 4: Top Potential Successors Table */}
      {loading && !summary ? (
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 card-shadow animate-pulse h-60 space-y-4">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="h-8 bg-slate-100 rounded"></div>
          <div className="h-8 bg-slate-100 rounded"></div>
          <div className="h-8 bg-slate-100 rounded"></div>
        </div>
      ) : (
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
      )}
      {/* Module 2: AI Top 3 Eligible Successor Recommendations */}
      <ErrorBoundary isSubSection sectionTitle="AI Top 3 Eligible Successors">
        <AITop3SuccessorsSection onNavigateProfile={(empId) => navigate(`/employees/${empId}`)} />
      </ErrorBoundary>

      {/* Module 3: AI Competency Gap Intelligence (8 Core Dimensions) */}
      <ErrorBoundary isSubSection sectionTitle="AI Competency Intelligence">
        <AICompetencyIntelligenceSection />
      </ErrorBoundary>

      {/* Module 5: Floating AI HR Chat Assistant */}
      <ErrorBoundary isSubSection sectionTitle="AI Chat Assistant">
        <AIChatDrawer isManager={false} />
      </ErrorBoundary>
    </div>
  );
};

export default Dashboard;

