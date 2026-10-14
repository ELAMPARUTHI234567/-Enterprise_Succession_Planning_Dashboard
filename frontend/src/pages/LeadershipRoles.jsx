import React, { useEffect, useState } from 'react';
import { Award, Plus, Edit2, Trash2, Sliders, CheckCircle2, Loader2, Code2, X } from 'lucide-react';
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
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);

  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({ role_name: '', department: 'Information Technology', description: '' });
  const [reqScores, setReqScores] = useState([]);
  const [roleSkills, setRoleSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [newSkillRow, setNewSkillRow] = useState({
    skill_name: '',
    category: 'Programming Languages',
    required_proficiency: 3,
    importance: 'Critical'
  });
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

  const handleOpenSkillsModal = async (role) => {
    setSelectedRole(role);
    setIsSkillsModalOpen(true);
    setSkillsLoading(true);
    try {
      const res = await roleService.getRequiredSkills(role.id);
      if (res.success) {
        setRoleSkills(res.data || []);
      }
    } catch (err) {
      alert(err.message || 'Error fetching required skills');
    } finally {
      setSkillsLoading(false);
    }
  };

  const handleAddSkillToRole = () => {
    if (!newSkillRow.skill_name.trim()) return;
    setRoleSkills(prev => [
      ...prev,
      {
        skill_name: newSkillRow.skill_name.trim(),
        category: newSkillRow.category,
        required_proficiency: Number(newSkillRow.required_proficiency),
        importance: newSkillRow.importance
      }
    ]);
    setNewSkillRow({
      skill_name: '',
      category: 'Programming Languages',
      required_proficiency: 3,
      importance: 'Critical'
    });
  };

  const handleRemoveSkillFromRole = (idx) => {
    setRoleSkills(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSkillsSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await roleService.saveRequiredSkills(selectedRole.id, roleSkills);
      if (res.success) {
        setIsSkillsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Error saving required skills');
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
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenReqModal(role)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center space-x-1 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Scores</span>
                  </button>

                  <button
                    onClick={() => handleOpenSkillsModal(role)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center space-x-1 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Skills</span>
                  </button>
                </div>

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

      {/* Assign Role Required Skills Modal */}
      <Modal 
        isOpen={isSkillsModalOpen} 
        onClose={() => setIsSkillsModalOpen(false)} 
        title={`Configure Required Technical Skills: ${selectedRole?.role_name}`} 
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSkillsSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Define mandatory and desirable technical skills and minimum required proficiency levels (1–5) for this leadership position:
          </p>

          {/* Add Skill Row Form */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="font-extrabold text-slate-800 text-xs">Add Required Skill Standard</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Skill name (e.g. Python)"
                value={newSkillRow.skill_name}
                onChange={(e) => setNewSkillRow({ ...newSkillRow, skill_name: e.target.value })}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
              />
              <select
                value={newSkillRow.category}
                onChange={(e) => setNewSkillRow({ ...newSkillRow, category: e.target.value })}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
              >
                <option value="Programming Languages">Programming Languages</option>
                <option value="Frameworks & Libraries">Frameworks & Libraries</option>
                <option value="Databases & Storage">Databases & Storage</option>
                <option value="Cloud & DevOps">Cloud & DevOps</option>
                <option value="Domain & Industry">Domain & Industry</option>
                <option value="Leadership & Management">Leadership & Management</option>
              </select>
              <select
                value={newSkillRow.required_proficiency}
                onChange={(e) => setNewSkillRow({ ...newSkillRow, required_proficiency: Number(e.target.value) })}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value={1}>Level 1 - Beginner</option>
                <option value={2}>Level 2 - Basic</option>
                <option value={3}>Level 3 - Intermediate</option>
                <option value={4}>Level 4 - Advanced</option>
                <option value={5}>Level 5 - Expert</option>
              </select>
              <button
                type="button"
                onClick={handleAddSkillToRole}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors"
              >
                + Add Standard
              </button>
            </div>
          </div>

          {/* List of Current Required Skills */}
          {skillsLoading ? (
            <div className="p-8 text-center text-slate-400">Loading role skills...</div>
          ) : roleSkills.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No required skills configured yet. Add role skill requirements above.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {roleSkills.map((rs, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <div>
                    <span className="font-extrabold text-slate-900">{rs.skill_name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">({rs.category})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-[11px] border border-indigo-100">
                      Required Level: {rs.required_proficiency} / 5
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkillFromRole(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setIsSkillsModalOpen(false)} 
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-md shadow-indigo-600/30"
            >
              Save Required Skills
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeadershipRoles;
