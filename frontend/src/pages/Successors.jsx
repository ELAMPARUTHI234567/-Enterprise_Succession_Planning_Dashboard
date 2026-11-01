import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, Award, Crown, Cpu, ChevronRight, Loader2, Sparkles, 
  Sliders, ShieldCheck, AlertTriangle, Search, CheckCircle, X, ChevronDown, ChevronUp, Info, 
  Zap, Briefcase, FileText, CheckCircle2, Clock, AlertCircle, Filter, ExternalLink, Calendar,
  BarChart2, Star, CheckSquare, Layers, HelpCircle, Users
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { ManagerVacancySection } from '../components/ManagerVacancySection';
import { roleService, successorService, mlService, suitabilityService } from '../services/api';

export const Successors = () => {
  const [viewMode, setViewMode] = useState('shortlist'); // 'shortlist' | 'pre_assessment' | 'matrix' | 'vacancies'
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  
  // Baseline successors data for quick ranking
  const [successorData, setSuccessorData] = useState(null);
  
  // Enhanced candidate comparison data
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState('suitability'); // 'suitability' | 'assessment' | 'projects' | 'skills' | 'experience' | 'readiness'
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterAssessmentStatus, setFilterAssessmentStatus] = useState('all'); // 'all' | 'completed' | 'pending'
  const [filterMandatorySkills, setFilterMandatorySkills] = useState('all'); // 'all' | 'eligible' | 'missing'
  const [filterCoverage, setFilterCoverage] = useState('all'); // 'all' | 'sufficient' | 'insufficient'
  const [highlightedCandidateIds, setHighlightedCandidateIds] = useState([]);
  const [activeHighlightLabel, setActiveHighlightLabel] = useState('');
  
  // Pre-Assessment Eligibility State
  const [preAssessmentData, setPreAssessmentData] = useState(null);
  const [preAssessmentLoading, setPreAssessmentLoading] = useState(false);
  const [preAssessmentSearch, setPreAssessmentSearch] = useState('');
  const [preAssessmentStatusFilter, setPreAssessmentStatusFilter] = useState('all'); // 'all' | 'eligible' | 'not_eligible' | 'insufficient_data'
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleCandidate, setScheduleCandidate] = useState(null);

  // Configurable Role Eligibility Thresholds Modal State
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholdConfig, setThresholdConfig] = useState({
    min_experience_years: 3.0,
    min_company_tenure_months: 6,
    min_project_success_rate: 70.0,
    min_verified_projects: 0,
    require_verified_projects: false,
    min_skill_match_pct: 60.0,
    require_all_mandatory_skills: true,
    min_competency_score: 60.0,
    min_evidence_coverage_pct: 40.0,
    assessment_pass_score: 70.0
  });
  const [savingThresholdConfig, setSavingThresholdConfig] = useState(false);

  // Evidence dossier modal state
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState(null);
  const [dossierTab, setDossierTab] = useState('overview'); // 'overview' | 'assessments' | 'projects' | 'skills' | 'experience'

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
          loadSuitabilityConfig(),
          loadEligibilityConfig(initialRoleId),
          loadPreAssessmentCandidates(initialRoleId)
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

  const loadComparison = async (roleId, sortParam) => {
    const targetId = roleId || selectedRoleId;
    if (!targetId) return;
    setComparisonLoading(true);
    try {
      const currentSort = sortParam !== undefined ? sortParam : sortBy;
      const res = await roleService.getCandidatesComparison(targetId, { sort_by: currentSort });
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

  const loadEligibilityConfig = async (roleId) => {
    const targetId = roleId || selectedRoleId;
    if (!targetId) return;
    try {
      const res = await roleService.getEligibilityConfig(targetId);
      if (res?.success && res?.data?.config) {
        setThresholdConfig(res.data.config);
      }
    } catch (err) {
      console.error('Error loading role eligibility config:', err);
    }
  };

  const loadPreAssessmentCandidates = async (roleId) => {
    const targetId = roleId || selectedRoleId;
    if (!targetId) return;
    setPreAssessmentLoading(true);
    try {
      const res = await roleService.getPreAssessmentCandidates(targetId);
      if (res?.success && res?.data) {
        setPreAssessmentData(res.data);
      }
    } catch (err) {
      console.error('Error loading pre-assessment candidates:', err);
    } finally {
      setPreAssessmentLoading(false);
    }
  };

  const handleRoleChange = (e) => {
    const newRoleId = Number(e.target.value);
    setSelectedRoleId(newRoleId);
    setHighlightedCandidateIds([]);
    setActiveHighlightLabel('');
    loadSuccessors(newRoleId);
    loadComparison(newRoleId);
    loadEligibilityConfig(newRoleId);
    loadPreAssessmentCandidates(newRoleId);
  };

  const handleSaveThresholdConfig = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingThresholdConfig(true);
    try {
      const res = await roleService.updateEligibilityConfig(selectedRoleId, thresholdConfig);
      if (res?.success) {
        setIsThresholdModalOpen(false);
        await Promise.all([
          loadEligibilityConfig(selectedRoleId),
          loadPreAssessmentCandidates(selectedRoleId),
          loadComparison(selectedRoleId)
        ]);
      }
    } catch (err) {
      alert(err.message || 'Error updating role eligibility configuration');
    } finally {
      setSavingThresholdConfig(false);
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    loadComparison(selectedRoleId, newSort);
  };

  const handleOpenDossier = (cand) => {
    setSelectedCandidateDetail(cand);
    setDossierTab('overview');
  };

  const handleCardClick = (employeeIds, filterType, label = '') => {
    if (employeeIds) {
      const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds];
      setHighlightedCandidateIds(ids);
      setActiveHighlightLabel(label);
      if (ids.length > 0) {
        const el = document.getElementById(`candidate-row-${ids[0]}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } else if (filterType) {
      setFilterCoverage(filterType);
      setActiveHighlightLabel(label || (filterType === 'sufficient' ? 'Eligible Candidates (Coverage >= 40%)' : 'Needs Evidence (Coverage < 40%)'));
    }
  };

  const handleTriggerMl = async (cand) => {
    setSelectedMlCand(cand);
    setMlPrediction(null);
    setIsMlModalOpen(true);
    setMlLoading(true);

    try {
      const res = await mlService.predictReadiness(cand.employee_id || cand.id, selectedRoleId);
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
    if (e && e.preventDefault) e.preventDefault();
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

  const rawCandidates = comparisonData?.candidates || [];

  // Extract unique departments for filter dropdown
  const uniqueDepartments = Array.from(new Set(rawCandidates.map(c => c.department).filter(Boolean)));

  // Filter candidates
  const filteredCandidates = rawCandidates.filter(c => {
    const name = c.employee_name || c.name || '';
    const code = c.employee_code || '';
    const desig = c.designation || '';
    const dept = c.department || '';

    // Search query
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchSearch = name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        desig.toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    // Department filter
    if (filterDepartment !== 'All' && dept !== filterDepartment) {
      return false;
    }

    // Assessment status filter
    if (filterAssessmentStatus === 'completed' && c.assessment_score === null) {
      return false;
    }
    if (filterAssessmentStatus === 'pending' && c.assessment_score !== null) {
      return false;
    }

    // Mandatory skills filter
    if (filterMandatorySkills === 'eligible') {
      const missingMandatory = c.criteria_scores?.skills?.missing_mandatory || [];
      if (missingMandatory.length > 0) return false;
    }
    if (filterMandatorySkills === 'missing') {
      const missingMandatory = c.criteria_scores?.skills?.missing_mandatory || [];
      if (missingMandatory.length === 0) return false;
    }

    // Coverage filter
    if (filterCoverage === 'sufficient' && !c.has_sufficient_data) {
      return false;
    }
    if (filterCoverage === 'insufficient' && c.has_sufficient_data) {
      return false;
    }

    return true;
  });

  // Client-side numeric sort fallback ensuring 100 > 80 > 9
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (sortBy === 'assessment') {
      const scoreA = a.assessment_score != null ? parseFloat(a.assessment_score) : -1;
      const scoreB = b.assessment_score != null ? parseFloat(b.assessment_score) : -1;
      return scoreB - scoreA;
    }
    if (sortBy === 'projects') {
      const rateA = a.project_summary?.average_verified_success_rate ?? a.project_score ?? -1;
      const rateB = b.project_summary?.average_verified_success_rate ?? b.project_score ?? -1;
      return rateB - rateA;
    }
    if (sortBy === 'skills') {
      const skillA = a.skill_score != null ? parseFloat(a.skill_score) : -1;
      const skillB = b.skill_score != null ? parseFloat(b.skill_score) : -1;
      return skillB - skillA;
    }
    if (sortBy === 'experience') {
      const expA = a.experience_summary?.total_professional_experience_years ?? a.experience_score ?? -1;
      const expB = b.experience_summary?.total_professional_experience_years ?? b.experience_score ?? -1;
      return expB - expA;
    }
    if (sortBy === 'readiness') {
      const readA = a.readiness_score != null ? parseFloat(a.readiness_score) : -1;
      const readB = b.readiness_score != null ? parseFloat(b.readiness_score) : -1;
      return readB - readA;
    }
    // Default: suitability_score
    const suffA = a.has_sufficient_data ? 1 : 0;
    const suffB = b.has_sufficient_data ? 1 : 0;
    if (suffA !== suffB) return suffB - suffA;
    const suitA = a.suitability_score != null ? parseFloat(a.suitability_score) : -1;
    const suitB = b.suitability_score != null ? parseFloat(b.suitability_score) : -1;
    return suitB - suitA;
  });

  const weights = comparisonData?.weights || weightsForm;
  const analysisSummary = comparisonData?.role_analysis_summary || {};
  const currentRole = roles.find(r => r.id === selectedRoleId) || { role_name: 'Target Leadership Role', department: 'Leadership' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Leadership Role Suitability &amp; Succession Planning</span>
            <span className="text-[10px] uppercase font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Evidence-Based
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Transparent, multi-dimensional candidate suitability matrix, real assessment scores, project success rates, and competency gap evaluation.
          </p>
        </div>

        {/* Role Selector & Configuration Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm">
            <Award className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">Role:</span>
            <select
              value={selectedRoleId || ''}
              onChange={handleRoleChange}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {roles.length === 0 ? (
                <option value="">Loading leadership positions...</option>
              ) : (
                roles.map(r => (
                  <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => setIsThresholdModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all border border-indigo-200 shadow-sm"
            title="Configure Role-Specific Eligibility Thresholds"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Configure Role Thresholds</span>
          </button>

          <button
            onClick={() => setIsWeightsModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            title="Configure Criteria Weights"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Configure Weights (100%)</span>
          </button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS (SECTION 7: Driven entirely by real database records) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Card 1: Highest Assessment Score */}
        <div
          onClick={() => {
            const tied = comparisonData?.highest_assessment_scorer?.tied_candidates;
            const ids = tied && tied.length > 0 
              ? tied.map(c => c.employee_id) 
              : (comparisonData?.highest_assessment_scorer?.employee_id ? [comparisonData.highest_assessment_scorer.employee_id] : []);
            handleCardClick(ids, null, 'Highest Assessment Scorer(s)');
          }}
          className="p-3.5 bg-white rounded-2xl border border-amber-200/80 shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden"
          title={
            comparisonData?.highest_assessment_scorer?.tied_candidates?.length > 1
              ? `Tied: ${comparisonData.highest_assessment_scorer.tied_candidates.map(c => c.employee_name).join(', ')}`
              : 'Click to highlight top assessment scorer'
          }
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Top Assessment</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900">
              {comparisonData?.highest_assessment_scorer?.score != null 
                ? `${comparisonData.highest_assessment_scorer.score}%` 
                : 'None'}
            </div>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5" title={comparisonData?.highest_assessment_scorer?.employee_name}>
              {comparisonData?.highest_assessment_scorer?.employee_name || 'No Completed Assessments'}
            </p>
            <p className="text-[10px] text-amber-600 font-semibold mt-1">
              {comparisonData?.highest_assessment_scorer?.count > 1 
                ? `${comparisonData.highest_assessment_scorer.count} Candidates Tied (Rank #1)` 
                : 'Verified Latest Attempt'}
            </p>
          </div>
        </div>

        {/* Card 2: Strongest Verified Project Performance */}
        <div
          onClick={() => {
            const eid = comparisonData?.highest_project_performer?.employee_id;
            if (eid) handleCardClick([eid], null, 'Strongest Project Performer');
          }}
          className="p-3.5 bg-white rounded-2xl border border-emerald-200/80 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Top Project Performer</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900">
              {comparisonData?.highest_project_performer?.rate != null 
                ? `${comparisonData.highest_project_performer.rate}%` 
                : 'N/A'}
            </div>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5" title={comparisonData?.highest_project_performer?.employee_name}>
              {comparisonData?.highest_project_performer?.employee_name || 'No Evaluated Projects'}
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
              {comparisonData?.highest_project_performer?.is_verified ? 'HR/Supervisor Verified' : 'Self-Reported'}
            </p>
          </div>
        </div>

        {/* Card 3: Best Role Skill Match */}
        <div
          onClick={() => {
            const eid = comparisonData?.best_skill_matcher?.employee_id;
            if (eid) handleCardClick([eid], null, 'Best Role Skill Match');
          }}
          className="p-3.5 bg-white rounded-2xl border border-indigo-200/80 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Best Skill Match</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900">
              {comparisonData?.best_skill_matcher?.score != null 
                ? `${comparisonData.best_skill_matcher.score}%` 
                : 'N/A'}
            </div>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5" title={comparisonData?.best_skill_matcher?.employee_name}>
              {comparisonData?.best_skill_matcher?.employee_name || 'No Skills Mapped'}
            </p>
            <p className="text-[10px] text-indigo-600 font-semibold mt-1">
              1–5 Proficiency Scale
            </p>
          </div>
        </div>

        {/* Card 4: Highest Overall Suitability */}
        <div
          onClick={() => {
            const eid = comparisonData?.highest_overall_suitability?.employee_id;
            if (eid) handleCardClick([eid], null, 'Highest Overall Suitability');
          }}
          className="p-3.5 bg-white rounded-2xl border border-purple-200/80 shadow-sm hover:shadow-md hover:border-purple-400 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full -mr-4 -mt-4" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">Highest Suitability</span>
            <Crown className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-purple-900">
              {comparisonData?.highest_overall_suitability?.score != null 
                ? `${comparisonData.highest_overall_suitability.score}%` 
                : 'Pending'}
            </div>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5" title={comparisonData?.highest_overall_suitability?.employee_name}>
              {comparisonData?.highest_overall_suitability?.employee_name || 'No Eligible Candidates'}
            </p>
            <p className="text-[10px] text-purple-600 font-semibold mt-1">
              Weighted 5-Criterion Composite
            </p>
          </div>
        </div>

        {/* Card 5: Eligible Candidates */}
        <div
          onClick={() => handleCardClick(null, 'sufficient', 'Eligible Candidates (Coverage >= 40%)')}
          className="p-3.5 bg-white rounded-2xl border border-blue-200/80 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Eligible Candidates</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900">
              {comparisonData?.eligible_candidates_count ?? 0}
            </div>
            <p className="text-xs font-bold text-slate-800 mt-0.5">
              Reliable Evidence
            </p>
            <p className="text-[10px] text-blue-600 font-semibold mt-1">
              Coverage ≥ 40%
            </p>
          </div>
        </div>

        {/* Card 6: Insufficient Evidence */}
        <div
          onClick={() => handleCardClick(null, 'insufficient', 'Candidates Needing Evidence (Coverage < 40%)')}
          className="p-3.5 bg-white rounded-2xl border border-rose-200/80 shadow-sm hover:shadow-md hover:border-rose-400 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Needs Evidence</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-rose-900">
              {comparisonData?.insufficient_evidence_count ?? 0}
            </div>
            <p className="text-xs font-bold text-slate-800 mt-0.5">
              Insufficient Data
            </p>
            <p className="text-[10px] text-rose-600 font-semibold mt-1">
              Coverage &lt; 40%
            </p>
          </div>
        </div>
      </div>

      {/* ROLE-SPECIFIC ANALYSIS PANEL (SECTION 7: Narrative grounded in actual database results) */}
      {analysisSummary.leading_candidate_name && (
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-lg border border-indigo-900/50">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                  Role Succession Analysis • {currentRole.role_name}
                </span>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-400/30">
                  Rank #1 Leader
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                {analysisSummary.leading_candidate_name} ({analysisSummary.leading_candidate_score}%)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analysisSummary.why_ranks_first}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const lead = rawCandidates.find(c => c.employee_id === analysisSummary.leading_candidate_id);
                  if (lead) handleOpenDossier(lead);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/30"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Full Evidence Dossier</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-indigo-800/60 text-xs">
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-indigo-300 uppercase">Assessment Evidence</p>
              <p className="text-[11px] text-slate-200 mt-1 leading-snug">
                {analysisSummary.assessment_evidence}
              </p>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-emerald-300 uppercase">Project Performance</p>
              <p className="text-[11px] text-slate-200 mt-1 leading-snug">
                {analysisSummary.project_evidence}
              </p>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-amber-300 uppercase">Skill Match &amp; Gaps</p>
              <p className="text-[11px] text-slate-200 mt-1 leading-snug">
                {analysisSummary.skill_evidence}
              </p>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-purple-300 uppercase">Experience &amp; Tenure</p>
              <p className="text-[11px] text-slate-200 mt-1 leading-snug">
                {analysisSummary.experience_evidence}
              </p>
            </div>
          </div>

          {/* Criteria Needing Evidence & Recommended Development Activities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-indigo-800/40 text-xs">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1.5">
              <div className="flex items-center space-x-1.5 text-amber-300 font-extrabold text-[11px] uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Criteria Needing Additional Evidence</span>
              </div>
              {analysisSummary.criteria_needing_evidence?.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-slate-200 text-[11px]">
                  {analysisSummary.criteria_needing_evidence.map((crit, idx) => (
                    <li key={idx}>{crit}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-300 italic">
                  Leading candidate has comprehensive evidence coverage across all evaluation criteria.
                </p>
              )}
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1.5">
              <div className="flex items-center space-x-1.5 text-emerald-300 font-extrabold text-[11px] uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" />
                <span>Recommended Development Activities</span>
              </div>
              {analysisSummary.development_activities?.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-slate-200 text-[11px]">
                  {analysisSummary.development_activities.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-300 italic">
                  No critical gaps identified for this role. Candidate is succession ready.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('shortlist')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 transition-all ${
              viewMode === 'shortlist'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>Role-Ready Successor Shortlist ({rawCandidates.filter(c => c.meets_readiness_requirements).length})</span>
          </button>

          <button
            onClick={() => setViewMode('pre_assessment')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 transition-all ${
              viewMode === 'pre_assessment'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pre-Assessment Candidate Eligibility ({preAssessmentData?.summary?.eligible ?? 0} Eligible)</span>
          </button>

          <button
            onClick={() => setViewMode('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 transition-all ${
              viewMode === 'matrix'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Full Evaluation Matrix ({rawCandidates.length})</span>
          </button>

          <button
            onClick={() => setViewMode('vacancies')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 transition-all ${
              viewMode === 'vacancies'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-400" />
            <span>Managerial Vacancies &amp; Succession</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-semibold hidden md:block">
          Active Role: <strong className="text-slate-800">{currentRole.role_name}</strong>
        </div>
      </div>

      {/* VIEW MODE 1: ROLE-READY QUALIFIED SUCCESSORS SHORTLIST */}
      {viewMode === 'shortlist' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  Executive Role-Ready Successor Shortlist • {currentRole.role_name}
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                Protected view displaying only vetted candidates who completed their assessments and met all role-readiness standards.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/10 text-emerald-300 font-bold rounded-xl text-xs border border-white/10">
                {rawCandidates.filter(c => c.meets_readiness_requirements).length} Qualified Candidates
              </span>
              <button
                onClick={() => setViewMode('pre_assessment')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pre-Assessment Candidates</span>
              </button>
            </div>
          </div>

          {/* Qualified Candidates List */}
          {(() => {
            const qualifiedCandidates = rawCandidates.filter(c => c.meets_readiness_requirements);
            if (qualifiedCandidates.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 card-shadow">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    No Candidates Currently Meet All Defined Role-Readiness Criteria
                  </h4>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto">
                    To appear on this executive succession shortlist for <strong>{currentRole.role_name}</strong>, candidates must complete an assigned leadership assessment and meet all role-readiness thresholds:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-slate-700 pt-1">
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Assessment Pass: ≥{thresholdConfig.assessment_pass_score}%</span>
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Project Success: ≥{thresholdConfig.min_project_success_rate}%</span>
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Skill Match: ≥{thresholdConfig.min_skill_match_pct}%</span>
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Competency: ≥{thresholdConfig.min_competency_score}%</span>
                  </div>
                  <div className="pt-3">
                    <button
                      onClick={() => setViewMode('pre_assessment')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all inline-flex items-center space-x-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Review Pre-Assessment Eligibility &amp; Schedules</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-4">
                {qualifiedCandidates.map((c, idx) => (
                  <div
                    key={c.employee_id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 card-shadow hover:border-indigo-300 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                          idx === 0 
                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-extrabold text-slate-900">{c.employee_name}</h4>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {c.employee_code}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{c.designation} • {c.department}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 self-start sm:self-auto">
                        <StatusBadge status={c.readiness_status || 'Succession Ready'} />
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Suitability</span>
                          <span className="text-base font-black text-indigo-700">
                            {c.suitability_score != null ? `${c.suitability_score}%` : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Criteria Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Assessment Result</span>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-black text-slate-900">
                            {c.assessment_score != null ? `${c.assessment_score}%` : 'Passed'}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">Meets Pass Threshold</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Verified Projects</span>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className="text-sm font-black text-slate-900">
                            {c.project_summary?.average_verified_success_rate ?? c.project_score ?? 'N/A'}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                          {c.project_summary?.verified_projects_count ?? c.criteria_scores?.projects?.verified_count ?? 0} verified projects
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Skills Match</span>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className="text-sm font-black text-slate-900">
                            {c.skill_score != null ? `${c.skill_score}%` : 'N/A'}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                          All mandatory skills met
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Experience</span>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <span className="text-sm font-black text-slate-900">
                            {c.experience_summary?.total_professional_experience_years ?? c.experience_score ?? 'N/A'} yrs
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                          {c.experience_summary?.company_tenure_months ?? 0} months company tenure
                        </span>
                      </div>
                    </div>

                    {/* Development & Mentorship Guidance */}
                    {c.development_recommendations?.length > 0 && (
                      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
                          Succession Development &amp; Mentorship Focus:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-indigo-950 text-[11px]">
                          {c.development_recommendations.map((rec, rIdx) => (
                            <li key={rIdx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        onClick={() => handleTriggerMl(c)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Run ML Model</span>
                      </button>

                      <button
                        onClick={() => handleOpenDossier(c)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Evidence Dossier</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* VIEW MODE 2: PRE-ASSESSMENT CANDIDATE ELIGIBILITY */}
      {viewMode === 'pre_assessment' && (
        <div className="space-y-4">
          {/* Summary Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Candidates</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {preAssessmentData?.total_evaluated || 0}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Evaluated for {currentRole.role_name}</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Eligible for Assessment</span>
              <p className="text-xl font-black text-emerald-800 mt-0.5">
                {preAssessmentData?.summary?.eligible || 0}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">All prerequisites satisfied</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-sm">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Not Eligible Yet</span>
              <p className="text-xl font-black text-amber-800 mt-0.5">
                {preAssessmentData?.summary?.not_eligible || 0}
              </p>
              <p className="text-[10px] text-amber-600 font-semibold mt-1">Prerequisites pending</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-600 uppercase">Insufficient Evidence</span>
              <p className="text-xl font-black text-slate-800 mt-0.5">
                {preAssessmentData?.summary?.insufficient_data || 0}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Coverage &lt; {thresholdConfig.min_evidence_coverage_pct}%</p>
            </div>
          </div>

          {/* Filtering & Actions Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={preAssessmentSearch}
                  onChange={(e) => setPreAssessmentSearch(e.target.value)}
                  placeholder="Filter candidate name or code..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={preAssessmentStatusFilter}
                onChange={(e) => setPreAssessmentStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white"
              >
                <option value="all">All Eligibility Statuses</option>
                <option value="eligible">Eligible for assessment only</option>
                <option value="not_eligible">Not eligible yet only</option>
                <option value="insufficient_data">Insufficient data only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsThresholdModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Adjust Role Thresholds</span>
              </button>

              <button
                onClick={() => {
                  setScheduleCandidate(null);
                  setScheduleModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow-sm transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Assign Assessment &amp; Schedules</span>
              </button>
            </div>
          </div>

          {/* Pre-Assessment Candidates List */}
          {preAssessmentLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Evaluating role eligibility rules...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {(preAssessmentData?.all_candidates || [])
                .filter(c => {
                  if (preAssessmentSearch.trim()) {
                    const q = preAssessmentSearch.toLowerCase();
                    const match = (c.employee_name || '').toLowerCase().includes(q) ||
                      (c.employee_code || '').toLowerCase().includes(q) ||
                      (c.designation || '').toLowerCase().includes(q);
                    if (!match) return false;
                  }
                  if (preAssessmentStatusFilter === 'eligible' && !c.is_eligible) return false;
                  if (preAssessmentStatusFilter === 'not_eligible' && (c.is_eligible || c.status === 'Insufficient data for reliable evaluation')) return false;
                  if (preAssessmentStatusFilter === 'insufficient_data' && c.status !== 'Insufficient data for reliable evaluation') return false;
                  return true;
                })
                .map(cand => {
                  const isEligible = cand.is_eligible;
                  const isInsufficient = cand.status === 'Insufficient data for reliable evaluation';

                  return (
                    <div
                      key={cand.employee_id}
                      className={`bg-white rounded-2xl border p-4 card-shadow space-y-3 transition-all ${
                        isEligible
                          ? 'border-emerald-200/80 hover:border-emerald-400'
                          : isInsufficient
                            ? 'border-slate-200 hover:border-slate-300'
                            : 'border-amber-200/80 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center space-x-2.5">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-black text-slate-900">{cand.employee_name}</h4>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {cand.employee_code}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">{cand.designation} • {cand.department}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {cand.is_scheduled && (
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1 border ${
                              cand.assignment_status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              cand.assignment_status === 'In Progress' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                              cand.assignment_status === 'Submitted' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                              cand.assignment_status === 'Expired' ? 'bg-red-100 text-red-800 border-red-300' :
                              'bg-purple-100 text-purple-800 border-purple-300'
                            }`}>
                              <Clock className="w-3 h-3 mr-0.5 inline" />
                              <span>{cand.assignment_status || 'Scheduled'}</span>
                              {cand.scheduled_date && (
                                <span className="text-[9px] opacity-80 font-normal ml-1">({cand.scheduled_date})</span>
                              )}
                            </span>
                          )}

                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
                            isEligible
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isInsufficient
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {isEligible ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 inline mr-1" />
                                <span>Eligible for assessment</span>
                              </>
                            ) : isInsufficient ? (
                              <>
                                <HelpCircle className="w-3 h-3 text-slate-500 inline mr-1" />
                                <span>Insufficient data for reliable evaluation</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-amber-600 inline mr-1" />
                                <span>Not eligible yet</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Reasons & Unmet Requirements */}
                      {!isEligible && (cand.unmet_requirements || []).length > 0 && (
                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
                          <span className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                            Pending Role Requirements ({cand.unmet_requirements.length}):
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-900 text-[11px]">
                            {cand.unmet_requirements.map((req, rIdx) => (
                              <li key={rIdx}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isEligible && (
                        <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs flex items-center space-x-1.5 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-semibold">
                            All role prerequisites satisfied. Candidate is verified and cleared for assessment assignment.
                          </span>
                        </div>
                      )}

                      {/* Evidence Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Verified Projects</span>
                          <p className="text-xs font-black text-slate-800 mt-0.5">
                            {cand.verified_projects_count} verified ({cand.project_success_rate}%)
                          </p>
                          <span className="text-[9px] text-slate-500 block">Total: {cand.total_projects_count} projects</span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Skills Match</span>
                          <p className="text-xs font-black text-slate-800 mt-0.5">
                            {cand.skill_match_pct}%
                          </p>
                          <span className="text-[9px] text-slate-500 block">
                            {(cand.missing_skills || []).length === 0 ? 'All required present' : `${cand.missing_skills.length} missing`}
                          </span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Experience</span>
                          <p className="text-xs font-black text-slate-800 mt-0.5">
                            {cand.total_experience_years} years
                          </p>
                          <span className="text-[9px] text-slate-500 block">{cand.company_tenure_months} mos tenure</span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Competencies</span>
                          <p className="text-xs font-black text-slate-800 mt-0.5">
                            {cand.competency_average}%
                          </p>
                          <span className="text-[9px] text-slate-500 block">Coverage: {cand.evidence_coverage_pct}%</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div>
                          {cand.is_scheduled && cand.scheduled_date && (
                            <span className="text-[11px] font-semibold text-slate-600 flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-indigo-600 inline mr-1" />
                              <span>Scheduled: {cand.scheduled_date} ({cand.start_time || '09:00'} - {cand.end_time || '10:00'}) [{cand.time_zone || 'UTC'}]</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {isEligible ? (
                            <button
                              onClick={() => {
                                setScheduleCandidate(cand);
                                setScheduleModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{cand.is_scheduled ? 'Reschedule Assessment' : 'Schedule Assessment'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-medium">
                              Cannot assign assessment until prerequisites are met
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: FULL EVALUATION MATRIX & ANALYTICS */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          {/* Table Filters & Sorting Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search name, code, title..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Department Filter */}
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
              >
                <option value="All">All Departments</option>
                {uniqueDepartments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              {/* Assessment Status Filter */}
              <select
                value={filterAssessmentStatus}
                onChange={(e) => setFilterAssessmentStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
              >
                <option value="all">Assessments: All</option>
                <option value="completed">Assessments: Completed</option>
                <option value="pending">Assessments: Pending / None</option>
              </select>

              {/* Mandatory Skills Filter */}
              <select
                value={filterMandatorySkills}
                onChange={(e) => setFilterMandatorySkills(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
              >
                <option value="all">Mandatory Skills: All</option>
                <option value="eligible">Fully Eligible (No Missing Mandatory)</option>
                <option value="missing">Has Missing Mandatory Skills</option>
              </select>

              {/* Evidence Coverage Filter */}
              <select
                value={filterCoverage}
                onChange={(e) => setFilterCoverage(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
              >
                <option value="all">Coverage: All</option>
                <option value="sufficient">Reliable Data (≥40%)</option>
                <option value="insufficient">Insufficient Data (&lt;40%)</option>
              </select>

              {(searchFilter || filterDepartment !== 'All' || filterAssessmentStatus !== 'all' || filterMandatorySkills !== 'all' || filterCoverage !== 'all' || highlightedCandidateIds.length > 0 || activeHighlightLabel) && (
                <button
                  onClick={() => {
                    setSearchFilter('');
                    setFilterDepartment('All');
                    setFilterAssessmentStatus('all');
                    setFilterMandatorySkills('all');
                    setFilterCoverage('all');
                    setHighlightedCandidateIds([]);
                    setActiveHighlightLabel('');
                  }}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-800 font-bold text-[11px] underline"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Sorting Options */}
            <div className="flex items-center space-x-2 justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <span className="font-bold text-slate-500 text-[11px] whitespace-nowrap">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-black text-indigo-900 focus:outline-none"
              >
                <option value="suitability">Overall Suitability Score</option>
                <option value="assessment">Assessment Score (0–100)</option>
                <option value="projects">Verified Project Performance</option>
                <option value="skills">Technical Skill Match</option>
                <option value="experience">Professional Experience</option>
                <option value="readiness">Leadership Readiness</option>
              </select>
            </div>
          </div>

          {/* Active Highlight Banner */}
          {activeHighlightLabel && (
            <div className="bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between text-indigo-900 font-semibold shadow-xs">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>
                  Highlight Focus: <strong>{activeHighlightLabel}</strong>
                  {highlightedCandidateIds.length > 0 && ` (${highlightedCandidateIds.length} candidate${highlightedCandidateIds.length > 1 ? 's' : ''})`}
                </span>
              </div>
              <button
                onClick={() => {
                  setHighlightedCandidateIds([]);
                  setActiveHighlightLabel('');
                  setFilterCoverage('all');
                }}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
              >
                Clear Focus
              </button>
            </div>
          )}

          {/* Candidates Matrix Table */}
          {comparisonLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
              <p className="text-xs font-bold text-slate-600">Calculating Multi-Dimensional Suitability Scores...</p>
              <p className="text-[11px] text-slate-400 mt-1">Normalizing assessment marks, project success rates, and skill proficiencies</p>
            </div>
          ) : sortedCandidates.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No candidates found matching the selected criteria.</p>
              <p className="text-[11px] text-slate-400 mt-1">Try resetting filters or switching leadership roles.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Candidate</th>
                      <th className="px-4 py-3.5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSortChange('assessment')}>
                        Assessment Score
                      </th>
                      <th className="px-4 py-3.5 text-center">Ass. Rank</th>
                      <th className="px-4 py-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSortChange('projects')}>
                        Project Performance ({weights.projects_weight}%)
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSortChange('skills')}>
                        Technical Skills ({weights.skills_weight}%)
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSortChange('experience')}>
                        Experience ({weights.experience_weight}%)
                      </th>
                      <th className="px-4 py-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSortChange('readiness')}>
                        Readiness ({weights.readiness_weight}%)
                      </th>
                      <th className="px-4 py-3.5 text-center">Coverage</th>
                      <th className="px-4 py-3.5 text-center cursor-pointer hover:text-indigo-600" onClick={() => handleSortChange('suitability')}>
                        Overall Suitability
                      </th>
                      <th className="px-4 py-3.5">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {sortedCandidates.map((cand) => {
                      const empId = cand.employee_id || cand.id;
                      const isHighlighted = highlightedCandidateIds.includes(empId);
                      const proj = cand.project_summary || {};
                      const exp = cand.experience_summary || {};
                      const skills = cand.skill_details || {};
                      const missingMandatory = cand.criteria_scores?.skills?.missing_mandatory || [];

                      return (
                        <tr 
                          key={empId} 
                          id={`candidate-row-${empId}`}
                          className={`transition-colors ${
                            isHighlighted ? 'bg-indigo-50/90 ring-2 ring-indigo-500' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Candidate Identity (Section 5: Column 1) */}
                          <td className="px-4 py-3.5">
                            <div>
                              <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                                <span 
                                  onClick={() => handleOpenDossier(cand)} 
                                  className="font-black text-slate-900 text-xs hover:text-indigo-600 cursor-pointer underline-offset-2 hover:underline"
                                  title="Click to view candidate evidence dossier"
                                >
                                  {cand.employee_name || cand.name}
                                </span>
                                {cand.is_highest_assessment_scorer && (
                                  <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300" title="Highest Assessment Scorer">
                                    ★ Top Scorer
                                  </span>
                                )}
                                {cand.is_highest_project_performer && (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300" title="Strongest Verified Project Performer">
                                    ★ Top Projects
                                  </span>
                                )}
                                {cand.is_best_skill_matcher && (
                                  <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded border border-blue-300" title="Best Role Skill Match">
                                    ★ Best Skills
                                  </span>
                                )}
                                {cand.is_highest_overall_suitability && (
                                  <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded border border-purple-300" title="Highest Overall Suitability">
                                    ★ Top Suitability
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {cand.email || `${cand.employee_code}@company.internal`}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {cand.designation} • <span className="font-bold text-slate-600">{cand.department}</span>
                              </p>
                            </div>
                          </td>

                          {/* Assessment Score (Section 5: Column 2) */}
                          <td className="px-4 py-3.5 text-center">
                            {cand.assessment_score != null ? (
                              <div className="space-y-0.5">
                                <span className={`text-xs font-black inline-block px-2 py-0.5 rounded-lg border ${
                                  cand.is_highest_assessment_scorer || cand.assessment_rank === 1
                                    ? 'text-amber-800 bg-amber-50 border-amber-300 shadow-xs' 
                                    : 'text-slate-900 bg-slate-50 border-slate-200'
                                }`}>
                                  {cand.assessment_score}%
                                </span>
                                <p className="text-[10px] font-semibold text-slate-600">
                                  {cand.assessment_marks != null && cand.assessment_max_marks != null 
                                    ? `${cand.assessment_marks}/${cand.assessment_max_marks} pts` 
                                    : 'Evaluated'}
                                </p>
                                <p className="text-[9px] text-slate-500 truncate max-w-[140px] mx-auto" title={cand.assessment_name}>
                                  {cand.assessment_name || 'Benchmark Test'}
                                </p>
                                <div className="flex items-center justify-center space-x-1">
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                    {cand.completed_assessments_count || 1} completed
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {cand.assessment_status || 'Not Completed'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Assessment Rank (Section 5: Column 3: Honest Standard Competition Ties) */}
                          <td className="px-4 py-3.5 text-center">
                            {cand.assessment_rank ? (
                              <span className={`inline-flex items-center space-x-0.5 text-[11px] font-black px-2 py-0.5 rounded-full ${
                                cand.assessment_rank === 1
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : cand.assessment_rank <= 3
                                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {cand.assessment_rank === 1 && <span>👑</span>}
                                <span>#{cand.assessment_rank}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )}
                          </td>

                          {/* Project Performance (Section 5: Column 4) */}
                          <td className="px-4 py-3.5">
                            <div>
                              {proj.average_verified_success_rate != null ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    <span className="font-extrabold text-emerald-700">{proj.average_verified_success_rate}%</span>
                                    <span className="text-[10px] text-slate-500">({proj.total_projects} proj)</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    Verified ({proj.verified_projects_count} verified)
                                  </span>
                                </div>
                              ) : proj.average_overall_success_rate != null ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                    <span className="font-bold text-slate-700">{proj.average_overall_success_rate}%</span>
                                    <span className="text-[10px] text-slate-500">({proj.total_projects} proj)</span>
                                  </div>
                                  <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    Self-reported
                                  </span>
                                </div>
                              ) : proj.total_projects > 0 ? (
                                <span className="text-[10px] font-semibold text-slate-400">Not evaluated ({proj.total_projects} proj)</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">0 projects</span>
                              )}
                            </div>
                          </td>

                          {/* Technical Skills (Section 5: Column 5: 1-5 scale) */}
                          <td className="px-4 py-3.5">
                            <div>
                              {cand.skill_score != null ? (
                                <div>
                                  <span className="font-black text-indigo-700">{cand.skill_score}%</span>
                                  <span className="text-[10px] text-slate-500 ml-1">
                                    ({skills.matched_skills_count || 0}/{skills.required_skills_count || 0} met)
                                  </span>
                                  {missingMandatory.length > 0 && (
                                    <p className="text-[9px] font-bold text-rose-600 truncate mt-0.5" title={`Missing mandatory: ${missingMandatory.join(', ')}`}>
                                      Missing: {missingMandatory[0]}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">Not mapped</span>
                              )}
                            </div>
                          </td>

                          {/* Professional Experience (Section 5: Column 6: Non-overlapping) */}
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-bold text-slate-800">
                                {exp.total_professional_experience_years || 0} yrs total
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {exp.current_company_tenure_years || 0} yrs tenure
                              </p>
                              {exp.leadership_experience_years > 0 && (
                                <p className="text-[9px] font-semibold text-indigo-600">
                                  {exp.leadership_experience_years} yrs leadership
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Leadership Competencies (Section 5: Column 7) */}
                          <td className="px-4 py-3.5">
                            <div>
                              <span className="font-black text-slate-900">{cand.readiness_score != null ? `${cand.readiness_score}%` : 'N/A'}</span>
                              <div className="mt-0.5">
                                <StatusBadge status={cand.readiness_level || 'Medium'} type="readiness" />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[120px]" title={cand.criteria_scores?.readiness?.major_gap}>
                                Gap: {cand.criteria_scores?.readiness?.major_gap || 'None'}
                              </p>
                            </div>
                          </td>

                          {/* Evidence Coverage (Section 5: Column 8) */}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              cand.evidence_coverage_pct >= 80
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : cand.evidence_coverage_pct >= 40
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                              {cand.evidence_coverage_pct}%
                            </span>
                          </td>

                          {/* Overall Suitability (Section 5: Column 9) */}
                          <td className="px-4 py-3.5 text-center">
                            {!cand.has_sufficient_data ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold" title="Coverage < 40%">
                                Insufficient Data
                              </span>
                            ) : (
                              <div>
                                <span className="text-sm font-black text-indigo-700">
                                  {cand.suitability_score}%
                                </span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      cand.suitability_score >= 80 ? 'bg-emerald-500' :
                                      cand.suitability_score >= 65 ? 'bg-indigo-600' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${cand.suitability_score}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Recommendation & Evidence Dossier (Section 5: Column 10) */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1.5 min-w-[200px]">
                              <p className="text-[11px] font-semibold text-slate-800 leading-snug">
                                {cand.recommendation?.summary || cand.recommendation_summary || cand.recommendation_verdict || 'Evaluation in progress.'}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-1">
                                {cand.recommendation?.strengths?.[0] && (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[190px]" title={cand.recommendation.strengths[0]}>
                                    ✓ {cand.recommendation.strengths[0]}
                                  </span>
                                )}
                                {cand.recommendation?.gaps?.[0] && (
                                  <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 truncate max-w-[190px]" title={cand.recommendation.gaps[0]}>
                                    ⚠ {cand.recommendation.gaps[0]}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => handleOpenDossier(cand)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] border border-indigo-200 inline-flex items-center space-x-1 transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Evidence Dossier</span>
                              </button>
                            </div>
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

      {/* VIEW MODE 2: QUICK SUCCESSION LEADERBOARD & ML PREDICTION */}
      {viewMode === 'ranking' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
            <h3 className="text-base font-extrabold text-slate-900 mb-2">
              Automated Random Forest ML Succession Pipeline
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Benchmark candidate readiness against trained Random Forest predictive classifiers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(comparisonData?.candidates || []).slice(0, 6).map((c, idx) => (
                <div key={c.employee_id || c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-700">Rank #{idx + 1}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200">
                        {c.suitability_score != null ? `${c.suitability_score}%` : 'Pending'}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 mt-1">{c.employee_name || c.name}</h4>
                    <p className="text-[11px] text-slate-500">{c.designation} • {c.department}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Readiness: {c.readiness_score || 'N/A'}%</span>
                    <button
                      onClick={() => handleTriggerMl(c)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] flex items-center space-x-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Run ML</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 4: MANAGERIAL VACANCIES & CROSS-TEAM SUCCESSION */}
      {viewMode === 'vacancies' && (
        <div className="space-y-4">
          <ManagerVacancySection roles={roles} />
        </div>
      )}

      {/* EVIDENCE DOSSIER MODAL */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200">
            {/* Dossier Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-black text-slate-900">
                    Candidate Evidence Dossier: {selectedCandidateDetail.employee_name || selectedCandidateDetail.name}
                  </h3>
                  <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                    {selectedCandidateDetail.employee_code}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedCandidateDetail.designation} • {selectedCandidateDetail.department} • {selectedCandidateDetail.email}
                </p>
                <p className="text-xs font-semibold text-indigo-700">
                  Target Leadership Role: {currentRole.role_name}
                </p>
              </div>

              <button
                onClick={() => setSelectedCandidateDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Navigation Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-xs">
              {[
                { id: 'overview', label: 'Overview & Formula' },
                { id: 'assessments', label: 'Assessments Evidence' },
                { id: 'projects', label: 'Projects & Outcomes' },
                { id: 'skills', label: 'Skills & 1–5 Gaps' },
                { id: 'experience', label: 'Experience & Tenure' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDossierTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    dossierTab === t.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview & Transparent Scoring Formula */}
            {dossierTab === 'overview' && (
              <div className="space-y-4 text-xs">
                {/* Score Summary Banner */}
                <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Overall Weighted Suitability</span>
                    <h2 className="text-2xl font-black mt-0.5">
                      {selectedCandidateDetail.suitability_score != null 
                        ? `${selectedCandidateDetail.suitability_score}%` 
                        : 'Insufficient Data for Reliable Evaluation'}
                    </h2>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Evidence Coverage: {selectedCandidateDetail.evidence_coverage_pct}% of required evaluation criteria supported by verified records.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-700 text-indigo-100 border border-indigo-500">
                      {selectedCandidateDetail.suitability_level}
                    </span>
                  </div>
                </div>

                {/* Mathematical Criteria Breakdown Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Criterion</th>
                        <th className="px-4 py-2.5 text-center">Score (0–100)</th>
                        <th className="px-4 py-2.5 text-center">Weight</th>
                        <th className="px-4 py-2.5 text-center">Weighted Points</th>
                        <th className="px-4 py-2.5">Evidence Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {Object.entries(selectedCandidateDetail.criteria_scores || {}).map(([cKey, cVal]) => (
                        <tr key={cKey} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold capitalize text-slate-800">{cKey}</td>
                          <td className="px-4 py-2.5 text-center font-extrabold text-indigo-700">
                            {cVal.score != null ? `${cVal.score}%` : 'Not Evaluated'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-slate-600">{cVal.weight}%</td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-900">{cVal.weighted_points || 0.0} pts</td>
                          <td className="px-4 py-2.5">
                            {cVal.is_available ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Valid Evidence
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Missing Data
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Development Priorities */}
                {selectedCandidateDetail.suggested_development_activities?.length > 0 && (
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                    <h4 className="font-extrabold text-indigo-900 mb-1.5 flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Recommended Development Roadmap</span>
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                      {selectedCandidateDetail.suggested_development_activities.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Assessment Evidence (Section 1) */}
            {dossierTab === 'assessments' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <p className="font-extrabold text-slate-800">Target Role Assessment Benchmark</p>
                    <p className="text-[11px] text-slate-500">
                      Evaluated using completed assignments for role '{currentRole.role_name}'.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-700">
                      {selectedCandidateDetail.assessment_score != null 
                        ? `${selectedCandidateDetail.assessment_score}%` 
                        : 'No Completed Assessment'}
                    </span>
                  </div>
                </div>

                {selectedCandidateDetail.criteria_scores?.assessments?.attempts?.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Assessment Title</th>
                          <th className="px-4 py-2.5 text-center">Marks Obtained</th>
                          <th className="px-4 py-2.5 text-center">Max Marks</th>
                          <th className="px-4 py-2.5 text-center">Normalized %</th>
                          <th className="px-4 py-2.5 text-center">Classification</th>
                          <th className="px-4 py-2.5 text-right">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {selectedCandidateDetail.criteria_scores.assessments.attempts.map((att, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{att.assessment_title}</td>
                            <td className="px-4 py-2.5 text-center font-extrabold text-slate-800">{att.marks_obtained}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600">{att.max_marks}</td>
                            <td className="px-4 py-2.5 text-center font-black text-indigo-700">{att.normalized_percentage}%</td>
                            <td className="px-4 py-2.5 text-center">
                              <StatusBadge status={att.readiness_level} type="readiness" />
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-500 text-[11px]">
                              {att.completed_at ? new Date(att.completed_at).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="font-bold">No completed assessments recorded for this specific role.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">HR can assign an assessment to benchmark this candidate's readiness.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Projects & Outcomes (Section 2) */}
            {dossierTab === 'projects' && (
              <div className="space-y-4 text-xs">
                {/* Project formula note */}
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900">
                  <span className="font-extrabold">Formula:</span> Project Success Rate = (0.25 × Milestones) + (0.25 × Deliverables) + (0.20 × Timeline) + (0.15 × Quality) + (0.15 × Business Objectives).
                </div>

                {selectedCandidateDetail.project_summary?.projects?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCandidateDetail.project_summary.projects.map((p, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-black text-slate-900 text-xs">{p.title}</h4>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                p.verification_status?.includes('Verified')
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                {p.verification_status || 'Self-Reported'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{p.role_in_project} • {p.status}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-emerald-700">
                              {p.success_rate != null ? `${p.success_rate}%` : 'Not Evaluated'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">{p.description}</p>

                        {/* Metric Indicators */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-200/60 text-[10px]">
                          <div>
                            <span className="text-slate-400">Milestones:</span> <span className="font-bold text-slate-800">{p.milestones_completed_pct ?? 'N/A'}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Deliverables:</span> <span className="font-bold text-slate-800">{p.deliverables_accepted_pct ?? 'N/A'}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Timeline:</span> <span className="font-bold text-slate-800">{p.timeline_adherence_pct ?? 'N/A'}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Quality:</span> <span className="font-bold text-slate-800">{p.quality_defect_score ?? 'N/A'}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Business:</span> <span className="font-bold text-slate-800">{p.business_goals_achieved_pct ?? 'N/A'}%</span>
                          </div>
                        </div>

                        {p.technologies?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {p.technologies.map((t, tidx) => (
                              <span key={tidx} className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-[9px] font-semibold">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
                    <p className="font-bold">No project records registered for this candidate.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Skills & 1-5 Proficiency Scale (Section 3) */}
            {dossierTab === 'skills' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900">
                  <span className="font-extrabold">Proficiency Scale:</span> 1 = Beginner, 2 = Basic, 3 = Intermediate, 4 = Advanced, 5 = Expert.
                </div>

                {/* Role Required Skills Comparison */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Skill Name</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5 text-center">Required (1–5)</th>
                        <th className="px-4 py-2.5 text-center">Employee (1–5)</th>
                        <th className="px-4 py-2.5 text-center">Gap</th>
                        <th className="px-4 py-2.5 text-center">Mandatory</th>
                        <th className="px-4 py-2.5">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(selectedCandidateDetail.skill_details?.matched_skills || []).concat(
                        selectedCandidateDetail.skill_details?.skills_below_requirement || [],
                        selectedCandidateDetail.skill_details?.missing_skills || []
                      ).map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{s.skill_name}</td>
                          <td className="px-4 py-2.5 text-slate-500">{s.category}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                            Level {s.required_level} ({s.required_label})
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold">
                            {s.employee_level > 0 ? (
                              <span className={s.employee_level >= s.required_level ? 'text-emerald-700' : 'text-amber-700'}>
                                Level {s.employee_level} ({s.employee_label})
                              </span>
                            ) : (
                              <span className="text-rose-600 italic">Not Acquired</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {s.gap > 0 ? (
                              <span className="text-rose-600 font-black">-{s.gap}</span>
                            ) : (
                              <span className="text-emerald-600 font-black">✓ Match</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {s.is_mandatory ? (
                              <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                Mandatory
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">Optional</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-semibold ${s.is_verified ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {s.verification_status || 'Unverified'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 5: Experience & Tenure (Section 4: Non-overlapping) */}
            {dossierTab === 'experience' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Company Tenure</p>
                    <p className="text-xl font-black text-slate-900 mt-0.5">
                      {selectedCandidateDetail.experience_summary?.current_company_tenure_years || 0} yrs
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Joined: {selectedCandidateDetail.experience_summary?.company_joining_date || 'N/A'}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Total Experience</p>
                    <p className="text-xl font-black text-slate-900 mt-0.5">
                      {selectedCandidateDetail.experience_summary?.total_professional_experience_years || 0} yrs
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Non-overlapping merged interval calculation
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Leadership Tenure</p>
                    <p className="text-xl font-black text-indigo-700 mt-0.5">
                      {selectedCandidateDetail.experience_summary?.leadership_experience_years || 0} yrs
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Demonstrated leadership roles
                    </p>
                  </div>
                </div>

                {/* Past Employment Records */}
                {selectedCandidateDetail.experience_summary?.employment_histories?.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Company</th>
                          <th className="px-4 py-2.5">Designation</th>
                          <th className="px-4 py-2.5">Domain</th>
                          <th className="px-4 py-2.5">Dates</th>
                          <th className="px-4 py-2.5">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {selectedCandidateDetail.experience_summary.employment_histories.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{h.company_name}</td>
                            <td className="px-4 py-2.5 text-slate-700">{h.designation}</td>
                            <td className="px-4 py-2.5 text-slate-500">{h.domain || 'General'}</td>
                            <td className="px-4 py-2.5 text-slate-600 text-[11px]">{h.start_date} to {h.end_date || 'Present'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                h.verification_status === 'HR-Verified'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {h.verification_status || 'Self-Reported'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Dossier Footer */}
            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCandidateDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURABLE WEIGHTS MODAL (SECTION 6) */}
      <Modal 
        isOpen={isWeightsModalOpen} 
        onClose={() => setIsWeightsModalOpen(false)} 
        title="Configure Succession Evaluation Criteria Weights"
      >
        <form onSubmit={handleSaveWeights} className="space-y-4 text-xs">
          <p className="text-slate-500 text-[11px]">
            Adjust the proportional contribution of each criterion to the overall leadership suitability score. All weights must sum exactly to 100%.
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Assessment Results:</span>
                <span className="text-indigo-600">{weightsForm.assessment_weight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightsForm.assessment_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, assessment_weight: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Leadership Readiness &amp; Competency:</span>
                <span className="text-indigo-600">{weightsForm.readiness_weight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightsForm.readiness_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, readiness_weight: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Technical Skills &amp; Gaps:</span>
                <span className="text-indigo-600">{weightsForm.skills_weight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightsForm.skills_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, skills_weight: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Project Experience &amp; Success Rates:</span>
                <span className="text-indigo-600">{weightsForm.projects_weight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightsForm.projects_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, projects_weight: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Professional &amp; Company Experience:</span>
                <span className="text-indigo-600">{weightsForm.experience_weight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightsForm.experience_weight}
                onChange={(e) => setWeightsForm({ ...weightsForm, experience_weight: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Sum Check */}
          {(() => {
            const sum = Number(weightsForm.assessment_weight) +
              Number(weightsForm.readiness_weight) +
              Number(weightsForm.skills_weight) +
              Number(weightsForm.projects_weight) +
              Number(weightsForm.experience_weight);

            const isExact = Math.round(sum) === 100;
            return (
              <div className={`p-3 rounded-xl border flex items-center justify-between font-bold ${
                isExact ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <span>Total Weights Sum:</span>
                <span className="text-sm font-black">{sum}% {isExact ? '✓ Valid' : '(Must Equal 100%)'}</span>
              </div>
            );
          })()}

          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsWeightsModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingWeights}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1"
            >
              {savingWeights && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ML Prediction Modal */}
      <Modal isOpen={isMlModalOpen} onClose={() => setIsMlModalOpen(false)} title={`Random Forest ML Readiness: ${selectedMlCand?.employee_name || selectedMlCand?.name}`}>
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
                  <p className="text-lg font-extrabold text-emerald-700">{Math.round((mlPrediction.probabilities?.High || 0) * 100)}%</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-amber-800">Medium</p>
                  <p className="text-lg font-extrabold text-amber-700">{Math.round((mlPrediction.probabilities?.Medium || 0) * 100)}%</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-rose-800">Low</p>
                  <p className="text-lg font-extrabold text-rose-700">{Math.round((mlPrediction.probabilities?.Low || 0) * 100)}%</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
              {mlPrediction.disclaimer || "Machine learning prediction based on historical competency vectors."}
            </p>
          </div>
        ) : null}
      </Modal>

      {/* CONFIGURABLE ROLE ELIGIBILITY THRESHOLDS MODAL */}
      <Modal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        title={`Configure Role-Specific Thresholds: ${currentRole.role_name}`}
      >
        <form onSubmit={handleSaveThresholdConfig} className="space-y-4 text-xs">
          <p className="text-slate-500 text-[11px]">
            Configure authoritative pre-assessment eligibility and post-assessment readiness thresholds for this specific leadership role.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Professional Experience (Years)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={thresholdConfig.min_experience_years ?? 3.0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_experience_years: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Company Tenure (Months)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={thresholdConfig.min_company_tenure_months ?? 6}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_company_tenure_months: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Verified Project Success Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdConfig.min_project_success_rate ?? 70.0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_project_success_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Technical Skill Match (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdConfig.min_skill_match_pct ?? 60.0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_skill_match_pct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Competency Score (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdConfig.min_competency_score ?? 60.0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_competency_score: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Assessment Pass Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdConfig.assessment_pass_score ?? 70.0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, assessment_pass_score: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Evidence Coverage (%)
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={thresholdConfig.min_evidence_coverage_pct ?? 40.0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_evidence_coverage_pct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Min Verified Projects Count
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={thresholdConfig.min_verified_projects ?? 0}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, min_verified_projects: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={thresholdConfig.require_all_mandatory_skills ?? true}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, require_all_mandatory_skills: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span>Require 100% of Mandatory Skills (disqualifies candidate if any mandatory skill is missing)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={thresholdConfig.require_verified_projects ?? false}
                onChange={(e) => setThresholdConfig({ ...thresholdConfig, require_verified_projects: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span>Strictly Require Verified Projects (disqualifies candidates who have only self-reported projects)</span>
            </label>
          </div>

          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsThresholdModalOpen(false)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingThresholdConfig}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1 shadow-sm"
            >
              {savingThresholdConfig && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Save Role Thresholds</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* SCHEDULE ASSESSMENT MODAL */}
      {scheduleModalOpen && (
        <ScheduleAssessmentModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          roleId={selectedRoleId}
          roleName={currentRole.role_name}
          candidates={preAssessmentData?.all_candidates || []}
          initialSelectedCandidate={scheduleCandidate}
          onSuccess={() => {
            loadPreAssessmentCandidates(selectedRoleId);
          }}
        />
      )}
    </div>
  );
};

export default Successors;
