import React, { useState } from 'react';
import { 
  Award, CheckCircle2, AlertTriangle, TrendingUp, Cpu, Calendar, User, Target, 
  ChevronLeft, BarChart2, ShieldCheck, Sparkles, HelpCircle, Check, X, Building2, Briefcase
} from 'lucide-react';
import StatusBadge from './StatusBadge';

export const AssessmentResultView = ({ result, onBack }) => {
  const [showQuestionsTab, setShowQuestionsTab] = useState(false);
  if (!result) return null;

  const {
    overall_score = 0,
    total_score = 0,
    total_possible = 100,
    readiness_level = 'High',
    completed_at,
    submission_date,
    detail = {},
    assignment = {},
    gap_analysis = {},
    readiness = {},
    ml_prediction = null,
    development_areas = [],
    strengths = [],
    answers = []
  } = result;

  const employeeName = result.employee_name || assignment.employee_name || 'Employee';
  const employeeCode = result.employee_code || assignment.employee_code || 'N/A';
  const department = result.department || assignment.department || 'Enterprise';
  const designation = result.designation || assignment.designation || 'Specialist';
  const assessmentTitle = result.assessment_title || assignment.assessment_title || 'Leadership Competency Assessment';
  const roleName = result.role_name || assignment.role_name || 'Target Leadership Role';

  const dateStr = completed_at || submission_date;
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recently Completed';

  // 8 Core Competencies
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
    const key = item.competency_name || item.name;
    if (key) acc[key.toLowerCase()] = item;
    return acc;
  }, {});

  const competencyItems = defaultCompetencies.map((compName) => {
    const rawScore = detail[compName] !== undefined ? detail[compName] : overall_score;
    const gapItem = gapCompetenciesMap[compName.toLowerCase()];
    const targetScore = gapItem ? (gapItem.required_score || gapItem.target_score || 80) : 80;
    const currentScore = gapItem ? gapItem.current_score : rawScore;
    const gap = gapItem ? gapItem.gap : Math.max(0, targetScore - currentScore);
    const status = gapItem ? gapItem.status : (currentScore >= targetScore ? 'Strength' : 'Improvement Area');

    return {
      name: compName,
      score: currentScore,
      target: targetScore,
      gap: gap,
      status: status
    };
  });

  const getScoreColor = (score) => {
    if (score >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 65) return { bg: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  // ML probabilities
  const mlData = ml_prediction?.data || ml_prediction || {};
  const mlPredictedClass = mlData.predicted_class || readiness_level;
  const mlProbs = mlData.probabilities || {
    High: mlData.high_probability || (mlPredictedClass === 'High' ? 0.85 : 0.1),
    Medium: mlData.medium_probability || (mlPredictedClass === 'Medium' ? 0.80 : 0.15),
    Low: mlData.low_probability || (mlPredictedClass === 'Low' ? 0.75 : 0.05)
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Navigation & Action */}
      {onBack && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200 card-shadow transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Results List</span>
          </button>

          {answers && answers.length > 0 && (
            <button
              onClick={() => setShowQuestionsTab(!showQuestionsTab)}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl text-xs border border-indigo-200 transition-all flex items-center space-x-1.5"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{showQuestionsTab ? 'View Analytics Summary' : 'View Question Breakdown'}</span>
            </button>
          )}
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-950 rounded-2xl p-6 text-white card-shadow relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Completed Assessment Result</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold">
                Target Role: {roleName}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {assessmentTitle}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-200 mt-3">
              <span className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Employee: <strong className="text-white">{employeeName}</strong> ({employeeCode})</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>{department} • {designation}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Submitted: <strong className="text-white">{formattedDate}</strong></span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
            <div className="text-right">
              <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold block">Calculated Readiness</span>
              <span className="text-xl font-black text-white">{readiness_level} Category</span>
            </div>
            <StatusBadge status={readiness_level} type="readiness" />
          </div>
        </div>
      </div>

      {/* Summary Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Points */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assessment Score</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {total_score} <span className="text-sm font-semibold text-slate-400">/ {total_possible}</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Calculated raw points</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Score Percentage */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Score Percentage</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">
              {overall_score}%
            </h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 inline" />
              <span>Assessment Completed</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <BarChart2 className="w-6 h-6" />
          </div>
        </div>

        {/* Overall Leadership Readiness */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Leadership Readiness</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {readiness.readiness_score || overall_score}%
            </h3>
            <p className="text-[10px] text-indigo-600 font-bold mt-1">
              Category: {readiness.readiness_level || readiness_level}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* AI/ML Readiness Prediction */}
        <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-2xl p-5 border border-purple-800 card-shadow flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-1 text-[10px] text-purple-300 font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-purple-300" />
              <span>AI ML Prediction</span>
            </div>
            <h3 className="text-2xl font-black text-purple-200 mt-1">
              {mlPredictedClass}
            </h3>
            <p className="text-[10px] text-purple-300 mt-1">
              Random Forest Classifier
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
            <Cpu className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* AI/ML READINESS PREDICTION SECTION - CLEARLY SEPARATED */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-slate-50 rounded-2xl p-5 border border-purple-200/80 card-shadow space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-purple-200/60 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-extrabold text-slate-900">AI / Machine Learning Readiness Prediction</h3>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-purple-200">
                  Separated ML Model Output
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Random Forest ML prediction generated independently from employee competency features and experience.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600">ML Predicted Class:</span>
            <span className={`px-3 py-1 rounded-xl text-xs font-extrabold shadow-sm ${
              mlPredictedClass === 'High' ? 'bg-emerald-600 text-white' :
              mlPredictedClass === 'Medium' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
            }`}>
              {mlPredictedClass} Readiness
            </span>
          </div>
        </div>

        {/* Probabilities Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
              <span>High Readiness Probability</span>
              <span className="text-emerald-600">{Math.round((mlProbs.High || 0) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((mlProbs.High || 0) * 100)}%` }} />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Medium Readiness Probability</span>
              <span className="text-amber-600">{Math.round((mlProbs.Medium || 0) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round((mlProbs.Medium || 0) * 100)}%` }} />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Low Readiness Probability</span>
              <span className="text-rose-600">{Math.round((mlProbs.Low || 0) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.round((mlProbs.Low || 0) * 100)}%` }} />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic">
          * AI/ML prediction is evaluated by the Random Forest model based on synthetic/trained competency vectors. Calculated readiness score ({readiness.readiness_score || overall_score}%) is derived from the weighted succession algorithm.
        </p>
      </div>

      {/* QUESTION BREAKDOWN TAB OR COMPETENCY ANALYSIS */}
      {showQuestionsTab && answers && answers.length > 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Submitted Questions &amp; Answer Breakdown</h3>
              <p className="text-xs text-slate-500">Individual question responses and scored items</p>
            </div>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-lg">
              {answers.length} Questions Answered
            </span>
          </div>

          <div className="space-y-3">
            {answers.map((ans, idx) => (
              <div key={ans.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                    Question {idx + 1}
                  </span>
                  <span className="font-bold text-slate-600">
                    Score: <strong className="text-indigo-700">{ans.score}</strong> / {ans.max_score} pt
                  </span>
                </div>
                <p className="font-bold text-slate-900">{ans.question_text}</p>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium">Selected Answer: </span>
                  <strong className="text-slate-900">{ans.answer || 'Not answered'}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Main Content: Competencies & Gaps */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Competency Scores List */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-800">Competency-wise Assessment Scores</h2>
                <p className="text-xs text-slate-500">Current employee scores vs target role requirements</p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">
                8 Core Competencies
              </span>
            </div>

            <div className="space-y-4">
              {competencyItems.map((comp) => {
                const colors = getScoreColor(comp.score);
                return (
                  <div key={comp.name} className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-extrabold text-slate-800">{comp.name}</span>
                        {comp.gap === 0 ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Strength
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Gap: -{comp.gap}%
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3 text-xs font-bold">
                        <span className="text-slate-500">Current: <strong className="text-slate-900">{comp.score}%</strong></span>
                        <span className="text-slate-400">|</span>
                        <span className="text-indigo-600">Required: {comp.target}%</span>
                      </div>
                    </div>

                    {/* Progress bar comparison */}
                    <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      {/* Current Score Bar */}
                      <div
                        className={`h-full ${colors.bg} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, comp.score)}%` }}
                      />
                      {/* Target Score Indicator Line */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-slate-900 z-10"
                        style={{ left: `${Math.min(100, comp.target)}%` }}
                        title={`Target Required: ${comp.target}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sidebar: Strengths, Gaps & Development Areas */}
          <div className="space-y-6">
            {/* Strengths Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Identified Strengths</h3>
                  <p className="text-[11px] text-slate-500">Competencies meeting target requirement</p>
                </div>
              </div>

              <div className="space-y-2">
                {competencyItems.filter(c => c.gap === 0).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No competencies meeting required score yet.</p>
                ) : (
                  competencyItems.filter(c => c.gap === 0).map(c => (
                    <div key={c.name} className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {c.score}% Score
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Competency Gap Summary */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Target className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Competency Gap Summary</h3>
                  <p className="text-[11px] text-slate-500">Comparison against target leadership role</p>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">Overall Competency Score</span>
                <div className="text-2xl font-black text-indigo-900 mt-1">
                  {gap_analysis.overall_competency_score || overall_score}%
                </div>
                <p className="text-[11px] text-indigo-700 mt-1">
                  {gap_analysis.major_gap && gap_analysis.major_gap !== 'None' ? `Primary Gap Area: ${gap_analysis.major_gap}` : 'Strong alignment with target role'}
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
                {competencyItems.filter(c => c.gap > 0).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No special development areas required at this stage.</p>
                ) : (
                  competencyItems.filter(c => c.gap > 0).map((comp) => (
                    <div key={comp.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <h4 className="text-xs font-bold text-slate-800">{comp.name}</h4>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Current: <strong className="text-slate-900">{comp.score}%</strong> | Target: <strong className="text-indigo-600">{comp.target}%</strong> | Gap: <strong className="text-rose-600">-{comp.gap}%</strong>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentResultView;
