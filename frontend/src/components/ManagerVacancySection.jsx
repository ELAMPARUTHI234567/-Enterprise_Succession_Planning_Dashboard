import React, { useState, useEffect } from 'react';
import { 
  Briefcase, UserX, Users, Award, ShieldCheck, AlertTriangle, 
  CheckCircle2, Clock, Check, ChevronRight, Plus, Sliders, 
  FileText, ArrowRight, Loader2, Sparkles, AlertCircle, Crown, Eye
} from 'lucide-react';
import { vacancyService, employeeService, roleService } from '../services/api';

export const ManagerVacancySection = ({ roles = [] }) => {
  const [vacancies, setVacancies] = useState([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState(null);
  const [selectedVacancy, setSelectedVacancy] = useState(null);
  const [candidatesData, setCandidatesData] = useState(null);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter & Search
  const [candidateCategoryFilter, setCandidateCategoryFilter] = useState('all'); // 'all' | 'eligible' | 'requires_assessment' | 'not_eligible' | 'insufficient_evidence'
  const [candidateSearch, setCandidateSearch] = useState('');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    departing_manager_id: '',
    role_id: '',
    effective_departure_date: new Date().toISOString().split('T')[0],
    reason: 'Career transition / Resignation'
  });
  const [savingVacancy, setSavingVacancy] = useState(false);

  // Appoint Modal
  const [appointModalItem, setAppointModalItem] = useState(null);
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointing, setAppointing] = useState(false);

  // Weights Modal
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [weightsForm, setWeightsForm] = useState({
    readiness_weight: 30,
    projects_weight: 25,
    skills_weight: 20,
    experience_weight: 15,
    assessment_weight: 10
  });
  const [savingWeights, setSavingWeights] = useState(false);

  // Feedback Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // All employees for departing manager selector
  const [allManagers, setAllManagers] = useState([]);

  useEffect(() => {
    loadVacancies();
    loadAllManagers();
    loadScoringWeights();
  }, []);

  const loadAllManagers = async () => {
    try {
      const res = await employeeService.getAll();
      if (res?.success && Array.isArray(res.data)) {
        // Find managers or employees holding managerial designations
        const mgrs = res.data.filter(e => 
          e.designation.toLowerCase().includes('manager') || 
          e.designation.toLowerCase().includes('lead') ||
          e.designation.toLowerCase().includes('director') ||
          e.id === 4
        );
        setAllManagers(mgrs.length > 0 ? mgrs : res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadScoringWeights = async () => {
    try {
      const res = await vacancyService.getScoringConfig();
      if (res?.success && res.data) {
        setWeightsForm({
          readiness_weight: res.data.readiness_weight ?? 30,
          projects_weight: res.data.projects_weight ?? 25,
          skills_weight: res.data.skills_weight ?? 20,
          experience_weight: res.data.experience_weight ?? 15,
          assessment_weight: res.data.assessment_weight ?? 10
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadVacancies = async () => {
    setLoading(true);
    try {
      const res = await vacancyService.getAll();
      if (res?.success && Array.isArray(res.data)) {
        setVacancies(res.data);
        if (res.data.length > 0 && !selectedVacancyId) {
          const firstOpen = res.data.find(v => v.status === 'Open') || res.data[0];
          setSelectedVacancyId(firstOpen.id);
          loadVacancyDetails(firstOpen.id);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load vacancies.');
    } finally {
      setLoading(false);
    }
  };

  const loadVacancyDetails = async (vacId) => {
    setDetailsLoading(true);
    setErrorMsg('');
    try {
      const [detailRes, candsRes, recsRes] = await Promise.all([
        vacancyService.getById(vacId),
        vacancyService.getCandidates(vacId),
        vacancyService.getRecommendations(vacId)
      ]);

      if (detailRes?.success) setSelectedVacancy(detailRes.data);
      if (candsRes?.success) setCandidatesData(candsRes);
      if (recsRes?.success) setRecommendationsData(recsRes);
    } catch (err) {
      setErrorMsg(err.message || 'Error loading vacancy evaluation.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSelectVacancy = (id) => {
    setSelectedVacancyId(id);
    loadVacancyDetails(id);
  };

  const handleRecordVacancySubmit = async (e) => {
    e.preventDefault();
    if (!recordForm.departing_manager_id) {
      alert('Please select the departing manager.');
      return;
    }
    setSavingVacancy(true);
    setErrorMsg('');
    try {
      const res = await vacancyService.create(recordForm);
      if (res?.success) {
        setSuccessMsg(res.message || 'Vacancy recorded successfully.');
        setIsRecordModalOpen(false);
        loadVacancies();
        if (res.data?.id) {
          setSelectedVacancyId(res.data.id);
          loadVacancyDetails(res.data.id);
        }
      } else {
        setErrorMsg(res?.message || 'Failed to record vacancy.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error recording vacancy.');
    } finally {
      setSavingVacancy(false);
    }
  };

  const handleAction = async (employeeId, action) => {
    if (!selectedVacancyId) return;
    try {
      const res = await vacancyService.recordAction(selectedVacancyId, {
        employee_id: employeeId,
        action: action,
        comments: `HR marked candidate as ${action}.`
      });
      if (res?.success) {
        setSuccessMsg(`Candidate marked as ${action}.`);
        loadVacancyDetails(selectedVacancyId);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Action failed.');
    }
  };

  const handleConfirmAppointment = async () => {
    if (!selectedVacancyId || !appointModalItem) return;
    setAppointing(true);
    setErrorMsg('');
    try {
      const res = await vacancyService.appoint(selectedVacancyId, {
        employee_id: appointModalItem.employee_id,
        appointment_notes: appointmentNotes.trim()
      });
      if (res?.success) {
        setSuccessMsg(res.message || `Successfully appointed ${appointModalItem.name}!`);
        setAppointModalItem(null);
        setAppointmentNotes('');
        loadVacancies();
        loadVacancyDetails(selectedVacancyId);
      } else {
        setErrorMsg(res?.message || 'Appointment failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error confirming appointment.');
    } finally {
      setAppointing(false);
    }
  };

  const handleSaveWeights = async (e) => {
    e.preventDefault();
    setSavingWeights(true);
    try {
      const res = await vacancyService.updateScoringConfig(weightsForm);
      if (res?.success) {
        setSuccessMsg('Suitability scoring framework updated.');
        setIsWeightsModalOpen(false);
        if (selectedVacancyId) loadVacancyDetails(selectedVacancyId);
      } else {
        setErrorMsg(res?.message || 'Failed to update weights.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Weights must sum to 100%.');
    } finally {
      setSavingWeights(false);
    }
  };

  const candidatesList = candidatesData?.candidates || [];
  const filteredCandidates = candidatesList.filter(c => {
    if (candidateCategoryFilter !== 'all' && c.category_badge !== candidateCategoryFilter) {
      return false;
    }
    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase();
      return (c.name || '').toLowerCase().includes(q) ||
             (c.employee_code || '').toLowerCase().includes(q) ||
             (c.designation || '').toLowerCase().includes(q) ||
             (c.candidate_source || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-300 font-extrabold text-xs uppercase tracking-wider mb-1">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            <span>Dynamic Manager Vacancy &amp; Succession Engine</span>
          </div>
          <h2 className="text-xl font-black tracking-tight">Manager Departure &amp; Successor Appointment</h2>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
            When a Manager departs, dynamically identify and appoint the highest-suitability successor from all organizational sources (departing team, peer teams, and unassigned employees).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsWeightsModalOpen(true)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 border border-white/20 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-300" />
            <span>Configure Weights (100%)</span>
          </button>

          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Manager Departure / Vacancy</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Vacancy Selector Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
          <span>Active &amp; Historical Manager Vacancies ({vacancies.length})</span>
          <span className="text-[11px] text-slate-500 font-normal">Select a vacancy to review potential successors</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {vacancies.map(v => {
            const isSelected = v.id === selectedVacancyId;
            const isAppointed = v.status === 'Appointed';

            return (
              <button
                key={v.id}
                onClick={() => handleSelectVacancy(v.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 border transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : isAppointed
                      ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Briefcase className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : isAppointed ? 'text-slate-400' : 'text-amber-600'}`} />
                <span>{v.departing_manager_name} ({v.role_name || 'Manager'})</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                  isSelected 
                    ? 'bg-white/20 text-white' 
                    : isAppointed 
                      ? 'bg-slate-200 text-slate-700' 
                      : 'bg-amber-200 text-amber-800'
                }`}>
                  {v.status}
                </span>
              </button>
            );
          })}

          {vacancies.length === 0 && !loading && (
            <div className="text-xs text-slate-400 italic py-1">
              No vacancies recorded yet. Click "Record Manager Departure / Vacancy" to initiate succession.
            </div>
          )}
        </div>
      </div>

      {/* Selected Vacancy Profile & Workflow */}
      {selectedVacancy && (
        <div className="space-y-6">
          
          {/* Step 1 Overview Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Step 1: Recorded Vacancy Details
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Vacant Position: {selectedVacancy.role_name} • {selectedVacancy.department}
                </h3>
                <p className="text-xs text-slate-500">
                  Departing Manager: <strong>{selectedVacancy.departing_manager_name}</strong> ({selectedVacancy.departing_manager_code} • {selectedVacancy.departing_manager_designation})
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                  selectedVacancy.status === 'Appointed'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  Status: {selectedVacancy.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Effective Date</span>
                <p className="text-xs font-black text-slate-800 mt-0.5">{selectedVacancy.effective_departure_date}</p>
                <span className="text-[10px] text-slate-500">Recorded Departure</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Affected Reports</span>
                <p className="text-xs font-black text-slate-800 mt-0.5">{selectedVacancy.affected_direct_reports?.length || 0} Employees</p>
                <span className="text-[10px] text-indigo-600 font-semibold">Pending Line Transfer</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Departure Reason</span>
                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{selectedVacancy.reason || 'General Transition'}</p>
                <span className="text-[10px] text-slate-500">Historical Records Preserved</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Appointed Successor</span>
                <p className="text-xs font-black text-emerald-700 mt-0.5">
                  {selectedVacancy.appointed_employee_name || 'Pending HR Selection'}
                </p>
                <span className="text-[10px] text-slate-500">
                  {selectedVacancy.appointed_at ? `Appointed on ${selectedVacancy.appointed_at.slice(0, 10)}` : 'Awaiting Review'}
                </span>
              </div>
            </div>
          </div>

          {/* Top Recommendations Banner (Steps 3 & 4) */}
          {recommendationsData?.top_performers && (
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-indigo-800/50 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-800/60 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center space-x-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Step 4: Top Succession Recommendations Across Domains</span>
                </span>
                <span className="text-[10px] bg-indigo-800/60 text-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                  Weights: 30% Readiness • 25% Projects • 20% Skills • 15% Experience • 10% Assessment
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Top Overall Suitability */}
                <div className="p-3 bg-white/10 rounded-2xl border border-white/15">
                  <span className="text-[10px] font-bold text-amber-300 uppercase block">1. Highest Overall Suitability</span>
                  <p className="text-sm font-black text-white mt-0.5">
                    {recommendationsData.top_performers.top_overall_suitability?.name || 'None'}
                  </p>
                  <p className="text-[11px] text-amber-200 font-bold mt-1">
                    Suitability Score: {recommendationsData.top_performers.top_overall_suitability?.score}%
                  </p>
                  <span className="text-[10px] text-slate-300 block">
                    {recommendationsData.top_performers.top_overall_suitability?.department}
                  </span>
                </div>

                {/* Top Assessment Scorer */}
                <div className="p-3 bg-white/10 rounded-2xl border border-white/15">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase block">2. Highest Assessment Scorer</span>
                  <p className="text-sm font-black text-white mt-0.5">
                    {recommendationsData.top_performers.top_assessment_scorer?.name || 'None'}
                  </p>
                  <p className="text-[11px] text-indigo-200 font-bold mt-1">
                    Assessment Score: {recommendationsData.top_performers.top_assessment_scorer?.score}%
                  </p>
                  <span className="text-[10px] text-slate-300 block">
                    {recommendationsData.top_performers.top_assessment_scorer?.department}
                  </span>
                </div>

                {/* Strongest Project Performer */}
                <div className="p-3 bg-white/10 rounded-2xl border border-white/15">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase block">3. Strongest Project Performer</span>
                  <p className="text-sm font-black text-white mt-0.5">
                    {recommendationsData.top_performers.top_project_performer?.name || 'None'}
                  </p>
                  <p className="text-[11px] text-emerald-200 font-bold mt-1">
                    Project Success Rate: {recommendationsData.top_performers.top_project_performer?.score}%
                  </p>
                  <span className="text-[10px] text-slate-300 block">
                    {recommendationsData.top_performers.top_project_performer?.department}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 & 3: Cross-Team Candidate Discovery & Evaluation */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Step 2 &amp; 3: Organization-Wide Candidate Pool
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-1">
                  Cross-Team Candidates &amp; Evaluated Suitability ({filteredCandidates.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Includes direct reports of departing manager, peers from other teams, and unassigned employees.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter by name, source, or code..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <select
                  value={candidateCategoryFilter}
                  onChange={(e) => setCandidateCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white"
                >
                  <option value="all">All Statuses ({candidatesData?.counts?.total_considered || 0})</option>
                  <option value="eligible">Eligible for Consideration ({candidatesData?.counts?.eligible_for_consideration || 0})</option>
                  <option value="requires_assessment">Requires Assessment ({candidatesData?.counts?.requires_assessment || 0})</option>
                  <option value="not_eligible">Not Eligible Yet ({candidatesData?.counts?.not_eligible_yet || 0})</option>
                  <option value="insufficient_evidence">Insufficient Evidence ({candidatesData?.counts?.insufficient_evidence || 0})</option>
                </select>
              </div>
            </div>

            {/* Candidates Cards Grid */}
            <div className="space-y-3">
              {filteredCandidates.map(cand => {
                const recCandidate = recommendationsData?.ranked_candidates?.find(r => r.employee_id === cand.employee_id);
                const suitScore = recCandidate?.suitability_score;
                const crit = recCandidate?.criterion_scores || {};

                return (
                  <div
                    key={cand.employee_id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-xs">
                          {cand.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-black text-slate-900">{cand.name}</h4>
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                              {cand.employee_code}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                              Source: {cand.candidate_source}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {cand.designation} • {cand.department} • Reports to: {cand.current_manager_name}
                          </p>
                        </div>
                      </div>

                      {/* Badges & Suitability Score */}
                      <div className="flex items-center space-x-2">
                        {suitScore != null ? (
                          <div className="px-3 py-1 bg-purple-50 text-purple-900 border border-purple-200 rounded-full font-black text-xs flex items-center space-x-1">
                            <span>Suitability:</span>
                            <strong className="text-purple-700">{suitScore}%</strong>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Coverage &lt; 40%
                          </span>
                        )}

                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border flex items-center space-x-1 ${
                          cand.category_badge === 'eligible'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : cand.category_badge === 'requires_assessment'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : cand.category_badge === 'not_eligible'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {cand.category_badge === 'eligible' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {cand.category_badge === 'requires_assessment' && <Clock className="w-3 h-3 text-blue-600" />}
                          {cand.category_badge === 'not_eligible' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {cand.category_badge === 'insufficient_evidence' && <AlertCircle className="w-3 h-3 text-slate-500" />}
                          <span>{cand.category}</span>
                        </span>
                      </div>
                    </div>

                    {/* Criteria Sub-Scores (5 Proposals) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">1. Leadership (30%)</span>
                        <p className="font-black text-slate-900 mt-0.5">
                          {crit.leadership_readiness?.score != null ? `${crit.leadership_readiness.score}%` : 'N/A'}
                        </p>
                        <span className="text-[9px] text-slate-500">Readiness Gap Model</span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">2. Projects (25%)</span>
                        <p className="font-black text-slate-900 mt-0.5">
                          {crit.project_outcomes?.score != null ? `${crit.project_outcomes.score}%` : 'Unverified'}
                        </p>
                        <span className="text-[9px] text-slate-500">Verified Outcomes</span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">3. Skills (20%)</span>
                        <p className="font-black text-slate-900 mt-0.5">
                          {crit.skills_match?.score != null ? `${crit.skills_match.score}%` : 'N/A'}
                        </p>
                        <span className="text-[9px] text-slate-500">Target Role Match</span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">4. Experience (15%)</span>
                        <p className="font-black text-slate-900 mt-0.5">
                          {crit.professional_experience?.score != null ? `${crit.professional_experience.score}%` : `${cand.total_experience_years} yrs`}
                        </p>
                        <span className="text-[9px] text-slate-500">Tenure &amp; History</span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">5. Assessment (10%)</span>
                        <p className="font-black text-slate-900 mt-0.5">
                          {crit.role_assessment?.score != null ? `${crit.role_assessment.score}%` : (cand.has_completed_assessment ? 'Complete' : 'Pending')}
                        </p>
                        <span className="text-[9px] text-slate-500">Role-Specific Test</span>
                      </div>
                    </div>

                    {/* Explanation Narrative */}
                    {recCandidate?.explanation && (
                      <p className="text-[11px] text-slate-600 italic bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                        <strong>Evaluation Note:</strong> {recCandidate.explanation}
                      </p>
                    )}

                    {/* Step 5: HR Actions & Appointment */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="text-[10px] text-slate-500">
                        {cand.unmet_requirements?.length > 0 ? (
                          <span className="text-amber-700">Notice: {cand.unmet_requirements.join('; ')}</span>
                        ) : (
                          <span className="text-emerald-700 font-bold">Candidate meets leadership eligibility prerequisites</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {cand.category_badge === 'requires_assessment' && (
                          <button
                            onClick={() => handleAction(cand.employee_id, 'Request Assessment')}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-colors"
                          >
                            Request Assessment
                          </button>
                        )}

                        <button
                          onClick={() => handleAction(cand.employee_id, 'Shortlist')}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
                        >
                          Shortlist
                        </button>

                        {selectedVacancy.status !== 'Appointed' && (
                          <button
                            onClick={() => setAppointModalItem(cand)}
                            className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow-sm transition-all"
                          >
                            <Crown className="w-3 h-3 text-amber-300" />
                            <span>Appoint as Manager</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCandidates.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No candidates match the current status filter.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Record Manager Departure Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <UserX className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-extrabold">Record Manager Departure</h3>
              </div>
              <button onClick={() => setIsRecordModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordVacancySubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Departing Manager</label>
                <select
                  value={recordForm.departing_manager_id}
                  onChange={(e) => setRecordForm({ ...recordForm, departing_manager_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">Select Departing Manager</option>
                  {allManagers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.employee_code} • {m.designation} • {m.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vacant Managerial Role</label>
                <select
                  value={recordForm.role_id}
                  onChange={(e) => setRecordForm({ ...recordForm, role_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">Auto-Detect from Manager Designation</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective Departure Date</label>
                <input
                  type="date"
                  value={recordForm.effective_departure_date}
                  onChange={(e) => setRecordForm({ ...recordForm, effective_departure_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Departure</label>
                <input
                  type="text"
                  value={recordForm.reason}
                  onChange={(e) => setRecordForm({ ...recordForm, reason: e.target.value })}
                  placeholder="e.g. Retirement, Career move, Relocation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">Database Integrity Guarantee:</p>
                <p>The departing manager's user account and historical records (tasks, projects, performance reviews) will be preserved. Reporting relationships will be marked pending until an HR-approved appointment is made.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVacancy}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center space-x-1"
                >
                  {savingVacancy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                  <span>Record Vacancy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appoint Confirmation Modal */}
      {appointModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-extrabold">Confirm Manager Appointment</h3>
              </div>
              <button onClick={() => setAppointModalItem(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                <p className="font-extrabold text-emerald-950 text-sm">{appointModalItem.name}</p>
                <p className="text-emerald-800">{appointModalItem.designation} • {appointModalItem.department}</p>
                <p className="text-[11px] text-emerald-700 font-medium">
                  Appointing to: <strong>{selectedVacancy?.role_name}</strong>
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-900">Appointment Notes &amp; Rationale</label>
                <textarea
                  rows={3}
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="Record HR committee notes, justification, and transition timeline..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] space-y-1 text-slate-600">
                <p className="font-bold text-slate-800">Transactional Execution:</p>
                <p>1. Promotes candidate designation to <strong>{selectedVacancy?.role_name}</strong>.</p>
                <p>2. Automatically transfers {selectedVacancy?.affected_direct_reports?.length || 0} direct reports of the departing manager to report to {appointModalItem.name}.</p>
                <p>3. Atomically closes vacancy as 'Appointed' and logs audit entry.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAppointModalItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAppointment}
                  disabled={appointing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center space-x-1 shadow-md shadow-emerald-600/30"
                >
                  {appointing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Authorize Appointment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weights Modal */}
      {isWeightsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-extrabold">Configure Scoring Weights</h3>
              </div>
              <button onClick={() => setIsWeightsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveWeights} className="p-6 space-y-3.5 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">1. Leadership Competencies &amp; Readiness</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.readiness_weight}
                    onChange={(e) => setWeightsForm({ ...weightsForm, readiness_weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-right text-xs"
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">2. Performance &amp; Verified Projects</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.projects_weight}
                    onChange={(e) => setWeightsForm({ ...weightsForm, projects_weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-right text-xs"
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">3. Role Skills Match</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.skills_weight}
                    onChange={(e) => setWeightsForm({ ...weightsForm, skills_weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-right text-xs"
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">4. Relevant Experience &amp; Tenure</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.experience_weight}
                    onChange={(e) => setWeightsForm({ ...weightsForm, experience_weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-right text-xs"
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">5. Role Assessment Results</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.assessment_weight}
                    onChange={(e) => setWeightsForm({ ...weightsForm, assessment_weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-right text-xs"
                  />
                  <span>%</span>
                </div>
              </div>

              {(() => {
                const total = (
                  (weightsForm.readiness_weight || 0) +
                  (weightsForm.projects_weight || 0) +
                  (weightsForm.skills_weight || 0) +
                  (weightsForm.experience_weight || 0) +
                  (weightsForm.assessment_weight || 0)
                );
                const isValid = Math.abs(total - 100) < 0.01;
                return (
                  <div className={`p-2.5 rounded-xl border font-bold flex items-center justify-between ${
                    isValid ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    <span>Total Weight Allocation:</span>
                    <span>{total}% {isValid ? '(Valid 100%)' : '(Must Equal 100%)'}</span>
                  </div>
                );
              })()}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWeightsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWeights}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  {savingWeights ? 'Saving...' : 'Apply Weights'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManagerVacancySection;
