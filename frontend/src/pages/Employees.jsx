import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Search, Filter, Eye, Edit2, Trash2, Loader2, CheckCircle2, 
  AlertCircle, Clock, Check, X, UserCheck, UserPlus, ShieldCheck, ArrowRightLeft 
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { CompanyHierarchySection } from '../components/CompanyHierarchySection';
import { employeeService, authService } from '../services/api';
import axios from 'axios';

export const Employees = () => {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'hierarchy'
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All'); // 'All' | 'unassigned' | managerId
  const [managers, setManagers] = useState([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [error, setError] = useState('');

  // Manager Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetEmp, setAssignTargetEmp] = useState(null); // null if bulk, emp if single
  const [targetManagerId, setTargetManagerId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignModalError, setAssignModalError] = useState('');

  // Pending Registrations State
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedEmp, setSelectedEmp] = useState(null);
  const [formData, setFormData] = useState({
    employee_code: '',
    name: '',
    email: '',
    department: 'Information Technology',
    designation: '',
    experience_years: 5.0,
    performance_score: 85.0,
    leadership_score: 80.0
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  const fetchEmployees = async (signal) => {
    setLoading(true);
    setError('');
    try {
      const params = { search, department };
      if (managerFilter === 'unassigned') {
        params.unassigned = true;
      } else if (managerFilter && managerFilter !== 'All') {
        params.manager_id = managerFilter;
      }

      const res = await employeeService.getAll(params, { signal });
      if (res && res.success) {
        setEmployees(res.data || []);
      }
    } catch (err) {
      if (axios.isCancel(err) || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        // Request was intentionally canceled due to component unmount or fast filter changes.
        return;
      }
      setError(err?.message || 'Failed to load employees');
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await employeeService.getManagers();
      if (res && res.success) {
        setManagers(res.data || []);
      }
    } catch (err) {
      console.warn('Could not load managers list:', err);
    }
  };

  const fetchPendingRegistrations = async () => {
    try {
      setLoadingPending(true);
      const res = await authService.getPendingRegistrations();
      if (res && res.success) {
        setPendingUsers(res.data || []);
      }
    } catch (err) {
      // Non-critical if user lacks permissions or network delay
      console.warn('Could not load pending registrations:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEmployees(controller.signal);
    fetchPendingRegistrations();
    fetchManagers();

    return () => {
      controller.abort();
    };
  }, [search, department, managerFilter]);

  const handleSelectAll = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(employees.map(e => e.id));
    }
  };

  const handleToggleSelectEmp = (id) => {
    setSelectedEmpIds(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleOpenAssignModal = (emp = null) => {
    setAssignTargetEmp(emp);
    setTargetManagerId(emp?.manager_id ? String(emp.manager_id) : '');
    setAssignModalError('');
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignSubmitting(true);
    setAssignModalError('');
    try {
      const empIdsToAssign = assignTargetEmp ? [assignTargetEmp.id] : selectedEmpIds;
      if (empIdsToAssign.length === 0) {
        setAssignModalError('Please select at least one employee.');
        setAssignSubmitting(false);
        return;
      }

      const mgrVal = targetManagerId === 'null' || !targetManagerId ? null : Number(targetManagerId);
      const res = await employeeService.bulkAssignManager({
        employee_ids: empIdsToAssign,
        new_manager_id: mgrVal
      });

      if (res && res.success) {
        setActionSuccess(res.message || 'Manager assignment updated successfully!');
        setIsAssignModalOpen(false);
        setSelectedEmpIds([]);
        setAssignTargetEmp(null);
        await Promise.all([fetchEmployees(), fetchManagers()]);
      } else {
        setAssignModalError(res?.message || 'Failed to assign manager.');
      }
    } catch (err) {
      setAssignModalError(err.message || 'An error occurred during manager assignment.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedEmpIds.length === 0) return;
    if (!window.confirm(`Unassign manager for ${selectedEmpIds.length} selected employee(s)?`)) return;
    setSubmitting(true);
    try {
      const res = await employeeService.bulkAssignManager({
        employee_ids: selectedEmpIds,
        new_manager_id: null
      });
      if (res && res.success) {
        setActionSuccess(res.message || 'Employees unassigned successfully.');
        setSelectedEmpIds([]);
        await Promise.all([fetchEmployees(), fetchManagers()]);
      }
    } catch (err) {
      setError(err.message || 'Failed to unassign employees.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveUser = async (userId, userName) => {
    setApprovingId(userId);
    setActionSuccess('');
    setError('');
    try {
      const res = await authService.approveUserAccount(userId);
      if (res.success) {
        setActionSuccess(`Employee account for "${userName || 'Employee'}" has been approved and activated!`);
        await fetchPendingRegistrations();
        await fetchEmployees();
      }
    } catch (err) {
      setError(err.message || 'Failed to approve registration');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectUser = async (userId, userName) => {
    setRejectingId(userId);
    setActionSuccess('');
    setError('');
    try {
      const res = await authService.rejectUserAccount(userId);
      if (res.success) {
        setActionSuccess(`Registration for "${userName || 'Employee'}" has been rejected.`);
        await fetchPendingRegistrations();
      }
    } catch (err) {
      setError(err.message || 'Failed to reject registration');
    } finally {
      setRejectingId(null);
    }
  };

  const handleOpenAddModal = () => {
    const nextCode = `EMP${String(employees.length + 1).padStart(3, '0')}`;
    setFormData({
      employee_code: nextCode,
      name: '',
      email: '',
      department: 'Information Technology',
      designation: 'Senior Engineer',
      experience_years: 6.0,
      performance_score: 85.0,
      leadership_score: 80.0
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp) => {
    setSelectedEmp(emp);
    setFormData({
      employee_code: emp.employee_code,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      designation: emp.designation,
      experience_years: emp.experience_years,
      performance_score: emp.performance_score,
      leadership_score: emp.leadership_score
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (emp) => {
    setSelectedEmp(emp);
    setIsDeleteModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await employeeService.create(formData);
      if (res.success) {
        setIsAddModalOpen(false);
        fetchEmployees();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await employeeService.update(selectedEmp.id, formData);
      if (res.success) {
        setIsEditModalOpen(false);
        fetchEmployees();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await employeeService.delete(selectedEmp.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        fetchEmployees();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Employee Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage workforce profiles, experience parameters, and leadership ratings</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Employee</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Success Toast Banner */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-0.5 rounded hover:bg-emerald-100 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* View Switcher: Directory vs Reporting Hierarchy */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 transition-all ${
            activeTab === 'directory'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Workforce Directory ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 transition-all ${
            activeTab === 'hierarchy'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Manager Reporting Hierarchy</span>
        </button>
      </div>

      {activeTab === 'hierarchy' && (
        <CompanyHierarchySection isHR={true} />
      )}

      {activeTab === 'directory' && (
        <>
          {/* Pending Employee Approvals Panel */}
          {pendingUsers.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 flex items-center space-x-2">
                  <span>Pending Employee Registrations</span>
                  <span className="px-2 py-0.5 bg-amber-200/90 text-amber-900 text-[10px] font-extrabold rounded-full">
                    {pendingUsers.length} awaiting HR approval
                  </span>
                </h3>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Employees who authenticated via Google OAuth and submitted self-registration details.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingUsers.map((pUser) => (
              <div
                key={pUser.id}
                className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {pUser.name || pUser.username}
                    </span>
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {pUser.email || pUser.oauth_email}
                  </p>
                  <div className="text-[10px] text-slate-400 flex items-center space-x-2 pt-1 font-medium">
                    <span>{pUser.department || 'General'}</span>
                    <span>•</span>
                    <span>{pUser.designation || 'Employee'}</span>
                    {pUser.employee_code && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-500">{pUser.employee_code}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleRejectUser(pUser.id, pUser.name || pUser.username)}
                    disabled={rejectingId === pUser.id || approvingId === pUser.id}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    {rejectingId === pUser.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <X className="w-3 h-3" />
                        <span>Reject</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveUser(pUser.id, pUser.name || pUser.username)}
                    disabled={approvingId === pUser.id || rejectingId === pUser.id}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs shadow-emerald-600/20 transition flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    {approvingId === pUser.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Approve Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 card-shadow flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, designation..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Department:</span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Departments</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Engineering">Engineering</option>
              <option value="Operations">Operations</option>
              <option value="Human Resources">Human Resources</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Manager:</span>
            <select
              value={managerFilter}
              onChange={(e) => {
                setManagerFilter(e.target.value);
                setSelectedEmpIds([]);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Managers</option>
              <option value="unassigned">⚠️ Unassigned (No Manager)</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.assigned_employee_count} direct reports)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Floating Batch Actions Bar */}
      {selectedEmpIds.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs">
              {selectedEmpIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {selectedEmpIds.length} employee{selectedEmpIds.length > 1 ? 's' : ''} selected
              </p>
              <p className="text-[10px] text-slate-300">Assign reporting manager or remove existing manager assignment</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleOpenAssignModal(null)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign to Manager</span>
            </button>
            <button
              type="button"
              onClick={handleBulkUnassign}
              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Unassign Manager</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedEmpIds([])}
              className="px-2.5 py-1.5 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-500">Loading Directory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-4 py-3.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedEmpIds.length === employees.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      title="Select / Deselect All"
                    />
                  </th>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Reporting Manager</th>
                  <th className="px-6 py-3.5">Experience</th>
                  <th className="px-6 py-3.5">Performance Score</th>
                  <th className="px-6 py-3.5">Leadership Score</th>
                  <th className="px-6 py-3.5">Readiness Baseline</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {employees.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-slate-50/80 transition-colors ${selectedEmpIds.includes(emp.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedEmpIds.includes(emp.id)}
                        onChange={() => handleToggleSelectEmp(emp.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">{emp.employee_code} • {emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{emp.department}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{emp.designation}</td>
                    <td className="px-6 py-4">
                      {emp.manager_name ? (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200/80 rounded-lg text-indigo-800 font-bold text-xs">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                          <span>{emp.manager_name}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-extrabold rounded-lg">
                          <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{emp.experience_years} Yrs</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-emerald-700">{emp.performance_score}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-indigo-700">{emp.leadership_score}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={emp.readiness_level} type="readiness" />
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenAssignModal(emp)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                        title="Assign or Change Manager"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                        title="View Employee Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(emp)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                        title="Edit Employee"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDeleteModal(emp)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                        title="Delete Employee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Manager Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={assignTargetEmp ? `Assign Manager: ${assignTargetEmp.name}` : `Bulk Assign Manager (${selectedEmpIds.length} Employees)`}
      >
        {assignModalError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {assignModalError}
          </div>
        )}
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <p className="text-xs text-slate-600 mb-2">
              {assignTargetEmp ? (
                <>Assign reporting manager for <strong className="text-slate-900">{assignTargetEmp.name}</strong> ({assignTargetEmp.employee_code} - {assignTargetEmp.designation}).</>
              ) : (
                <>Assign reporting manager for <strong className="text-slate-900">{selectedEmpIds.length} selected employees</strong>.</>
              )}
            </p>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Target Manager</label>
            <select
              value={targetManagerId}
              onChange={(e) => setTargetManagerId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">-- Choose Manager --</option>
              <option value="null">⚠️ Unassign (Remove Manager / Individual Contributor)</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.department} • {m.assigned_employee_count} direct reports)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow cursor-pointer disabled:opacity-50"
            >
              {assignSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirm Assignment</span>}
            </button>
          </div>
        </form>
      </Modal>
      </>
      )}

      {/* Add Employee Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Employee">
        {formError && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{formError}</div>}
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Code</label>
              <input
                type="text"
                value={formData.employee_code}
                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                placeholder="e.g. Arun Kumar"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                placeholder="name@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="Information Technology">Information Technology</option>
                <option value="Engineering">Engineering</option>
                <option value="Operations">Operations</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
              placeholder="e.g. Senior Developer"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Yrs)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Performance (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.performance_score}
                onChange={(e) => setFormData({ ...formData, performance_score: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Leadership (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.leadership_score}
                onChange={(e) => setFormData({ ...formData, leadership_score: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-bold"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center space-x-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Employee</span>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Employee Profile">
        {formError && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{formError}</div>}
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Code</label>
              <input
                type="text"
                value={formData.employee_code}
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-semibold cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="Information Technology">Information Technology</option>
                <option value="Engineering">Engineering</option>
                <option value="Operations">Operations</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Yrs)</label>
              <input
                type="number"
                step="0.5"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Performance</label>
              <input
                type="number"
                value={formData.performance_score}
                onChange={(e) => setFormData({ ...formData, performance_score: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Leadership</label>
              <input
                type="number"
                value={formData.leadership_score}
                onChange={(e) => setFormData({ ...formData, leadership_score: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
            >
              Update Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to delete employee <strong className="text-slate-900">{selectedEmp?.name}</strong> ({selectedEmp?.employee_code})? This action cannot be undone.
          </p>
          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center space-x-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirm Delete</span>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Employees;
