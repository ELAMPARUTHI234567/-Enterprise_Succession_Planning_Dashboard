import React, { useEffect, useState } from 'react';
import { 
  Calendar, Clock, Users, AlertTriangle, CheckCircle, 
  X, RefreshCw, Plus, Edit2, Ban, ShieldCheck, Eye, Layers, Filter, CheckSquare, Square
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
  
  // Multi-employee selection
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  
  // Manual Schedule Table Rows: empId -> { date: '', start_time: '', duration: '' }
  // CRITICAL REQUIREMENT: NO DEFAULT DATES, NO DEFAULT TIMES, NO DEFAULT DURATIONS
  const [employeeSchedules, setEmployeeSchedules] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
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

  // Auto-link selected assessment when target role changes
  useEffect(() => {
    if (targetRoleId && assessmentsList.length > 0) {
      const match = assessmentsList.find(a => Number(a.role_id) === Number(targetRoleId));
      if (match) {
        setSelectedAssessmentId(match.id);
        if (!title || title.includes('Leadership Assessment')) {
          setTitle(match.title);
        }
      }
    }
  }, [targetRoleId, assessmentsList]);

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

  // Employee Selection Toggles
  const handleToggleEmployee = (empId) => {
    setSelectedEmpIds(prev => {
      if (prev.includes(empId)) {
        const next = prev.filter(id => id !== empId);
        const nextSchedules = { ...employeeSchedules };
        delete nextSchedules[empId];
        setEmployeeSchedules(nextSchedules);
        return next;
      } else {
        // Do NOT assign default date or time or duration
        setEmployeeSchedules(old => ({
          ...old,
          [empId]: { date: '', start_time: '', duration: '' }
        }));
        return [...prev, empId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([]);
      setEmployeeSchedules({});
    } else {
      const allIds = employees.map(e => e.id);
      setSelectedEmpIds(allIds);
      const newScheds = {};
      allIds.forEach(id => {
        newScheds[id] = employeeSchedules[id] || { date: '', start_time: '', duration: '' };
      });
      setEmployeeSchedules(newScheds);
    }
  };

  // Update schedule row for specific employee
  const handleScheduleChange = (empId, field, val) => {
    setEmployeeSchedules(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { date: '', start_time: '', duration: '' }),
        [field]: val
      }
    }));
  };

  // Helper: calculate end time from start_time (HH:MM) and duration (mins)
  const calculateEndTime = (startTime, durationMins) => {
    if (!startTime || !durationMins || isNaN(durationMins)) return '—';
    const parts = startTime.split(':');
    if (parts.length < 2) return '—';
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hrs) || isNaN(mins)) return '—';

    const totalMins = hrs * 60 + mins + parseInt(durationMins, 10);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  // Validate that every selected employee has explicit manual date, start_time, duration
  const validateIncomplete = () => {
    if (selectedEmpIds.length === 0) return 'Please select at least one employee to schedule.';
    if (!title.trim()) return 'Assessment title is required.';

    for (const empId of selectedEmpIds) {
      const s = employeeSchedules[empId];
      const emp = employees.find(e => e.id === empId);
      const name = emp ? emp.name : `Employee #${empId}`;
      if (!s || !s.date) {
        return `Missing manual assessment date for ${name}. HR must explicitly specify the date for every employee.`;
      }
      if (!s.start_time) {
        return `Missing manual start time for ${name}. HR must explicitly specify the start time for every employee.`;
      }
      if (!s.duration || isNaN(s.duration) || Number(s.duration) <= 0) {
        return `Missing manual duration for ${name}. HR must explicitly enter the duration in minutes for every employee.`;
      }
    }
    return null;
  };

  // Check conflicts with backend
  const handleCheckConflicts = async () => {
    setErrorMsg('');
    if (selectedEmpIds.length === 0) {
      setErrorMsg('Please select at least one employee to check conflicts.');
      return;
    }
    const validationError = validateIncomplete();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setCheckingConflicts(true);
    try {
      const schedules = selectedEmpIds.map(empId => {
        const sched = employeeSchedules[empId] || {};
        const emp = employees.find(e => e.id === empId);
        const calculatedEndTime = calculateEndTime(sched.start_time, sched.duration);
        return {
          employee_id: empId,
          employee_name: emp?.name || `Employee #${empId}`,
          scheduled_date: sched.date,
          date: sched.date,
          start_time: sched.start_time,
          duration_minutes: Number(sched.duration),
          duration: Number(sched.duration),
          end_time: calculatedEndTime,
          time_zone: timeZone
        };
      });

      const res = await assessmentService.checkConflicts({
        schedules,
        allow_simultaneous: allowSimultaneous
      });

      if (res.success) {
        setConflicts(res.data?.conflicts || []);
        if ((res.data?.conflicts || []).length === 0) {
          setSuccessMsg('No scheduling conflicts detected. All manually configured time slots are valid.');
          setTimeout(() => setSuccessMsg(''), 4000);
        } else {
          setErrorMsg(`Detected ${res.data.conflicts.length} scheduling conflicts. Review the conflict warnings before saving.`);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error checking scheduling conflicts');
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Batch Save Manual Schedules
  const handleBatchSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (selectedEmpIds.length === 0) {
      setErrorMsg('Please select at least one employee to schedule.');
      return;
    }

    const validationError = validateIncomplete();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSavingBatch(true);
    try {
      const schedules = selectedEmpIds.map(empId => {
        const sched = employeeSchedules[empId] || {};
        const emp = employees.find(e => e.id === empId);
        const calculatedEndTime = calculateEndTime(sched.start_time, sched.duration);
        return {
          employee_id: empId,
          employee_name: emp?.name || `Employee #${empId}`,
          scheduled_date: sched.date,
          date: sched.date,
          start_time: sched.start_time,
          duration_minutes: Number(sched.duration),
          duration: Number(sched.duration),
          end_time: calculatedEndTime,
          time_zone: timeZone,
          instructions: instructions.trim()
        };
      });

      const payload = {
        assessment_id: selectedAssessmentId ? Number(selectedAssessmentId) : undefined,
        role_id: Number(targetRoleId),
        title: title.trim(),
        description: description.trim(),
        time_zone: timeZone,
        instructions: instructions.trim(),
        allow_simultaneous: allowSimultaneous,
        schedules
      };

      const res = await assessmentService.batchSaveSchedules(payload);
      if (res.success) {
        const count = res.data?.created_count || (Array.isArray(res.data) ? res.data.length : (res.data?.assignments?.length || selectedEmpIds.length));
        setSuccessMsg(`Successfully saved ${count} manual assessment schedule(s) in authoritative database!`);
        // Reset selections
        setSelectedEmpIds([]);
        setEmployeeSchedules({});
        setConflicts([]);
        if (onScheduleCreated) onScheduleCreated();
        setTimeout(() => {
          setActiveSubTab('manage');
          loadSchedules();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Failed to save schedules.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error saving assessment schedules');
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
          <span>Manual Assessment Scheduling Table</span>
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

      {/* SUB-TAB 1: MANUAL SCHEDULING FORM & TABLE */}
      {activeSubTab === 'new' && (
        <form onSubmit={handleBatchSave} className="space-y-6 text-xs">
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

          {/* Employee Multi-Selection Grid */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  2. Select Employees to Schedule ({selectedEmpIds.length} of {employees.length} selected)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select individual candidates or all 10+ employees. You will explicitly configure each candidate&apos;s schedule in the table below.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSelectAllEmployees}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {selectedEmpIds.length === employees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
              {employees.map(emp => {
                const isSelected = selectedEmpIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleToggleEmployee(emp.id)}
                    className={`p-2 rounded-xl border cursor-pointer transition-all flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    <div className="truncate">
                      <p className="text-[11px] truncate leading-tight">{emp.name}</p>
                      <p className="text-[9px] text-slate-400 truncate">{emp.designation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editable Scheduling Table for All Selected Employees */}
          {selectedEmpIds.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    3. Individual Manual Schedule Assignment Table ({selectedEmpIds.length} Candidates)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Mandatory: Enter Date, Start Time, and Duration in minutes for every single candidate. End Time is calculated live.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCheckConflicts}
                  disabled={checkingConflicts}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all self-start sm:self-auto"
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

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Employee Candidate</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Assessment Date *</th>
                      <th className="px-4 py-3">Start Time (HH:MM) *</th>
                      <th className="px-4 py-3">Duration (Mins) *</th>
                      <th className="px-4 py-3 text-center">Calculated End Time</th>
                      <th className="px-4 py-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {selectedEmpIds.map(empId => {
                      const emp = employees.find(e => e.id === empId);
                      const sched = employeeSchedules[empId] || { date: '', start_time: '', duration: '' };
                      const endTime = calculateEndTime(sched.start_time, sched.duration);
                      const isComplete = sched.date && sched.start_time && sched.duration > 0;

                      return (
                        <tr key={empId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-extrabold text-slate-900">{emp?.name || `Employee #${empId}`}</p>
                            <p className="text-[10px] text-slate-400">{emp?.designation} • {emp?.employee_code}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{emp?.department}</td>

                          {/* Date input (EMPTY BY DEFAULT) */}
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              required
                              value={sched.date}
                              onChange={(e) => handleScheduleChange(empId, 'date', e.target.value)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                sched.date ? 'border-slate-300 bg-white' : 'border-amber-300 bg-amber-50/50'
                              }`}
                            />
                          </td>

                          {/* Start time input (EMPTY BY DEFAULT) */}
                          <td className="px-4 py-3">
                            <input
                              type="time"
                              required
                              value={sched.start_time}
                              onChange={(e) => handleScheduleChange(empId, 'start_time', e.target.value)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                sched.start_time ? 'border-slate-300 bg-white' : 'border-amber-300 bg-amber-50/50'
                              }`}
                            />
                          </td>

                          {/* Duration input in minutes (EMPTY BY DEFAULT) */}
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="5"
                              max="300"
                              required
                              placeholder="e.g. 45"
                              value={sched.duration}
                              onChange={(e) => handleScheduleChange(empId, 'duration', e.target.value)}
                              className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                sched.duration ? 'border-slate-300 bg-white' : 'border-amber-300 bg-amber-50/50'
                              }`}
                            />
                          </td>

                          {/* Live Calculated End Time */}
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-md text-xs font-extrabold ${
                              endTime !== '—'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'text-slate-400 bg-slate-50'
                            }`}>
                              {endTime}
                            </span>
                          </td>

                          {/* Remove row */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleEmployee(empId)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remove from batch"
                            >
                              <X className="w-4 h-4" />
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

          {/* Action Save Button */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="font-extrabold text-slate-800">
                Ready to persist {selectedEmpIds.length} manual assignments?
              </p>
              <p className="text-[11px] text-slate-500">
                All assigned start times, durations, and end times will be locked in the authoritative backend.
              </p>
            </div>

            <button
              type="submit"
              disabled={selectedEmpIds.length === 0 || savingBatch}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {savingBatch ? 'Validating & Persisting...' : 'Save & Assign Assessment'}
            </button>
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
