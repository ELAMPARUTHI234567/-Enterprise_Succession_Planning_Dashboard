import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Award, ShieldAlert, UserCheck, TrendingUp, RefreshCw, ArrowRight, 
  CheckCircle2, Clock, PlusCircle, Eye, Search, BarChart2, Cpu, X,
  Sparkles, FileText, ChevronDown, ChevronUp, ShieldCheck, AlertCircle, HelpCircle,
  AlertTriangle, Target, CheckSquare, MessageSquare, ThumbsUp, Send, Trash2, Edit3,
  Briefcase, Calendar, Star, Filter, Flag, MoreVertical, ClipboardCheck, Check
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import ReadinessPieChart from '../charts/ReadinessPieChart';
import TaskStatusChart from '../charts/TaskStatusChart';
import ProjectProgressChart from '../charts/ProjectProgressChart';
import AssessmentResultView from '../components/AssessmentResultView';
import { CompanyHierarchySection } from '../components/CompanyHierarchySection';
import AITop3SuccessorsSection from '../components/AITop3SuccessorsSection';
import AIManagerTeamIntelligenceSection from '../components/AIManagerTeamIntelligenceSection';
import AICompetencyIntelligenceSection from '../components/AICompetencyIntelligenceSection';
import AIChatDrawer from '../components/AIChatDrawer';
import { 
  authService, managerService, roleService, assessmentService 
} from '../services/api';

