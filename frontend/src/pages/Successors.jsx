import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, Award, Crown, Cpu, ChevronRight, Loader2, Sparkles, 
  Sliders, ShieldCheck, AlertTriangle, Search, CheckCircle, X, ChevronDown, ChevronUp, Info, Zap
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { roleService, successorService, mlService, suitabilityService } from '../services/api';

export const Successors = () => {
  const [viewMode, setViewMode] = useState('suitability'); // 'suitability' | 'ranking'
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  
  // Baseline successors data
  const [successorData, setSuccessorData] = useState(null);
  
  // Enhanced candidate comparison data (Module 4)
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState('suitability'); // 'suitability' | 'readiness' | 'experience'
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState(null);

  // Configurable weights modal state
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [weightsForm, setWeightsForm] = useState({
    assessment_weight: 30,
    readiness_weight: 25,
    skills_weight: 20,
    projects_weight: 15,
    experience_weight: 10
  });
  const [savingWeights, setSavingWeights] = useState(false);
  
  // ML modal state
  const [loading, setLoading] = useState(true);
  const [mlLoading, setMlLoading] = useState(false);
  const [selectedMlCand, setSelectedMlCand] = useState(null);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [isMlModalOpen, setIsMlModalOpen] = useState(false);

  const initLoad = async () => {
    setLoading(true);
    try {
      const res = await roleService.getAll();
      if (res.success && res.data.length > 0) {
        setRoles(res.data);
        const initialRoleId = res.data[0].id;
        setSelectedRoleId(initialRoleId);
        
        await Promise.all([
          loadSuccessors(initialRoleId),
          loadComparison(initialRoleId),
          loadSuitabilityConfig()
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initLoad();
  }, []);

  const loadSuccessors = async (roleId) => {
    const targetId = roleId || selectedRoleId;
    if (!targetId) return;
    try {
      const res = await successorService.getByRole(targetId);
      if (res.success) {
        setSuccessorData(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadComparison = async (roleId) => {
    const targetId = roleId || selectedRoleId;
    if (!targetId) return;
    setComparisonLoading(true);
    try {
      const res = await roleService.getCandidatesComparison(targetId);
      if (res.success) {
        setComparisonData(res.data);
      }
    } catch (err) {
      console.error('Error loading candidates comparison:', err);
    } finally {
      setComparisonLoading(false);
    }
  };

  const loadSuitabilityConfig = async () => {
    try {
      const res = await suitabilityService.getConfig();
      if (res.success && res.data) {
        setWeightsForm({
          assessment_weight: res.data.assessment_weight,
          readiness_weight: res.data.readiness_weight,
          skills_weight: res.data.skills_weight,
          projects_weight: res.data.projects_weight,
          experience_weight: res.data.experience_weight
        });
      }
    } catch (err) {
      console.warn('Using default suitability weights:', err);
    }
  };

  const handleRoleChange = (e) => {
    const newRoleId = Number(e.target.value);
    setSelectedRoleId(newRoleId);
    loadSuccessors(newRoleId);
    loadComparison(newRoleId);
  };

  const handleTriggerMl = async (cand) => {
    setSelectedMlCand(cand);
    setMlPrediction(null);
    setIsMlModalOpen(true);
    setMlLoading(true);

    try {
      const res = await mlService.predictReadiness(cand.employee_id, selectedRoleId);
      if (res.success) {
        setMlPrediction(res.data);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setMlLoading(false);
    }
  };

  // Save weights
  const handleSaveWeights = async (e) => {
    e.preventDefault();
    const sum = Number(weightsForm.assessment_weight) +
      Number(weightsForm.readiness_weight) +
      Number(weightsForm.skills_weight) +
      Number(weightsForm.projects_weight) +
      Number(weightsForm.experience_weight);

    if (Math.round(sum) !== 100) {
      alert(`The total configured weight must equal exactly 100%. Current sum: ${sum}%`);
      return;
    }

    setSavingWeights(true);
    try {
      const res = await suitabilityService.updateConfig(weightsForm);
      if (res.success) {
        setIsWeightsModalOpen(false);
        loadComparison(selectedRoleId);
      }
    } catch (err) {
      alert(err.message || 'Error saving weights');
    } finally {
      setSavingWeights(false);
    }
  };

  const weightsSum = Number(weightsForm.assessment_weight || 0) +
    Number(weightsForm.readiness_weight || 0) +
    Number(weightsForm.skills_weight || 0) +
    Number(weightsForm.projects_weight || 0) +
    Number(weightsForm.experience_weight || 0);

  const rawCandidates = comparisonData?.candidates || [];

  // Filter & sort comparison candidates
  const filteredCandidates = rawCandidates.filter(c => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (c.name || '').toLowerCase().includes(query) ||
      (c.employee_code || '').toLowerCase().includes(query) ||
      (c.designation || '').toLowerCase().includes(query) ||
      (c.department || '').toLowerCase().includes(query);
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (sortBy === 'suitability') {
      const scoreA = a.suitability?.overall_suitability_score ?? -1;
      const scoreB = b.suitability?.overall_suitability_score ?? -1;
      return scoreB - scoreA;
    }
    if (sortBy === 'readiness') {
      const readA = a.readiness?.readiness_score ?? -1;
      const readB = b.readiness?.readiness_score ?? -1;
      return readB - readA;
    }
    if (sortBy === 'experience') {
      const expA = a.experience_summary?.total_experience_years ?? 0;
      const expB = b.experience_summary?.total_experience_years ?? 0;
      return expB - expA;
    }
    return 0;
  });

  const topThree = (successorData?.candidates || []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Leadership Role Suitability &amp; Succession Planning</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent, multi-dimensional candidate suitability matrix and succession pipeline evaluation.
          </p>
        </div>

        {/* Role Selector & Configuration Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">Target Role:</span>
            <select
              value={selectedRoleId}
              onChange={handleRoleChange}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsWeightsModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
            title="Configure Criteria Weights"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Configure Weights</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setViewMode('suitability')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            viewMode === 'suitability'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Comprehensive Suitability Matrix ({rawCandidates.length} Candidates)
        </button>
        <button
          onClick={() => setViewMode('ranking')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            viewMode === 'ranking'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Quick Succession Leaderboard &amp; ML
        </button>
      </div>

      {/* COMPREHENSIVE SUITABILITY MATRIX VIEW (Module 4) */}
      {viewMode === 'suitability' && (
        <div className="space-y-4">
          {/* Transparent Evaluation Disclaimer */}
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start space-x-3 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold">Transparent Evidence-Based Human-in-the-Loop Comparison</p>
              <p className="text-blue-800 mt-0.5 text-[11px] leading-relaxed">
                Calculations combine verified assessment results, competency readiness, technical skills, documented project outcomes, and professional experience according to HR-configured weights. Candidates with missing data are marked with coverage indicators. Final promotion, succession, or appointment decisions remain subject to authorized human review.
              </p>
            </div>
          </div>

          {/* Table Filters & Sorting Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search candidate name, code, title..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <span className="font-bold text-slate-500 text-[11px]">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="suitability">Overall Suitability Score</option>
                <option value="readiness">Leadership Readiness</option>
                <option value="experience">Total Experience</option>
              </select>
            </div>
          </div>

          {/* Candidates Matrix Table */}
          {comparisonLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-500">Calculating Multi-Dimensional Suitability Scores...</p>
            </div>
          ) : sortedCandidates.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No candidates matching current filters.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 card-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Candidate</th>
                      <th className="px-5 py-3.5 text-center">Suitability Score</th>
                      <th className="px-5 py-3.5 text-center">Evidence Coverage</th>
                      <th className="px-5 py-3.5">Assessments ({comparisonData?.weights?.assessment_weight || 30}%)</th>
                      <th className="px-5 py-3.5">Readiness ({comparisonData?.weights?.readiness_weight || 25}%)</th>
                      <th className="px-5 py-3.5">Skills ({comparisonData?.weights?.skills_weight || 20}%)</th>
                      <th className="px-5 py-3.5">Projects ({comparisonData?.weights?.projects_weight || 15}%)</th>
                      <th className="px-5 py-3.5">Experience ({comparisonData?.weights?.experience_weight || 10}%)</th>
                      <th className="px-5 py-3.5 text-right">Evidence Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {sortedCandidates.map((cand) => {
                      const suit = cand.suitability || {};
                      const breakdown = suit.criteria_breakdown || {};
                      const isInsufficient = suit.insufficient_data_flag;

                      return (
                        <tr key={cand.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-extrabold text-slate-900">{cand.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {cand.designation} • <span className="font-semibold text-slate-600">{cand.department}</span>
                              </p>
                            </div>
                          </td>

                          {/* Overall Suitability Score */}
                          <td className="px-5 py-3.5 text-center">
                            {isInsufficient ? (
                              <div className="inline-block px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                Insufficient Data ({suit.evidence_coverage_pct}%)
                              </div>
                            ) : (
                              <div>
                                <span className="text-base font-extrabold text-indigo-700">
                                  {suit.overall_suitability_score != null ? `${suit.overall_suitability_score}%` : 'Pending'}
                                </span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-600 rounded-full"
                                    style={{ width: `${suit.overall_suitability_score || 0}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Evidence Coverage */}
                          <td className="px-5 py-3.5 text-center">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              suit.evidence_coverage_pct >= 80
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : suit.evidence_coverage_pct >= 50
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {suit.evidence_coverage_pct}%
                            </span>
                          </td>

                          {/* Assessments */}
                          <td className="px-5 py-3.5 font-bold">
                            {breakdown.assessments?.score != null ? (
                              <span className="text-slate-800">{breakdown.assessments.score}%</span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Missing</span>
                            )}
                          </td>

                          {/* Readiness */}
                          <td className="px-5 py-3.5 font-bold">
                            {breakdown.readiness?.score != null ? (
                              <span className="text-indigo-700">{breakdown.readiness.score}%</span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Missing</span>
                            )}
                          </td>

                          {/* Skills */}
                          <td className="px-5 py-3.5">
                            {breakdown.skills?.score != null ? (
                              <div>
                                <span className="font-bold text-slate-800">{breakdown.skills.score}%</span>
                                <p className="text-[10px] text-slate-400">
                                  {cand.skill_gaps?.matched_skills?.length || 0} matched
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Missing</span>
                            )}
                          </td>

                          {/* Projects */}
                          <td className="px-5 py-3.5">
                            {breakdown.projects?.score != null ? (
                              <div>
                                <span className="font-bold text-emerald-700">{breakdown.projects.score}%</span>
                                <p className="text-[10px] text-slate-400">
                                  {cand.projects_summary?.verified_projects_count || 0} verified
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Not evaluated</span>
                            )}
                          </td>

                          {/* Experience */}
                          <td className="px-5 py-3.5 font-bold">
                            {breakdown.experience?.score != null ? (
                              <div>
                                <span className="text-slate-800">{breakdown.experience.score}%</span>
                                <p className="text-[10px] text-slate-400">
                                  {cand.experience_summary?.total_experience_years || 0} yrs
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Missing</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedCandidateDetail(cand)}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors"
                            >
                              Dossier
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK SUCCESSION RANKING & ML VIEW (Module baseline) */}
      {viewMode === 'ranking' && (
        <div className="space-y-6">
          {/* Top 3 Spotlight Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {topThree.map((cand, idx) => {
                const badgeColors = [
                  'bg-amber-500 text-amber-950 border-amber-300', // Gold
                  'bg-slate-300 text-slate-900 border-slate-200',  // Silver
                  'bg-amber-700 text-amber-100 border-amber-600'   // Bronze
                ];
                return (
                  <div key={cand.employee_id} className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow card-hover relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border ${badgeColors[idx]}`}>
                          #{idx + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{cand.name}</h3>
                          <p className="text-[10px] text-slate-500">{cand.designation}</p>
                        </div>
                      </div>
                      <Crown className={`w-5 h-5 ${idx === 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                    </div>

                    <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Readiness Score:</span>
                        <span className="text-base font-extrabold text-indigo-700">{cand.readiness_score}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Readiness Level:</span>
                        <StatusBadge status={cand.readiness_level} type="readiness" />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Major Gap:</span>
                        <span className="font-bold text-rose-600">{cand.major_gap}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTriggerMl(cand)}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Run Random Forest ML</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Leaderboard */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Complete Candidate Succession Leaderboard</h3>
                <p className="text-[11px] text-slate-500">Target Role: {successorData?.role_name} ({successorData?.department})</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{(successorData?.candidates || []).length} Candidates</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="px-6 py-3.5">Rank</th>
                    <th className="px-6 py-3.5">Employee Candidate</th>
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5">Competency (40%)</th>
                    <th className="px-6 py-3.5">Performance (25%)</th>
                    <th className="px-6 py-3.5">Experience (15%)</th>
                    <th className="px-6 py-3.5">Leadership (20%)</th>
                    <th className="px-6 py-3.5">Readiness Score</th>
                    <th className="px-6 py-3.5">Readiness Level</th>
                    <th className="px-6 py-3.5 text-right">ML Prediction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(successorData?.candidates || []).map((cand) => (
                    <tr key={cand.employee_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-extrabold text-slate-900">#{cand.rank}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900">{cand.name}</p>
                          <p className="text-[10px] text-slate-500">{cand.designation} • {cand.employee_code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{cand.department}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{cand.competency_score}%</td>
                      <td className="px-6 py-4 font-bold text-emerald-700">{cand.performance_score}%</td>
                      <td className="px-6 py-4 font-bold text-slate-700">{cand.experience_score}%</td>
                      <td className="px-6 py-4 font-bold text-indigo-700">{cand.leadership_score}%</td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-indigo-700 text-sm">{cand.readiness_score}%</span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={cand.readiness_level} type="readiness" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleTriggerMl(cand)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 ml-auto"
                        >
                          <Cpu className="w-3 h-3" />
                          <span>Run ML</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURE EVALUATION WEIGHTS MODAL */}
      <Modal 
        isOpen={isWeightsModalOpen} 
        onClose={() => setIsWeightsModalOpen(false)} 
        title="Configure Suitability Scoring Criteria Weights"
      >
        <form onSubmit={handleSaveWeights} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Define organizational evaluation weights across the 5 leadership dimensions. The total configured weight must sum to exactly 100%:
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Existing Assessment Results</span>
                <span className="text-indigo-600">{weightsForm.assessment_weight}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={weightsForm.assessment_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, assessment_weight: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Leadership Competency &amp; Readiness</span>
                <span className="text-indigo-600">{weightsForm.readiness_weight}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={weightsForm.readiness_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, readiness_weight: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Technical Skills &amp; Role Skill Match</span>
                <span className="text-indigo-600">{weightsForm.skills_weight}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={weightsForm.skills_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, skills_weight: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Project Experience &amp; Verified Outcomes</span>
                <span className="text-indigo-600">{weightsForm.projects_weight}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={weightsForm.projects_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, projects_weight: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Professional &amp; Current Company Tenure</span>
                <span className="text-indigo-600">{weightsForm.experience_weight}%</span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={weightsForm.experience_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, experience_weight: Number(e.target.value) })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-extrabold text-xs">
            <span>Total Configured Weight:</span>
            <span className={weightsSum === 100 ? 'text-emerald-600' : 'text-rose-600'}>
              {weightsSum}% {weightsSum === 100 ? '✓ (Valid)' : '✗ (Must equal 100%)'}
            </span>
          </div>

          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsWeightsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={weightsSum !== 100 || savingWeights}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              {savingWeights ? 'Saving...' : 'Apply Scoring Model'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CANDIDATE EVIDENCE DOSSIER MODAL */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Candidate Evidence Dossier</span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">{selectedCandidateDetail.name}</h3>
                <p className="text-xs text-slate-500">{selectedCandidateDetail.designation} • {selectedCandidateDetail.department}</p>
              </div>
              <button
                onClick={() => setSelectedCandidateDetail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Suitability Score Summary */}
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Overall Suitability Score</p>
                <p className="text-2xl font-black text-indigo-950 mt-0.5">
                  {selectedCandidateDetail.suitability?.overall_suitability_score != null 
                    ? `${selectedCandidateDetail.suitability.overall_suitability_score}%` 
                    : 'Insufficient Data'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Evidence Coverage: <strong>{selectedCandidateDetail.suitability?.evidence_coverage_pct}%</strong>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Readiness Status</p>
                <StatusBadge status={selectedCandidateDetail.readiness?.readiness_level} type="readiness" />
              </div>
            </div>

            {/* Missing criteria warning if any */}
            {selectedCandidateDetail.suitability?.missing_criteria?.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <p className="font-bold">Missing or Unverified Criteria:</p>
                <p className="text-[11px] mt-0.5">
                  {selectedCandidateDetail.suitability.missing_criteria.join(', ')}
                </p>
              </div>
            )}

            {/* Technical Skills Matching */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Technical Skill Requirements Match
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-bold text-emerald-700 text-[11px] mb-1">
                    Matched Skills ({selectedCandidateDetail.skill_gaps?.matched_skills?.length || 0})
                  </p>
                  <div className="space-y-1">
                    {(selectedCandidateDetail.skill_gaps?.matched_skills || []).map((ms, idx) => (
                      <p key={idx} className="text-[11px] text-slate-600">
                        • {ms.skill_name} (Proficiency Level {ms.employee_proficiency} / {ms.required_proficiency})
                      </p>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-bold text-rose-700 text-[11px] mb-1">
                    Skill Gaps / Missing ({selectedCandidateDetail.skill_gaps?.below_requirement_skills?.length || 0})
                  </p>
                  <div className="space-y-1">
                    {(selectedCandidateDetail.skill_gaps?.below_requirement_skills || []).map((bg, idx) => (
                      <p key={idx} className="text-[11px] text-slate-600">
                        • {bg.skill_name} (Current: {bg.employee_proficiency}, Required: {bg.required_proficiency})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Projects Summary */}
            <div className="space-y-2 text-xs">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Project Experience &amp; Outcomes
              </h4>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span>Total Projects: <strong>{selectedCandidateDetail.projects_summary?.total_projects || 0}</strong></span>
                <span>Verified by HR: <strong>{selectedCandidateDetail.projects_summary?.verified_projects_count || 0}</strong></span>
                <span>Avg Verified Success Rate: <strong>{selectedCandidateDetail.projects_summary?.verified_avg_success_rate != null ? `${selectedCandidateDetail.projects_summary.verified_avg_success_rate}%` : 'Not evaluated'}</strong></span>
              </div>
            </div>

            {/* Recommended Development Actions */}
            {selectedCandidateDetail.skill_gaps?.recommended_activities?.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Suggested Development Activities</span>
                </h4>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  {selectedCandidateDetail.skill_gaps.recommended_activities.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCandidateDetail(null)}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ML Prediction Modal */}
      <Modal isOpen={isMlModalOpen} onClose={() => setIsMlModalOpen(false)} title={`Random Forest ML Readiness: ${selectedMlCand?.name}`}>
        {mlLoading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-500">Executing Random Forest inference model...</p>
          </div>
        ) : mlPrediction ? (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Predicted Readiness Class</p>
                <h3 className="text-xl font-black mt-0.5">{mlPrediction.predicted_class} Readiness</h3>
              </div>
              <Sparkles className="w-6 h-6 text-indigo-300" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Class Probabilities Distribution:</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-emerald-800">High</p>
                  <p className="text-lg font-extrabold text-emerald-700">{Math.round(mlPrediction.probabilities.High * 100)}%</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-amber-800">Medium</p>
                  <p className="text-lg font-extrabold text-amber-700">{Math.round(mlPrediction.probabilities.Medium * 100)}%</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-rose-800">Low</p>
                  <p className="text-lg font-extrabold text-rose-700">{Math.round(mlPrediction.probabilities.Low * 100)}%</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
              {mlPrediction.disclaimer}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default Successors;
