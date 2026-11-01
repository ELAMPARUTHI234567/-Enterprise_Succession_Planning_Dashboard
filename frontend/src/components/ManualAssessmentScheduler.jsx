import React, { useEffect, useState, useMemo } from 'react';
import { 
  Calendar, Clock, Users, AlertTriangle, CheckCircle, 
  X, RefreshCw, Plus, Edit2, Ban, ShieldCheck, Eye, Layers, Filter, CheckSquare, Square,
  Sparkles, CheckCircle2, AlertCircle, HelpCircle
} from 'lucide-react';
import { assessmentService, roleService } from '../services/api';

const TIME_ZONES = [
  'IST (Asia/Kolkata)',
  'UTC',
  'EST (America/New_York)',
  'CST (America/Chicago)',
  'PST (America/Los_Angeles)',
  'GMT (Europe/London)',
  'SGT (Asia/Singapore)'
];

export const ManualAssessmentScheduler = ({ roles = [], employees = [], assessments = [], onScheduleCreated }) => {
  const [activeSubTab, setActiveSubTab] = useState('new'); // 'new' | 'manage'
  
  // Schedule Form State
  const [assessmentsList, setAssessmentsList] = useState(assessments || []);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetRoleId, setTargetRoleId] = useState('');
  const [timeZone, setTimeZone] = useState('IST (Asia/Kolkata)');
  const [instructions, setInstructions] = useState('Complete this leadership assessment autonomously within your allocated time window.');
  const [allowSimultaneous, setAllowSimultaneous] = useState(false);
  
  // Pre-Assessment Eligibility Filtering State
  const [preAssessmentData, setPreAssessmentData] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [onlyEligibleFilter, setOnlyEligibleFilter] = useState(true);

  // Common Window State (Batch apply shared date/time to all selected)
  const [commonDate, setCommonDate] = useState('');
  const [commonStartTime, setCommonStartTime] = useState('');
  const [commonEndTime, setCommonEndTime] = useState('');
  const [commonDuration, setCommonDuration] = useState('');

  // Multi-employee selection
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [rejectedList, setRejectedList] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Management State
  const [schedulesList, setSchedulesList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Reschedule / Cancel Modal
  const [rescheduleModalItem, setRescheduleModalItem] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleDuration, setRescheduleDuration] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Sync assessments prop if updated externally
  useEffect(() => {
    if (assessments && assessments.length > 0) {
      setAssessmentsList(assessments);
    }
  }, [assessments]);

  // Load assessments if not passed as prop
  useEffect(() => {
    if (assessmentsList.length === 0) {
      assessmentService.getAll().then(res => {
        if (res?.success && res?.data) {
          setAssessmentsList(res.data);
        }
      }).catch(err => console.error('Error fetching assessments:', err));
    }
  }, []);

  // Initialize target role and assessment title when roles load
  useEffect(() => {
    if (roles.length > 0 && !targetRoleId) {
      setTargetRoleId(roles[0].id);
      setTitle(`${roles[0].role_name} Leadership Assessment`);
    }
  }, [roles]);

  // Auto-link selected assessment and load pre-assessment candidates when target role changes
  useEffect(() => {
    if (targetRoleId) {
      if (assessmentsList.length > 0) {
        const match = assessmentsList.find(a => Number(a.role_id) === Number(targetRoleId));
        if (match) {
          setSelectedAssessmentId(match.id);
          if (!title || title.includes('Leadership Assessment')) {
            setTitle(match.title);
          }
        }
      }

      // Fetch pre-assessment candidates evaluated for target role
      setEligibilityLoading(true);
      roleService.getPreAssessmentCandidates(targetRoleId)
        .then(res => {
          if (res?.success && res?.data) {
            setPreAssessmentData(res.data);
          }
        })
        .catch(err => console.error('Error fetching pre-assessment candidates:', err))
        .finally(() => setEligibilityLoading(false));
    }
  }, [targetRoleId, assessmentsList]);

  // Eligibility Lookup Map: employee_id -> candidate pre-assessment evaluation
  const eligibilityMap = useMemo(() => {
    const map = {};
    if (preAssessmentData?.all_candidates) {
      preAssessmentData.all_candidates.forEach(c => {
        map[c.employee_id] = c;
      });
    }
    return map;
  }, [preAssessmentData]);

  const loadSchedules = async () => {
    setListLoading(true);
    try {
      const res = await assessmentService.getSchedules();
      if (res.success) {
        setSchedulesList(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'manage') {
      loadSchedules();
    }
  }, [activeSubTab]);

  // Employee Selection Toggles - Enforce Pre-Assessment Eligibility
  const handleToggleEmployee = (empId) => {
    const cand = eligibilityMap[empId];
    if (cand && !cand.is_eligible) {
      const unmetStr = (cand.unmet_requirements || []).join('; ') || cand.status || 'Prerequisites not met';
      setErrorMsg(`Cannot select ${cand.employee_name || 'candidate'}: Not eligible for this role. Reason(s): ${unmetStr}`);
      setTimeout(() => setErrorMsg(''), 6000);
      return;
    }

    setSelectedEmpIds(prev => {
      if (prev.includes(empId)) {
        return prev.filter(id => id !== empId);
      } else {
        return [...prev, empId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    // Only select employees who are pre-assessment eligible
    const eligibleEmployees = employees.filter(e => {
      const c = eligibilityMap[e.id];
      return c ? c.is_eligible : true;
    });
    const eligibleIds = eligibleEmployees.map(e => e.id);

    if (selectedEmpIds.length === eligibleIds.length && eligibleIds.length > 0) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(eligibleIds);
    }
  };

  // Helper: calculate duration between start_time and end_time (HH:MM)
  const calculateDurationMins = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const sParts = startTime.split(':').map(Number);
    const eParts = endTime.split(':').map(Number);
    if (sParts.length < 2 || eParts.length < 2) return 0;
    const [sH, sM] = sParts;
    const [eH, eM] = eParts;
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
    return (eH * 60 + eM) - (sH * 60 + sM);
  };

  // Helper: calculate end time from start_time (HH:MM) and duration (mins)
  const calculateEndTimeFromDuration = (startTime, durationMins) => {
    if (!startTime || !durationMins || isNaN(durationMins)) return '';
    const parts = startTime.split(':');
    if (parts.length < 2) return '';
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hrs) || isNaN(mins)) return '';

    const totalMins = hrs * 60 + mins + parseInt(durationMins, 10);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (val) => {
    setCommonStartTime(val);
    if (val && commonEndTime) {
      const dur = calculateDurationMins(val, commonEndTime);
      if (dur > 0) setCommonDuration(dur);
    } else if (val && commonDuration && Number(commonDuration) > 0) {
      setCommonEndTime(calculateEndTimeFromDuration(val, commonDuration));
    }
  };

  const handleEndTimeChange = (val) => {
    setCommonEndTime(val);
    if (commonStartTime && val) {
      const dur = calculateDurationMins(commonStartTime, val);
      if (dur > 0) {
        setCommonDuration(dur);
      }
    }
  };

  const handleDurationChange = (val) => {
    setCommonDuration(val);
    if (commonStartTime && val && Number(val) > 0) {
      setCommonEndTime(calculateEndTimeFromDuration(commonStartTime, val));
    }
  };

  // Validate unified batch form
  const validateBatchForm = () => {
    if (!targetRoleId) return 'Please select a target leadership role.';
    if (selectedEmpIds.length === 0) return 'Please select at least one eligible employee to schedule.';
    if (!title.trim()) return 'Assessment title is required.';
    if (!commonDate) return 'Assessment date is required. HR must explicitly specify the date.';
    if (!commonStartTime) return 'Assessment start time is required. HR must explicitly specify the start time.';
    if (!commonEndTime) return 'Assessment end time is required. HR must explicitly specify the end time.';

    const dur = calculateDurationMins(commonStartTime, commonEndTime);
    if (dur <= 0) {
      return `Invalid time range: End time (${commonEndTime}) must be strictly after start time (${commonStartTime}).`;
    }

    // Verify all selected candidates are pre-assessment eligible
    for (const empId of selectedEmpIds) {
      const cand = eligibilityMap[empId];
      if (cand && !cand.is_eligible) {
        return `Candidate ${cand.employee_name || empId} does not meet pre-assessment eligibility requirements.`;
      }
    }

    return null;
  };

  // Check conflicts with backend for all selected candidates
  const handleCheckConflicts = async () => {
    setErrorMsg('');
    const valErr = validateBatchForm();
    if (valErr) {
      setErrorMsg(valErr);
      return;
    }

    setCheckingConflicts(true);
    try {
      const dur = calculateDurationMins(commonStartTime, commonEndTime);
      const schedules = selectedEmpIds.map(empId => {
        const emp = employees.find(e => e.id === empId);
        return {
          employee_id: empId,
          employee_name: emp?.name || `Employee #${empId}`,
          scheduled_date: commonDate,
          date: commonDate,
          start_time: commonStartTime,
          end_time: commonEndTime,
          duration_minutes: dur,
          duration: dur,
          time_zone: timeZone
        };
      });

      const res = await assessmentService.checkConflicts({
        schedules,
        allow_simultaneous: true
      });

      if (res.success) {
        setConflicts(res.data?.conflicts || []);
        if ((res.data?.conflicts || []).length === 0) {
          setSuccessMsg('No scheduling conflicts detected. All selected candidates are available for this shared schedule window.');
          setTimeout(() => setSuccessMsg(''), 4500);
        } else {
          setErrorMsg(`Detected ${res.data.conflicts.length} scheduling conflict(s). Review conflict warnings before saving.`);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error checking scheduling conflicts');
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Batch Assessment Assignment (Single Button Submission)
  const handleAssignAssessment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setRejectedList([]);

    const valErr = validateBatchForm();
    if (valErr) {
      setErrorMsg(valErr);
      return;
    }

    setSavingBatch(true);
    try {
      const dur = calculateDurationMins(commonStartTime, commonEndTime);
      const payload = {
        assessment_id: selectedAssessmentId ? Number(selectedAssessmentId) : undefined,
        role_id: Number(targetRoleId),
        title: title.trim(),
        description: description.trim(),
        time_zone: timeZone,
        instructions: instructions.trim(),
        allow_simultaneous: true,
        employee_ids: selectedEmpIds,
        scheduled_date: commonDate,
        date: commonDate,
        start_time: commonStartTime,
        end_time: commonEndTime,
        duration_minutes: dur,
        duration: dur
      };

      const res = await assessmentService.batchSaveSchedules(payload);
      if (res.success) {
        const count = res.data?.created_count || (res.data?.assignments?.length || selectedEmpIds.length);
        const rejected = res.data?.rejected || [];
        setRejectedList(rejected);

        let msg = `Successfully assigned assessment to ${count} employee(s) with synchronized timing window!`;
        if (rejected.length > 0) {
          msg += ` Note: ${rejected.length} candidate(s) could not be assigned.`;
        }
        setSuccessMsg(msg);

        // Reset selections
        setSelectedEmpIds([]);
        setConflicts([]);
        if (onScheduleCreated) onScheduleCreated();
        setTimeout(() => {
          setActiveSubTab('manage');
          loadSchedules();
        }, 1800);
      } else {
        setErrorMsg(res.message || 'Failed to assign assessments.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error assigning assessments');
    } finally {
      setSavingBatch(false);
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = (item) => {
    setRescheduleModalItem(item);
    setRescheduleDate(item.scheduled_date || '');
    setRescheduleStartTime(item.start_time || '');
    setRescheduleDuration(item.duration_minutes || '');
    setRescheduleReason('');
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleStartTime || !rescheduleDuration) {
      alert('Date, start time, and duration are required.');
      return;
    }
    setRescheduleSubmitting(true);
    try {
      const res = await assessmentService.reschedule(rescheduleModalItem.id, {
        date: rescheduleDate,
        start_time: rescheduleStartTime,
        duration: Number(rescheduleDuration),
        reason: rescheduleReason.trim()
      });
      if (res.success) {
        setRescheduleModalItem(null);
        loadSchedules();
      }
    } catch (err) {
      alert(err.message || 'Error rescheduling assessment');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Open Cancel Modal
  const openCancelModal = (item) => {
    setCancelModalItem(item);
    setCancelReason('');
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setCancelSubmitting(true);
    try {
      const res = await assessmentService.cancelSchedule(cancelModalItem.id, cancelReason.trim());
      if (res.success) {
        setCancelModalItem(null);
        loadSchedules();
      }
    } catch (err) {
      alert(err.message || 'Error cancelling assessment');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Filtered manage list
  const filteredSchedules = schedulesList.filter(s => {
    if (statusFilter === 'all') return true;
    const status = (s.schedule_status || s.status || '').toLowerCase();
    return status === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('new')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
            activeSubTab === 'new'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Batch Assessment Scheduling</span>
        </button>
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
            activeSubTab === 'manage'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Manage Active Schedules ({schedulesList.length})</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SUB-TAB 1: BATCH SCHEDULING FORM */}
      {activeSubTab === 'new' && (
        <form onSubmit={handleAssignAssessment} className="space-y-6 text-xs">
          {/* Scheduling Guidelines Banner */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs space-y-1">
            <h4 className="font-extrabold text-indigo-950 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Strict HR Manual Scheduling Policy</span>
            </h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Every assessment date, start time, and duration in minutes must be entered explicitly by authorized HR personnel. The system never generates random, default, or sequential appointment times. Incomplete schedules cannot be saved.
            </p>
          </div>

          {/* Assessment Header Configuration */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              1. Assessment Information &amp; Scope
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Assessment Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Executive Engineering Leadership Readiness Assessment"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Leadership Role *</label>
                <select
                  value={targetRoleId}
                  onChange={(e) => {
                    const newRoleId = e.target.value;
                    setTargetRoleId(newRoleId);
                    const matching = assessmentsList.find(a => Number(a.role_id) === Number(newRoleId));
                    if (matching) {
                      setSelectedAssessmentId(matching.id);
                      setTitle(matching.title);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assessment Template</label>
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAssessmentId(val);
                    if (val) {
                      const found = assessmentsList.find(a => String(a.id) === String(val));
                      if (found) {
                        setTitle(found.title);
                        if (found.role_id) setTargetRoleId(found.role_id);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Linked Assessment Template --</option>
                  {assessmentsList
                    .filter(a => !targetRoleId || Number(a.role_id) === Number(targetRoleId))
                    .map(a => (
                      <option key={a.id} value={a.id}>#{a.id} - {a.title}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Authoritative Time Zone *</label>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  {TIME_ZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Instructions for Candidates</label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Rules, environment requirements, proctoring guidelines..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">Assessment Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of competency goals and evaluated objectives..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3 flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="simultaneous_checkbox"
                  checked={allowSimultaneous}
                  onChange={(e) => setAllowSimultaneous(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="simultaneous_checkbox" className="font-semibold text-slate-700 cursor-pointer">
                  Allow deliberate simultaneous participation sessions (allows multiple candidates scheduled for the same time window)
                </label>
              </div>
            </div>
          </div>

          {/* Employee Multi-Selection Grid with Pre-Assessment Eligibility Filtering */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    2. Select Eligible Candidates to Schedule ({selectedEmpIds.length} of {employees.length} selected)
                  </h3>
                  {eligibilityLoading && (
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Pre-assessment eligibility evaluates verified projects, skill requirements, experience, and competency thresholds.
                </p>
              </div>

              {/* Filtering & Quick Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {preAssessmentData?.summary && (
                  <div className="flex items-center space-x-1.5 text-[10px] font-bold mr-2">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {preAssessmentData.summary.eligible} Eligible
                    </span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      {preAssessmentData.summary.not_eligible} Not Eligible
                    </span>
                    {preAssessmentData.summary.insufficient_data > 0 && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-slate-500" />
                        {preAssessmentData.summary.insufficient_data} Incomplete
                      </span>
                    )}
                  </div>
                )}

                <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={onlyEligibleFilter}
                    onChange={(e) => setOnlyEligibleFilter(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <span>Only Show Eligible Candidates</span>
                </label>

                <button
                  type="button"
                  onClick={handleSelectAllEmployees}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition-colors"
                >
                  {selectedEmpIds.length > 0 ? 'Deselect All' : 'Select All Eligible'}
                </button>
              </div>
            </div>

            {/* Candidate Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {employees
                .filter(emp => {
                  if (!onlyEligibleFilter) return true;
                  const cand = eligibilityMap[emp.id];
                  return cand ? cand.is_eligible : true;
                })
                .map(emp => {
                  const isSelected = selectedEmpIds.includes(emp.id);
                  const cand = eligibilityMap[emp.id];
                  const isEligible = cand ? cand.is_eligible : true;
                  const isInsufficient = cand?.status === 'Insufficient data for reliable evaluation';

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-400 shadow-sm'
                          : isEligible
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                            : 'bg-rose-50/30 border-rose-200 hover:bg-rose-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center space-x-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={cand && !cand.is_eligible}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 text-indigo-600 rounded"
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 truncate leading-tight">{emp.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{emp.designation}</p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {cand && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center space-x-0.5 ${
                            isEligible
                              ? 'bg-emerald-100 text-emerald-800'
                              : isInsufficient
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isEligible ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 inline mr-0.5" />
                                <span>Eligible</span>
                              </>
                            ) : isInsufficient ? (
                              <span>Incomplete</span>
                            ) : (
                              <span>Pending</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Mini Evidence Details */}
                      {cand && (
                        <div className="text-[10px] text-slate-600 space-y-0.5 bg-white/70 rounded-lg p-1.5 border border-slate-100">
                          <div className="flex justify-between items-center text-[9px]">
                            <span>Skills Match: <strong className="text-indigo-700">{cand.skill_match_pct}%</strong></span>
                            <span>Projects: <strong className="text-slate-800">{cand.verified_projects_count} verified ({cand.project_success_rate}%)</strong></span>
                          </div>
                          {!isEligible && (cand.unmet_requirements || []).length > 0 && (
                            <p className="text-[9px] text-rose-600 font-semibold truncate" title={cand.unmet_requirements.join(', ')}>
                              • {cand.unmet_requirements[0]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* SECTION 3: Common Assessment Schedule & Time Window */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  3. Common Assessment Schedule &amp; Time Window
                </h3>
                <p className="text-[11px] text-slate-500">
                  HR specifies one date, one start time, and one end time. This exact schedule window applies to all selected candidates.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-500">Time Zone:</span>
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
                  {timeZone}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assessment Date *</label>
                <input
                  type="date"
                  required
                  value={commonDate}
                  onChange={(e) => setCommonDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Start Time (HH:MM) *</label>
                <input
                  type="time"
                  required
                  value={commonStartTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">End Time (HH:MM) *</label>
                <input
                  type="time"
                  required
                  value={commonEndTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Live Window Details & Presets */}
            <div className="p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-600">Calculated Assessment Window:</span>
                {commonStartTime && commonEndTime ? (
                  calculateDurationMins(commonStartTime, commonEndTime) > 0 ? (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-lg">
                      {calculateDurationMins(commonStartTime, commonEndTime)} minutes ({commonStartTime} to {commonEndTime})
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> End time must be after start time
                    </span>
                  )
                ) : (
                  <span className="text-slate-400 italic">Select start and end times above</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Quick Set Duration:</span>
                {[30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleDurationChange(mins)}
                    disabled={!commonStartTime}
                    className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors disabled:opacity-40"
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: Schedule Summary & Batch Assignment */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  4. Review Batch Summary &amp; Assign Assessment
                </h3>
                <p className="text-[11px] text-slate-500">
                  Review selected candidates, unified schedule window, and assign with one click.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCheckConflicts}
                disabled={checkingConflicts || selectedEmpIds.length === 0}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all self-start sm:self-auto disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingConflicts ? 'animate-spin' : ''}`} />
                <span>Check Conflict Warnings</span>
              </button>
            </div>

            {/* Conflict Warnings Box if any */}
            {conflicts.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <p className="text-xs font-bold text-amber-900 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Scheduling Conflicts Identified ({conflicts.length}):</span>
                </p>
                <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-0.5">
                  {conflicts.map((c, idx) => (
                    <li key={idx}>
                      Candidate: <strong>{c.employee_name || c.employee_id}</strong> on {c.date} ({c.start_time} - {c.end_time})
                      {c.message && ` — ${c.message}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rejected / Skipped Candidates Feedback Banner */}
            {rejectedList.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                <p className="text-xs font-extrabold text-rose-900 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Rejected / Skipped Assignments ({rejectedList.length}):</span>
                </p>
                <ul className="text-[11px] text-rose-800 list-disc list-inside space-y-1">
                  {rejectedList.map((rej, idx) => (
                    <li key={idx}>
                      <strong>{rej.employee_name || `Employee #${rej.employee_id}`}</strong>: {rej.reason || 'Not assigned'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selected Candidates Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700">
                  Selected Candidates ({selectedEmpIds.length}):
                </span>
                {selectedEmpIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmpIds([])}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selectedEmpIds.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  No eligible candidates selected yet. Check candidates in Section 2 above to include them in this batch.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {selectedEmpIds.map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    return (
                      <span
                        key={empId}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-900 rounded-lg text-xs font-bold shadow-sm"
                      >
                        <span>{emp?.name || `Employee #${empId}`}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({emp?.designation || emp?.department})</span>
                        <button
                          type="button"
                          onClick={() => handleToggleEmployee(empId)}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Unified Summary Breakdown Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Target Leadership Role</p>
                <p className="font-extrabold text-slate-800">
                  {roles.find(r => String(r.id) === String(targetRoleId))?.role_name || `Role #${targetRoleId}`}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Assessment Title</p>
                <p className="font-extrabold text-slate-800 truncate" title={title}>
                  {title || '—'}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Assessment Window</p>
                <p className="font-extrabold text-indigo-900">
                  {commonDate && commonStartTime && commonEndTime
                    ? `${commonDate} (${commonStartTime} - ${commonEndTime})`
                    : 'Not fully configured'}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Integrity &amp; Timing Rule</p>
                <p className="font-semibold text-emerald-800 text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Authoritative (15m early window)</span>
                </p>
              </div>
            </div>

            {/* Action Submit Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-slate-600 text-[11px]">
                Clicking <strong>Assign Assessment</strong> will create and persist an assignment for each of the {selectedEmpIds.length} candidate(s) with identical start and end time windows, and generate unique role-specific question sets.
              </div>

              <button
                type="submit"
                disabled={selectedEmpIds.length === 0 || savingBatch}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shrink-0"
              >
                {savingBatch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Assigning Assessment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Assign Assessment ({selectedEmpIds.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: MANAGE ACTIVE SCHEDULES */}
      {activeSubTab === 'manage' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Filter by Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
              >
                <option value="all">All Statuses ({schedulesList.length})</option>
                <option value="scheduled">Scheduled</option>
                <option value="in progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              onClick={loadSchedules}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Schedules Table */}
          {listLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-500">Loading schedules...</p>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No schedules found matching current filter.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Candidate</th>
                      <th className="px-5 py-3.5">Assessment Title</th>
                      <th className="px-5 py-3.5">Target Role</th>
                      <th className="px-5 py-3.5">Scheduled Date</th>
                      <th className="px-5 py-3.5">Time Window</th>
                      <th className="px-5 py-3.5 text-center">Duration</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredSchedules.map(item => {
                      const schedStatus = item.schedule_status || item.status || 'Scheduled';
                      const isCancelled = schedStatus.toLowerCase() === 'cancelled';
                      const isCompleted = schedStatus.toLowerCase() === 'completed';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-extrabold text-slate-900">{item.employee_name || `Employee #${item.employee_id}`}</p>
                            <p className="text-[10px] text-slate-400">{item.department || 'Staff'}</p>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">{item.assessment_title}</td>
                          <td className="px-5 py-3.5 text-slate-600">{item.role_name || 'Executive'}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">{item.scheduled_date || item.due_date}</td>
                          <td className="px-5 py-3.5">
                            {item.start_time ? (
                              <span className="font-bold text-indigo-700">
                                {item.start_time} - {item.end_time || 'End'} ({item.time_zone || 'IST'})
                              </span>
                            ) : (
                              <span className="text-slate-400">Standard due date</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold">
                            {item.duration_minutes || item.duration || 30} mins
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              schedStatus === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : schedStatus === 'In Progress'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : schedStatus === 'Cancelled'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              • {schedStatus}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-right space-x-1.5">
                            {!isCompleted && !isCancelled && (
                              <>
                                <button
                                  onClick={() => openRescheduleModal(item)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors"
                                  title="Reschedule"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => openCancelModal(item)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                                  title="Cancel Assignment"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
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

      {/* RESCHEDULE MODAL */}
      {rescheduleModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Reschedule Assessment</h3>
                <p className="text-[11px] text-slate-500">{rescheduleModalItem.employee_name} • {rescheduleModalItem.assessment_title}</p>
              </div>
              <button onClick={() => setRescheduleModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Assessment Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Start Time *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Mins) *</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    required
                    value={rescheduleDuration}
                    onChange={(e) => setRescheduleDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rescheduling Reason / Justification</label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Schedule clash with executive review meeting..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleModalItem(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/30"
                >
                  {rescheduleSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Cancel Assessment Assignment</h3>
                <p className="text-[11px] text-slate-500">{cancelModalItem.employee_name} • {cancelModalItem.assessment_title}</p>
              </div>
              <button onClick={() => setCancelModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Are you sure you want to cancel this scheduled assessment assignment? The candidate will no longer be able to start this session.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cancellation Reason</label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Employee role transition or project conflict..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelModalItem(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/30"
                >
                  {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualAssessmentScheduler;
