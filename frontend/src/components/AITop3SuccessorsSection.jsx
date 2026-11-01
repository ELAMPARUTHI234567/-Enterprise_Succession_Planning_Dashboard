import React, { useState, useEffect } from 'react';
import { 
  Award, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, 
  Sparkles, SlidersHorizontal, BookOpen, Clock, UserCheck, 
  BarChart3, RefreshCw, Layers, ExternalLink, X, ChevronRight
} from 'lucide-react';
import { aiService, roleService } from '../services/api';
import StatusBadge from './StatusBadge';

export const AITop3SuccessorsSection = ({ isManager = false, onNavigateProfile }) => {
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  
  // Comparison modal state
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [comparing, setComparing] = useState(false);

  // Shortlist action loading
  const [shortlistActionEmpId, setShortlistActionEmpId] = useState(null);

  // Load available roles
  useEffect(() => {
    let mounted = true;
    const fetchRoles = async () => {
      try {
        const fetchFn = roleService.getRoles || roleService.getAll;
        const res = await fetchFn();
        if (mounted && res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRoles(res.data);
          setSelectedRoleId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load roles for AI successor recommendations:', err);
      }
    };
    fetchRoles();
    return () => { mounted = false; };
  }, []);

  // Fetch Top 3 Successors whenever selectedRoleId or isManager changes
  const fetchSuccessors = async (isManual = false) => {
    if (!selectedRoleId) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = isManager 
        ? await aiService.getManagerTopSuccessors(selectedRoleId)
        : await aiService.getTopSuccessors(selectedRoleId);

      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Unable to retrieve successor recommendations.');
      }
    } catch (err) {
      console.error('Error fetching AI Top 3 successors:', err);
      setError('A connection or data error occurred while generating successor recommendations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuccessors();
    setSelectedCandidates([]);
  }, [selectedRoleId, isManager]);

  // Handle shortlist / nomination toggle
  const handleShortlist = async (candidate, action = 'Shortlist') => {
    setShortlistActionEmpId(candidate.employee_id);
    try {
      const nextAction = candidate.is_shortlisted ? 'Remove' : action;
      const res = await aiService.shortlistCandidate(
        candidate.employee_id,
        selectedRoleId,
        nextAction,
        `AI Top 3 Recommendation (${nextAction})`
      );
      if (res.success) {
        // Optimistically update candidate in data
        setData(prev => {
          if (!prev || !prev.top_candidates) return prev;
          return {
            ...prev,
            top_candidates: prev.top_candidates.map(c => 
              c.employee_id === candidate.employee_id 
                ? { ...c, is_shortlisted: nextAction !== 'Remove', shortlist_status: nextAction === 'Remove' ? null : nextAction }
                : c
            )
          };
        });
      }
    } catch (err) {
      console.error('Failed to update shortlist:', err);
    } finally {
      setShortlistActionEmpId(null);
    }
  };

  // Handle Candidate Selection for Comparison
  const toggleSelectCandidate = (empId) => {
    setSelectedCandidates(prev => {
      if (prev.includes(empId)) {
        return prev.filter(id => id !== empId);
      } else {
        if (prev.length >= 3) return prev; // max 3
        return [...prev, empId];
      }
    });
  };

  // Trigger side-by-side comparison
  const handleOpenComparison = async () => {
    if (selectedCandidates.length < 2) return;
    setComparing(true);
    setComparisonModalOpen(true);
    try {
      const res = await aiService.compareCandidates(selectedRoleId, selectedCandidates);
      if (res.success) {
        setComparisonData(res);
      }
    } catch (err) {
      console.error('Error comparing candidates:', err);
    } finally {
      setComparing(false);
    }
  };

  const currentRole = roles.find(r => r.id === Number(selectedRoleId)) || (data && data.role);
  const candidates = data?.top_candidates || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-8 transition-all">
      {/* Top Banner & Role Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold tracking-tight text-white">
                  AI Top 3 Eligible Successor Recommendations
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isManager ? 'Team Scope' : 'Organization-Wide'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Ranked using weighted multi-factor analytics: Competency Match (30%), Leadership Readiness (30%), 
                Role Assessment (20%), Performance (10%), and Experience (10%). Mandatory role assessment completion required.
              </p>
            </div>
          </div>

          {/* Role Dropdown & Action Controls */}
          <div className="flex items-center space-x-3 self-end md:self-center">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Target Leadership Role
              </label>
              <select
                value={selectedRoleId || ''}
                onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-w-[220px]"
              >
                {roles.length === 0 ? (
                  <option value="">Loading leadership positions...</option>
                ) : (
                  roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.role_name} ({r.department})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              onClick={() => fetchSuccessors(true)}
              disabled={refreshing || loading}
              title="Refresh Recommendations"
              className="mt-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Comparison Trigger Pill */}
        {selectedCandidates.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between animate-fadeIn">
            <span className="text-xs text-indigo-200">
              {selectedCandidates.length} candidate(s) selected for side-by-side comparative analysis.
            </span>
            <button
              onClick={handleOpenComparison}
              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Launch Side-by-Side Comparison</span>
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="h-16 bg-slate-100 rounded-lg"></div>
                <div className="h-24 bg-slate-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Evaluation Notice</p>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Transparent Notice Banner */}
            {data?.notice && (
              <div className={`p-4 rounded-xl border mb-6 flex items-start space-x-3 text-xs ${
                candidates.length === 3 
                  ? 'bg-indigo-50/70 border-indigo-200/80 text-indigo-900' 
                  : 'bg-amber-50/90 border-amber-200 text-amber-900'
              }`}>
                {candidates.length === 3 ? (
                  <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold tracking-tight">
                    {candidates.length === 3 ? 'Top 3 Successor Evaluation Complete' : 'Candidate Availability Notice'}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{data.notice}</p>
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    Governance Rule: Ineligible candidates and employees with incomplete assessments are strictly excluded.
                  </p>
                </div>
              </div>
            )}

            {/* Zero candidates state */}
            {candidates.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/60">
                <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">
                  No Eligible Successors with Completed Assessments
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  There are currently no active employees who satisfy prerequisite eligibility benchmarks 
                  and possess completed assessment results for <strong>{currentRole?.role_name}</strong>.
                </p>
                <div className="inline-flex items-center space-x-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                  <span>Schedule role assessments in the Assessments module to qualify candidates.</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map((cand) => {
                  const rankStyles = {
                    1: {
                      badge: 'bg-amber-500 text-white shadow-amber-500/30',
                      border: 'border-amber-300/80 shadow-amber-500/5 ring-1 ring-amber-400/20',
                      headerBg: 'bg-gradient-to-r from-amber-50 to-orange-50/60',
                      trophy: 'text-amber-500'
                    },
                    2: {
                      badge: 'bg-slate-400 text-white shadow-slate-400/30',
                      border: 'border-slate-300 shadow-slate-400/5',
                      headerBg: 'bg-gradient-to-r from-slate-50 to-gray-50',
                      trophy: 'text-slate-400'
                    },
                    3: {
                      badge: 'bg-amber-700 text-white shadow-amber-700/30',
                      border: 'border-amber-700/30 shadow-amber-700/5',
                      headerBg: 'bg-gradient-to-r from-amber-50/40 to-stone-50',
                      trophy: 'text-amber-700'
                    }
                  }[cand.rank] || {
                    badge: 'bg-indigo-600 text-white',
                    border: 'border-slate-200',
                    headerBg: 'bg-white',
                    trophy: 'text-indigo-600'
                  };

                  const isSelectedForCompare = selectedCandidates.includes(cand.employee_id);

                  return (
                    <div
                      key={cand.employee_id}
                      className={`relative bg-white rounded-2xl border ${rankStyles.border} shadow-md overflow-hidden flex flex-col transition-all hover:shadow-lg`}
                    >
                      {/* Card Header with Rank Pill */}
                      <div className={`p-4 border-b border-slate-100 ${rankStyles.headerBg} flex items-center justify-between`}>
                        <div className="flex items-center space-x-2.5">
                          <span className={`w-7 h-7 rounded-full ${rankStyles.badge} text-xs font-black flex items-center justify-center shadow`}>
                            #{cand.rank}
                          </span>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {cand.rank === 1 ? 'Primary Successor' : (cand.rank === 2 ? 'Secondary Successor' : 'Tertiary Successor')}
                            </span>
                            <div className="text-xs font-extrabold text-slate-800">
                              Rank Index: <span className="text-indigo-600">{cand.ranking_score}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Compare Selection Checkbox */}
                        <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] font-semibold text-slate-600 select-none bg-white/80 px-2 py-1 rounded-md border border-slate-200">
                          <input
                            type="checkbox"
                            checked={isSelectedForCompare}
                            onChange={() => toggleSelectCandidate(cand.employee_id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>Compare</span>
                        </label>
                      </div>

                      {/* Candidate Profile Details */}
                      <div className="p-5 flex-1 flex flex-col space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                              {cand.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {cand.designation} • {cand.department}
                            </p>
                            <span className="inline-block mt-0.5 text-[10px] font-mono text-slate-400">
                              {cand.employee_code}
                            </span>
                          </div>
                          <StatusBadge status={cand.readiness_level} type="readiness" />
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 block">Competency Match</span>
                            <span className="text-xs font-extrabold text-slate-900">{cand.competency_match_pct}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 block">Leadership Readiness</span>
                            <span className="text-xs font-extrabold text-indigo-700">{cand.readiness_score}%</span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 block">Role Assessment</span>
                              <span className="text-xs font-extrabold text-emerald-700">
                                {cand.assessment_score}%
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">
                              {cand.assessment_date}
                            </span>
                          </div>
                        </div>

                        {/* AI Explanation Callout */}
                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-950 leading-relaxed">
                          <div className="flex items-center space-x-1.5 text-indigo-700 font-bold mb-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Grounded Assessment</span>
                          </div>
                          <p className="text-[11px] text-indigo-900">
                            {cand.ai_explanation}
                          </p>
                        </div>

                        {/* Major Strengths */}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Verified Key Strengths
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {cand.major_strengths?.map((s, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                <span>{s}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Major Competency Gaps */}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Development Gaps
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {cand.major_gaps?.map((g, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-semibold border border-rose-100"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                                <span>{g}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Suggested Training */}
                        {cand.suggested_training && cand.suggested_training.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Targeted Mentorship
                            </span>
                            <p className="text-[11px] text-slate-600 italic">
                              • {cand.suggested_training[0]}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleShortlist(cand, 'Shortlist')}
                          disabled={shortlistActionEmpId === cand.employee_id}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                            cand.is_shortlisted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                          }`}
                        >
                          {cand.is_shortlisted ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Shortlisted</span>
                            </>
                          ) : (
                            <>
                              <Award className="w-3.5 h-3.5" />
                              <span>Shortlist Candidate</span>
                            </>
                          )}
                        </button>

                        {onNavigateProfile && (
                          <button
                            onClick={() => onNavigateProfile(cand.employee_id)}
                            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg hover:border-indigo-300 transition-colors"
                            title="View Employee Profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      {comparisonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Side-by-Side Candidate Comparison
                </h3>
                <p className="text-xs text-slate-500">
                  Evaluating candidates for <strong>{currentRole?.role_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setComparisonModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {comparing ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  Generating comparative leadership analytics...
                </div>
              ) : comparisonData ? (
                <div className="space-y-6">
                  {/* Synthesis Callout */}
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 font-medium">
                    <p className="font-bold text-indigo-900 mb-1">Comparative AI Verdict</p>
                    <p>{comparisonData.ai_comparative_summary}</p>
                  </div>

                  {/* Comparative Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">Evaluation Metric</th>
                          {comparisonData.candidates?.map(c => (
                            <th key={c.employee_id} className="p-3 font-extrabold text-slate-900 border-l border-slate-200">
                              {c.name}
                              <span className="block text-[10px] font-normal text-slate-500">{c.designation}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        <tr>
                          <td className="p-3 font-semibold text-slate-600">Readiness Score</td>
                          {comparisonData.candidates?.map(c => (
                            <td key={c.employee_id} className="p-3 border-l border-slate-100 font-black text-indigo-700">
                              {c.readiness_score}% ({c.readiness_level})
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-600">Competency Match</td>
                          {comparisonData.candidates?.map(c => (
                            <td key={c.employee_id} className="p-3 border-l border-slate-100 font-bold">
                              {c.competency_match_pct}%
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-600">Role Assessment Score</td>
                          {comparisonData.candidates?.map(c => (
                            <td key={c.employee_id} className="p-3 border-l border-slate-100 font-bold text-emerald-700">
                              {c.assessment_score}%
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-600">Experience Tenure</td>
                          {comparisonData.candidates?.map(c => (
                            <td key={c.employee_id} className="p-3 border-l border-slate-100">
                              {c.experience_years} years
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-600">Target Transition Timeline</td>
                          {comparisonData.candidates?.map(c => (
                            <td key={c.employee_id} className="p-3 border-l border-slate-100 font-bold text-slate-900">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                                {c.transition_timeline}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-600">Major Competency Gap</td>
                          {comparisonData.candidates?.map(c => (
                            <td key={c.employee_id} className="p-3 border-l border-slate-100 text-rose-700 font-medium">
                              {c.major_gap}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setComparisonModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITop3SuccessorsSection;

