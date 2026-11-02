import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, Users, Award, CheckCircle2, AlertCircle, ShieldCheck, 
  Layers, Search, Filter, ArrowRight, Eye, RefreshCw, Loader2, 
  CheckSquare, Square, UserCheck, FileText, Sparkles, X, ChevronRight, AlertTriangle
} from 'lucide-react';
import { assessmentService, roleService, employeeService } from '../services/api';
import StatusBadge from './StatusBadge';
import AssessmentResultView from './AssessmentResultView';

export const AssessmentAssignmentEvaluation = ({ onRefresh }) => {
  // Step 1 & 2: Department and Manager Selection
  const [department, setDepartment] = useState('All');
  const [selectedManagerId, setSelectedManagerId] = useState('All');
  const [managers, setManagers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Step 4: Multi-select employees
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);

  // Step 5 & 6: Target Leadership Role and Auto-loaded Assessment
  const [targetRoleId, setTargetRoleId] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  // Step 7 & 8: Date, Time, Duration & Submission Window
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const defaultStartTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }, []);

  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [instructions, setInstructions] = useState('Complete this leadership assessment autonomously within your allocated time window.');
  const [timeZone, setTimeZone] = useState('IST (Asia/Kolkata)');

  // Step 9: Assignment State & Feedback
  const [assigning, setAssigning] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [batchResult, setBatchResult] = useState(null);

  // Step 10: Track Assignment & Completion Status
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Scheduled' | 'In Progress' | 'Completed' | 'Expired'
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [selectedResultForModal, setSelectedResultForModal] = useState(null);

  // Two-Stage Workflow: Stage 1 Eligible Screened Employees State
  const [activeHubView, setActiveHubView] = useState('assignment'); // 'assignment' | 'eligible-screened'
  const [eligibleScreened, setEligibleScreened] = useState([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [screenedSearch, setScreenedSearch] = useState('');
  const [screenedDeptFilter, setScreenedDeptFilter] = useState('All');

  // Fast set lookup for Stage 1 passed employee IDs
  const eligibleScreenedEmpIds = useMemo(() => {
    return new Set(eligibleScreened.map(e => e.employee_id));
  }, [eligibleScreened]);

  // Calculate calculated end time based on startTime + durationMinutes
  const calculatedEndTime = useMemo(() => {
    if (!startTime) return '10:30';
    try {
      const [h, m] = startTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + Number(durationMinutes);
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    } catch {
      return '10:30';
    }
  }, [startTime, durationMinutes]);

  // Load initial managers, employees, roles, assessments, and existing schedules
  const loadInitialData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [mgrRes, empRes, roleRes, assRes] = await Promise.all([
        employeeService.getManagers().catch(() => ({ success: false, data: [] })),
        employeeService.getAll().catch(() => ({ success: false, data: [] })),
        (roleService.getRoles || roleService.getAll)().catch(() => ({ success: false, data: [] })),
        assessmentService.getAll().catch(() => ({ success: false, data: [] }))
      ]);

      if (mgrRes?.success) setManagers(mgrRes.data || []);
      if (empRes?.success) setAllEmployees(empRes.data || []);
      
      const loadedRoles = roleRes?.success ? (roleRes.data || []) : [];
      setRoles(loadedRoles);

      const loadedAss = assRes?.success ? (assRes.data || []) : [];
      setAssessments(loadedAss);

      if (loadedRoles.length > 0 && !targetRoleId) {
        setTargetRoleId(String(loadedRoles[0].id));
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setActionError('Failed to load system data. Please verify network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const res = await assessmentService.getSchedules();
      if (res?.success) {
        setSchedules(res.data || []);
      }
    } catch (err) {
      console.warn('Could not load assessment schedules:', err);
    } finally {
      setSchedulesLoading(false);
    }
  };

  const loadEligibleScreened = async () => {
    setLoadingEligible(true);
    try {
      const res = await assessmentService.getEligibleScreenedEmployees();
      if (res?.success) {
        setEligibleScreened(res.data || []);
      }
    } catch (err) {
      console.warn('Could not load eligible screened employees:', err);
    } finally {
      setLoadingEligible(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    loadSchedules();
    loadEligibleScreened();
  }, []);

  // When targetRoleId or assessments change, auto-load role-specific assessment details
  useEffect(() => {
    if (!targetRoleId) return;
    const roleIdNum = Number(targetRoleId);
    const matchedAss = assessments.find(a => Number(a.role_id) === roleIdNum);
    setSelectedAssessment(matchedAss || null);
    if (matchedAss?.duration) {
      setDurationMinutes(matchedAss.duration);
    }
  }, [targetRoleId, assessments]);

  // Filter direct reports based on Step 1 (Department) and Step 2 (Manager)
  const departments = useMemo(() => Array.from(new Set(allEmployees.map(e => e.department).filter(Boolean))), [allEmployees]);

  const filteredEmployees = useMemo(() => {
    return allEmployees.filter(emp => {
      if (department !== 'All' && emp.department !== department) {
        return false;
      }
      if (selectedManagerId === 'unassigned') {
        if (emp.manager_id != null) return false;
      } else if (selectedManagerId !== 'All') {
        if (Number(emp.manager_id) !== Number(selectedManagerId)) return false;
      }
      return true;
    });
  }, [allEmployees, department, selectedManagerId]);

  // Handle multi-select checkboxes
  const handleSelectAll = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map(e => e.id));
    }
  };

  const handleToggleEmp = (id) => {
    setSelectedEmpIds(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  // Step 9: Assign Assessment to Selected Employees
  const handleAssignAssessment = async (e) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) {
      setActionError('Please select at least one employee from the list.');
      return;
    }
    if (!targetRoleId) {
      setActionError('Please select a target leadership role.');
      return;
    }
    if (!scheduledDate || !startTime) {
      setActionError('Please specify both scheduled date and start time.');
      return;
    }

    // Validate that schedule start time is in the future
    const now = new Date();
    const [startH, startM] = startTime.split(':').map(Number);
    const [scY, scM, scD] = scheduledDate.split('-').map(Number);
    const scheduleStartDt = new Date(scY, (scM || 1) - 1, scD || 1, startH || 0, startM || 0, 0);

    // Provide a 2-minute buffer for form submission time
    if (scheduleStartDt.getTime() < (now.getTime() - 2 * 60 * 1000)) {
      const curTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setActionError(`Invalid schedule time: Scheduled start time (${scheduledDate} at ${startTime}) cannot be in the past. Current time is ${curTimeStr}. Please select a future time.`);
      return;
    }

    // Check Stage 1 screening status for selected employees
    const screenedCandidates = selectedEmpIds.filter(id => eligibleScreenedEmpIds.has(id));
    const notScreenedCandidates = selectedEmpIds.filter(id => !eligibleScreenedEmpIds.has(id));

    if (screenedCandidates.length === 0 && notScreenedCandidates.length > 0) {
      const names = allEmployees.filter(e => notScreenedCandidates.includes(e.id)).map(e => e.name).join(', ');
      setActionError(`Cannot assign Stage 2 Leadership Assessment: All ${selectedEmpIds.length} selected employee(s) [${names}] have not completed Stage 1 Initial Screening (≥70%). Please screen them before assigning leadership assessments.`);
      return;
    }

    setAssigning(true);
    setActionError('');
    setActionSuccess('');
    setBatchResult(null);

    try {
      const payload = {
        role_id: Number(targetRoleId),
        assessment_id: selectedAssessment ? selectedAssessment.id : undefined,
        employee_ids: selectedEmpIds,
        scheduled_date: scheduledDate,
        start_time: startTime,
        end_time: calculatedEndTime,
        duration_minutes: Number(durationMinutes),
        time_zone: timeZone,
        instructions: instructions
      };

      const res = await assessmentService.batchSaveSchedules(payload);
      if (res && res.success) {
        const bData = res.data || {};
        const createdCount = bData.created_count ?? (Array.isArray(bData.created) ? bData.created.length : (Array.isArray(bData.assignments) ? bData.assignments.length : selectedEmpIds.length));
        const skippedCount = bData.skipped_count ?? (Array.isArray(bData.skipped) ? bData.skipped.length : 0);
        const failedCount = bData.failed_count ?? (Array.isArray(bData.failed) ? bData.failed.length : 0);

        setBatchResult(bData);

        if (createdCount > 0) {
          let msg = `Successfully assigned assessment to ${createdCount} employee(s)!`;
          if (skippedCount > 0) {
            msg += ` (${skippedCount} already active, skipped)`;
          }
          if (failedCount > 0) {
            msg += ` (${failedCount} ineligible, skipped)`;
          }
          setActionSuccess(msg);
          setSelectedEmpIds([]);
        } else if (skippedCount > 0 && createdCount === 0) {
          setActionSuccess(bData.message || `All ${skippedCount} selected employee(s) already have active schedules for this assessment.`);
          setSelectedEmpIds([]);
        }

        await loadSchedules();
        await loadEligibleScreened();
        if (onRefresh) onRefresh();
      } else {
        setBatchResult(res?.data || null);
        setActionError(res?.message || 'Failed to assign assessments.');
      }
    } catch (err) {
      console.error('Assignment error:', err);
      const respData = err.response?.data;
      if (respData?.data) {
        setBatchResult(respData.data);
      }
      setActionError(respData?.message || err.message || 'An error occurred while creating assessment schedules.');
    } finally {
      setAssigning(false);
    }
  };

  // Filtered schedules for Step 10: Track assignment & completion status
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (statusFilter !== 'All') {
        const itemStatus = (s.status || s.schedule_status || '').toLowerCase();
        if (itemStatus !== statusFilter.toLowerCase()) return false;
      }
      if (scheduleSearch) {
        const q = scheduleSearch.toLowerCase();
        const empName = (s.employee_name || '').toLowerCase();
        const empCode = (s.employee_code || '').toLowerCase();
        const assTitle = (s.assessment_title || '').toLowerCase();
        const roleName = (s.role_name || '').toLowerCase();
        if (!empName.includes(q) && !empCode.includes(q) && !assTitle.includes(q) && !roleName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [schedules, statusFilter, scheduleSearch]);

  const currentRole = roles.find(r => Number(r.id) === Number(targetRoleId));

  return (
    <div className="space-y-8 font-sans">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>HR Centralized Assessment Control</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Assessment Assignment &amp; Evaluation</h2>
            <p className="text-xs text-indigo-200 mt-1 max-w-3xl leading-relaxed">
              Select department and manager direct reports, assign role-specific leadership competency evaluations, configure scheduling windows, and track live assessment completion and candidate scores.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { loadInitialData(); loadSchedules(); }}
            disabled={loading || schedulesLoading}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || schedulesLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Hub</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 font-extrabold text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="text-rose-700 hover:text-rose-900 font-bold text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TWO-STAGE WORKFLOW NAVIGATION TOGGLE */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveHubView('assignment')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
            activeHubView === 'assignment'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Stage 2 Leadership Assessment Scheduling</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveHubView('eligible-screened');
            loadEligibleScreened();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
            activeHubView === 'eligible-screened'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Stage 1 Passed – Eligible for Leadership Assessment</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeHubView === 'eligible-screened' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {eligibleScreened.length}
          </span>
        </button>
      </div>

      {activeHubView === 'eligible-screened' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>Stage 1 Passed – Eligible for Leadership Assessment</span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                  Stage 1 Verified ({eligibleScreened.length})
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Active organization employees who have successfully completed and passed Stage 1 Initial Screening (≥70%). Select any candidate to assign their Stage 2 Leadership Assessment.
              </p>
            </div>
            {/* Search & Department Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={screenedSearch}
                onChange={(e) => setScreenedSearch(e.target.value)}
                placeholder="Search candidate or code..."
                className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-48"
              />
              <select
                value={screenedDeptFilter}
                onChange={(e) => setScreenedDeptFilter(e.target.value)}
                className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-4 py-3">Department &amp; Role</th>
                  <th className="px-4 py-3">Reporting Manager</th>
                  <th className="px-4 py-3 text-center">Stage 1 Screening</th>
                  <th className="px-4 py-3 text-center">Stage 2 Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {eligibleScreened
                  .filter(cand => {
                    if (screenedDeptFilter !== 'All' && cand.department !== screenedDeptFilter) return false;
                    if (screenedSearch) {
                      const q = screenedSearch.toLowerCase();
                      const name = (cand.name || '').toLowerCase();
                      const code = (cand.employee_code || '').toLowerCase();
                      if (!name.includes(q) && !code.includes(q)) return false;
                    }
                    return true;
                  })
                  .map(cand => {
                    const s1 = cand.stage_1_screening || {};
                    const s2Count = cand.stage_2_count || 0;
                    return (
                      <tr key={cand.employee_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{cand.name}</p>
                            <p className="text-[10px] text-slate-500">{cand.employee_code} • {cand.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800 text-xs">{cand.designation}</p>
                          <p className="text-[10px] text-slate-500">{cand.department} • {cand.experience_years}y exp</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-slate-700">{cand.manager_name || 'Unassigned'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-black text-emerald-700 text-sm">{s1.score || 88}%</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-extrabold">
                              Passed (≥70%)
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {s2Count > 0 ? (
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold">
                              {s2Count} Role Assessment(s)
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold">
                              Awaiting Stage 2
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmpIds([cand.employee_id]);
                              setActiveHubView('assignment');
                              setActionSuccess(`Candidate ${cand.name} selected for Stage 2 Leadership Assessment. Choose a role and schedule below.`);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ml-auto cursor-pointer shadow-xs"
                          >
                            <span>Select for Role Assessment</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* 10-STEP WORKFLOW CONTAINER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANEL: Steps 1 to 4 - Department, Manager & Employee Multi-Selection (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">1-4</span>
                <h3 className="text-sm font-bold text-slate-900">Select Employees to Evaluate</h3>
              </div>
              <span className="text-[11px] font-bold text-indigo-600">
                {selectedEmpIds.length} of {filteredEmployees.length} Selected
              </span>
            </div>

            {/* Step 1: Select Dept */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Step 1: Filter by Department
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setSelectedEmpIds([]);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Departments</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Engineering">Engineering</option>
                <option value="Operations">Operations</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>

            {/* Step 2: Select Manager */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Step 2: Filter by Manager (Direct Reports)
              </label>
              <select
                value={selectedManagerId}
                onChange={(e) => {
                  setSelectedManagerId(e.target.value);
                  setSelectedEmpIds([]);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Managers &amp; Teams</option>
                <option value="unassigned">⚠️ Unassigned Employees (No Manager)</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.department} • {m.assigned_employee_count} direct reports)
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3 & 4: Load Direct Reports & Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  Step 3 &amp; 4: Direct Reports List
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                >
                  {selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0 
                    ? 'Deselect All' 
                    : 'Select All Filtered'}
                </button>
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200/60 rounded-xl">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No employees match this filter</p>
                  <p className="text-[11px] text-slate-500 mt-1">Try selecting "All Managers" or "All Departments".</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border border-slate-200/60 rounded-xl p-2 bg-slate-50/50 divide-y divide-slate-100">
                  {filteredEmployees.map(emp => {
                    const isSelected = selectedEmpIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleToggleEmp(emp.id)}
                        className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/80 border border-indigo-200' : 'hover:bg-white bg-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <p className="text-xs font-bold text-slate-900">{emp.name}</p>
                              {eligibleScreenedEmpIds.has(emp.id) && (
                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded">
                                  Stage 1 Passed
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              {emp.employee_code} • {emp.designation}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-semibold text-slate-600 block">
                            {emp.department}
                          </span>
                          {emp.manager_name ? (
                            <span className="text-[9px] font-bold text-indigo-600">
                              Mgr: {emp.manager_name}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-600">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Steps 5 to 9 - Target Leadership Role, Assessment Details, Scheduling & Assignment (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <form onSubmit={handleAssignAssessment} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">5-9</span>
                <h3 className="text-sm font-bold text-slate-900">Leadership Role &amp; Schedule Configuration</h3>
              </div>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                Automated Grading
              </span>
            </div>

            {/* Step 5: Select Target Leadership Role */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Step 5: Target Leadership Role for Succession Evaluation
              </label>
              <select
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.role_name} ({r.department} • Level {r.criticality_level || 'High'})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 6: Auto-load Role-Specific Assessment Details */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Step 6: Role Assessment Blueprint</span>
                </span>
                <span className="px-2 py-0.5 bg-indigo-200/80 text-indigo-900 text-[10px] font-bold rounded">
                  {selectedAssessment ? 'Verified Role Assessment' : 'Standard 20-Question Evaluation'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-semibold">Assessment Title</p>
                  <p className="font-bold text-slate-900 truncate">
                    {selectedAssessment?.title || (currentRole ? `${currentRole.role_name} Leadership Assessment` : 'Leadership Assessment')}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-semibold">Passing Benchmark</p>
                  <p className="font-bold text-emerald-700">
                    {selectedAssessment?.passing_threshold || 70}% Minimum
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-semibold">Question Bank Count</p>
                  <p className="font-bold text-indigo-700">
                    20 Competency Scenarios
                  </p>
                </div>
              </div>
            </div>

            {/* Step 7 & 8: Date, Start Time, Duration & Submission Window */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">
                  Step 7 &amp; 8: Schedule Window &amp; Time Enforcement
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Duration (Mins)</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                    <option value={90}>90 Minutes</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-medium text-slate-700">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Submission Window Deadline:</span>
                  <span className="font-mono font-bold text-slate-900">{scheduledDate} @ {calculatedEndTime}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Auto-expires after window</span>
              </div>
            </div>

            {/* Instructions textarea */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Candidate Instructions</label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                placeholder="Instructions displayed to candidate..."
              />
            </div>

            {/* Inline Status Feedback & Batch Details */}
            {actionError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-start space-x-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{actionError}</p>
                  {batchResult?.failed && batchResult.failed.length > 0 && (
                    <ul className="mt-1.5 list-disc list-inside text-[11px] text-rose-700 space-y-0.5">
                      {batchResult.failed.map((f, i) => (
                        <li key={i}><span className="font-bold">{f.name}:</span> {f.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActionError('')}
                  className="text-rose-600 hover:text-rose-900 font-bold text-xs p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start space-x-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{actionSuccess}</p>
                  {batchResult?.skipped && batchResult.skipped.length > 0 && (
                    <p className="mt-1 text-[11px] text-emerald-700">
                      Skipped duplicate(s): {batchResult.skipped.map(s => s.name).join(', ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActionSuccess('')}
                  className="text-emerald-600 hover:text-emerald-900 font-bold text-xs p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Step 9: Assign Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={assigning || selectedEmpIds.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Assigning &amp; Generating Question Banks...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>
                      Assign &amp; Schedule Assessment to {selectedEmpIds.length} Selected Employee(s)
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* STEP 10: TRACK ASSIGNMENT & COMPLETION STATUS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">10</span>
              <h3 className="text-base font-bold text-slate-900">Track Assignment &amp; Completion Status</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Organization-wide view of assigned tests, in-progress evaluations, completed scores, and candidate dossiers.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
                placeholder="Search candidate, role..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Statuses ({schedules.length})</option>
              <option value="Scheduled">Scheduled / Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Expired">Expired / Overdue</option>
            </select>
          </div>
        </div>

        {schedulesLoading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-500">Loading assignments &amp; completion status...</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 border border-slate-200/60 rounded-xl">
            <Layers className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No Assessment Schedules Found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Use the workflow above to assign role assessments to direct reports.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Target Leadership Role</th>
                  <th className="px-5 py-3">Scheduled Window</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Score / Result</th>
                  <th className="px-5 py-3 text-right">Evaluation Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredSchedules.map((item) => {
                  const isCompleted = item.status === 'Completed' || item.schedule_status === 'Completed' || !!item.result;
                  const res = item.result;
                  const scoreVal = res ? (res.overall_score || res.percentage_score || 0) : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-bold text-slate-900">{item.employee_name || 'Employee'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{item.employee_code}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-800">
                          {item.role_name || item.assessment_title || 'Leadership Role'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900">{item.scheduled_date || item.due_date || 'N/A'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {item.start_time || '10:00'} - {item.end_time || '10:30'} ({item.duration_minutes || 30}m)
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={item.status || item.schedule_status} type="status" />
                      </td>
                      <td className="px-5 py-3.5">
                        {isCompleted && scoreVal !== null ? (
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-emerald-700 text-sm">
                              {Number(scoreVal).toFixed(0)}%
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              scoreVal >= (item.passing_threshold || 70) 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {scoreVal >= (item.passing_threshold || 70) ? 'Passed' : 'Needs Dev'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            Pending Submission
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isCompleted && item.result ? (
                          <button
                            type="button"
                            onClick={() => setSelectedResultForModal(item.result)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition inline-flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Dossier</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Awaiting Completion
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Result View Modal */}
      {selectedResultForModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedResultForModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <AssessmentResultView
              result={selectedResultForModal}
              onBack={() => setSelectedResultForModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentAssignmentEvaluation;

