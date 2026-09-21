import React, { useEffect, useState } from 'react';
import { Award, Plus, Edit2, Trash2, Sliders, CheckCircle2, Loader2 } from 'lucide-react';
import Modal from '../components/Modal';
import { roleService, competencyService } from '../services/api';

export const LeadershipRoles = () => {
  const [roles, setRoles] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);

  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({ role_name: '', department: 'Information Technology', description: '' });
  const [reqScores, setReqScores] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const compRes = await competencyService.getAll();
      if (compRes.success) setCompetencies(compRes.data);

      const res = await roleService.getAll();
      if (res.success) setRoles(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ role_name: '', department: 'Information Technology', description: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (role) => {
    setSelectedRole(role);
    setFormData({ role_name: role.role_name, department: role.department, description: role.description });
    setIsEditModalOpen(true);
  };

  const handleOpenReqModal = (role) => {
    setSelectedRole(role);
    const existingReqs = role.required_competencies || [];
    const mapped = competencies.map(c => {
      const match = existingReqs.find(r => r.competency_id === c.id);
      return {
        competency_id: c.id,
        competency_name: c.name,
        required_score: match ? match.required_score : 80.0
      };
    });
    setReqScores(mapped);
    setIsReqModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await roleService.create(formData);
      if (res.success) {
        setIsAddModalOpen(false);
        fetchData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await roleService.update(selectedRole.id, formData);
      if (res.success) {
        setIsEditModalOpen(false);
        fetchData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReqSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await roleService.saveCompetencies(selectedRole.id, reqScores);
      if (res.success) {
        setIsReqModalOpen(false);
        fetchData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this leadership role?")) return;
    try {
      await roleService.delete(id);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Leadership Roles</h2>
          <p className="text-xs text-slate-500 mt-0.5">Define target executive positions and benchmark competency standards</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Leadership Role</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading Roles...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {roles.map((role) => (
            <div key={role.id} className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow card-hover flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {role.department}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-3">{role.role_name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{role.description}</p>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Required Standards:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(role.required_competencies || []).slice(0, 4).map(rc => (
                      <span key={rc.id} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {rc.competency_name}: {rc.required_score}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleOpenReqModal(role)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Assign Scores</span>
                </button>
                <div className="flex space-x-1">
                  <button onClick={() => handleOpenEdit(role)} className="p-1.5 text-slate-500 hover:text-indigo-600">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(role.id)} className="p-1.5 text-slate-500 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Role Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Leadership Role">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Role Name</label>
            <input
              type="text"
              value={formData.role_name}
              onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
              placeholder="e.g. Technical Director"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="Information Technology">Information Technology</option>
              <option value="Engineering">Engineering</option>
              <option value="Operations">Operations</option>
              <option value="Human Resources">Human Resources</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              placeholder="Describe role responsibilities..."
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs">Save Role</button>
          </div>
        </form>
      </Modal>

      {/* Assign Required Standards Modal */}
      <Modal isOpen={isReqModalOpen} onClose={() => setIsReqModalOpen(false)} title={`Assign Benchmark Standards: ${selectedRole?.role_name}`} maxWidth="max-w-2xl">
        <form onSubmit={handleReqSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">Define the benchmark required score (0-100) for each core competency for this position:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
            {reqScores.map((item, idx) => (
              <div key={item.competency_id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-800 mb-1">{item.competency_name}</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.required_score}
                    onChange={(e) => {
                      const updated = [...reqScores];
                      updated[idx].required_score = parseFloat(e.target.value);
                      setReqScores(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button type="button" onClick={() => setIsReqModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs">Save Standards</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeadershipRoles;
