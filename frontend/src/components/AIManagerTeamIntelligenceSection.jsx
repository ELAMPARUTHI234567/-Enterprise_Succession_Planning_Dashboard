import React, { useState, useEffect } from 'react';
import { 
  Users, Award, AlertTriangle, ShieldCheck, TrendingUp, 
  CheckCircle2, RefreshCw, Sparkles, Flame, Clock, UserCheck
} from 'lucide-react';
import { aiService } from '../services/api';
import StatusBadge from './StatusBadge';

export const AIManagerTeamIntelligenceSection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTeamIntelligence = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiService.getTeamIntelligence();
      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Unable to load team intelligence.');
      }
    } catch (err) {
      console.error('Error fetching team intelligence:', err);
      setError('Failed to retrieve team intelligence records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamIntelligence();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm animate-pulse mb-8 space-y-4">
        <div className="h-5 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-20 bg-slate-100 rounded-xl"></div>
          <div className="h-20 bg-slate-100 rounded-xl"></div>
          <div className="h-20 bg-slate-100 rounded-xl"></div>
          <div className="h-20 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const riskSummary = data.risk_summary || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-white tracking-tight">
                AI Team Performance & Risk Intelligence
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Direct Reports Scope
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Target Bench Role: <strong>{data.target_bench_role}</strong> • Real-time workload & risk modeling
            </p>
          </div>
        </div>

        <button
          onClick={fetchTeamIntelligence}
          title="Refresh Team Intelligence"
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors self-end sm:self-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Team Average Readiness
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-indigo-700">{data.team_readiness_avg}%</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {data.high_performers_count} high-readiness members
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Assessment Completion
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-emerald-700">{data.assessment_completion_rate}%</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {data.total_assessments_completed} of {data.total_assessments_assigned} completed
            </span>
          </div>

          <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-1">
              Burnout Risk Alerts
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-rose-600">{riskSummary.burnout_count || 0}</span>
            </div>
            <span className="text-[10px] text-rose-600 mt-1 block">
              Heavy active tasks / critical issues
            </span>
          </div>

          <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
              Retention Risk Alerts
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-amber-600">{riskSummary.retention_count || 0}</span>
            </div>
            <span className="text-[10px] text-amber-600 mt-1 block">
              High potential needing advancement
            </span>
          </div>
        </div>

        {/* AI Synthesis Summary */}
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-6 text-xs text-indigo-950 flex items-start space-x-3">
          <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-indigo-900 mb-0.5">Manager Advisory Summary</p>
            <p className="leading-relaxed">{data.ai_team_summary}</p>
          </div>
        </div>

        {/* Team Members List with Development Advisor */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Team Member</th>
                <th className="p-3">Readiness</th>
                <th className="p-3">Assessments</th>
                <th className="p-3">Workload</th>
                <th className="p-3">Risk Indicators</th>
                <th className="p-3">AI Development Advisor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {data.members?.map((m) => {
                const burnout = m.risks?.burnout?.level;
                const retention = m.risks?.retention?.level;
                const stagnation = m.risks?.stagnation?.level;

                return (
                  <tr key={m.employee_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div>
                        <p className="font-bold text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-500">{m.designation} • {m.employee_code}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-indigo-700 text-xs">{m.readiness_score}%</span>
                        <StatusBadge status={m.readiness_level} type="readiness" />
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">
                        {m.assessments_completed} / {m.assessments_assigned}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px]">
                        <span className="font-semibold text-slate-800">{m.active_tasks_count} active tasks</span>
                        {m.urgent_tasks_count > 0 && (
                          <span className="text-rose-600 block text-[10px] font-bold">({m.urgent_tasks_count} urgent)</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {burnout === 'High' && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center space-x-1">
                            <Flame className="w-3 h-3 text-rose-500" />
                            <span>Burnout Alert</span>
                          </span>
                        )}
                        {retention === 'High' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Retention Watch</span>
                          </span>
                        )}
                        {burnout !== 'High' && retention !== 'High' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Balanced</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[11px] text-slate-600 max-w-xs">
                      {m.development_advice}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AIManagerTeamIntelligenceSection;

