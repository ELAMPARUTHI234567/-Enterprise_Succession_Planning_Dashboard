import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserCheck, Clock, CheckCircle2, ShieldAlert, Trash2, ArrowUp, ArrowDown, HelpCircle, Save, Loader2, Play } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { assessmentService, roleService, competencyService, employeeService } from '../services/api';

export const Assessments = () => {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'assign'
  const [assessments, setAssessments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();
  const userJson = localStorage.getItem('succession_user');
  const user = userJson ? JSON.parse(userJson) : { id: 1, role: 'HR', name: 'Sarah Jenkins' };

  // Form State for New Assessment Creation
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roleId, setRoleId] = useState(1);
  const [duration, setDuration] = useState(30);
  const [dueDate, setDueDate] = useState('2026-10-15');
  const [passingThreshold, setPassingThreshold] = useState(75);

  // Dynamic Question Builder State
  const [questions, setQuestions] = useState([
    {
      question: 'How do you prioritize high-risk technical debt during a fast-paced release cycle?',
      question_type: 'Multiple Choice',
      competency_id: 1,
      max_score: 10,
      difficulty: 'Medium',
      correct_answer: 'A',
      options: [
        'A. Conduct trade-off analysis with stakeholders and schedule critical fixes in sprint backlog',
        'B. Postpone all technical debt indefinitely to meet initial feature deadlines',
        'C. Stop all feature development immediately to rewrite code',
        'D. Let developers fix debt quietly without tracking story points'
      ]
    }
  ]);

  // Assign Assessment State
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [assignEmpId, setAssignEmpId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('2026-10-15');
  const [instructions, setInstructions] = useState('Complete this assessment to evaluate leadership readiness for succession planning.');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [assRes, roleRes, compRes, empRes] = await Promise.all([
        assessmentService.getAll(),
        roleService.getAll(),
        competencyService.getAll(),
        employeeService.getAll()
      ]);

      if (assRes.success) setAssessments(assRes.data || []);
      if (roleRes.success) {
        setRoles(roleRes.data || []);
        if (roleRes.data?.length > 0) setRoleId(roleRes.data[0].id);
      }
      if (compRes.success) setCompetencies(compRes.data || []);
      if (empRes.success) {
        setEmployees(empRes.data || []);
        if (empRes.data?.length > 0) setAssignEmpId(empRes.data[0].id);
      }
    } catch (err) {
      setError(err.message || 'Error loading assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Question Builder Handlers
  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: 'New evaluation question description...',
        question_type: 'Multiple Choice',
        competency_id: competencies[0]?.id || 1,
        max_score: 10,
        difficulty: 'Medium',
        correct_answer: 'A',
        options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4']
      }
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleMoveQuestion = (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const copy = [...questions];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;
    setQuestions(copy);
  };

  const handleQuestionChange = (idx, field, value) => {
    const copy = [...questions];
    copy[idx][field] = value;
    setQuestions(copy);
  };

  const handleOptionChange = (qIdx, oIdx, value) => {
    const copy = [...questions];
    copy[qIdx].options[oIdx] = value;
    setQuestions(copy);
  };

  // Submit Create Assessment
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!title) {
      setError('Please provide an assessment title');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        title,
        description,
        created_by: user.id,
        role_id: Number(roleId),
        duration: Number(duration),
        due_date: dueDate,
        passing_threshold: Number(passingThreshold),
        questions
      };

      const res = await assessmentService.create(payload);
      if (res.success) {
        setSuccessMsg('Assessment created successfully with custom questions!');
        fetchData();
        setActiveTab('list');
        setTitle('');
        setDescription('');
      } else {
        setError(res.message || 'Failed to create assessment');
      }
    } catch (err) {
      setError(err.message || 'Error saving assessment');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Assign Assessment
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssessmentId || !assignEmpId) {
      setError('Please select both an assessment template and an employee.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await assessmentService.assign(selectedAssessmentId, {
        employee_id: Number(assignEmpId),
        assigned_by: user.id,
        due_date: assignDueDate,
        instructions
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Assessment assigned to employee successfully!');
        fetchData();
        setActiveTab('list');
      } else {
        setError(res.message || 'Assignment failed');
      }
    } catch (err) {
      setError(err.message || 'Error assigning assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assessment Builder &amp; Assignment Workflow</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Competency Assessment Module</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Design dynamic evaluation templates, add customized question items per competency category, and assign assessments to employees.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="mt-4 md:mt-0 flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Assessments
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            + Create Assessment
          </button>
          <button
            onClick={() => setActiveTab('assign')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'assign' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Assign Test
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: ASSESSMENT LIST */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Assessment Templates &amp; Assignments</h3>
              <p className="text-[11px] text-slate-500">Active tests in the enterprise succession planning framework</p>
            </div>
            <button
              onClick={() => setActiveTab('create')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Create New</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3">Assessment Title</th>
                  <th className="px-6 py-3">Target Role</th>
                  <th className="px-6 py-3">Questions Count</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Threshold</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {assessments.map((ass) => (
                  <tr key={ass.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{ass.title}</p>
                        <p className="text-[10px] text-slate-500">{ass.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-indigo-700 font-semibold">{ass.role_name}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{ass.question_count || 4} questions</td>
                    <td className="px-6 py-4">{ass.duration} mins</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{ass.passing_threshold}%</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={ass.status || 'Active'} type="status" />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAssessmentId(ass.id);
                          setActiveTab('assign');
                        }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold rounded-lg text-xs transition-colors"
                      >
                        Assign to Employee
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: CREATE ASSESSMENT & QUESTION BUILDER */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">1. Assessment Template Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assessment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g. Senior Leadership Competency &amp; Conflict Management Assessment"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Leadership Role</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Instructions</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="Enter high level objective of this evaluation..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Passing Threshold (%)</label>
                <input
                  type="number"
                  value={passingThreshold}
                  onChange={(e) => setPassingThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC QUESTION BUILDER */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">2. Dynamic Question Builder Items</h3>
                <p className="text-[11px] text-slate-500">Construct customized questions, types, competencies, and options</p>
              </div>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg text-xs transition-colors flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-900 bg-indigo-100 px-2.5 py-1 rounded-lg">
                      Question #{qIdx + 1}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIdx, 'up')}
                        disabled={qIdx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIdx, 'down')}
                        disabled={qIdx === questions.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1 text-rose-500 hover:text-rose-700 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Question Text</label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Question Type</label>
                      <select
                        value={q.question_type}
                        onChange={(e) => handleQuestionChange(qIdx, 'question_type', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                      >
                        <option value="Multiple Choice">Multiple Choice</option>
                        <option value="Rating Scale">Rating Scale (1-5)</option>
                        <option value="Scenario-Based Question">Scenario-Based Question</option>
                        <option value="Yes/No">Yes/No</option>
                        <option value="Short Answer">Short Answer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Competency Category</label>
                      <select
                        value={q.competency_id}
                        onChange={(e) => handleQuestionChange(qIdx, 'competency_id', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                      >
                        {competencies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Max Score</label>
                      <input
                        type="number"
                        value={q.max_score}
                        onChange={(e) => handleQuestionChange(qIdx, 'max_score', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Options if Multiple Choice */}
                  {q.question_type === 'Multiple Choice' && (
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-bold text-slate-700">Multiple Choice Options</label>
                      {q.options?.map((opt, oIdx) => (
                        <input
                          key={oIdx}
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center space-x-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Assessment Template</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* VIEW 3: ASSIGN ASSESSMENT TO EMPLOYEE */}
      {activeTab === 'assign' && (
        <form onSubmit={handleAssignSubmit} className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-5 max-w-2xl mx-auto">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Assign Assessment to Employee</h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Assessment Template</label>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              required
            >
              <option value="">-- Choose Assessment Template --</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>{a.title} ({a.role_name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee</label>
            <select
              value={assignEmpId}
              onChange={(e) => setAssignEmpId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              required
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.designation} • {emp.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Completion Due Date</label>
            <input
              type="date"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Instructions for Employee</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center justify-center space-x-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
            <span>Confirm &amp; Dispatch Assignment</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default Assessments;
