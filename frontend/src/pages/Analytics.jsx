import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, Layers } from 'lucide-react';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import ReadinessPieChart from '../charts/ReadinessPieChart';
import { analyticsService } from '../services/api';

export const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getAnalytics();
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Deep HR Analytics...</p>
      </div>
    );
  }

  const deptData = analytics?.department_analytics || {};
  const compAvg = analytics?.competency_averages || {};
  const gapSeverity = analytics?.gap_severity || {};
  const scatterPoints = analytics?.performance_vs_readiness || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Enterprise HR &amp; Succession Analytics</h2>
        <p className="text-xs text-slate-500 mt-0.5">Multi-dimensional workforce analytics, gap severity metrics, and department breakdowns</p>
      </div>

      {/* Row 1: Gap Severity Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Strengths (No Gap)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{gapSeverity.Strength || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Low Gap (0-10)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{gapSeverity['Low Gap'] || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Medium Gap (11-20)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{gapSeverity['Medium Gap'] || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">High Gap (&gt;20)</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{gapSeverity['High Gap'] || 0}</p>
        </div>
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Enterprise Average Competencies</h3>
          <CompetencyBarChart
            labels={compAvg.labels}
            currentScores={compAvg.averages}
            requiredScores={compAvg.averages.map(() => 85)}
          />
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Department Employee Distribution</h3>
          <div className="space-y-4 pt-2">
            {(deptData.labels || []).map((dept, idx) => (
              <div key={dept} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{dept}</span>
                  <span>{deptData.counts[idx]} Employees • Avg Readiness: {deptData.avg_readiness[idx]}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${(deptData.counts[idx] / 20) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance vs Readiness Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Performance vs Readiness Correlation Matrix</h3>
          <p className="text-[11px] text-slate-500">Cross-evaluating performance ratings (X-axis) against computed readiness scores (Y-axis)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-3">Employee Name</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Performance Rating (X)</th>
                <th className="px-6 py-3">Computed Readiness (Y)</th>
                <th className="px-6 py-3">Readiness Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {scatterPoints.map((pt, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3 font-bold text-slate-900">{pt.name}</td>
                  <td className="px-6 py-3 text-slate-600">{pt.department}</td>
                  <td className="px-6 py-3 font-bold text-emerald-700">{pt.x}%</td>
                  <td className="px-6 py-3 font-bold text-indigo-700">{pt.y}%</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      pt.readiness_level === 'High' ? 'bg-emerald-100 text-emerald-800' :
                      pt.readiness_level === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {pt.readiness_level}
                    </span>
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

export default Analytics;
