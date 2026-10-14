import React, { useState } from 'react';
import { 
  FolderGit2, Plus, CheckCircle, Clock, AlertCircle, 
  ExternalLink, Check, X, ShieldCheck, FileText, ChevronDown, ChevronUp, Trash2, Edit2
} from 'lucide-react';
import { employeeService } from '../services/api';

export const ProjectExperienceSection = ({ 
  employeeId, 
  projects = [], 
  onRefresh, 
  canEdit = true, 
  canVerify = false 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [verifyModalProject, setVerifyModalProject] = useState(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('Verified');

  // Form state
  const [formData, setFormData] = useState({
    project_name: '',
    description: '',
    role_responsibilities: '',
    start_date: '',
    end_date: '',
    technologies: '',
    completion_status: 'Completed',
    milestones_completed_pct: '',
    deliverables_accepted_pct: '',
    timeline_performance_pct: '',
    quality_defect_targets_pct: '',
    business_objectives_pct: '',
    supervisor_feedback: '',
    supporting_evidence_url: ''
  });

  const openAddModal = () => {
    setEditingProject(null);
    setFormData({
      project_name: '',
      description: '',
      role_responsibilities: '',
      start_date: '',
      end_date: '',
      technologies: '',
      completion_status: 'Completed',
      milestones_completed_pct: '',
      deliverables_accepted_pct: '',
      timeline_performance_pct: '',
      quality_defect_targets_pct: '',
      business_objectives_pct: '',
      supervisor_feedback: '',
      supporting_evidence_url: ''
    });
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingProject(p);
    const techStr = Array.isArray(p.technologies) 
      ? p.technologies.join(', ') 
      : (p.technologies || '');
    setFormData({
      project_name: p.project_name || '',
      description: p.description || '',
      role_responsibilities: p.role_responsibilities || '',
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      technologies: techStr,
      completion_status: p.completion_status || 'Completed',
      milestones_completed_pct: p.milestones_completed_pct ?? '',
      deliverables_accepted_pct: p.deliverables_accepted_pct ?? '',
      timeline_performance_pct: p.timeline_performance_pct ?? '',
      quality_defect_targets_pct: p.quality_defect_targets_pct ?? '',
      business_objectives_pct: p.business_objectives_pct ?? '',
      supervisor_feedback: p.supervisor_feedback || '',
      supporting_evidence_url: p.supporting_evidence_url || ''
    });
    setShowModal(true);
  };

  // Transparent calculation preview
  const calculatePreviewRate = () => {
    const m = formData.milestones_completed_pct === '' ? null : Number(formData.milestones_completed_pct);
    const d = formData.deliverables_accepted_pct === '' ? null : Number(formData.deliverables_accepted_pct);
    const t = formData.timeline_performance_pct === '' ? null : Number(formData.timeline_performance_pct);
    const q = formData.quality_defect_targets_pct === '' ? null : Number(formData.quality_defect_targets_pct);
    const b = formData.business_objectives_pct === '' ? null : Number(formData.business_objectives_pct);

    const metrics = [
      { val: m, weight: 0.25 },
      { val: d, weight: 0.25 },
      { val: t, weight: 0.20 },
      { val: q, weight: 0.15 },
      { val: b, weight: 0.15 }
    ].filter(x => x.val !== null && !isNaN(x.val));

    if (metrics.length === 0) return null;
    const totalWeight = metrics.reduce((acc, curr) => acc + curr.weight, 0);
    const weightedSum = metrics.reduce((acc, curr) => acc + (curr.val * curr.weight), 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  };

  const previewRate = calculatePreviewRate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.project_name.trim()) {
      alert('Please enter a project name');
      return;
    }
    setSubmitting(true);
    try {
      const techList = formData.technologies
        ? formData.technologies.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        project_name: formData.project_name.trim(),
        description: formData.description.trim(),
        role_responsibilities: formData.role_responsibilities.trim(),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        technologies: techList,
        completion_status: formData.completion_status,
        milestones_completed_pct: formData.milestones_completed_pct === '' ? null : Number(formData.milestones_completed_pct),
        deliverables_accepted_pct: formData.deliverables_accepted_pct === '' ? null : Number(formData.deliverables_accepted_pct),
        timeline_performance_pct: formData.timeline_performance_pct === '' ? null : Number(formData.timeline_performance_pct),
        quality_defect_targets_pct: formData.quality_defect_targets_pct === '' ? null : Number(formData.quality_defect_targets_pct),
        business_objectives_pct: formData.business_objectives_pct === '' ? null : Number(formData.business_objectives_pct),
        supervisor_feedback: formData.supervisor_feedback.trim(),
        supporting_evidence_url: formData.supporting_evidence_url.trim()
      };

      if (editingProject) {
        await employeeService.updateProject(employeeId, editingProject.id, payload);
      } else {
        await employeeService.addProject(employeeId, payload);
      }
      setShowModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error saving project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (projId) => {
    if (!window.confirm('Are you sure you want to delete this project entry?')) return;
    try {
      await employeeService.deleteProject(employeeId, projId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error deleting project');
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyModalProject) return;
    try {
      await employeeService.verifyProject(employeeId, verifyModalProject.id, {
        verification_status: verifyStatus,
        supervisor_feedback: verifyNotes
      });
      setVerifyModalProject(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error updating verification status');
    }
  };

  // Summary counts
  const totalProjects = projects.length;
  const verifiedProjects = projects.filter(p => p.verification_status === 'Verified').length;
  const evaluatedProjects = projects.filter(p => p.success_rate != null);
  const avgSuccessRate = evaluatedProjects.length > 0
    ? Math.round(evaluatedProjects.reduce((sum, p) => sum + p.success_rate, 0) / evaluatedProjects.length)
    : null;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <FolderGit2 className="w-4 h-4 text-indigo-600" />
            <span>Employee Project Experience &amp; Success Rates</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent KPI-driven project evaluation with verified milestones, deliverables, and performance outcomes.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={openAddModal}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project Experience</span>
          </button>
        )}
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Projects</p>
          <p className="text-lg font-extrabold text-slate-900 mt-0.5">{totalProjects}</p>
          <p className="text-[10px] text-slate-500">Documented in portfolio</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HR / Supervisor Verified</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{verifiedProjects} / {totalProjects}</p>
          <p className="text-[10px] text-slate-500">Formally validated records</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Success Rate</p>
          <p className="text-lg font-extrabold text-indigo-600 mt-0.5">
            {avgSuccessRate != null ? `${avgSuccessRate}%` : 'Not evaluated'}
          </p>
          <p className="text-[10px] text-slate-500">Based on valid performance metrics</p>
        </div>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
          No project experience documented yet. Click &quot;Add Project Experience&quot; to submit project achievements and outcome metrics.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const isExpanded = expandedId === p.id;
            const techList = Array.isArray(p.technologies) 
              ? p.technologies 
              : (p.technologies ? p.technologies.split(',') : []);

            return (
              <div 
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 transition-all hover:border-slate-300 card-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-extrabold text-slate-900">{p.project_name}</h4>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        p.completion_status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.completion_status === 'In Progress'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {p.completion_status}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        p.verification_status === 'Verified'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : p.verification_status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        • {p.verification_status || 'Self-Reported'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium">
                      Role: <strong className="text-slate-800">{p.role_responsibilities || 'Contributor'}</strong>
                      {p.start_date && (
                        <span className="text-slate-400 ml-2">
                          ({p.start_date} to {p.end_date || 'Present'})
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Success Rate Badge & Controls */}
                  <div className="flex items-center space-x-2">
                    <div className="text-right mr-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Success Rate</p>
                      <p className="text-sm font-extrabold text-indigo-700">
                        {p.success_rate != null ? `${p.success_rate}%` : 'Not evaluated'}
                      </p>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Toggle Details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="Edit Project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {canVerify && (
                      <button
                        onClick={() => {
                          setVerifyModalProject(p);
                          setVerifyStatus(p.verification_status || 'Verified');
                          setVerifyNotes(p.supervisor_feedback || '');
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center space-x-1"
                        title="HR / Manager Review"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Technologies */}
                {techList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {techList.map((t, idx) => (
                      <span 
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-100"
                      >
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded Outcome & KPI Details */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 text-xs">
                    {p.description && (
                      <div>
                        <p className="font-bold text-slate-700">Project Description:</p>
                        <p className="text-slate-600 mt-0.5">{p.description}</p>
                      </div>
                    )}

                    <div>
                      <p className="font-bold text-slate-700 mb-1.5">Documented Performance Indicators (KPIs):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Milestones</p>
                          <p className="font-extrabold text-slate-800">
                            {p.milestones_completed_pct != null ? `${p.milestones_completed_pct}%` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Deliverables</p>
                          <p className="font-extrabold text-slate-800">
                            {p.deliverables_accepted_pct != null ? `${p.deliverables_accepted_pct}%` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Timeline</p>
                          <p className="font-extrabold text-slate-800">
                            {p.timeline_performance_pct != null ? `${p.timeline_performance_pct}%` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Quality</p>
                          <p className="font-extrabold text-slate-800">
                            {p.quality_defect_targets_pct != null ? `${p.quality_defect_targets_pct}%` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Business Impact</p>
                          <p className="font-extrabold text-slate-800">
                            {p.business_objectives_pct != null ? `${p.business_objectives_pct}%` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {p.supervisor_feedback && (
                      <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl">
                        <p className="text-[11px] font-bold text-blue-900">Supervisor / HR Feedback:</p>
                        <p className="text-xs text-blue-800 mt-0.5">{p.supervisor_feedback}</p>
                      </div>
                    )}

                    {p.supporting_evidence_url && (
                      <div className="flex items-center space-x-1.5 text-indigo-600 font-semibold">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <a 
                          href={p.supporting_evidence_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="hover:underline"
                        >
                          View Supporting Evidence Document
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingProject ? 'Edit Project Experience' : 'Submit New Project Experience'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    placeholder="e.g. Core Banking Migration Platform"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Your Role &amp; Responsibilities</label>
                  <input
                    type="text"
                    value={formData.role_responsibilities}
                    onChange={(e) => setFormData({ ...formData, role_responsibilities: e.target.value })}
                    placeholder="e.g. Technical Lead / Lead Architect"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Completion Status</label>
                  <select
                    value={formData.completion_status}
                    onChange={(e) => setFormData({ ...formData, completion_status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Planned">Planned</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Completion Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Technologies, Languages &amp; Tools (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.technologies}
                    onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                    placeholder="e.g. Python, Flask, React.js, PostgreSQL, Docker, AWS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Project Description &amp; Scope</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the project objectives and architecture..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Documented KPI Indicators */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800">Measurable Performance Indicators (0 - 100%)</span>
                  <span className="text-[11px] font-bold text-indigo-700">
                    Preview Success Rate: {previewRate != null ? `${previewRate}%` : 'Not evaluated'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Formula: 25% Milestones + 25% Deliverables + 20% Timeline + 15% Quality + 15% Business Objectives. Leave empty if unmeasured (will display as &quot;Not evaluated&quot;).
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Milestones %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.milestones_completed_pct}
                      onChange={(e) => setFormData({ ...formData, milestones_completed_pct: e.target.value })}
                      placeholder="e.g. 95"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Deliverables %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.deliverables_accepted_pct}
                      onChange={(e) => setFormData({ ...formData, deliverables_accepted_pct: e.target.value })}
                      placeholder="e.g. 90"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Timeline %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.timeline_performance_pct}
                      onChange={(e) => setFormData({ ...formData, timeline_performance_pct: e.target.value })}
                      placeholder="e.g. 100"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Quality / Defect %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.quality_defect_targets_pct}
                      onChange={(e) => setFormData({ ...formData, quality_defect_targets_pct: e.target.value })}
                      placeholder="e.g. 92"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Business Impact %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.business_objectives_pct}
                      onChange={(e) => setFormData({ ...formData, business_objectives_pct: e.target.value })}
                      placeholder="e.g. 88"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supporting Evidence Document / Link</label>
                <input
                  type="text"
                  value={formData.supporting_evidence_url}
                  onChange={(e) => setFormData({ ...formData, supporting_evidence_url: e.target.value })}
                  placeholder="https://jira.internal/project or file share link..."
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
                  {submitting ? 'Saving...' : (editingProject ? 'Update Project' : 'Save Project Experience')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR / MANAGER VERIFICATION MODAL */}
      {verifyModalProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                Review &amp; Verify Project Record
              </h3>
              <button 
                onClick={() => setVerifyModalProject(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-800">{verifyModalProject.project_name}</p>
                <p className="text-slate-500 text-[11px]">Reported role: {verifyModalProject.role_responsibilities}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Verification Decision</label>
                <select
                  value={verifyStatus}
                  onChange={(e) => setVerifyStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="Verified">Verified (Officially Confirmed)</option>
                  <option value="Self-Reported">Self-Reported (Unverified)</option>
                  <option value="Rejected">Rejected (Inaccurate / Incomplete)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supervisor / HR Feedback &amp; Notes</label>
                <textarea
                  rows={3}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Reviewer validation remarks, defect notes, or delivery observations..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVerifyModalProject(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30"
                >
                  Save Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectExperienceSection;
