import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, UserCheck, Clock, CheckCircle2, ShieldAlert, Trash2, ArrowUp, ArrowDown, 
  HelpCircle, Save, Loader2, Play, BookOpen, Layers, Filter, CheckSquare, Square, Eye, Check,
  Award, BarChart2, TrendingUp, Cpu, Search, RefreshCw, X, Edit, Edit2, Pencil, Shield, AlertCircle
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';
import AssessmentResultView from '../components/AssessmentResultView';
import { assessmentService, roleService, competencyService, employeeService, questionBankService } from '../services/api';

export const Assessments = () => {
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'bank' | 'list' | 'create' | 'assign'
  const [assessments, setAssessments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // --- ASSESSMENT RESULTS & ANALYTICS STATE ---
  const [completedResults, setCompletedResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterReadiness, setFilterReadiness] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const navigate = useNavigate();
  const userJson = localStorage.getItem('succession_user');
  const user = userJson ? JSON.parse(userJson) : { id: 1, role: 'HR', name: 'Sarah Jenkins' };

  // --- QUESTION BANK STATE ---
  const [selectedBankRoleId, setSelectedBankRoleId] = useState('');
  const [bankSummary, setBankSummary] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [filterCompetencyId, setFilterCompetencyId] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterQuestionType, setFilterQuestionType] = useState('all'); // 'all' | 'builtin' | 'custom'
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // --- ADD / EDIT CUSTOM QUESTION MODAL STATE ---
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // null for Add, object for Edit
  const [qRoleId, setQRoleId] = useState('');
  const [qCompetencyId, setQCompetencyId] = useState('');
  const [qText, setQText] = useState('');
  const [qOptionA, setQOptionA] = useState('');
  const [qOptionB, setQOptionB] = useState('');
  const [qOptionC, setQOptionC] = useState('');
  const [qOptionD, setQOptionD] = useState('');
  const [qCorrectAnswer, setQCorrectAnswer] = useState('A');
  const [qExplanation, setQExplanation] = useState('');
  const [qDifficulty, setQDifficulty] = useState('Medium');
  const [qModalError, setQModalError] = useState('');
  const [qModalSubmitting, setQModalSubmitting] = useState(false);

  // --- FORM STATE FOR NEW ASSESSMENT CREATION ---
  const [createRoleId, setCreateRoleId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [dueDate, setDueDate] = useState('2026-10-15');
  const [passingThreshold, setPassingThreshold] = useState(75);
  const [selectedQbQuestionIds, setSelectedQbQuestionIds] = useState([]);
  const [roleQbQuestions, setRoleQbQuestions] = useState([]);
  const [assignEmpIdForCreate, setAssignEmpIdForCreate] = useState('');

  // --- ASSIGN ASSESSMENT STATE ---
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [assignEmpId, setAssignEmpId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('2026-10-15');
  const [instructions, setInstructions] = useState('Complete this assessment to evaluate leadership readiness for succession planning.');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        assessmentService.getAll(),
        roleService.getAll(),
        competencyService.getAll(),
        employeeService.getAll(),
        questionBankService.getSummary(),
        assessmentService.getCompletedResults()
      ]);

      const [assRes, roleRes, compRes, empRes, qbSumRes, resultsRes] = results;
      let firstErr = null;

      if (assRes.status === 'fulfilled' && assRes.value?.success) {
        setAssessments(assRes.value.data || []);
      } else if (assRes.status === 'rejected' && !firstErr) {
        firstErr = assRes.reason?.message;
      }

      if (roleRes.status === 'fulfilled' && roleRes.value?.success) {
        const fetchedRoles = roleRes.value.data || [];
        setRoles(fetchedRoles);
        if (fetchedRoles.length > 0) {
          setSelectedBankRoleId(fetchedRoles[0].id);
          setCreateRoleId(fetchedRoles[0].id);
        }
      } else if (roleRes.status === 'rejected' && !firstErr) {
        firstErr = roleRes.reason?.message;
      }

      if (compRes.status === 'fulfilled' && compRes.value?.success) {
        setCompetencies(compRes.value.data || []);
      } else if (compRes.status === 'rejected' && !firstErr) {
        firstErr = compRes.reason?.message;
      }

      if (empRes.status === 'fulfilled' && empRes.value?.success) {
        const fetchedEmps = empRes.value.data || [];
        setEmployees(fetchedEmps);
        if (fetchedEmps.length > 0) {
          setAssignEmpId(fetchedEmps[0].id);
        }
      } else if (empRes.status === 'rejected' && !firstErr) {
        firstErr = empRes.reason?.message;
      }

      if (qbSumRes.status === 'fulfilled' && qbSumRes.value?.success) {
        setBankSummary(qbSumRes.value.data || []);
      } else if (qbSumRes.status === 'rejected' && !firstErr) {
        firstErr = qbSumRes.reason?.message;
      }

      if (resultsRes.status === 'fulfilled' && resultsRes.value?.success) {
        setCompletedResults(resultsRes.value.data || []);
      } else if (resultsRes.status === 'rejected' && !firstErr) {
        firstErr = resultsRes.reason?.message;
      }

      if (firstErr && (!resultsRes.value?.success && !assRes.value?.success)) {
        setError(firstErr);
      }
    } catch (err) {
      setError(err.message || 'Error loading assessment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchCompletedResults = async () => {
    setResultsLoading(true);
    try {
      const params = {};
      if (filterRole) params.role_id = filterRole;
      if (filterDept) params.department = filterDept;
      if (filterReadiness) params.readiness_level = filterReadiness;
      if (searchQuery) params.search = searchQuery;

      const res = await assessmentService.getCompletedResults(params);
      if (res.success) {
        setCompletedResults(res.data || []);
      }
    } catch (err) {
      console.error("Error loading completed results:", err);
      setError(err.message || "Failed to fetch completed results");
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'results') {
      fetchCompletedResults();
    }
  }, [activeTab, filterRole, filterDept, filterReadiness, searchQuery]);

  // Fetch Role-Specific Question Bank when selecting role in Bank Explorer
  const fetchRoleQuestionBank = async (roleId) => {
    if (!roleId) return;
    setBankLoading(true);
    try {
      const res = await questionBankService.getByRole(roleId);
      if (res.success) {
        setBankQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error("Error loading question bank:", err);
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBankRoleId) {
      fetchRoleQuestionBank(selectedBankRoleId);
    }
  }, [selectedBankRoleId]);

  // Load Built-in Questions when selecting role in Assessment Creation
  const loadQuestionsForCreateRole = async (roleId) => {
    if (!roleId) return;
    try {
      const res = await questionBankService.getByRole(roleId);
      if (res.success) {
        const qList = res.data.questions || [];
        setRoleQbQuestions(qList);
        setSelectedQbQuestionIds(qList.map(q => q.id));
        const matchedRole = roles.find(r => r.id === Number(roleId));
        if (matchedRole && !title) {
          setTitle(`${matchedRole.role_name} Leadership Assessment`);
        }
      }
    } catch (err) {
      console.error("Error fetching role questions:", err);
    }
  };

  useEffect(() => {
    if (createRoleId && activeTab === 'create') {
      loadQuestionsForCreateRole(createRoleId);
    }
  }, [createRoleId, activeTab]);

  const toggleQbQuestionSelection = (qId) => {
    if (selectedQbQuestionIds.includes(qId)) {
      setSelectedQbQuestionIds(selectedQbQuestionIds.filter(id => id !== qId));
    } else {
      setSelectedQbQuestionIds([...selectedQbQuestionIds, qId]);
    }
  };

  const toggleSelectAllQuestions = () => {
    if (selectedQbQuestionIds.length === roleQbQuestions.length) {
      setSelectedQbQuestionIds([]);
    } else {
      setSelectedQbQuestionIds(roleQbQuestions.map(q => q.id));
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createRoleId) {
      setError('Please select a target leadership role.');
      return;
    }
    if (selectedQbQuestionIds.length === 0) {
      setError('Please select at least one built-in question for the assessment.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        role_id: Number(createRoleId),
        title,
        description,
        duration: Number(duration),
        due_date: dueDate,
        passing_threshold: Number(passingThreshold),
        question_ids: selectedQbQuestionIds,
        assign_employee_id: assignEmpIdForCreate ? Number(assignEmpIdForCreate) : null
      };

      const res = await questionBankService.createAssessment(payload);
      if (res.success) {
        setSuccessMsg(res.message || `Created assessment with ${selectedQbQuestionIds.length} built-in questions!`);
        fetchData();
        setActiveTab('list');
      } else {
        setError(res.message || 'Failed to create assessment.');
      }
    } catch (err) {
      setError(err.message || 'Error saving assessment');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleOpenAddModal = (presetRoleId = null) => {
    setEditingQuestion(null);
    const targetRoleId = presetRoleId || selectedBankRoleId || createRoleId || (roles[0] ? roles[0].id : '');
    setQRoleId(targetRoleId);
    setQCompetencyId(competencies[0] ? competencies[0].id : '');
    setQText('');
    setQOptionA('');
    setQOptionB('');
    setQOptionC('');
    setQOptionD('');
    setQCorrectAnswer('A');
    setQExplanation('');
    setQDifficulty('Medium');
    setQModalError('');
    setShowQuestionModal(true);
  };

  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    setQRoleId(q.role_id);
    setQCompetencyId(q.competency_id || (competencies[0] ? competencies[0].id : ''));
    setQText(q.question_text || q.question || '');
    
    const opts = q.options || [];
    setQOptionA(opts[0] || '');
    setQOptionB(opts[1] || '');
    setQOptionC(opts[2] || '');
    setQOptionD(opts[3] || '');
    
    let corrLabel = 'A';
    if (q.correct_answer) {
      const rawCorr = q.correct_answer.trim();
      if (['A', 'B', 'C', 'D'].includes(rawCorr[0].toUpperCase())) {
        corrLabel = rawCorr[0].toUpperCase();
      }
    }
    setQCorrectAnswer(corrLabel);
    setQExplanation(q.explanation || '');
    setQDifficulty(q.difficulty || 'Medium');
    setQModalError('');
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e, addAnother = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setQModalError('');

    if (!qRoleId) {
      setQModalError('Please select a Leadership Role.');
      return;
    }
    if (!qCompetencyId) {
      setQModalError('Please select a Competency.');
      return;
    }
    if (!qText.trim()) {
      setQModalError('Question Text is required.');
      return;
    }
    if (!qOptionA.trim() || !qOptionB.trim() || !qOptionC.trim() || !qOptionD.trim()) {
      setQModalError('All 4 MCQ options (Option A, Option B, Option C, Option D) must be provided.');
      return;
    }

    setQModalSubmitting(true);
    try {
      const payload = {
        role_id: Number(qRoleId),
        competency_id: Number(qCompetencyId),
        question_text: qText.trim(),
        options: [qOptionA.trim(), qOptionB.trim(), qOptionC.trim(), qOptionD.trim()],
        correct_answer: qCorrectAnswer,
        explanation: qExplanation.trim(),
        difficulty: qDifficulty,
        max_score: 1.0
      };

      let res;
      if (editingQuestion) {
        res = await questionBankService.updateQuestion(editingQuestion.id, payload);
      } else {
        res = await questionBankService.createQuestion(payload);
      }

      if (res.success) {
        setSuccessMsg(res.message || (editingQuestion ? 'Question updated successfully!' : 'Custom question added successfully!'));
        
        // Refresh question bank summary & role questions
        const qbSumRes = await questionBankService.getSummary();
        if (qbSumRes.success) setBankSummary(qbSumRes.data || []);

        const targetId = Number(qRoleId);
        if (selectedBankRoleId === targetId) {
          fetchRoleQuestionBank(selectedBankRoleId);
        } else {
          setSelectedBankRoleId(targetId);
        }

        if (addAnother) {
          setEditingQuestion(null);
          setQText('');
          setQOptionA('');
          setQOptionB('');
          setQOptionC('');
          setQOptionD('');
          setQExplanation('');
        } else {
          setShowQuestionModal(false);
        }
      } else {
        setQModalError(res.message || 'Failed to save question.');
      }
    } catch (err) {
      setQModalError(err.message || 'Error saving question');
    } finally {
      setQModalSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (q) => {
    if (!window.confirm(`Are you sure you want to delete this custom question?\n\n"${q.question_text}"`)) {
      return;
    }

    setError('');
    setSuccessMsg('');
    try {
      const res = await questionBankService.deleteQuestion(q.id);
      if (res.success) {
        setSuccessMsg(res.message || 'Custom question deleted successfully.');
        const qbSumRes = await questionBankService.getSummary();
        if (qbSumRes.success) setBankSummary(qbSumRes.data || []);
        fetchRoleQuestionBank(selectedBankRoleId);
      } else {
        setError(res.message || 'Failed to delete custom question.');
      }
    } catch (err) {
      setError(err.message || 'Error deleting custom question');
    }
  };

  // Filter completed results on frontend for client-side search/filters
  const filteredCompletedResults = completedResults.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (r.employee_name || '').toLowerCase().includes(q);
      const matchCode = (r.employee_code || '').toLowerCase().includes(q);
      const matchTitle = (r.assessment_title || '').toLowerCase().includes(q);
      const matchRole = (r.role_name || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchTitle && !matchRole) return false;
    }
    if (filterRole && r.role_id !== Number(filterRole)) return false;
    if (filterDept && r.department !== filterDept) return false;
    if (filterReadiness && r.readiness_level !== filterReadiness) return false;
    if (filterDate && r.submission_date) {
      if (!r.submission_date.startsWith(filterDate)) return false;
    }
    return true;
  });

  // Calculate summary stats
  const totalAssessmentsCount = assessments.length;
  const completedCount = completedResults.length;
  const avgScore = completedCount > 0 
    ? Math.round(completedResults.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / completedCount) 
    : 0;
  const highReadinessCount = completedResults.filter(r => r.readiness_level === 'High').length;
  const devReqCount = completedResults.filter(r => r.readiness_level === 'Low' || r.readiness_level === 'Medium' || (r.development_areas && r.development_areas.length > 0)).length;

  const filteredBankQuestions = bankQuestions.filter(q => {
    if (filterCompetencyId && q.competency_id !== Number(filterCompetencyId)) return false;
    if (filterDifficulty && q.difficulty.toLowerCase() !== filterDifficulty.toLowerCase()) return false;
    if (bankSearchQuery && !(q.question_text || '').toLowerCase().includes(bankSearchQuery.toLowerCase())) return false;
    const isCustom = q.is_custom || (q.stable_code && q.stable_code.includes("CUSTOM"));
    if (filterQuestionType === 'custom' && !isCustom) return false;
    if (filterQuestionType === 'builtin' && isCustom) return false;
    return true;
  });

  const selectedRoleSummary = bankSummary.find(s => s.role_id === Number(selectedBankRoleId));
  const currentRoleObj = roles.find(r => r.id === Number(selectedBankRoleId));

  // Render detail view if an individual result is selected
  if (selectedResult) {
    return (
      <div className="font-sans">
        <AssessmentResultView
          result={selectedResult}
          onBack={() => setSelectedResult(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>Assessment Results &amp; Analytics Hub</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Competency Assessment &amp; Analytics</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            View completed employee assessment results, analyze competency gaps against target leadership roles, and evaluate AI ML readiness predictions.
          </p>
        </div>

        {/* Action Navigation Tabs */}
        <div className="mt-4 md:mt-0 flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'results' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Results &amp; Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'bank' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Question Bank</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Templates</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Assessment</span>
          </button>
          <button
            onClick={() => setActiveTab('assign')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'assign' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assign Test</span>
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

      {/* TAB 1: ASSESSMENT RESULTS & ANALYTICS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Assessments"
              value={totalAssessmentsCount || 5}
              subtitle="Active assessment templates"
              icon={Layers}
              color="indigo"
            />
            <StatCard
              title="Completed Assessments"
              value={completedCount}
              subtitle="Processed employee submissions"
              icon={CheckCircle2}
              color="emerald"
            />
            <StatCard
              title="Average Score"
              value={`${avgScore}%`}
              subtitle="Mean percentage score"
              icon={BarChart2}
              color="blue"
            />
            <StatCard
              title="High-Readiness"
              value={highReadinessCount}
              subtitle="Score >= 80% candidates"
              icon={TrendingUp}
              color="indigo"
            />
            <StatCard
              title="Development Areas"
              value={devReqCount}
              subtitle="Employees requiring training"
              icon={ShieldAlert}
              color="amber"
            />
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 card-shadow flex flex-col md:flex-row items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee, role, or test..."
                className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2 w-full md:w-auto">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value="">All Target Roles</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.role_name}</option>
                ))}
              </select>

              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value="">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Sales & Marketing">Sales &amp; Marketing</option>
                <option value="Product Management">Product Management</option>
              </select>

              <select
                value={filterReadiness}
                onChange={(e) => setFilterReadiness(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value="">All Readiness Levels</option>
                <option value="High">High Readiness</option>
                <option value="Medium">Medium Readiness</option>
                <option value="Low">Low Readiness</option>
              </select>

              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
              />

              {(filterRole || filterDept || filterReadiness || filterDate || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterRole('');
                    setFilterDept('');
                    setFilterReadiness('');
                    setFilterDate('');
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Completed Assessment Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Completed Employee Assessment Results</h3>
                <p className="text-[11px] text-slate-500">Database records of evaluated assessments, competency gap scores, and ML predictions</p>
              </div>
              <span className="text-xs font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
                {filteredCompletedResults.length} Completed Results
              </span>
            </div>

            {resultsLoading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs font-semibold">Loading employee assessment results...</p>
              </div>
            ) : filteredCompletedResults.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Award className="w-8 h-8 mx-auto mb-2 opacity-50 text-indigo-400" />
                <p className="text-xs font-semibold text-slate-700">No completed assessment results found matching filters.</p>
                <p className="text-[11px] text-slate-500 mt-1">Assign an assessment to an employee and complete it to see real-time results.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                    <tr>
                      <th className="px-6 py-3">Employee</th>
                      <th className="px-6 py-3">Assessment Title</th>
                      <th className="px-6 py-3">Target Role</th>
                      <th className="px-6 py-3">Submission Date</th>
                      <th className="px-6 py-3">Raw Score</th>
                      <th className="px-6 py-3">Score %</th>
                      <th className="px-6 py-3">Readiness Category</th>
                      <th className="px-6 py-3">AI ML Class</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filteredCompletedResults.map((res) => {
                      const submissionDateFormatted = res.submission_date
                        ? new Date(res.submission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A';
                      const mlClass = res.ml_prediction?.predicted_class || res.ml_prediction?.data?.predicted_class || res.readiness_level;

                      return (
                        <tr key={res.id || res.assignment_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{res.employee_name}</p>
                              <p className="text-[10px] text-slate-500">{res.employee_code} • {res.department}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{res.assessment_title}</td>
                          <td className="px-6 py-4 text-indigo-700 font-bold">{res.role_name}</td>
                          <td className="px-6 py-4 text-slate-600">{submissionDateFormatted}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">
                            {res.total_score} / {res.total_possible}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-indigo-700">{res.overall_score}%</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={res.readiness_level || 'High'} type="readiness" />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                              mlClass === 'High' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              mlClass === 'Medium' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              ML: {mlClass}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedResult(res)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Results</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: HR QUESTION BANK MANAGEMENT */}
      {activeTab === 'bank' && (
        <div className="space-y-6">
          {/* Question Bank Role Cards Summary Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {bankSummary.map(sum => (
              <div
                key={sum.role_id}
                onClick={() => setSelectedBankRoleId(sum.role_id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer card-shadow ${
                  Number(selectedBankRoleId) === sum.role_id
                    ? 'bg-indigo-900 text-white border-indigo-600 ring-2 ring-indigo-500'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <p className={`text-[10px] font-extrabold uppercase tracking-wider ${Number(selectedBankRoleId) === sum.role_id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {sum.department}
                </p>
                <h4 className="text-sm font-extrabold mt-0.5 truncate">{sum.role_name}</h4>
                <div className="mt-3 flex items-center justify-between text-xs border-t pt-2 border-slate-200/40">
                  <span className="font-bold">{sum.total_questions} Questions</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    Number(selectedBankRoleId) === sum.role_id ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sum.builtin_questions_count || 20} Built-in • {sum.custom_questions_count || 0} Custom
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Main Question Preview Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4">
              <div>
                <div className="flex items-center space-x-3 flex-wrap gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Question Bank: <span className="text-indigo-600">{currentRoleObj?.role_name || 'Selected Role'}</span>
                  </h3>
                  <span className="bg-indigo-50 text-indigo-700 font-extrabold text-xs px-3 py-1 rounded-full border border-indigo-100">
                    Total: {bankQuestions.length} Questions ({filteredBankQuestions.length} Shown)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Manage built-in and custom MCQ assessment questions for target leadership evaluations.
                </p>
              </div>

              <div className="flex items-center space-x-3 flex-wrap gap-2">
                <button
                  onClick={() => handleOpenAddModal(selectedBankRoleId)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Question</span>
                </button>

                <button
                  onClick={() => {
                    setCreateRoleId(selectedBankRoleId);
                    setActiveTab('create');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Role Assessment</span>
                </button>
              </div>
            </div>

            {/* Question Filters Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={bankSearchQuery}
                  onChange={(e) => setBankSearchQuery(e.target.value)}
                  placeholder="Search question text..."
                  className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none w-full"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterCompetencyId}
                  onChange={(e) => setFilterCompetencyId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full"
                >
                  <option value="">All Competencies</option>
                  {competencies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full"
                >
                  <option value="">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <select
                  value={filterQuestionType}
                  onChange={(e) => setFilterQuestionType(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-full"
                >
                  <option value="all">All Question Types</option>
                  <option value="builtin">Built-in Questions Only</option>
                  <option value="custom">Custom Questions Only</option>
                </select>
              </div>
            </div>

            {bankLoading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs font-semibold">Loading question bank for selected role...</p>
              </div>
            ) : filteredBankQuestions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <BookOpen className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-semibold">No questions matched the selected filters.</p>
                <button
                  onClick={() => handleOpenAddModal(selectedBankRoleId)}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Custom Question</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBankQuestions.map((q, idx) => {
                  const isCustom = q.is_custom || (q.stable_code && q.stable_code.includes("CUSTOM"));
                  return (
                    <div key={q.id || idx} className={`p-5 rounded-2xl border transition-all space-y-3 ${
                      isCustom ? 'border-emerald-200/90 bg-emerald-50/20 hover:bg-emerald-50/40' : 'border-slate-200/90 bg-slate-50/40 hover:bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <span className="font-extrabold text-xs text-indigo-900 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                            Q{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md">
                            {q.competency_name}
                          </span>

                          {/* Built-in vs Custom Badge */}
                          {isCustom ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-xs text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                              <span>Custom</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 font-bold text-xs text-indigo-800 bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                              <Shield className="w-3 h-3 text-indigo-600" />
                              <span>Built-in</span>
                            </span>
                          )}

                          <span className="text-[10px] font-extrabold text-slate-500 uppercase px-2 py-0.5 bg-slate-100 rounded">
                            {q.difficulty || 'Medium'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-bold text-slate-500 mr-2">Max Score: {q.max_score} pt</span>

                          {isCustom ? (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(q)}
                                className="p-1.5 bg-white border border-slate-200 hover:border-indigo-400 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                                title="Edit Question"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(q)}
                                className="p-1.5 bg-white border border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                                title="Delete Question"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                              Built-in (Protected)
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-bold text-slate-900 leading-snug">{q.question_text}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options?.map((opt, oIdx) => {
                          const optLabel = typeof opt === 'string' && opt.length >= 3 && opt[1] === '.' ? opt[0] : ["A","B","C","D"][oIdx];
                          const isCorrect = q.correct_answer === optLabel || (typeof opt === 'string' && opt.startsWith(q.correct_answer));
                          return (
                            <div
                              key={oIdx}
                              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span>{opt}</span>
                              {isCorrect && (
                                <span className="text-[9px] uppercase bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium flex items-start space-x-2">
                          <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-blue-950">Explanation: </span>
                            <span>{q.explanation}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: ALL ASSESSMENTS LIST */}
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
                    <td className="px-6 py-4 font-bold text-slate-800">{ass.question_count || 20} questions</td>
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

      {/* VIEW 4: CREATE ASSESSMENT & QUESTION BANK SELECTION */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">1. Select Target Leadership Role &amp; Parameters</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Leadership Role</label>
                <select
                  value={createRoleId}
                  onChange={(e) => setCreateRoleId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assessment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g. Senior Leadership Competency &amp; Readiness Evaluation"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Instructions</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="Enter objective and guidelines..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Passing Threshold (%)</label>
                <input
                  type="number"
                  value={passingThreshold}
                  onChange={(e) => setPassingThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">2. Select Questions from Built-in Question Bank</h3>
                <p className="text-[11px] text-slate-500">
                  Pre-loaded 20 questions for target role. HR can select all 20 or choose a subset.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                  Selected: {selectedQbQuestionIds.length} of {roleQbQuestions.length} Questions
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAllQuestions}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-colors"
                >
                  {selectedQbQuestionIds.length === roleQbQuestions.length ? 'Deselect All' : 'Select All 20'}
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {roleQbQuestions.map((q, qIdx) => {
                const isSelected = selectedQbQuestionIds.includes(q.id);
                return (
                  <div
                    key={q.id || qIdx}
                    onClick={() => toggleQbQuestionSelection(q.id)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500'
                        : 'bg-slate-50/50 border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="pt-0.5 flex-shrink-0">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border border-slate-300 bg-white" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">
                          Q{qIdx + 1}. {q.competency_name} ({q.difficulty})
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">Max Score: {q.max_score} pt</span>
                      </div>
                      <p className="font-semibold text-slate-800">{q.question_text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center space-x-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Assessment &amp; Built-in Questions</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* VIEW 5: ASSIGN ASSESSMENT TO EMPLOYEE */}
      {activeTab === 'assign' && (
        <form onSubmit={handleAssignSubmit} className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-5 max-w-2xl mx-auto">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Assign Assessment to Employee</h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Assessment Template</label>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              required
            >
              <option value="">-- Choose Assessment Template --</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>{a.title} ({a.role_name} • {a.question_count} questions)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee</label>
            <select
              value={assignEmpId}
              onChange={(e) => setAssignEmpId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
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

      {/* ADD / EDIT CUSTOM QUESTION MODAL */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 card-shadow max-w-2xl w-full p-6 space-y-6 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                  {editingQuestion ? 'Edit Custom Question' : 'Question Bank Management'}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                  {editingQuestion ? 'Edit Custom MCQ Question' : 'Add New Custom MCQ Question'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create role-tailored multiple choice questions to extend the built-in assessment question bank.
                </p>
              </div>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{qModalError}</span>
              </div>
            )}

            <form onSubmit={(e) => handleSaveQuestion(e, false)} className="space-y-4">
              {/* Role & Competency Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Leadership Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={qRoleId}
                    onChange={(e) => setQRoleId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Leadership Role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Leadership Competency <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={qCompetencyId}
                    onChange={(e) => setQCompetencyId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Competency...</option>
                    {competencies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Question Text <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Enter the detailed multiple choice question text..."
                  rows={3}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* MCQ Options A, B, C, D */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Multiple Choice Options (4 Required) <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-900 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                      A
                    </span>
                    <input
                      type="text"
                      value={qOptionA}
                      onChange={(e) => setQOptionA(e.target.value)}
                      placeholder="Option A text..."
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-900 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                      B
                    </span>
                    <input
                      type="text"
                      value={qOptionB}
                      onChange={(e) => setQOptionB(e.target.value)}
                      placeholder="Option B text..."
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-900 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                      C
                    </span>
                    <input
                      type="text"
                      value={qOptionC}
                      onChange={(e) => setQOptionC(e.target.value)}
                      placeholder="Option C text..."
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-900 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                      D
                    </span>
                    <input
                      type="text"
                      value={qOptionD}
                      onChange={(e) => setQOptionD(e.target.value)}
                      placeholder="Option D text..."
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Correct Answer & Difficulty Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correct Answer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={qCorrectAnswer}
                    onChange={(e) => setQCorrectAnswer(e.target.value)}
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="A">Option A is Correct</option>
                    <option value="B">Option B is Correct</option>
                    <option value="C">Option C is Correct</option>
                    <option value="D">Option D is Correct</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Question Difficulty Level
                  </label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-bold text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Answer Explanation <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Provide rationale or background behind the correct answer..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>

                {!editingQuestion && (
                  <button
                    type="button"
                    disabled={qModalSubmitting}
                    onClick={(e) => handleSaveQuestion(e, true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5"
                  >
                    {qModalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Save &amp; Add Another</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={qModalSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
                >
                  {qModalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editingQuestion ? 'Update Question' : 'Save Question'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessments;
