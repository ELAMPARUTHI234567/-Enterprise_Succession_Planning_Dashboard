import React from 'react';
import { Award, CheckCircle2, AlertTriangle, TrendingUp, Cpu, Calendar, User, Target, ChevronLeft, BarChart2, ShieldCheck } from 'lucide-react';
import StatusBadge from './StatusBadge';

export const AssessmentResultView = ({ result, onBack }) => {
  if (!result) return null;

  const {
    overall_score = 0,
    total_score = 0,
    total_possible = 100,
    readiness_level = 'High',
    completed_at,
    detail = {},
    assignment = {},
    gap_analysis = {},
    readiness = {},
    development_areas = []
  } = result;

  const formattedDate = completed_at
    ? new Date(completed_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recently Completed';

  // Extract all 8 default competencies or from detail/gap_analysis
  const defaultCompetencies = [
    'Leadership',
    'Communication',
    'Decision Making',
    'Team Management',
    'Strategic Thinking',
    'Problem Solving',
    'Adaptability',
    'Technical Knowledge'
  ];

  const gapCompetenciesMap = (gap_analysis.competencies || []).reduce((acc, item) => {
    acc[item.name] = item;
    return acc;
  }, {});

  const competencyItems = defaultCompetencies.map((compName) => {
    const rawScore = detail[compName] !== undefined ? detail[compName] : overall_score;
    const gapItem = gapCompetenciesMap[compName];
    const targetScore = gapItem ? gapItem.target_score : 85;
    const currentScore = gapItem ? gapItem.current_score : rawScore;
    const gap = gapItem ? gapItem.gap : Math.max(0, targetScore - currentScore);

    return {
      name: compName,
      score: currentScore,
      target: targetScore,
      gap: gap
    };
  });

  const getScoreColor = (score) => {
    if (score >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 65) return { bg: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Navigation & Action */}
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white px-3 py-2 rounded-xl border border-slate-200 card-shadow transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Assessments</span>
        </button>
      )}

      {/* Hero Header Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white card-shadow relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Assessment Completed &amp; Processed</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {assignment.assessment_title || 'Leadership & Competency Assessment'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-200 mt-2">
              <span className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Employee: <strong className="text-white">{assignment.employee_name || 'Authenticated Employee'}</strong></span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Submitted: <strong className="text-white">{formattedDate}</strong></span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
            <div className="text-right">
              <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold block">Overall Readiness</span>
              <span className="text-lg font-black text-white">{readiness_level}</span>
            </div>
            <StatusBadge status={readiness_level} type="readiness" />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Score */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Score</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {total_score} <span className="text-sm font-semibold text-slate-400">/ {total_possible}</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Raw points calculated from answers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Overall Percentage */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Score Percentage</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">
              {overall_score}%
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 inline" />
              <span>Threshold Passed</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <BarChart2 className="w-6 h-6" />
          </div>
        </div>

        {/* Leadership Readiness */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Leadership Readiness</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {readiness.readiness_score || overall_score}%
            </h3>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">
              Level: <span className="text-indigo-600">{readiness.readiness_level || readiness_level}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* ML Prediction */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Random Forest</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {readiness_level}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">ML Succession Classifier</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Cpu className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content: Competencies & Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Competency Scores List */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Competency-wise Assessment Scores</h2>
              <p className="text-xs text-slate-500">Evaluated competency scores based on submitted responses</p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">
              8 Core Competencies
            </span>
          </div>

          <div className="space-y-4">
            {competencyItems.map((comp) => {
              const colors = getScoreColor(comp.score);
              return (
                <div key={comp.name} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">{comp.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors.badge}`}>
                        {comp.score}%
                      </span>
                      {comp.gap > 0 && (
                        <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Gap: -{comp.gap}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${colors.bg} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, comp.score)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                    <span>Achieved: {comp.score}%</span>
                    <span>Target Required: {comp.target}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Gaps & Development Areas */}
        <div className="space-y-6">
          {/* Competency Gap Analysis */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Target className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">Competency Gap Summary</h3>
                <p className="text-[11px] text-slate-500">Comparison against target leadership role</p>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">Overall Competency Rating</span>
              <div className="text-2xl font-black text-indigo-900 mt-1">
                {gap_analysis.overall_competency_score || overall_score}%
              </div>
              <p className="text-[11px] text-indigo-700 mt-1">
                {gap_analysis.major_gap ? `Primary Focus: ${gap_analysis.major_gap}` : 'Strong alignment with target role'}
              </p>
            </div>

            {/* Gap List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Competency Gaps Identified:</span>
              {competencyItems.filter(c => c.gap > 0).length === 0 ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>No critical competency gaps! Employee meets target requirements.</span>
                </div>
              ) : (
                competencyItems.filter(c => c.gap > 0).map(c => (
                  <div key={c.name} className="flex items-center justify-between p-2.5 bg-rose-50/50 rounded-xl border border-rose-100 text-xs">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                      -{c.gap}% Gap
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Development Areas */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">Target Development Areas</h3>
                <p className="text-[11px] text-slate-500">Recommended training &amp; mentorship goals</p>
              </div>
            </div>

            <div className="space-y-3">
              {development_areas.length === 0 && competencyItems.filter(c => c.gap > 0).length === 0 ? (
                <p className="text-xs text-slate-500 italic">No special development areas required at this stage.</p>
              ) : (
                (development_areas.length > 0 ? development_areas : competencyItems.filter(c => c.gap > 0)).map((area) => (
                  <div key={area.competency || area.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <h4 className="text-xs font-bold text-slate-800">{area.competency || area.name}</h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Current Score: <strong className="text-slate-900">{area.current_score || area.score}%</strong> | Target: <strong className="text-indigo-600">{area.target_score || area.target}%</strong>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentResultView;
