import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Users, AlertCircle, CheckCircle2, 
  X, Loader2, Globe, Shield, UserCheck, AlertTriangle
} from 'lucide-react';
import { assessmentService } from '../services/api';

const TIME_ZONES = [
  'IST (Asia/Kolkata)',
  'UTC',
  'EST (America/New_York)',
  'CST (America/Chicago)',
  'PST (America/Los_Angeles)',
  'GMT (Europe/London)',
  'SGT (Asia/Singapore)'
];

export const ScheduleAssessmentModal = ({
  isOpen,
  onClose,
  roleId,
  roleName = '',
  targetCandidate = null,
  allCandidates = [],
  onSuccess
}) => {
  if (!isOpen) return null;

  const [assessmentsList, setAssessmentsList] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Form State
  const [isBatchMode, setIsBatchMode] = useState(!targetCandidate);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [timeZone, setTimeZone] = useState('IST (Asia/Kolkata)');
  const [instructions, setInstructions] = useState('Complete this leadership assessment autonomously within your allocated time window.');

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    setScheduledDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Initialize selected candidate(s)
  useEffect(() => {
    if (targetCandidate && targetCandidate.employee_id) {
      setSelectedEmpIds([targetCandidate.employee_id]);
      setIsBatchMode(false);
    } else {
      // In batch mode, pre-select all eligible candidates
      const eligibleIds = allCandidates
        .filter(c => c.is_eligible || c.status === 'Eligible for assessment')
        .map(c => c.employee_id);
      setSelectedEmpIds(eligibleIds);
      setIsBatchMode(true);
    }
  }, [targetCandidate, allCandidates]);

  // Fetch available assessments
  useEffect(() => {
    setLoadingAssessments(true);
    assessmentService.getAll().then(res => {
      if (res?.success && Array.isArray(res.data)) {
        setAssessmentsList(res.data);
        // Find matching assessment for role
        const match = res.data.find(a => Number(a.role_id) === Number(roleId));
        if (match) {
          setSelectedAssessmentId(String(match.id));
        } else if (res.data.length > 0) {
          setSelectedAssessmentId(String(res.data[0].id));
        }
      }
    }).catch(err => {
      console.error('Failed to load assessments:', err);
    }).finally(() => {
      setLoadingAssessments(false);
    });
  }, [roleId]);

  // Calculate duration in minutes
  const calculateDuration = () => {
    if (!startTime || !endTime) return 60;
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      return diff > 0 ? diff : 0;
    } catch {
      return 60;
    }
  };

  const durationMinutes = calculateDuration();

  const handleToggleEmp = (empId, isEligible) => {
    if (!isEligible) return; // Ineligible candidates cannot be selected
    setSelectedEmpIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllEligible = () => {
    const eligibleIds = allCandidates
      .filter(c => c.is_eligible || c.status === 'Eligible for assessment')
      .map(c => c.employee_id);
    setSelectedEmpIds(eligibleIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmpIds([]);
  };

  const validateForm = () => {
    if (!scheduledDate) return 'Assessment date is required.';
    if (!startTime) return 'Start time is required.';
    if (!endTime) return 'End time is required.';
    if (durationMinutes <= 0) return 'End time must be strictly after start time.';
    if (selectedEmpIds.length === 0) return 'At least one eligible candidate must be selected.';
    return null;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const valErr = validateForm();
    if (valErr) {
      setErrorMsg(valErr);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        assessment_id: selectedAssessmentId ? Number(selectedAssessmentId) : undefined,
        role_id: Number(roleId),
        title: `${roleName || 'Leadership'} Scheduled Assessment`,
        time_zone: timeZone,
        instructions: instructions.trim(),
        employee_ids: selectedEmpIds,
        scheduled_date: scheduledDate,
        date: scheduledDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        duration: durationMinutes
      };

      const res = await assessmentService.batchSaveSchedules(payload);

      if (res && res.success) {
        const count = res.data?.created_count || selectedEmpIds.length;
        setSuccessMsg(`Successfully scheduled assessment for ${count} candidate(s)! Assessment window: ${scheduledDate} from ${startTime} to ${endTime} (${timeZone}).`);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(res?.message || 'Failed to schedule assessment. Please verify permissions and candidate eligibility.');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'An error occurred while scheduling assessment.';
      setErrorMsg(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const eligibleCandidatesCount = allCandidates.filter(c => c.is_eligible || c.status === 'Eligible for assessment').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                {targetCandidate ? `Schedule Assessment: ${targetCandidate.employee_name || targetCandidate.name}` : 'Assign Assessment & Schedules'}
              </h3>
              <p className="text-xs text-indigo-200/80">
                Target Role: <strong className="text-white">{roleName || 'Leadership Role'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start space-x-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-bold">Scheduling Error</p>
                <p className="text-[11px] font-medium leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start space-x-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-bold">Assessment Scheduled Successfully</p>
                <p className="text-[11px] font-medium leading-relaxed">{successMsg}</p>
              </div>
            </div>
          )}

          {/* Assessment Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900">
              Assessment Template
            </label>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              disabled={loadingAssessments}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {assessmentsList.map(ass => (
                <option key={ass.id} value={ass.id}>
                  {ass.title} ({ass.duration || 30} mins • Passing: {ass.passing_threshold || 70}%)
                </option>
              ))}
              {assessmentsList.length === 0 && (
                <option value="">{loadingAssessments ? 'Loading assessments...' : `${roleName} Leadership Assessment (Role Blueprint)`}</option>
              )}
            </select>
          </div>

          {/* Candidate Selection Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Selected Eligible Candidate(s) ({selectedEmpIds.length})</span>
              </label>
              {allCandidates.length > 1 && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllEligible}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                  >
                    Select All Eligible ({eligibleCandidatesCount})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-[11px] text-slate-500 hover:text-slate-700 font-medium hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Candidates Selection Box */}
            <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-2 space-y-1.5">
              {allCandidates.map(cand => {
                const eid = cand.employee_id || cand.id;
                const isEligible = cand.is_eligible || cand.status === 'Eligible for assessment';
                const isSelected = selectedEmpIds.includes(eid);

                return (
                  <div
                    key={eid}
                    onClick={() => isEligible && handleToggleEmp(eid, isEligible)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected && isEligible
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold'
                        : isEligible
                          ? 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer text-slate-800'
                          : 'bg-slate-100/70 border-slate-200/80 text-slate-400 opacity-75 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isEligible}
                        onChange={() => {}}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs">{cand.employee_name || cand.name}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-200/60 px-1.5 py-0.2 rounded font-mono">
                            {cand.employee_code}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          {cand.designation} • {cand.department}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isEligible ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Eligible</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1" title={(cand.unmet_requirements || []).join('; ')}>
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Not Eligible Yet</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {allCandidates.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No candidates available in current team scope.
                </div>
              )}
            </div>
          </div>

          {/* Timing Window Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Assessment Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                End Time ({durationMinutes} mins)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Timezone Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center space-x-1">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span>Timezone</span>
              </label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TIME_ZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Server-Side Question Generation</span>
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-medium">
                Fresh role-specific question sets generated dynamically upon assignment.
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-900">
              Candidate Notice &amp; Instructions
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Enter special instructions or prerequisites for candidates..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Selected: <strong className="text-slate-800">{selectedEmpIds.length}</strong> eligible candidate(s)
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedEmpIds.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scheduling Assessment...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Confirm Schedule ({selectedEmpIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScheduleAssessmentModal;
