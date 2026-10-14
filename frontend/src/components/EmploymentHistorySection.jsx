import React, { useState } from 'react';
import { 
  Briefcase, Plus, Calendar, Building, CheckCircle, 
  ShieldCheck, Edit2, Trash2, X, Users, Compass, Clock
} from 'lucide-react';
import { employeeService } from '../services/api';

export const EmploymentHistorySection = ({ 
  employeeId, 
  employeeProfile = {}, 
  history = [], 
  onRefresh, 
  canEdit = true, 
  canVerify = false 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showJoiningDateModal, setShowJoiningDateModal] = useState(false);
  const [joiningDateInput, setJoiningDateInput] = useState(employeeProfile?.company_joining_date || '');

  // Form state for past employment
  const [formData, setFormData] = useState({
    company_name: '',
    designation: '',
    start_date: '',
    end_date: '',
    responsibilities: '',
    domain: '',
    has_leadership_experience: false
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      company_name: '',
      designation: '',
      start_date: '',
      end_date: '',
      responsibilities: '',
      domain: '',
      has_leadership_experience: false
    });
    setShowAddModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      company_name: item.company_name || '',
      designation: item.designation || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      responsibilities: item.responsibilities || '',
      domain: item.domain || '',
      has_leadership_experience: !!item.has_leadership_experience
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company_name.trim() || !formData.designation.trim() || !formData.start_date) {
      alert('Company, designation, and start date are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        company_name: formData.company_name.trim(),
        designation: formData.designation.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        responsibilities: formData.responsibilities.trim(),
        domain: formData.domain.trim(),
        has_leadership_experience: formData.has_leadership_experience
      };

      if (editingItem) {
        await employeeService.updateEmploymentHistory(employeeId, editingItem.id, payload);
      } else {
        await employeeService.addEmploymentHistory(employeeId, payload);
      }
      setShowAddModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error saving employment record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (histId) => {
    if (!window.confirm('Delete this employment history record?')) return;
    try {
      await employeeService.deleteEmploymentHistory(employeeId, histId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error deleting record');
    }
  };

  const handleVerify = async (histId, status) => {
    try {
      await employeeService.verifyEmploymentHistory(employeeId, histId, {
        verification_status: status
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error updating verification');
    }
  };

  const handleSaveJoiningDate = async (e) => {
    e.preventDefault();
    try {
      await employeeService.update(employeeId, {
        company_joining_date: joiningDateInput || null
      });
      setShowJoiningDateModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error updating joining date');
    }
  };

  // Company tenure & calculated total
  const currentTenure = employeeProfile?.current_company_tenure_years != null
    ? `${employeeProfile.current_company_tenure_years} Years`
    : (employeeProfile?.experience_summary?.current_company_tenure_years != null 
        ? `${employeeProfile.experience_summary.current_company_tenure_years} Years` 
        : 'Not recorded');

  const totalExperience = employeeProfile?.experience_summary?.total_experience_years != null
    ? `${employeeProfile.experience_summary.total_experience_years} Years`
    : (employeeProfile?.experience_years != null ? `${employeeProfile.experience_years} Years` : 'Not recorded');

  const verifiedHistoryCount = history.filter(h => h.verification_status === 'Verified').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <span>Company Experience &amp; Employment History</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Non-overlapping professional tenure tracking, domain experience, and leadership history.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canVerify && (
            <button
              onClick={() => {
                setJoiningDateInput(employeeProfile?.company_joining_date || '');
                setShowJoiningDateModal(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Set Joining Date</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Previous Job</span>
            </button>
          )}
        </div>
      </div>

      {/* Experience Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Joining Date</p>
          <p className="text-base font-extrabold text-slate-900 mt-0.5">
            {employeeProfile?.company_joining_date || 'Not specified'}
          </p>
          <p className="text-[10px] text-slate-500">Official onboarding date</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Company Tenure</p>
          <p className="text-base font-extrabold text-indigo-700 mt-0.5">{currentTenure}</p>
          <p className="text-[10px] text-slate-500">Continuous service period</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Experience (Non-Overlapping)</p>
          <p className="text-base font-extrabold text-emerald-700 mt-0.5">{totalExperience}</p>
          <p className="text-[10px] text-slate-500">Overlap intervals merged</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verified Records</p>
          <p className="text-base font-extrabold text-blue-600 mt-0.5">
            {verifiedHistoryCount} / {history.length}
          </p>
          <p className="text-[10px] text-slate-500">Background validated</p>
        </div>
      </div>

      {/* Employment Records Table / Timeline */}
      {history.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
          No external employment records registered. Current company tenure is evaluated from the joining date.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <div 
              key={h.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 transition-all card-shadow hover:border-slate-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-extrabold text-slate-900">{h.designation}</h4>
                    <span className="text-xs font-semibold text-slate-500">at</span>
                    <span className="text-xs font-bold text-slate-800">{h.company_name}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      h.verification_status === 'Verified'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      • {h.verification_status || 'Self-Reported'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center space-x-2">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{h.start_date} to {h.end_date || 'Present'}</span>
                    </span>
                    {h.duration_years != null && (
                      <span className="font-semibold text-slate-700">({h.duration_years} Years)</span>
                    )}
                  </p>

                  {h.domain && (
                    <p className="text-xs text-slate-600 flex items-center space-x-1 mt-1">
                      <Compass className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Domain: <strong className="text-slate-800">{h.domain}</strong></span>
                    </p>
                  )}

                  {h.responsibilities && (
                    <p className="text-xs text-slate-600 mt-1">{h.responsibilities}</p>
                  )}

                  {h.has_leadership_experience && (
                    <div className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 mt-2">
                      <Users className="w-3 h-3 text-amber-600" />
                      <span>Leadership &amp; Team Management Experience</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {canVerify && h.verification_status !== 'Verified' && (
                    <button
                      onClick={() => handleVerify(h.id, 'Verified')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Record</span>
                    </button>
                  )}

                  {canVerify && h.verification_status === 'Verified' && (
                    <button
                      onClick={() => handleVerify(h.id, 'Self-Reported')}
                      className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Reset to Unverified"
                    >
                      Unverify
                    </button>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => openEditModal(h)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingItem ? 'Edit Employment Record' : 'Add Past Employment History'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="e.g. Acme Financial Systems Inc."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Designation / Role Title *</label>
                <input
                  type="text"
                  required
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Relevant Industry Domain</label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="e.g. FinTech / HealthTech / Cloud Infrastructure"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Key Responsibilities</label>
                <textarea
                  rows={2}
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                  placeholder="Led cross-functional team of 6 engineers delivering distributed payment services..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="leadership_check"
                  checked={formData.has_leadership_experience}
                  onChange={(e) => setFormData({ ...formData, has_leadership_experience: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="leadership_check" className="font-semibold text-slate-700 cursor-pointer">
                  Included team leadership, people management, or technical mentorship responsibilities
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (editingItem ? 'Update Record' : 'Save Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SET JOINING DATE MODAL */}
      {showJoiningDateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                Set Company Joining Date
              </h3>
              <button 
                onClick={() => setShowJoiningDateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJoiningDate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Joining Date</label>
                <input
                  type="date"
                  required
                  value={joiningDateInput}
                  onChange={(e) => setJoiningDateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tenure within current company is calculated authoritatively from this date to current day.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowJoiningDateModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30"
                >
                  Save Date
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmploymentHistorySection;
