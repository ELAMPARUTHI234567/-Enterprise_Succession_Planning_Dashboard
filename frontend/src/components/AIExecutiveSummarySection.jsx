import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, TrendingUp, Users, Award, 
  ArrowRight, Sparkles, RefreshCw, Layers, CheckCircle2 
} from 'lucide-react';
import { aiService } from '../services/api';

export const AIExecutiveSummarySection = ({ onNavigateAssessments, onNavigateSuccessors }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiService.getWorkforceSummary();
      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Unable to generate workforce executive summary.');
      }
    } catch (err) {
      console.error('Error fetching workforce executive summary:', err);
      setError('Failed to load executive intelligence summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
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

  if (error || !data) {
    return null; // Gracefully degrade if fails
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-6 border border-indigo-900/50 shadow-lg mb-8 relative overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                AI Executive Workforce & Succession Summary
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Enterprise Grounded
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Live intelligence synthesized across {data.total_leadership_roles} leadership roles and {data.total_workforce_evaluated} active personnel.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSummary}
          title="Refresh Executive Intelligence"
          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors self-end sm:self-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 4 Metric Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 relative z-10">
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Succession Coverage Ratio
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-indigo-400">
              {data.coverage_ratio_pct}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {data.covered_roles_count} of {data.total_leadership_roles} roles covered
          </span>
        </div>

        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Workforce Average Readiness
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-emerald-400">
              {data.average_workforce_readiness_pct}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Across validated leadership competencies
          </span>
        </div>

        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Roles at Risk
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className={`text-2xl font-black ${data.at_risk_roles_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {data.at_risk_roles_count}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Lacking verified ready successors
          </span>
        </div>

        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/60 rounded-xl p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Succession Bench Health
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white">
              {data.coverage_ratio_pct >= 70 ? 'Strong' : 'Moderate'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Active pipeline governance
          </span>
        </div>
      </div>

      {/* Strategic Guidance & Urgent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        {/* Strategic Guidance */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>AI Strategic Succession Directives</span>
          </h4>
          <ul className="space-y-2">
            {data.strategic_recommendations?.map((rec, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Priority Urgent Alerts */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Succession Risk Alerts ({data.urgent_alerts?.length || 0})</span>
          </h4>
          {data.urgent_alerts && data.urgent_alerts.length > 0 ? (
            <div className="space-y-2">
              {data.urgent_alerts.map((alert, idx) => (
                <div 
                  key={idx}
                  className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between"
                >
                  <div className="pr-2">
                    <p className="font-bold text-amber-300 text-[11px]">{alert.title}</p>
                    <p className="text-[10px] text-slate-300 line-clamp-1">{alert.description}</p>
                  </div>
                  {onNavigateAssessments && (
                    <button
                      onClick={onNavigateAssessments}
                      className="whitespace-nowrap px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[10px] transition-colors flex items-center space-x-1"
                    >
                      <span>Action</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No critical leadership alerts active.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIExecutiveSummarySection;
