import React, { useState } from 'react';
import { 
  Code2, Plus, CheckCircle, AlertTriangle, ShieldCheck, 
  Trash2, Edit2, X, Star, BookOpen, Layers, ArrowUpRight, Zap
} from 'lucide-react';
import { employeeService } from '../services/api';

const PROFICIENCY_LABELS = {
  1: 'Beginner (1)',
  2: 'Basic (2)',
  3: 'Intermediate (3)',
  4: 'Advanced (4)',
  5: 'Expert (5)'
};

const CATEGORIES = [
  'Programming Languages',
  'Frameworks & Libraries',
  'Databases & Storage',
  'Cloud & DevOps',
  'Domain & Industry',
  'Leadership & Management',
  'Communication & Soft Skills',
  'Project Management',
  'Problem Solving',
  'Other Technical'
];

export const SkillsCompetenciesSection = ({ 
  employeeId, 
  skills = [], 
  skillGaps = {}, 
  onRefresh, 
  canEdit = true, 
  canVerify = false 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilterCategory, setActiveFilterCategory] = useState('All');

  // Form state
  const [formData, setFormData] = useState({
    skill_name: '',
    category: 'Programming Languages',
    proficiency_level: 3,
    years_experience: 2,
    assessment_score: '',
    reviewer_notes: ''
  });

  const openAddModal = () => {
    setEditingSkill(null);
    setFormData({
      skill_name: '',
      category: 'Programming Languages',
      proficiency_level: 3,
      years_experience: 2,
      assessment_score: '',
      reviewer_notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (s) => {
    setEditingSkill(s);
    setFormData({
      skill_name: s.skill_name || '',
      category: s.category || 'Programming Languages',
      proficiency_level: s.proficiency_level || 3,
      years_experience: s.years_experience ?? 2,
      assessment_score: s.assessment_score ?? '',
      reviewer_notes: s.reviewer_notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.skill_name.trim()) {
      alert('Skill name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        skill_name: formData.skill_name.trim(),
        category: formData.category,
        proficiency_level: Number(formData.proficiency_level),
        years_experience: formData.years_experience === '' ? null : Number(formData.years_experience),
        assessment_score: formData.assessment_score === '' ? null : Number(formData.assessment_score),
        reviewer_notes: formData.reviewer_notes.trim()
      };

      if (editingSkill) {
        await employeeService.updateSkill(employeeId, editingSkill.id, payload);
      } else {
        await employeeService.addSkill(employeeId, payload);
      }
      setShowModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error saving skill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (skillId) => {
    if (!window.confirm('Delete this skill entry?')) return;
    try {
      await employeeService.deleteSkill(employeeId, skillId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error deleting skill');
    }
  };

  const handleVerify = async (skillId, status) => {
    try {
      await employeeService.verifySkill(employeeId, skillId, {
        verification_status: status
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error updating skill verification');
    }
  };

  // Filter skills
  const filteredSkills = activeFilterCategory === 'All'
    ? skills
    : skills.filter(s => s.category === activeFilterCategory);

  const matchedSkills = skillGaps?.matched_skills || [];
  const belowSkills = skillGaps?.below_requirement_skills || [];
  const missingSkills = skillGaps?.missing_required_skills || [];
  const recommendedActions = skillGaps?.recommended_activities || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-indigo-600" />
            <span>Technical Skills &amp; Competencies</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Standardized 1–5 proficiency levels, assessment verification, and target role competency gap matching.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={openAddModal}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Skill</span>
          </button>
        )}
      </div>

      {/* Target Role Skill Gap Analysis Matrix Banner */}
      {skillGaps?.target_role_name && (
        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                Target Role Benchmark
              </span>
              <h4 className="text-xs font-extrabold text-indigo-950">
                Skill Gap Evaluation against: <span className="underline">{skillGaps.target_role_name}</span>
              </h4>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                {matchedSkills.length} Matched
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[11px]">
                {belowSkills.length} Below Req
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[11px]">
                {missingSkills.length} Missing
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Matched */}
            <div className="bg-white p-3 rounded-xl border border-indigo-100/80">
              <p className="font-bold text-emerald-700 flex items-center space-x-1 mb-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Proficiency Matched ({matchedSkills.length})</span>
              </p>
              {matchedSkills.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No skills currently meet or exceed target level</p>
              ) : (
                <div className="space-y-1">
                  {matchedSkills.map((m, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] text-slate-700 font-medium">
                      <span>{m.skill_name}</span>
                      <span className="font-bold text-emerald-600">Level {m.employee_proficiency} / {m.required_proficiency}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Below Requirement */}
            <div className="bg-white p-3 rounded-xl border border-indigo-100/80">
              <p className="font-bold text-amber-700 flex items-center space-x-1 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Below Required Level ({belowSkills.length})</span>
              </p>
              {belowSkills.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">None below required level</p>
              ) : (
                <div className="space-y-1">
                  {belowSkills.map((b, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] text-slate-700 font-medium">
                      <span>{b.skill_name}</span>
                      <span className="font-bold text-amber-600">
                        {b.employee_proficiency} vs {b.required_proficiency} (Gap: -{b.gap})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Missing Required Skills */}
            <div className="bg-white p-3 rounded-xl border border-indigo-100/80">
              <p className="font-bold text-rose-700 flex items-center space-x-1 mb-1.5">
                <X className="w-3.5 h-3.5" />
                <span>Missing Role Requirements ({missingSkills.length})</span>
              </p>
              {missingSkills.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">All required skills documented</p>
              ) : (
                <div className="space-y-1">
                  {missingSkills.map((ms, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] text-slate-700 font-medium">
                      <span>{ms.skill_name}</span>
                      <span className="font-bold text-rose-600">Needs Lvl {ms.required_proficiency}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recommended Development Activities */}
          {recommendedActions.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-indigo-100/80">
              <p className="font-bold text-indigo-900 flex items-center space-x-1 mb-1 text-xs">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Recommended Skill Development Activities</span>
              </p>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                {recommendedActions.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {['All', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilterCategory(cat)}
            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-colors text-[11px] ${
              activeFilterCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
          No skills recorded in this category. Click &quot;Add Skill&quot; to catalog technical proficiencies.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map((s) => (
            <div 
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-3.5 flex flex-col justify-between card-shadow hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{s.skill_name}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">{s.category}</p>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                    s.verification_status === 'Assessment-Verified'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : s.verification_status === 'Reviewer-Verified'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {s.verification_status || 'Self-Reported'}
                  </span>
                </div>

                {/* Proficiency Rating Meter */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-700">
                    <span>Proficiency Level</span>
                    <span className="text-indigo-600">
                      {PROFICIENCY_LABELS[s.proficiency_level] || `Level ${s.proficiency_level}`}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1.5 flex-1 rounded-full ${
                          lvl <= s.proficiency_level ? 'bg-indigo-600' : 'bg-slate-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Experience: {s.years_experience != null ? `${s.years_experience} yrs` : 'N/A'}</span>
                  {s.assessment_score != null && (
                    <span className="font-bold text-emerald-600">Assessed: {s.assessment_score}%</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  {canVerify && s.verification_status !== 'Reviewer-Verified' && (
                    <button
                      onClick={() => handleVerify(s.id, 'Reviewer-Verified')}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100"
                    >
                      Verify
                    </button>
                  )}
                  {canVerify && s.verification_status === 'Reviewer-Verified' && (
                    <button
                      onClick={() => handleVerify(s.id, 'Self-Reported')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-0.5"
                    >
                      Unverify
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  {canEdit && (
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT SKILL MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingSkill ? 'Edit Skill Proficiency' : 'Add Technical Skill'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Skill Name *</label>
                <input
                  type="text"
                  required
                  value={formData.skill_name}
                  onChange={(e) => setFormData({ ...formData, skill_name: e.target.value })}
                  placeholder="e.g. Python, Docker, Distributed Systems"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Proficiency Scale (1 - Beginner to 5 - Expert)
                </label>
                <select
                  value={formData.proficiency_level}
                  onChange={(e) => setFormData({ ...formData, proficiency_level: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>1 — Beginner (Fundamental awareness)</option>
                  <option value={2}>2 — Basic (Practical application with guidance)</option>
                  <option value={3}>3 — Intermediate (Independent autonomous delivery)</option>
                  <option value={4}>4 — Advanced (Complex problem-solving &amp; mentoring)</option>
                  <option value={5}>5 — Expert (Organizational authority &amp; architecture)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Years of Experience</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.years_experience}
                    onChange={(e) => setFormData({ ...formData, years_experience: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assessment Score (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.assessment_score}
                    onChange={(e) => setFormData({ ...formData, assessment_score: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reviewer / Self-Reflection Notes</label>
                <textarea
                  rows={2}
                  value={formData.reviewer_notes}
                  onChange={(e) => setFormData({ ...formData, reviewer_notes: e.target.value })}
                  placeholder="Supporting credentials, certifications, or project application context..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (editingSkill ? 'Update Skill' : 'Save Skill')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsCompetenciesSection;
