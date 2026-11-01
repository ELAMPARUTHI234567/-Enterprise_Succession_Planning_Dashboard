import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, UserX, ArrowRightLeft, ShieldCheck, AlertTriangle, 
  ChevronDown, ChevronUp, Search, RefreshCw, CheckCircle2, AlertCircle,
  Briefcase, Mail, Building, Plus, ArrowRight, UserPlus
} from 'lucide-react';
import { hierarchyService, employeeService } from '../services/api';

export const CompanyHierarchySection = ({ isHR = true }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [hierarchyData, setHierarchyData] = useState(null);
  const [unassignedList, setUnassignedList] = useState([]);
  
  // Search & Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [expandedManagers, setExpandedManagers] = useState({});

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null); // employee object
  const [selectedNewManagerId, setSelectedNewManagerId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [hierRes, unassignedRes] = await Promise.all([
        hierarchyService.getHierarchy().catch(err => ({ success: false, message: err.message })),
        hierarchyService.getUnassigned().catch(err => ({ success: false, message: err.message }))
      ]);

      if (hierRes?.success) {
        setHierarchyData(hierRes.data);
        // Expand all managers by default
        const initialExpanded = {};
        (hierRes.data?.managers || []).forEach(m => {
          initialExpanded[m.manager_id] = true;
        });
        setExpandedManagers(initialExpanded);
      } else {
        setError(hierRes?.message || 'Failed to load organization hierarchy');
      }

      if (unassignedRes?.success) {
        setUnassignedList(unassignedRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Error communicating with hierarchy service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleManagerExpand = (managerId) => {
    setExpandedManagers(prev => ({
      ...prev,
      [managerId]: !prev[managerId]
    }));
  };

  const handleOpenTransfer = (emp, currentManagerId = null) => {
    setTransferTarget({
      ...emp,
      current_manager_id: currentManagerId
    });
    setSelectedNewManagerId(currentManagerId ? String(currentManagerId) : '');
    setTransferNotes('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!transferTarget) return;

    setSubmittingTransfer(true);
    setTransferError('');
    try {
      const newMgrId = selectedNewManagerId === '' || selectedNewManagerId === 'none' 
        ? null 
        : Number(selectedNewManagerId);

      const res = await hierarchyService.transfer(
        transferTarget.employee_id || transferTarget.id,
        newMgrId,
        transferNotes
      );

      if (res?.success) {
        setSuccessMsg(res.message || 'Reporting line updated successfully.');
        setIsTransferModalOpen(false);
        setTransferTarget(null);
        await loadData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setTransferError(res?.message || 'Failed to update reporting relationship');
      }
    } catch (err) {
      setTransferError(err.message || 'Failed to update reporting relationship');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const managers = hierarchyData?.managers || [];
  const summary = hierarchyData?.summary || {};

  // Department unique list
  const departments = ['All', ...new Set(managers.map(m => m.department).filter(Boolean))];

  // Filtered managers
  const filteredManagers = managers.filter(m => {
    if (departmentFilter !== 'All' && m.department !== departmentFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchMgr = (m.name || '').toLowerCase().includes(q) ||
        (m.employee_code || '').toLowerCase().includes(q) ||
        (m.designation || '').toLowerCase().includes(q);
      const matchReport = (m.direct_reports || []).some(r => 
        (r.name || '').toLowerCase().includes(q) ||
        (r.employee_code || '').toLowerCase().includes(q) ||
        (r.designation || '').toLowerCase().includes(q)
      );
      if (!matchMgr && !matchReport) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Managers</span>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{summary.total_managers ?? managers.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Active leadership nodes</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assigned Direct Reports</span>
            <p className="text-2xl font-black text-emerald-800 mt-0.5">{summary.total_assigned_direct_reports ?? 0}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Reporting to a manager</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Unassigned Employees</span>
            <p className="text-2xl font-black text-amber-800 mt-0.5">{summary.unassigned_employees_count ?? unassignedList.length}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Awaiting manager assignment</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Team Span</span>
            <p className="text-2xl font-black text-indigo-700 mt-0.5">{summary.average_direct_reports_per_manager ?? 0}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Direct reports per manager</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-0.5">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search manager, direct report, role..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white"
          >
            {departments.map(d => (
              <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Hierarchy</span>
          </button>
        </div>
      </div>

      {/* Hierarchy Manager Trees */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">Loading reporting structure...</p>
          </div>
        ) : filteredManagers.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No managers found matching criteria</p>
          </div>
        ) : (
          filteredManagers.map(mgr => {
            const isExpanded = !!expandedManagers[mgr.manager_id];
            const reports = mgr.direct_reports || [];

            return (
              <div 
                key={mgr.manager_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Manager Header Bar */}
                <div 
                  onClick={() => toggleManagerExpand(mgr.manager_id)}
                  className="p-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer border-b border-slate-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm">
                      {(mgr.name || 'M')[0]}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-black text-slate-900">{mgr.name}</h4>
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                          {mgr.employee_code}
                        </span>
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Manager
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {mgr.designation} • {mgr.department} • {mgr.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-extrabold px-3 py-1 bg-white border border-slate-200 rounded-xl text-slate-800 shadow-2xs">
                      {reports.length} Direct Reports
                    </span>
                    <button className="p-1 text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Direct Reports List */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/50">
                    {reports.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs italic">
                        No direct reports currently assigned to this manager.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {reports.map(rep => (
                          <div 
                            key={rep.employee_id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between">
                                <div>
                                  <h5 className="text-xs font-black text-slate-900">{rep.name}</h5>
                                  <p className="text-[10px] text-slate-500 font-medium">{rep.designation}</p>
                                </div>
                                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {rep.employee_code}
                                </span>
                              </div>

                              <div className="mt-2 text-[10px] space-y-0.5 text-slate-600">
                                <p><span className="text-slate-400">Dept:</span> {rep.department}</p>
                                <p><span className="text-slate-400">Experience:</span> {rep.experience_years ? `${rep.experience_years} years` : 'N/A'}</p>
                                {rep.performance_score != null && (
                                  <p><span className="text-slate-400">Performance:</span> <strong className="text-indigo-700">{rep.performance_score}/100</strong></p>
                                )}
                              </div>
                            </div>

                            {isHR && (
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTransfer(rep, mgr.manager_id);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold rounded-lg text-[10px] flex items-center space-x-1 transition-colors"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                                  <span>Transfer / Reassign</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Unassigned Employees Section */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-amber-50/70 to-white border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-bold flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Unassigned Employees (No Reporting Manager)</h4>
              <p className="text-[11px] text-slate-500">
                Workforce members currently without an active manager relationship. Assign to establish clear reporting lines.
              </p>
            </div>
          </div>
          <span className="text-xs font-black bg-amber-100 text-amber-800 px-3 py-1 rounded-full self-start sm:self-auto">
            {unassignedList.length} Unassigned
          </span>
        </div>

        <div className="p-4">
          {unassignedList.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="font-semibold text-slate-700">All workforce members have an assigned reporting manager.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedList.map(emp => (
                <div 
                  key={emp.id}
                  className="p-3.5 bg-amber-50/30 rounded-xl border border-amber-200/60 shadow-2xs space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-xs font-black text-slate-900">{emp.name}</h5>
                        <p className="text-[10px] text-slate-500 font-medium">{emp.designation}</p>
                      </div>
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        {emp.employee_code}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      <span className="text-slate-400">Dept:</span> {emp.department} • {emp.email}
                    </p>
                  </div>

                  {isHR && (
                    <div className="pt-2 border-t border-amber-100 flex items-center justify-end">
                      <button
                        onClick={() => handleOpenTransfer(emp, null)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] flex items-center space-x-1 shadow-sm transition-all"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Assign Manager</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer / Reassign Modal */}
      {isTransferModalOpen && transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  <span>Update Reporting Line</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Assign or transfer employee to an authorized manager
                </p>
              </div>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              {/* Target Employee Info Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Selected Employee</span>
                <p className="text-sm font-black text-slate-900">{transferTarget.name}</p>
                <p className="text-[11px] text-slate-600">
                  {transferTarget.employee_code} • {transferTarget.designation} • {transferTarget.department}
                </p>
              </div>

              {/* Select New Manager */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Assign To Manager</label>
                <select
                  value={selectedNewManagerId}
                  onChange={(e) => setSelectedNewManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">-- Unassigned (No Manager) --</option>
                  {managers
                    .filter(m => m.manager_id !== (transferTarget.employee_id || transferTarget.id))
                    .map(m => (
                      <option key={m.manager_id} value={m.manager_id}>
                        {m.name} ({m.employee_code} - {m.department} - {m.direct_reports?.length || 0} direct reports)
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Circular reporting relationships (e.g., manager reporting to subordinate) are automatically blocked by the server.
                </p>
              </div>

              {/* Transfer Notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Audit Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Reason for department re-allocation or hierarchy update..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTransfer}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow-sm"
                >
                  {submittingTransfer && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Save Reporting Relationship</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyHierarchySection;