export const ManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('team'); // 'team', 'tasks', 'goals', 'issues', 'feedback', 'recommendations', 'assessments'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '' }

  // Core Data with Session Caching for Instant Loading
  const [overview, setOverview] = useState(() => {
    try {
      const cached = sessionStorage.getItem('manager_overview');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [teamMembers, setTeamMembers] = useState(() => {
    try {
      const cached = sessionStorage.getItem('manager_team');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [issues, setIssues] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [teamResults, setTeamResults] = useState([]);
  const [roles, setRoles] = useState([]);

  // UI state
  const [selectedResult, setSelectedResult] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('All');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('All');

  // Modals state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', employee_id: '', priority: 'Medium',
    start_date: '', due_date: '', status: 'Pending'
  });

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: '', description: '', target_metric: 100, current_metric: 0,
    metric_unit: '%', target_date: '', status: 'On Track'
  });

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [resolvingIssue, setResolvingIssue] = useState(null);
  const [issueForm, setIssueForm] = useState({
    title: '', description: '', severity: 'Medium', employee_id: '', status: 'Open'
  });
  const [resolveNotes, setResolveNotes] = useState('');

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    employee_id: '', feedback_date: new Date().toISOString().slice(0, 10),
    strengths: '', improvement_areas: '', development_plan: '',
    follow_up_status: 'Scheduled', is_private: true
  });

  const [recModalOpen, setRecModalOpen] = useState(false);
  const [recForm, setRecForm] = useState({
    employee_id: '', role_id: '', strengths_summary: '',
    development_needs: '', recommendation_notes: ''
  });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedEmpForEdit, setSelectedEmpForEdit] = useState(null);
  const [profileForm, setProfileForm] = useState({
    availability_status: 'Available', responsibilities: '', performance_score: ''
  });

  // Stage 1 Initial Screening Assignment State
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [isAssignScreeningModalOpen, setIsAssignScreeningModalOpen] = useState(false);
  const [selectedScreeningIds, setSelectedScreeningIds] = useState([]);
  const [screeningDate, setScreeningDate] = useState(todayDateStr);
  const [screeningTime, setScreeningTime] = useState('10:00');
  const [screeningDuration, setScreeningDuration] = useState(30);
  const [assigningScreening, setAssigningScreening] = useState(false);
  const [screeningSearch, setScreeningSearch] = useState('');
  const [screeningStatusFilter, setScreeningStatusFilter] = useState('All');

  const handleAssignInitialScreening = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (selectedScreeningIds.length === 0) {
      showToast('error', 'Please select at least one direct report.');
      return;
    }

    setAssigningScreening(true);
    try {
      const res = await managerService.assignInitialAssessment({
        employee_ids: selectedScreeningIds,
        scheduled_date: screeningDate,
        start_time: screeningTime,
        duration_minutes: Number(screeningDuration)
      });
      if (res?.data?.success || res?.success) {
        showToast('success', res?.data?.message || res?.message || 'Stage 1 Initial Screening scheduled successfully.');
        setIsAssignScreeningModalOpen(false);
        setSelectedScreeningIds([]);
        await fetchManagerData();
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to assign initial screening assessment.');
    } finally {
      setAssigningScreening(false);
    }
  };

  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const userJson = localStorage.getItem('succession_user');
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  });

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const fetchManagerData = async () => {
    if (!overview) setLoading(true);
    setError('');

    const timeoutId = setTimeout(() => {
      setLoading(false);
      if (!overview) {
        setError('Loading manager dashboard timed out. Please click retry.');
      }
    }, 15000);

    try {
      let currentManager = user;
      try {
        const meRes = await authService.getMe();
        if (meRes?.success && meRes?.data) {
          currentManager = meRes.data;
          setUser(currentManager);
          localStorage.setItem('succession_user', JSON.stringify(currentManager));
        }
      } catch {
        // Fall back to cached session
      }

      // Fetch all required dynamic data from backend endpoints in parallel
      const [
        overviewRes, teamRes, tasksRes, goalsRes,
        issuesRes, feedbackRes, recsRes, resultsRes, rolesRes
      ] = await Promise.all([
        managerService.getOverview().catch(() => null),
        managerService.getTeam().catch(() => null),
        managerService.getTasks().catch(() => null),
        managerService.getGoals().catch(() => null),
        managerService.getIssues().catch(() => null),
        managerService.getFeedback().catch(() => null),
        managerService.getRecommendations().catch(() => null),
        assessmentService.getCompletedResults().catch(() => null),
        roleService.getAll().catch(() => null)
      ]);

      if (overviewRes?.success) {
        setOverview(overviewRes);
        try { sessionStorage.setItem('manager_overview', JSON.stringify(overviewRes)); } catch {}
      }
      if (teamRes?.success) {
        setTeamMembers(teamRes.data || []);
        try { sessionStorage.setItem('manager_team', JSON.stringify(teamRes.data || [])); } catch {}
      }
      if (tasksRes?.success) setTasks(tasksRes.data || []);
      if (goalsRes?.success) setGoals(goalsRes.data || []);
      if (issuesRes?.success) setIssues(issuesRes.data || []);
      if (feedbackRes?.success) setFeedbacks(feedbackRes.data || []);
      if (recsRes?.success) setRecommendations(recsRes.data || []);
      if (resultsRes?.success) setTeamResults(resultsRes.data || []);
      if (rolesRes?.success) setRoles(rolesRes.data || []);

    } catch (err) {
      setError(err.message || 'Error loading dynamic manager dashboard data');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
  }, []);

  // Filter team results with ranking & honest ties
  const rankedTeamResults = useMemo(() => {
    const filtered = (teamResults || []).filter(r => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.employee_name || '').toLowerCase().includes(q);
        const matchCode = (r.employee_code || '').toLowerCase().includes(q);
        const matchTitle = (r.assessment_title || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchTitle) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const scoreA = a.overall_score ?? a.score ?? -1;
      const scoreB = b.overall_score ?? b.score ?? -1;
      return scoreB - scoreA;
    });

    let currentRank = 1;
    return sorted.map((item, index) => {
      let isTied = false;
      if (index > 0) {
        const prevScore = sorted[index - 1].overall_score ?? sorted[index - 1].score ?? -1;
        const curScore = item.overall_score ?? item.score ?? -1;
        if (curScore !== prevScore) {
          currentRank = index + 1;
        } else {
          isTied = true;
        }
      }
      if (index < sorted.length - 1) {
        const nextScore = sorted[index + 1].overall_score ?? sorted[index + 1].score ?? -1;
        const curScore = item.overall_score ?? item.score ?? -1;
        if (curScore === nextScore) {
          isTied = true;
        }
      }
      return { ...item, intra_team_rank: currentRank, is_tied: isTied };
    });
  }, [teamResults, searchQuery]);

  // Stage 1 Initial Screening Filter
  const filteredScreeningMembers = useMemo(() => {
    return (teamMembers || []).filter(m => {
      if (screeningStatusFilter !== 'All') {
        if (screeningStatusFilter === 'Passed' && m.initial_screening_status !== 'Passed') return false;
        if (screeningStatusFilter === 'Failed' && m.initial_screening_status !== 'Failed') return false;
        if (screeningStatusFilter === 'Assigned' && m.initial_screening_status !== 'Assigned') return false;
        if (screeningStatusFilter === 'Awaiting Assessment' && m.initial_screening_status !== 'Awaiting Assessment') return false;
        if (screeningStatusFilter === 'Eligible' && !m.eligible_for_hr) return false;
      }
      if (screeningSearch) {
        const q = screeningSearch.toLowerCase();
        const matchName = (m.name || '').toLowerCase().includes(q);
        const matchCode = (m.employee_code || '').toLowerCase().includes(q);
        const matchRole = (m.designation || m.department || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchRole) return false;
      }
      return true;
    });
  }, [teamMembers, screeningStatusFilter, screeningSearch]);

  // Tasks Filter
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (taskStatusFilter !== 'All' && t.status !== taskStatusFilter) return false;
      if (taskPriorityFilter !== 'All' && t.priority !== taskPriorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchAssignee = (t.employee_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee) return false;
      }
      return true;
    });
  }, [tasks, taskStatusFilter, taskPriorityFilter, searchQuery]);

  // --------------------------------------------------------------------------
  // TASK OPERATIONS
  // --------------------------------------------------------------------------
  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setTaskForm({
      title: '', description: '',
      employee_id: teamMembers.length > 0 ? teamMembers[0].id : '',
      priority: 'Medium',
      start_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'Pending'
    });
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      employee_id: task.employee_id,
      priority: task.priority || 'Medium',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      status: task.status || 'Pending'
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      showToast('error', 'Task title is required.');
      return;
    }
    if (!taskForm.employee_id) {
      showToast('error', 'Please assign an authorized direct report.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingTask) {
        await managerService.updateTask(editingTask.id, taskForm);
        showToast('success', `Task '${taskForm.title}' updated.`);
      } else {
        await managerService.createTask(taskForm);
        showToast('success', `Task '${taskForm.title}' created and assigned.`);
      }
      setTaskModalOpen(false);
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (task, newStatus) => {
    try {
      await managerService.updateTask(task.id, { status: newStatus });
      showToast('success', `Task status set to ${newStatus}.`);
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await managerService.deleteTask(taskId);
      showToast('success', 'Task removed.');
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to delete task');
    }
  };

  // --------------------------------------------------------------------------
  // TEAM GOALS OPERATIONS
  // --------------------------------------------------------------------------
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.title.trim()) {
      showToast('error', 'Goal title is required.');
      return;
    }
    setSubmitting(true);
    try {
      await managerService.createGoal(goalForm);
      showToast('success', `Team Goal '${goalForm.title}' created.`);
      setGoalModalOpen(false);
      setGoalForm({
        title: '', description: '', target_metric: 100, current_metric: 0,
        metric_unit: '%', target_date: '', status: 'On Track'
      });
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateGoalMetric = async (goal, newMetric) => {
    try {
      await managerService.updateGoal(goal.id, { current_metric: parseFloat(newMetric) });
      showToast('success', `Goal progress updated to ${newMetric}${goal.metric_unit}.`);
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Delete this team goal?')) return;
    try {
      await managerService.deleteGoal(goalId);
      showToast('success', 'Team goal removed.');
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to delete goal');
    }
  };

  // --------------------------------------------------------------------------
  // ISSUES & BLOCKERS OPERATIONS
  // --------------------------------------------------------------------------
  const handleSaveIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.title.trim()) {
      showToast('error', 'Issue title is required.');
      return;
    }
    setSubmitting(true);
    try {
      await managerService.createIssue(issueForm);
      showToast('success', `Issue '${issueForm.title}' recorded.`);
      setIssueModalOpen(false);
      setIssueForm({ title: '', description: '', severity: 'Medium', employee_id: '', status: 'Open' });
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to record issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResolveIssue = (issue) => {
    setResolvingIssue(issue);
    setResolveNotes('');
  };

  const handleConfirmResolveIssue = async () => {
    if (!resolvingIssue) return;
    setSubmitting(true);
    try {
      await managerService.updateIssue(resolvingIssue.id, {
        status: 'Resolved',
        resolution_notes: resolveNotes.trim() || 'Resolved and verified by Manager.'
      });
      showToast('success', `Issue '${resolvingIssue.title}' marked as Resolved.`);
      setResolvingIssue(null);
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to resolve issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIssue = async (issueId) => {
    if (!window.confirm('Delete this issue record?')) return;
    try {
      await managerService.deleteIssue(issueId);
      showToast('success', 'Issue record removed.');
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to delete issue');
    }
  };

  // --------------------------------------------------------------------------
  // FEEDBACK OPERATIONS
  // --------------------------------------------------------------------------
  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackForm.employee_id) {
      showToast('error', 'Please select an employee.');
      return;
    }
    if (!feedbackForm.strengths.trim() && !feedbackForm.improvement_areas.trim()) {
      showToast('error', 'Please provide either key strengths or development areas.');
      return;
    }

    setSubmitting(true);
    try {
      await managerService.createFeedback(feedbackForm);
      showToast('success', 'Development feedback recorded.');
      setFeedbackModalOpen(false);
      setFeedbackForm({
        employee_id: teamMembers.length > 0 ? teamMembers[0].id : '',
        feedback_date: new Date().toISOString().slice(0, 10),
        strengths: '', improvement_areas: '', development_plan: '',
        follow_up_status: 'Scheduled', is_private: true
      });
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to record feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // LEADERSHIP RECOMMENDATIONS OPERATIONS
  // --------------------------------------------------------------------------
  const handleSaveRecommendation = async (e) => {
    e.preventDefault();
    if (!recForm.employee_id || !recForm.role_id) {
      showToast('error', 'Please select both an employee and a target leadership role.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await managerService.submitRecommendation(recForm);
      showToast('success', res.message || 'Recommendation submitted to HR.');
      setRecModalOpen(false);
      setRecForm({
        employee_id: teamMembers.length > 0 ? teamMembers[0].id : '',
        role_id: roles.length > 0 ? roles[0].id : '',
        strengths_summary: '', development_needs: '', recommendation_notes: ''
      });
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to submit recommendation');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // PROFILE & RESPONSIBILITIES UPDATE
  // --------------------------------------------------------------------------
  const handleOpenEditProfile = (emp) => {
    setSelectedEmpForEdit(emp);
    setProfileForm({
      availability_status: emp.availability_status || 'Available',
      responsibilities: emp.responsibilities || '',
      performance_score: emp.performance_score != null ? String(emp.performance_score) : ''
    });
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!selectedEmpForEdit) return;

    setSubmitting(true);
    try {
      await managerService.updateTeamMember(selectedEmpForEdit.id, profileForm);
      showToast('success', `Updated responsibilities and status for ${selectedEmpForEdit.name}.`);
      setProfileModalOpen(false);
      await fetchManagerData();
    } catch (err) {
      showToast('error', err.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Dynamic Manager Team Dashboard...</p>
      </div>
    );
  }

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

  if (error && !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6 bg-white rounded-2xl border border-slate-200 card-shadow text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-slate-800">Unable to Load Manager Dashboard</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md">{error}</p>
        <button
          onClick={fetchManagerData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Dashboard</span>
        </button>
      </div>
    );
  }

  const kpis = overview?.kpis || {};
  const charts = overview?.charts || {};

  // Resolve Manager profile info dynamically from authenticated user profile and manager overview
  const isDemoEmail = (em) => {
    if (!em) return true;
    const lower = em.toLowerCase().trim();
    return lower === 'manager@company.com' || lower === 'hr@company.com' || lower.includes('sneha.reddy@');
  };

  const isDemoName = (n) => {
    if (!n) return true;
    const lower = n.toLowerCase().trim();
    return lower.includes('sneha reddy') || lower.includes('sarah jenkins');
  };

  const getManagerDisplayEmail = () => {
    if (user?.oauth_email && !isDemoEmail(user.oauth_email)) return user.oauth_email;
    if (user?.authenticated_email && !isDemoEmail(user.authenticated_email)) return user.authenticated_email;
    if (user?.email && !isDemoEmail(user.email)) return user.email;
    if (user?.oauth_email) return user.oauth_email;
    if (overview?.manager?.email && !isDemoEmail(overview.manager.email)) return overview.manager.email;
    if (user?.email) return user.email;
    return overview?.manager?.email || 'elamparuthikp777@gmail.com';
  };

  const getManagerDisplayName = () => {
    if (user?.name && user.name.trim() && !isDemoName(user.name)) return user.name.trim();
    if (overview?.manager?.name && overview.manager.name.trim() && !isDemoName(overview.manager.name)) return overview.manager.name.trim();
    const email = getManagerDisplayEmail();
    if (email && email.includes('@')) {
      return email.split('@')[0];
    }
    return user?.username || overview?.manager?.name || 'Manager';
  };

  const mgrEmail = getManagerDisplayEmail();
  const mgrName = getManagerDisplayName();
  const mgrDept = user?.department || overview?.manager?.department;
  const mgrDesig = user?.designation || overview?.manager?.designation;

  const mgrInfo = {
    ...(overview?.manager || {}),
    ...(user || {}),
    name: mgrName,
    email: mgrEmail,
    department: mgrDept,
    designation: mgrDesig
  };

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold transition-all shadow-md ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Authorized Manager Scope • {mgrInfo?.name || 'Manager'}</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Manager Dashboard</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-indigo-200">
            <span>Email: <strong className="text-white font-semibold">{mgrInfo?.email || 'N/A'}</strong></span>
            {mgrInfo?.department && <span>• Department: <strong className="text-white font-semibold">{mgrInfo.department}</strong></span>}
            {mgrInfo?.designation && <span>• Designation: <strong className="text-white font-semibold">{mgrInfo.designation}</strong></span>}
          </div>
          <p className="text-xs text-indigo-200/80 mt-1.5 max-w-2xl">
            Live database operations for your direct reports: assign tasks, track goals, resolve blockers, log development feedback, and submit leadership succession candidates.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap gap-2">
          <button
            onClick={fetchManagerData}
            disabled={loading}
            className="px-3.5 py-2 bg-indigo-700/60 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center space-x-1.5 border border-indigo-500/30"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={handleOpenCreateTask}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Task</span>
          </button>
          <button
            onClick={() => setGoalModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
          >
            <Target className="w-4 h-4" />
            <span>New Goal</span>
          </button>
        </div>
      </div>

      {/* TWO-STAGE WORKFLOW: STAGE 1 TEAM SCREENING KPI BANNER (8 METRICS) */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white border border-indigo-700/40 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
              <ClipboardCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Stage 1 Employee Screening &amp; Team Performance</span>
                <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-extrabold rounded-full">
                  Two-Stage Succession Model
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                Live team statistics for initial competency screening and HR leadership evaluation eligibility.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('screening');
              setIsAssignScreeningModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Assign Initial Assessment</span>
          </button>
        </div>

        {/* 8 STAGE 1 KPI METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-white">{kpis.total_approved_team_employees ?? teamMembers.length}</span>
            <span className="block text-[10px] font-bold text-indigo-200 uppercase tracking-wider mt-1">Approved Team</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-amber-300">{kpis.newly_assigned_awaiting_screening ?? 0}</span>
            <span className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mt-1">Newly Assigned</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-slate-300">{kpis.awaiting_initial_assessment ?? 0}</span>
            <span className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1">Awaiting Test</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-blue-300">{kpis.initial_assessments_assigned ?? 0}</span>
            <span className="block text-[10px] font-bold text-blue-200 uppercase tracking-wider mt-1">Scheduled</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-cyan-300">{kpis.initial_assessments_completed ?? 0}</span>
            <span className="block text-[10px] font-bold text-cyan-200 uppercase tracking-wider mt-1">Completed</span>
          </div>
          <div className="bg-white/5 border border-emerald-500/30 bg-emerald-950/20 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-emerald-400">{kpis.initial_assessments_passed ?? 0}</span>
            <span className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mt-1">Passed (≥70%)</span>
          </div>
          <div className="bg-white/5 border border-rose-500/30 bg-rose-950/20 rounded-xl p-3 text-center">
            <span className="block text-xl font-black text-rose-400">{kpis.initial_assessments_failed ?? 0}</span>
            <span className="block text-[10px] font-bold text-rose-300 uppercase tracking-wider mt-1">Failed (&lt;70%)</span>
          </div>
          <div className="bg-indigo-600/30 border border-indigo-400/40 rounded-xl p-3 text-center shadow-inner">
            <span className="block text-xl font-black text-emerald-300">{kpis.eligible_for_hr_evaluation ?? 0}</span>
            <span className="block text-[10px] font-bold text-indigo-100 uppercase tracking-wider mt-1">Eligible for HR</span>
          </div>
        </div>
      </div>

      {/* 8 DYNAMIC KPI CARDS (Section 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total authorized team members */}
        <StatCard
          title="Team Members"
          value={kpis.total_team_members ?? teamMembers.length}
          subtitle="Authorized direct reports"
          icon={Users}
          color="indigo"
        />

        {/* Card 2: Active tasks */}
        <StatCard
          title="Active Tasks"
          value={kpis.active_tasks ?? 0}
          subtitle="In Progress &amp; Pending"
          icon={Clock}
          color="amber"
        />

        {/* Card 3: Completed tasks */}
        <StatCard
          title="Completed Tasks"
          value={kpis.completed_tasks ?? 0}
          subtitle={`Completion Rate: ${kpis.task_completion_rate ?? 0}%`}
          icon={CheckCircle2}
          color="emerald"
        />

        {/* Card 4: Overdue tasks */}
        <StatCard
          title="Overdue Tasks"
          value={kpis.overdue_tasks ?? 0}
          subtitle="Requires immediate review"
          icon={AlertTriangle}
          color={kpis.overdue_tasks > 0 ? "rose" : "slate"}
        />

        {/* Card 5: Projects in progress */}
        <StatCard
          title="Projects In Progress"
          value={kpis.projects_in_progress ?? 0}
          subtitle="Active team project milestones"
          icon={Briefcase}
          color="blue"
        />

        {/* Card 6: Open issues */}
        <StatCard
          title="Open Issues &amp; Blockers"
          value={kpis.open_issues ?? 0}
          subtitle="Unresolved team risks"
          icon={ShieldAlert}
          color={kpis.open_issues > 0 ? "amber" : "emerald"}
        />

        {/* Card 7: Pending feedback */}
        <StatCard
          title="Pending Feedback"
          value={kpis.pending_feedback ?? 0}
          subtitle="Awaiting 1-on-1 development"
          icon={MessageSquare}
          color="purple"
        />

        {/* Card 8: Employees requiring development */}
        <StatCard
          title="Needing Development"
          value={kpis.employees_needing_development ?? 0}
          subtitle="Identified competency gaps"
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* 4 DYNAMIC CHARTS (Section 9) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Competency Gaps */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Team Competency Gap Analysis</h3>
              <p className="text-[11px] text-slate-500">Average team performance vs target leadership requirements</p>
            </div>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              Live Database
            </span>
          </div>
          <CompetencyBarChart
            labels={charts.competency_gaps?.labels || []}
            currentScores={charts.competency_gaps?.current || []}
            requiredScores={charts.competency_gaps?.required || []}
          />
        </div>

        {/* Chart 2: Task Status Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Task Execution Status</h3>
              <p className="text-[11px] text-slate-500">Real-time status breakdown across all team tasks</p>
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
              {tasks.length} Total Tasks
            </span>
          </div>
          <TaskStatusChart
            pending={charts.task_status?.data?.[0] ?? 0}
            inProgress={charts.task_status?.data?.[1] ?? 0}
            completed={charts.task_status?.data?.[2] ?? 0}
            overdue={charts.task_status?.data?.[3] ?? 0}
          />
        </div>

        {/* Chart 3: Project Progress Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Team Project Progress</h3>
              <p className="text-[11px] text-slate-500">Distribution of direct reports' active and completed projects</p>
            </div>
          </div>
          <ProjectProgressChart
            labels={charts.project_progress?.labels || ['In Progress', 'Completed', 'Other']}
            dataValues={charts.project_progress?.data || []}
          />
        </div>

        {/* Chart 4: Team Readiness Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Leadership Readiness Distribution</h3>
              <p className="text-[11px] text-slate-500">AI and assessment readiness classification for team candidates</p>
            </div>
          </div>
          <ReadinessPieChart
            highCount={kpis.high_readiness ?? (teamMembers.filter(m => m.readiness_level === 'High').length)}
            mediumCount={kpis.medium_readiness ?? (teamMembers.filter(m => m.readiness_level === 'Medium').length)}
            lowCount={kpis.low_readiness ?? (teamMembers.filter(m => m.readiness_level === 'Low').length)}
          />
        </div>
      </div>

      {/* DASHBOARD TAB NAVIGATION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow p-2 flex flex-wrap gap-1.5 text-xs font-bold">
        {[
          { id: 'team', label: 'My Team', icon: Users, count: teamMembers.length },
          { id: 'screening', label: 'Initial Screening (Stage 1)', icon: ClipboardCheck, count: teamMembers.length },
          { id: 'ai-intelligence', label: 'AI Succession & Risks', icon: Sparkles },
          { id: 'hierarchy', label: 'Team Hierarchy', icon: UserCheck },
          { id: 'tasks', label: 'Tasks & Projects', icon: CheckSquare, count: tasks.length },
          { id: 'goals', label: 'Team Goals', icon: Target, count: goals.length },
          { id: 'issues', label: 'Issues & Blockers', icon: ShieldAlert, count: issues.filter(i => i.status !== 'Resolved').length },
          { id: 'feedback', label: 'Feedback & 1-on-1s', icon: MessageSquare, count: feedbacks.length },
          { id: 'recommendations', label: 'HR Recommendations', icon: Award, count: recommendations.length },
          { id: 'assessments', label: 'Assessment Results', icon: BarChart2, count: teamResults.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count != null && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB: AI SUCCESSION, TEAM INTELLIGENCE & RISKS */}
      {/* ========================================================================= */}
      {activeTab === 'ai-intelligence' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Module 2: AI Top 3 Eligible Successors for Manager's Team */}
          <AITop3SuccessorsSection isManager={true} onNavigateProfile={(empId) => navigate(`/employees/${empId}`)} />

          {/* Modules 6 & 7: Manager Team Performance & Risk Intelligence */}
          <AIManagerTeamIntelligenceSection />

          {/* Module 3: Team Competency Gap Intelligence */}
          <AICompetencyIntelligenceSection managerId={overview?.manager?.id} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MY TEAM MEMBERS (SECTION 2 & 4) */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Authorized Team Members</h3>
              <p className="text-[11px] text-slate-500">
                Direct reports assigned to your scope. Update responsibilities, work availability status, and view verified outcomes.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
                {teamMembers.length} Direct Reports
              </span>
            </div>
          </div>

          {teamMembers.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
              <p className="text-xs font-semibold text-slate-700">No direct reports assigned</p>
              <p className="text-[11px] font-normal text-slate-500 mt-1">Direct reports assigned to you in the HR directory will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-4 py-3">Department &amp; Role</th>
                    <th className="px-4 py-3">Work Status</th>
                    <th className="px-4 py-3">Responsibilities</th>
                    <th className="px-4 py-3 text-center">Tasks</th>
                    <th className="px-4 py-3 text-center">Projects</th>
                    <th className="px-4 py-3 text-center">Performance Rating</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {teamMembers.map((emp) => (
                    <React.Fragment key={emp.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">{emp.employee_code} • {emp.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 text-xs">{emp.designation}</p>
                        <p className="text-[10px] text-slate-500">{emp.department} • {emp.experience_years ? `${emp.experience_years}y exp` : 'N/A'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center space-x-1 ${
                          emp.availability_status === 'Available'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.availability_status === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>{emp.availability_status || 'Available'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="text-[11px] text-slate-700 truncate" title={emp.responsibilities || 'No responsibilities specified'}>
                          {emp.responsibilities || <span className="text-slate-400 italic">None logged</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-slate-800 text-xs">
                          {emp.task_counts?.active ?? 0} active
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {emp.task_counts?.completed ?? 0} completed
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-slate-800 text-xs">
                          {emp.project_counts?.in_progress ?? 0} in progress
                        </span>
                        <span className="block text-[10px] text-emerald-600 font-semibold">
                          {emp.project_counts?.verified ?? 0} verified
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {emp.performance_score != null ? (
                          <div>
                            <span className="font-black text-indigo-700 text-sm block">
                              {emp.performance_score}/100
                            </span>
                            <span className="text-[9px] text-slate-400">Verified</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Evaluating</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setExpandedRowId(expandedRowId === emp.id ? null : emp.id)}
                            className={`px-2.5 py-1.5 font-bold rounded-lg text-xs transition-colors inline-flex items-center space-x-1 ${
                              expandedRowId === emp.id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="View full competency, project, assessment, and experience breakdown"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{expandedRowId === emp.id ? 'Close' : 'Details'}</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditProfile(emp)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors inline-flex items-center space-x-1"
                            title="Edit responsibilities and work status"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>Edit Scope</span>
                          </button>
                          <button
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors inline-flex items-center space-x-1"
                          >
                            <span>Gaps</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRowId === emp.id && (
                      <tr className="bg-slate-50/80 border-b border-indigo-100">
                        <td colSpan={8} className="p-4 sm:p-5">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm text-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div>
                                <h4 className="font-black text-slate-900 text-sm">{emp.name} — Comprehensive Authorized Profile</h4>
                                <p className="text-[11px] text-slate-500">
                                  {emp.employee_code} • {emp.designation} • {emp.department} • Assigned Manager: <strong className="text-slate-800">{user?.name || 'You'}</strong>
                                </p>
                              </div>
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                Tenure: {emp.company_tenure_months ? `${emp.company_tenure_months} months` : 'N/A'} • Total Exp: {emp.experience_years ? `${emp.experience_years} years` : 'N/A'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {/* Verified Skills & Proficiency */}
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Skills &amp; Verified Proficiency ({emp.skills?.length || 0})
                                </span>
                                {(emp.skills || []).length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">No skills logged yet.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {emp.skills.map((s, sIdx) => (
                                      <span key={sIdx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-800 flex items-center space-x-1">
                                        <span>{s.skill_name}</span>
                                        <span className="text-indigo-600 font-extrabold">L{s.proficiency_level || 3}</span>
                                        {s.verified && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 inline ml-0.5" />}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Competency Scores & Gaps */}
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Competency Scores &amp; Gaps ({emp.competencies?.length || 0})
                                </span>
                                {(emp.competencies || []).length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">No competency evaluations available.</p>
                                ) : (
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {emp.competencies.slice(0, 5).map((c, cIdx) => (
                                      <div key={cIdx} className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-slate-700">{c.competency_name}</span>
                                        <div className="flex items-center space-x-1">
                                          <span className="font-extrabold text-slate-900">{c.score}%</span>
                                          {c.identified_gap > 0 ? (
                                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1 rounded">-{c.identified_gap}</span>
                                          ) : (
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1 rounded">Met</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Verified Project Outcomes */}
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Verified Projects &amp; Outcomes ({emp.projects?.length || 0})
                                </span>
                                {(emp.projects || []).length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">No project history logged.</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {emp.projects.slice(0, 3).map((p, pIdx) => (
                                      <div key={pIdx} className="p-1.5 bg-white rounded border border-slate-200 text-[10px]">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-slate-900">{p.title}</span>
                                          <span className={`px-1 rounded text-[9px] font-extrabold ${p.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {p.verified ? 'Verified' : 'Logged'}
                                          </span>
                                        </div>
                                        {p.outcome && <p className="text-slate-500 text-[9px] mt-0.5">{p.outcome}</p>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Assessment Assignments & Real Status */}
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Assessments &amp; Real Status ({emp.assessments?.length || 0})
                                </span>
                                {(emp.assessments || []).length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">No assessments assigned yet.</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {emp.assessments.slice(0, 3).map((a, aIdx) => (
                                      <div key={aIdx} className="p-1.5 bg-white rounded border border-slate-200 text-[10px] flex items-center justify-between">
                                        <div>
                                          <p className="font-bold text-slate-900">{a.title}</p>
                                          {a.scheduled_date && <p className="text-[9px] text-slate-400">{a.scheduled_date} {a.start_time || ''}</p>}
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                          a.real_status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                          a.real_status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                          a.real_status === 'Submitted' ? 'bg-indigo-100 text-indigo-800' :
                                          a.real_status === 'Expired' ? 'bg-rose-100 text-rose-800' :
                                          'bg-purple-100 text-purple-800'
                                        }`}>
                                          {a.real_status || a.status || 'Scheduled'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Performance Reviews & Development Plans */}
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 md:col-span-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Performance Reviews &amp; Development Plans
                                </span>
                                {(emp.reviews || []).length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">No historical performance reviews available.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {emp.reviews.slice(0, 2).map((r, rIdx) => (
                                      <div key={rIdx} className="p-2 bg-white rounded border border-slate-200 text-[10px] space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-slate-800">{r.review_period} Review</span>
                                          <span className="font-black text-indigo-700">Rating: {r.overall_rating}/5</span>
                                        </div>
                                        {r.strengths && <p className="text-slate-600"><strong className="text-slate-700">Strengths:</strong> {r.strengths}</p>}
                                        {r.development_goals && <p className="text-slate-600"><strong className="text-slate-700">Development:</strong> {r.development_goals}</p>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: INITIAL SCREENING (STAGE 1) */}
      {/* ========================================================================= */}
      {activeTab === 'screening' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-black text-slate-900">Stage 1: Direct Reports Initial Screening</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Evaluate your direct reports on foundational competencies before recommending or qualifying them for HR role-specific assessments. Passing threshold is 70.0%.
                </p>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-2">
                {/* Search */}
                <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={screeningSearch}
                    onChange={(e) => setScreeningSearch(e.target.value)}
                    placeholder="Search direct reports..."
                    className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none w-36 sm:w-48"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={screeningStatusFilter}
                  onChange={(e) => setScreeningStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Awaiting Assessment">Awaiting Screening</option>
                  <option value="Assigned">Assigned / Scheduled</option>
                  <option value="Passed">Passed (≥70%)</option>
                  <option value="Failed">Failed (&lt;70%)</option>
                  <option value="Eligible">Eligible for HR</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedScreeningIds([]);
                    setIsAssignScreeningModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Assign Initial Screening</span>
                </button>
              </div>
            </div>

            {/* 7 Foundation Competency Chips */}
            <div className="mt-5 pt-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2.5 uppercase tracking-wider">
                Stage 1 Evaluated Core Competencies (Passing Benchmark: 70%)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {[
                  { name: 'Communication', desc: 'Clarity, listening & presentation' },
                  { name: 'Problem Solving', desc: 'Root cause analysis & solutions' },
                  { name: 'Teamwork', desc: 'Cross-functional collaboration' },
                  { name: 'Technical Knowledge', desc: 'Domain fluency & best practices' },
                  { name: 'Decision Making', desc: 'Risk-aware timely judgment' },
                  { name: 'Adaptability', desc: 'Agility during change' },
                  { name: 'Basic Leadership', desc: 'Initiative, ownership & coaching' }
                ].map((c) => (
                  <div key={c.name} className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 text-center">
                    <span className="block text-xs font-black text-slate-800">{c.name}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 line-clamp-1">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Direct Reports Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Direct Reports Initial Screening Records</h4>
                <p className="text-xs text-slate-500">Showing {filteredScreeningMembers.length} team members</p>
              </div>
            </div>

            {filteredScreeningMembers.length === 0 ? (
              <div className="text-center py-12 px-4">
                <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">No matching team members found</p>
                <p className="text-xs text-slate-400 mt-1">Adjust search filter or assign new initial screening assessments.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Role &amp; Dept</th>
                      <th className="py-3.5 px-4">Screening Status</th>
                      <th className="py-3.5 px-4">Score &amp; Date</th>
                      <th className="py-3.5 px-4">HR Succession Eligibility</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredScreeningMembers.map((emp) => {
                      const isPassed = emp.initial_screening_status === 'Passed';
                      const isFailed = emp.initial_screening_status === 'Failed';
                      const isAssigned = emp.initial_screening_status === 'Assigned';
                      const isAwaiting = !isPassed && !isFailed && !isAssigned;

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                                {emp.name ? emp.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'EM'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{emp.name}</p>
                                <p className="text-[11px] text-slate-400">{emp.employee_code} • {emp.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-800 block">{emp.designation || 'Staff'}</span>
                            <span className="text-[11px] text-slate-500 block">{emp.department || 'Operations'}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            {isPassed && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                Passed (≥70%)
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                                Failed (&lt;70%)
                              </span>
                            )}
                            {isAssigned && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                <Clock className="w-3 h-3 mr-1 text-blue-600" />
                                Assigned / Scheduled
                              </span>
                            )}
                            {isAwaiting && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
                                Awaiting Screening
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {emp.initial_screening_score != null ? (
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className={`text-sm font-black ${isPassed ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {emp.initial_screening_score}%
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    (Min: 70%)
                                  </span>
                                </div>
                                {emp.initial_screening_date && (
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
                                    Completed: {emp.initial_screening_date}
                                  </span>
                                )}
                              </div>
                            ) : emp.initial_screening_date ? (
                              <span className="text-xs text-slate-500 font-medium">
                                Scheduled: {emp.initial_screening_date}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Not taken</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {emp.eligible_for_hr ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm">
                                <Check className="w-3 h-3 mr-1 text-emerald-600 stroke-[3]" />
                                Eligible for HR Stage 2
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                Pending Stage 1 Screening
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isAwaiting || isFailed ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedScreeningIds([emp.id]);
                                  setIsAssignScreeningModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition border border-indigo-200 flex items-center space-x-1 ml-auto cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>{isFailed ? 'Reassign Screening' : 'Assign Screening'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(`/employees/${emp.id}`)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center space-x-1 ml-auto cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Profile</span>
                              </button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: TEAM HIERARCHY (SECTION 2) */}
      {/* ========================================================================= */}
      {activeTab === 'hierarchy' && (
        <CompanyHierarchySection isHR={false} />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DYNAMIC TASK AND PROJECT MANAGEMENT (SECTION 3) */}
      {/* ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">Team Task &amp; Project Assignments</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full database-backed task CRUD with real-time status transitions and server-side overdue calculations.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter tasks..."
                  className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none w-36"
                />
              </div>

              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>

              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <button
                onClick={handleOpenCreateTask}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Task</span>
              </button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
              <p className="text-xs font-semibold text-slate-700">No tasks found matching criteria</p>
              <p className="text-[11px] text-slate-500 mt-1">Create tasks for your direct reports to track completion rates.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="px-4 py-3">Task Details</th>
                    <th className="px-4 py-3">Assigned Direct Report</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 max-w-sm">
                        <p className="font-bold text-slate-900 text-xs">{t.title}</p>
                        {t.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                        )}
                        {t.project_name && (
                          <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5">
                            <Briefcase className="w-2.5 h-2.5" />
                            <span>{t.project_name}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-800 text-xs">{t.employee_name}</p>
                        <p className="text-[10px] text-slate-400">{t.employee_code} • {t.employee_designation}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          t.priority === 'Urgent' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          t.priority === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          t.priority === 'Medium' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1 text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-semibold">{t.due_date || 'No deadline'}</span>
                        </div>
                        {t.is_overdue && (
                          <span className="text-[9px] font-bold text-rose-600 flex items-center space-x-0.5 mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Overdue</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={t.status}
                          onChange={(e) => handleQuickStatusChange(t, e.target.value)}
                          className={`text-[11px] font-bold rounded-lg px-2 py-1 border focus:outline-none transition-colors ${
                            t.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            t.status === 'In Progress' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                            t.status === 'Overdue' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                            'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Overdue">Overdue</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditTask(t)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit task details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DYNAMIC TEAM GOALS (SECTION 5) */}
      {/* ========================================================================= */}
      {activeTab === 'goals' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">Measurable Team Goals &amp; Deadlines</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Track team objectives with verifiable metric progress, completion calculations, and at-risk alerts.
              </p>
            </div>

            <button
              onClick={() => setGoalModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1 shadow-sm self-start md:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Team Goal</span>
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
              <p className="text-xs font-semibold text-slate-700">No team goals created</p>
              <p className="text-[11px] text-slate-500 mt-1">Create measurable targets to track quarterly milestones.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((g) => (
                <div key={g.id} className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-slate-50/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">{g.title}</h4>
                      {g.description && <p className="text-[11px] text-slate-500 mt-0.5">{g.description}</p>}
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      g.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                      g.status === 'At Risk' ? 'bg-rose-100 text-rose-800' :
                      g.status === 'Overdue' ? 'bg-rose-200 text-rose-900' :
                      'bg-indigo-100 text-indigo-800'
                    }`}>
                      {g.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>Progress ({g.current_metric} / {g.target_metric} {g.metric_unit})</span>
                      <span className="text-indigo-600 font-extrabold">{g.progress_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          g.progress_pct >= 100 ? 'bg-emerald-500' :
                          g.progress_pct >= 60 ? 'bg-indigo-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, g.progress_pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Target: {g.target_date || 'Ongoing'}</span>
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          const val = prompt(`Enter new progress metric (${g.metric_unit}):`, String(g.current_metric));
                          if (val !== null && !isNaN(val)) {
                            handleUpdateGoalMetric(g, val);
                          }
                        }}
                        className="px-2 py-0.5 text-indigo-600 hover:bg-indigo-50 font-bold rounded"
                      >
                        Update Progress
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(g.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DYNAMIC ISSUES & BLOCKERS (SECTION 6) */}
      {/* ========================================================================= */}
      {activeTab === 'issues' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="text-base font-extrabold text-slate-900">Team Issues, Blockers &amp; Project Risks</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Log and monitor technical hurdles, track responsible employees, and record verified resolution notes.
              </p>
            </div>

            <button
              onClick={() => setIssueModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1 shadow-sm self-start md:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Issue / Risk</span>
            </button>
          </div>

          {issues.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
              <p className="text-xs font-semibold text-slate-700">Zero open blockers or issues logged</p>
              <p className="text-[11px] text-slate-500 mt-1">Log technical or operational blockers to collaborate on resolutions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Issue Title &amp; Description</th>
                    <th className="px-4 py-3">Responsible Scope</th>
                    <th className="px-4 py-3">Resolution Status</th>
                    <th className="px-4 py-3">Resolution Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {issues.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          i.severity === 'Critical' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          i.severity === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          i.severity === 'Medium' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {i.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-sm">
                        <p className="font-bold text-slate-900 text-xs">{i.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{i.description}</p>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800 text-xs">
                        {i.employee_name || 'All Team'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          i.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                          i.status === 'Investigating' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {i.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs text-[11px] text-slate-600 truncate">
                        {i.resolution_notes || <span className="text-slate-400 italic">Unresolved</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {i.status !== 'Resolved' && (
                            <button
                              onClick={() => handleOpenResolveIssue(i)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteIssue(i.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete issue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DYNAMIC FEEDBACK AND DEVELOPMENT (SECTION 7) */}
      {/* ========================================================================= */}
      {activeTab === 'feedback' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                <h3 className="text-base font-extrabold text-slate-900">Direct Report Development &amp; Feedback Records</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Record 1-on-1 development recommendations, track follow-up progress, and address competency gap hints.
              </p>
            </div>

            <button
              onClick={() => {
                setFeedbackForm({
                  employee_id: teamMembers.length > 0 ? teamMembers[0].id : '',
                  feedback_date: new Date().toISOString().slice(0, 10),
                  strengths: '', improvement_areas: '', development_plan: '',
                  follow_up_status: 'Scheduled', is_private: true
                });
                setFeedbackModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1 shadow-sm self-start md:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Feedback</span>
            </button>
          </div>

          {feedbacks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40 text-purple-500" />
              <p className="text-xs font-semibold text-slate-700">No feedback sessions recorded yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Record feedback to guide direct reports on competencies and leadership readiness.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedbacks.map((f) => (
                <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">{f.employee_name}</h4>
                      <p className="text-[10px] text-slate-400">{f.employee_code} • {f.feedback_date}</p>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      f.follow_up_status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                      f.follow_up_status === 'In Progress' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {f.follow_up_status}
                    </span>
                  </div>

                  {f.strengths && (
                    <div className="text-[11px]">
                      <span className="font-bold text-emerald-700 block">Demonstrated Strengths:</span>
                      <p className="text-slate-700 mt-0.5">{f.strengths}</p>
                    </div>
                  )}

                  {f.improvement_areas && (
                    <div className="text-[11px]">
                      <span className="font-bold text-amber-700 block">Areas for Growth:</span>
                      <p className="text-slate-700 mt-0.5">{f.improvement_areas}</p>
                    </div>
                  )}

                  {f.development_plan && (
                    <div className="text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/70">
                      <span className="font-bold text-indigo-700 block">Mentoring &amp; Development Plan:</span>
                      <p className="text-slate-700 mt-0.5">{f.development_plan}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DYNAMIC LEADERSHIP RECOMMENDATIONS (SECTION 8) */}
      {/* ========================================================================= */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <AITop3SuccessorsSection isManager={true} onNavigateProfile={(empId) => navigate(`/employees/${empId}`)} />

          <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">Leadership Succession Recommendations to HR</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Recommend direct reports for future leadership roles backed by real 5-factor suitability evaluations.
              </p>
            </div>

            <button
              onClick={() => {
                setRecForm({
                  employee_id: teamMembers.length > 0 ? teamMembers[0].id : '',
                  role_id: roles.length > 0 ? roles[0].id : '',
                  strengths_summary: '', development_needs: '', recommendation_notes: ''
                });
                setRecModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1 shadow-sm self-start md:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Submit Recommendation</span>
            </button>
          </div>

          {recommendations.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Award className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
              <p className="text-xs font-semibold text-slate-700">No succession recommendations submitted yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Submit high-potential team members to HR with verified project and assessment evidence.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Target Leadership Role</th>
                    <th className="px-4 py-3 text-center">5-Factor Fit</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3">Notes to HR</th>
                    <th className="px-4 py-3">HR Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {recommendations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 text-xs">{rec.employee_name}</p>
                        <p className="text-[10px] text-slate-500">{rec.employee_code}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-extrabold text-indigo-700 text-xs">{rec.role_name}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {rec.suitability_score != null ? (
                          <span className="font-black text-purple-700 text-sm">
                            {rec.suitability_score}%
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={rec.readiness_level || 'Medium'} type="readiness" />
                      </td>
                      <td className="px-4 py-3.5 max-w-xs text-[11px] text-slate-600">
                        <p className="line-clamp-2">{rec.recommendation_notes || rec.strengths_summary || 'No notes'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          rec.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          rec.status === 'Declined' ? 'bg-rose-100 text-rose-800' :
                          rec.status === 'Under Review' ? 'bg-amber-100 text-amber-800' :
                          'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {rec.status}
                        </span>
                        {rec.hr_feedback && (
                          <p className="text-[10px] text-slate-500 mt-1 italic">HR: {rec.hr_feedback}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: TEAM ASSESSMENT RESULTS & INTRA-TEAM RANKINGS */}
      {/* ========================================================================= */}
      {activeTab === 'assessments' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden space-y-4 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">Authorized Team Member Assessment Results</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Results and AI ML readiness analysis for direct reports under your management scope.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team member..."
                  className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none w-36"
                />
              </div>
            </div>
          </div>

          {rankedTeamResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
              <p className="text-xs font-semibold text-slate-700">No team assessment results found.</p>
              <p className="text-[11px] font-normal text-slate-500 mt-1">Assignments completed by your direct reports will automatically appear here with verified rankings and evidence.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="px-4 py-3">Team Rank</th>
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Target Leadership Role</th>
                    <th className="px-4 py-3 text-center">Assessment Score</th>
                    <th className="px-4 py-3 text-center">Role Suitability</th>
                    <th className="px-4 py-3">Eligibility</th>
                    <th className="px-4 py-3">Verified Projects</th>
                    <th className="px-4 py-3">Skills &amp; Tenure</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {rankedTeamResults.map((res) => {
                    const formattedDate = res.submission_date
                      ? new Date(res.submission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Completed';
                    const mlClass = res.ml_prediction?.predicted_class || res.ml_prediction?.data?.predicted_class || res.readiness_level;
                    const isExpanded = expandedRowId === (res.id || res.assignment_id);
                    const isEligible = res.pre_assessment_eligibility?.is_eligible;

                    return (
                      <React.Fragment key={res.id || res.assignment_id}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center space-x-1">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                res.intra_team_rank === 1
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : res.intra_team_rank === 2
                                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                #{res.intra_team_rank}
                              </span>
                              {res.is_tied && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  Tied
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{res.employee_name}</p>
                              <p className="text-[10px] text-slate-500">{res.employee_code} • {res.designation || 'Engineer'}</p>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="font-bold text-indigo-700 text-xs">{res.role_name}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-xs">{res.assessment_title}</p>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="font-black text-indigo-900 text-sm block">
                              {res.overall_score}%
                            </span>
                            <span className="text-[9px] text-slate-400 block">{formattedDate}</span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            {res.suitability?.suitability_score != null ? (
                              <div>
                                <span className="font-black text-purple-700 text-sm block">
                                  {res.suitability.suitability_score}%
                                </span>
                                <span className="text-[9px] text-purple-500 font-semibold block">5-Factor Fit</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Evaluating</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center space-x-1 ${
                              isEligible
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {isEligible ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 inline mr-0.5" />
                                  <span>Eligible</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3 h-3 text-amber-600 inline mr-0.5" />
                                  <span>Prerequisites Pending</span>
                                </>
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div>
                              <span className="font-bold text-slate-800 text-xs block">
                                {res.project_summary?.verified_projects_count ?? 0} verified
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold block">
                                {res.project_summary?.average_verified_success_rate ?? 'N/A'}% success
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div>
                              <span className="font-semibold text-slate-800 text-[11px] block">
                                {res.skill_details?.matched_count ?? 0} skills matched
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {res.experience_summary?.total_years ?? 0}y exp • {res.experience_summary?.tenure_months ?? 0}m tenure
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <StatusBadge status={res.readiness_level || 'High'} type="readiness" />
                              {mlClass && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 block text-center">
                                  ML: {mlClass}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => setExpandedRowId(isExpanded ? null : (res.id || res.assignment_id))}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Toggle evidence breakdown"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setSelectedResult(res)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors inline-flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Evidence Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b border-indigo-100 animate-in fade-in">
                            <td colSpan={10} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Verified Project History
                                  </span>
                                  <p className="text-xs text-slate-700">
                                    <strong>{res.project_summary?.verified_projects_count ?? 0}</strong> verified projects on file.
                                  </p>
                                  <p className="text-xs text-emerald-700 font-semibold">
                                    Average Verified Outcome: {res.project_summary?.average_verified_success_rate ?? 'N/A'}%
                                  </p>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Technical Skills &amp; Missing Requirements
                                  </span>
                                  <p className="text-xs text-slate-700">
                                    Matched Skills: <strong>{res.skill_details?.matched_count ?? 0}</strong>
                                  </p>
                                  {res.skill_details?.missing_skills?.length > 0 ? (
                                    <p className="text-xs text-rose-600 font-medium">
                                      Missing: {res.skill_details.missing_skills.join(', ')}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-emerald-600 font-semibold">
                                      ✓ All mandatory role skills present
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Development &amp; Mentoring Plan
                                  </span>
                                  {res.development_recommendations?.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700">
                                      {res.development_recommendations.slice(0, 2).map((rec, rIdx) => (
                                        <li key={rIdx}>{rec}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-slate-500 italic">Candidate is performing well on all evaluated competencies.</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT TASK */}
      {/* ========================================================================= */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingTask ? 'Edit Task' : 'Create & Assign Task'}
              </h3>
              <button onClick={() => setTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g., Containerize Event Broker Service"
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Direct Report *</label>
                <select
                  required
                  value={taskForm.employee_id}
                  onChange={(e) => setTaskForm({ ...taskForm, employee_id: e.target.value })}
                  className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">Select Team Member</option>
                  {teamMembers.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_code} - {emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={taskForm.start_date}
                    onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
                    className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description &amp; Deliverables</label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Outline key deliverables, verification criteria, and linked milestones..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{editingTask ? 'Save Changes' : 'Assign Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE TEAM GOAL */}
      {/* ========================================================================= */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Create Team Goal</h3>
              <button onClick={() => setGoalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Goal Title *</label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  placeholder="e.g., Deliver Cloud Platform Microservices Milestone"
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Value *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={goalForm.target_metric}
                    onChange={(e) => setGoalForm({ ...goalForm, target_metric: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Initial Metric</label>
                  <input
                    type="number"
                    step="0.1"
                    value={goalForm.current_metric}
                    onChange={(e) => setGoalForm({ ...goalForm, current_metric: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={goalForm.metric_unit}
                    onChange={(e) => setGoalForm({ ...goalForm, metric_unit: e.target.value })}
                    placeholder="%, tasks, pts"
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Date</label>
                  <input
                    type="date"
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                    className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Initial Status</label>
                  <select
                    value={goalForm.status}
                    onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value })}
                    className="w-full border rounded-xl p-2 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="On Track">On Track</option>
                    <option value="At Risk">At Risk</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description &amp; Measurement Criteria</label>
                <textarea
                  rows={2}
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  placeholder="Specify how this goal will be verified..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Create Goal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LOG ISSUE / BLOCKER */}
      {/* ========================================================================= */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Log Team Issue or Blocker</h3>
              <button onClick={() => setIssueModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIssue} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Issue / Risk Title *</label>
                <input
                  type="text"
                  required
                  value={issueForm.title}
                  onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                  placeholder="e.g., Third-party API Rate Limiting"
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Severity</label>
                  <select
                    value={issueForm.severity}
                    onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value="Critical">Critical (P1)</option>
                    <option value="High">High (P2)</option>
                    <option value="Medium">Medium (P3)</option>
                    <option value="Low">Low (P4)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Responsible Direct Report</label>
                  <select
                    value={issueForm.employee_id}
                    onChange={(e) => setIssueForm({ ...issueForm, employee_id: e.target.value })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value="">Team Wide / Unassigned</option>
                    {teamMembers.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Impact &amp; Description</label>
                <textarea
                  rows={3}
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Describe impact on sprint commitments, root cause, and immediate actions needed..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Log Blocker</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE ISSUE MODAL */}
      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 card-shadow space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">Resolve Issue</h3>
            <p className="text-xs text-slate-600">
              Provide resolution notes to confirm that <strong>{resolvingIssue.title}</strong> is unblocked.
            </p>
            <textarea
              rows={3}
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="e.g., Upgraded service quota and optimized request throttling..."
              className="w-full border rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setResolvingIssue(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolveIssue}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RECORD 1-ON-1 FEEDBACK */}
      {/* ========================================================================= */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Record Development Feedback</h3>
              <button onClick={() => setFeedbackModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFeedback} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Direct Report *</label>
                  <select
                    required
                    value={feedbackForm.employee_id}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, employee_id: e.target.value })}
                    className="w-full border rounded-xl p-2 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Select Employee</option>
                    {teamMembers.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Feedback Date</label>
                  <input
                    type="date"
                    value={feedbackForm.feedback_date}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback_date: e.target.value })}
                    className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Demonstrated Strengths</label>
                <textarea
                  rows={2}
                  value={feedbackForm.strengths}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                  placeholder="Key accomplishments and leadership competencies demonstrated..."
                  className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Areas for Development</label>
                <textarea
                  rows={2}
                  value={feedbackForm.improvement_areas}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, improvement_areas: e.target.value })}
                  placeholder="Specific technical or strategic competencies needing development..."
                  className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Agreed Mentoring &amp; Action Plan</label>
                <textarea
                  rows={2}
                  value={feedbackForm.development_plan}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, development_plan: e.target.value })}
                  placeholder="Assigned courses, pairing initiatives, or project leadership stretch roles..."
                  className="w-full border rounded-xl p-2 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Follow-Up Status</label>
                  <select
                    value={feedbackForm.follow_up_status}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, follow_up_status: e.target.value })}
                    className="w-full border rounded-xl p-2 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="is_private"
                    checked={feedbackForm.is_private}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, is_private: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="is_private" className="font-bold text-slate-700 text-xs">
                    Confidential / Manager-Only
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Feedback</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: SUBMIT LEADERSHIP RECOMMENDATION TO HR */}
      {/* ========================================================================= */}
      {recModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Submit Leadership Recommendation</h3>
              <button onClick={() => setRecModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecommendation} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Direct Report *</label>
                <select
                  required
                  value={recForm.employee_id}
                  onChange={(e) => setRecForm({ ...recForm, employee_id: e.target.value })}
                  className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">Select Team Member</option>
                  {teamMembers.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Leadership Role *</label>
                <select
                  required
                  value={recForm.role_id}
                  onChange={(e) => setRecForm({ ...recForm, role_id: e.target.value })}
                  className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">Select Leadership Role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Demonstrated Leadership Strengths</label>
                <textarea
                  rows={2}
                  value={recForm.strengths_summary}
                  onChange={(e) => setRecForm({ ...recForm, strengths_summary: e.target.value })}
                  placeholder="Key technical and decision-making strengths supporting this recommendation..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Development &amp; Growth Needs</label>
                <textarea
                  rows={2}
                  value={recForm.development_needs}
                  onChange={(e) => setRecForm({ ...recForm, development_needs: e.target.value })}
                  placeholder="Areas HR should support before full succession handover..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Recommendation Notes to HR</label>
                <textarea
                  rows={3}
                  value={recForm.recommendation_notes}
                  onChange={(e) => setRecForm({ ...recForm, recommendation_notes: e.target.value })}
                  placeholder="Your formal statement of recommendation to the succession committee..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRecModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Submit to HR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: EDIT DIRECT REPORT RESPONSIBILITIES & STATUS */}
      {/* ========================================================================= */}
      {profileModalOpen && selectedEmpForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 card-shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Update Responsibilities &amp; Status
                </h3>
                <p className="text-xs text-slate-500">{selectedEmpForEdit.name} ({selectedEmpForEdit.employee_code})</p>
              </div>
              <button onClick={() => setProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Work Availability Status</label>
                  <select
                    value={profileForm.availability_status}
                    onChange={(e) => setProfileForm({ ...profileForm, availability_status: e.target.value })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy (Heavy Load)</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Performance Rating (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={profileForm.performance_score}
                    onChange={(e) => setProfileForm({ ...profileForm, performance_score: e.target.value })}
                    className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Key Responsibilities &amp; Team Duties</label>
                <textarea
                  rows={4}
                  value={profileForm.responsibilities}
                  onChange={(e) => setProfileForm({ ...profileForm, responsibilities: e.target.value })}
                  placeholder="Outline core technical ownership, mentoring duties, sprint commitments..."
                  className="w-full border rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Responsibilities</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN STAGE 1 INITIAL SCREENING ASSESSMENT */}
      {/* ========================================================================= */}
      {isAssignScreeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Assign Stage 1 Initial Screening</h3>
                  <p className="text-xs text-slate-500">Assign standard foundation competency assessment to direct reports</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignScreeningModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignInitialScreening} className="space-y-4">
              {/* Info Banner */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 text-xs text-indigo-900 space-y-1">
                <p className="font-bold flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Standard 7-Competency Foundation Assessment</span>
                </p>
                <p className="text-indigo-700/90 text-[11px]">
                  Covers Communication, Problem Solving, Teamwork, Technical Knowledge, Decision Making, Adaptability, and Leadership Potential. 70.0% passing score qualifies candidate for HR Leadership Role evaluations.
                </p>
              </div>

              {/* Direct Reports Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Select Direct Reports ({selectedScreeningIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const awaitingIds = teamMembers
                        .filter(m => m.initial_screening_status !== 'Passed')
                        .map(m => m.id);
                      if (selectedScreeningIds.length === awaitingIds.length) {
                        setSelectedScreeningIds([]);
                      } else {
                        setSelectedScreeningIds(awaitingIds);
                      }
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    {selectedScreeningIds.length > 0 ? 'Clear Selection' : 'Select All Awaiting'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1 bg-slate-50/50">
                  {teamMembers.map((emp) => {
                    const isSelected = selectedScreeningIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScreeningIds(prev => [...prev, emp.id]);
                              } else {
                                setSelectedScreeningIds(prev => prev.filter(id => id !== emp.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{emp.name}</span>
                            <span className="text-[10px] text-slate-500 block">{emp.designation || 'Staff'} • {emp.department}</span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          emp.initial_screening_status === 'Passed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : emp.initial_screening_status === 'Failed'
                            ? 'bg-rose-100 text-rose-800'
                            : emp.initial_screening_status === 'Assigned'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {emp.initial_screening_status || 'Awaiting'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Schedule Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={screeningDate}
                    onChange={(e) => setScreeningDate(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={screeningTime}
                    onChange={(e) => setScreeningTime(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Duration (Mins)</label>
                  <select
                    value={screeningDuration}
                    onChange={(e) => setScreeningDuration(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                    <option value={90}>90 Minutes</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAssignScreeningModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningScreening || selectedScreeningIds.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                >
                  {assigningScreening ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  <span>Schedule Screening ({selectedScreeningIds.length})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Module 8: Floating AI Manager Chat Assistant */}
      <AIChatDrawer isManager={true} />
    </div>
  );
};

export default ManagerDashboard;
