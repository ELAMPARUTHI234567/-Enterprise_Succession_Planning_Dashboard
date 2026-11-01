import React, { useState, useEffect } from 'react';
import { 
  BarChart3, AlertTriangle, CheckCircle2, TrendingUp, 
  Sparkles, RefreshCw, Layers, ArrowRight, BookOpen
} from 'lucide-react';
import { aiService } from '../services/api';

export const AICompetencyIntelligenceSection = ({ managerId = null }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCompetencyData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiService.getCompetencyIntelligence(managerId);
      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Unable to load competency intelligence.');
      }
    } catch (err) {
      console.error('Error fetching competency intelligence:', err);
      setError('Failed to retrieve competency benchmark intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetencyData();
  }, [managerId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm animate-pulse mb-8 space-y-4">
        <div className="h-5 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !data.dimensions) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                AI Competency Gap Intelligence (8 Core Dimensions)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                {data.scope}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated across {data.total_employees} active personnel against leadership benchmarks.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCompetencyData}
          title="Refresh Competency Intelligence"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors self-end sm:self-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6">
        {/* AI Narrative Callout */}
        {data.ai_insights && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl mb-6 text-xs text-indigo-950 flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-indigo-900 mb-0.5">Workforce Capability Insights</p>
              <p className="leading-relaxed">{data.ai_insights}</p>
            </div>
          </div>
        )}

        {/* 8 Dimension Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {data.dimensions.map((dim) => {
            const isCritical = dim.severity === 'High';
            const isModerate = dim.severity === 'Medium';
            const isStrength = dim.status === 'Strength';

            const severityStyles = isCritical 
              ? 'border-rose-200 bg-rose-50/20 text-rose-900'
              : isModerate
              ? 'border-amber-200 bg-amber-50/20 text-amber-900'
              : 'border-emerald-200 bg-emerald-50/20 text-emerald-900';

            const progressColor = isCritical
              ? 'bg-rose-500'
              : isModerate
              ? 'bg-amber-500'
              : 'bg-emerald-500';

            return (
              <div 
                key={dim.competency_id}
                className={`p-4 rounded-xl border ${severityStyles} flex flex-col justify-between transition-all hover:shadow-sm`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {dim.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      isCritical ? 'bg-rose-100 text-rose-800' : isModerate ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {dim.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[11px] mb-1 font-semibold text-slate-600">
                      <span>Avg: {dim.current_score}/100</span>
                      <span className="text-slate-400">Target: {dim.target_benchmark}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, (dim.current_score / dim.target_benchmark) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Gap metric */}
                  <div className="text-[10px] text-slate-500 flex items-center justify-between mb-2">
                    <span>Deficit Gap:</span>
                    <span className={`font-bold ${isCritical ? 'text-rose-700' : isModerate ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {dim.gap > 0 ? `-${dim.gap} pts` : 'Target Met'}
                    </span>
                  </div>
                </div>

                {/* Training Pill */}
                <div className="pt-2 border-t border-slate-100/80">
                  <p className="text-[10px] text-slate-600 font-medium line-clamp-2 leading-tight">
                    <span className="font-bold text-slate-700">Intervention:</span> {dim.recommended_training}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Department Breakdown if available */}
        {data.department_breakdown && Object.keys(data.department_breakdown).length > 0 && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Department Competency Benchmarks
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(data.department_breakdown).map(([dept, info]) => (
                <div key={dept} className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block truncate">{dept}</span>
                  <div className="flex items-baseline space-x-1.5 mt-1">
                    <span className="text-sm font-extrabold text-indigo-700">{info.average_score}</span>
                    <span className="text-[10px] text-slate-400">/ 100 avg</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {info.employee_count} personnel evaluated
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICompetencyIntelligenceSection;

