import axios from 'axios';
import { supabase, KNOWN_SUPABASE_ANON_KEY } from '../utils/supabaseClient';

const PRODUCTION_API_URL = 'https://enterprise-succession-planning-dashboard.onrender.com/api';
const LOCAL_DEV_API_URL = 'http://localhost:5000/api';

const isBrowser = typeof window !== 'undefined';
const isLocalhostHost = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0'
);

const isDev = Boolean(import.meta.env.DEV || import.meta.env.MODE === 'development');

/**
 * Resolves the backend API base URL with full environment safety:
 * 1. On remote/deployed client hosts (e.g. *.vercel.app), NEVER use localhost.
 *    If VITE_API_URL is missing or incorrectly set to localhost, fallback to PRODUCTION_API_URL.
 * 2. If VITE_API_URL is explicitly set and valid, use it (sanitizing legacy domain names).
 * 3. In local development on a local machine, default to LOCAL_DEV_API_URL.
 * 4. In all production builds, default to PRODUCTION_API_URL.
 */
function resolveApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();

  // 1. If running in a browser on a deployed host (e.g. Vercel production):
  if (isBrowser && !isLocalhostHost) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return PRODUCTION_API_URL;
    }
  }

  // 2. If VITE_API_URL is explicitly provided:
  if (envUrl) {
    let clean = envUrl;
    if (clean.includes('enterprise-succession-dashboard.onrender.com')) {
      clean = clean.replace('enterprise-succession-dashboard.onrender.com', 'enterprise-succession-planning-dashboard.onrender.com');
    }
    return clean.endsWith('/api') ? clean : `${clean.replace(/\/+$/, '')}/api`;
  }

  // 3. Local dev fallback only when running on localhost:
  if (isDev && (!isBrowser || isLocalhostHost)) {
    return LOCAL_DEV_API_URL;
  }

  // 4. Default production fallback (never localhost):
  return PRODUCTION_API_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'development')) {
  console.log(`[API Service] Active Base URL: ${API_BASE_URL}`);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000, // 45 seconds to accommodate Render free-tier spin-up
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('succession_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    const status = error.response ? error.response.status : (error.request ? 'NO_RESPONSE' : 'REQUEST_SETUP_ERROR');
    const responseData = error.response?.data?.message || error.response?.data?.error || null;
    const errCode = error.code || 'UNKNOWN_CODE';
    const errMessage = error.message || 'Unknown network error';

    // Log diagnostic without exposing sensitive authorization or token headers
    console.error(`[API Error Diagnostic] Status: ${status} | Code: ${errCode} | Target: ${API_BASE_URL}${error.config?.url || ''}`);

    if (error.response) {
      if (error.response.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          localStorage.removeItem('succession_token');
          localStorage.removeItem('succession_user');
          window.location.href = '/login';
        }
      }
      const detailStr = responseData || error.response.statusText || errMessage;
      const customErr = new Error(`[HTTP ${error.response.status}] ${detailStr}`);
      customErr.response = error.response;
      return Promise.reject(customErr);
    }

    // Explicit timeout handling (especially helpful for Render free-tier cold starts)
    if (errCode === 'ECONNABORTED' || (errMessage && errMessage.toLowerCase().includes('timeout'))) {
      return Promise.reject(new Error(
        `API server request timed out after 45 seconds while communicating with ${API_BASE_URL}. The backend service may be waking up from a sleeping state (Render free tier). Please wait 30 seconds and refresh.`
      ));
    }

    if (error.code === 'ERR_NETWORK' || !error.response) {
      return Promise.reject(new Error(
        `Unable to communicate with API server at ${API_BASE_URL}. Please check your internet connection or verify that the backend service is healthy.`
      ));
    }

    return Promise.reject(new Error(errMessage));
  }
);

export const authService = {
  login: (credentials) => api.post('/login', credentials),
  loginSupabase: (accessToken, metadata = {}) => {
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || KNOWN_SUPABASE_ANON_KEY || '';
    return api.post('/supabase', { 
      access_token: accessToken,
      apikey: key,
      user_metadata: metadata
    }, {
      headers: {
        'apikey': key
      }
    });
  },
  onboardEmployee: (data) => {
    const key = data.apikey || import.meta.env.VITE_SUPABASE_ANON_KEY || KNOWN_SUPABASE_ANON_KEY || '';
    return api.post('/onboard-employee', {
      ...data,
      apikey: key
    }, {
      headers: {
        'apikey': key
      }
    });
  },
  getPendingRegistrations: () => api.get('/user-accounts/pending'),
  approveUserAccount: (id) => api.post(`/user-accounts/${id}/approve`),
  rejectUserAccount: (id) => api.post(`/user-accounts/${id}/reject`),
  getMe: () => api.get('/me'),
  getUserAccounts: () => api.get('/user-accounts'),
  createUserAccount: (data) => api.post('/user-accounts', data),
  updateUserAccount: (id, data) => api.put(`/user-accounts/${id}`, data),
  linkOAuthEmail: (id, oauthEmail) => api.post(`/user-accounts/${id}/link-oauth-email`, { oauth_email: oauthEmail }),
  unlinkOAuthEmail: (id) => api.post(`/user-accounts/${id}/unlink-oauth-email`),
  toggleUserStatus: (id) => api.post(`/user-accounts/${id}/toggle-status`),
  switchRole: (role) => api.post('/switch-role', { role }),
  logout: async () => {
    // 1. Sign out from Supabase session if active with timeout guard
    if (supabase?.auth) {
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 2000))
        ]);
      } catch (err) {
        console.warn('[Auth] Supabase signOut caught error:', err);
      }
    }

    // 2. Clear application auth token and user profile
    try {
      localStorage.removeItem('succession_token');
      localStorage.removeItem('succession_user');

      // Clear any Supabase cached tokens in localStorage (e.g. sb-*-auth-token)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[Auth] Storage clear error:', e);
    }

    // 3. Clear session storage
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (e) {}
  }
};

export const employeeService = {
  getAll: (params, config = {}) => api.get('/employees', { params, ...config }),
  getDirectory: (params) => api.get('/employees/directory', { params }),
  getById: (id, roleId = 1, config = {}) => api.get(`/employees/${id}`, { params: { role_id: roleId }, ...config }),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),

  // Module 1: Projects
  getProjects: (empId) => api.get(`/employees/${empId}/projects`),
  addProject: (empId, data) => api.post(`/employees/${empId}/projects`, data),
  updateProject: (empId, projId, data) => api.put(`/employees/${empId}/projects/${projId}`, data),
  deleteProject: (empId, projId) => api.delete(`/employees/${empId}/projects/${projId}`),
  verifyProject: (empId, projId, data) => api.post(`/employees/${empId}/projects/${projId}/verify`, data),

  // Module 2: Employment History & Company Tenure
  getEmploymentHistory: (empId) => api.get(`/employees/${empId}/employment-history`),
  addEmploymentHistory: (empId, data) => api.post(`/employees/${empId}/employment-history`, data),
  updateEmploymentHistory: (empId, histId, data) => api.put(`/employees/${empId}/employment-history/${histId}`, data),
  deleteEmploymentHistory: (empId, histId) => api.delete(`/employees/${empId}/employment-history/${histId}`),
  verifyEmploymentHistory: (empId, histId) => api.post(`/employees/${empId}/employment-history/${histId}/verify`),
  updateCompanyInfo: (empId, data) => api.put(`/employees/${empId}/company-info`, data),

  // Module 3: Technical Skills
  getSkills: (empId, roleId = 1) => api.get(`/employees/${empId}/skills`, { params: { role_id: roleId } }),
  addSkill: (empId, data) => api.post(`/employees/${empId}/skills`, data),
  updateSkill: (empId, skillId, data) => api.put(`/employees/${empId}/skills/${skillId}`, data),
  deleteSkill: (empId, skillId) => api.delete(`/employees/${empId}/skills/${skillId}`),
  verifySkill: (empId, skillId, data) => api.post(`/employees/${empId}/skills/${skillId}/verify`, data),

  // Summary APIs
  getProjectsSummary: (empId) => api.get(`/employees/${empId}/projects-summary`),
  getExperienceSummary: (empId) => api.get(`/employees/${empId}/experience-summary`),
  getRoleSkillsSummary: (empId, roleId = 1) => api.get(`/employees/${empId}/roles/${roleId}/skills-summary`),
  getRoleAssessmentSummary: (empId, roleId = 1) => api.get(`/employees/${empId}/roles/${roleId}/assessment-summary`),
};

export const roleService = {
  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  getCompetencies: (roleId) => api.get(`/roles/${roleId}/competencies`),
  saveCompetencies: (roleId, competencies) => api.post(`/roles/${roleId}/competencies`, { competencies }),

  // Module 3: Role Required Skills
  getRequiredSkills: (roleId) => api.get(`/roles/${roleId}/required-skills`),
  addRequiredSkill: (roleId, data) => api.post(`/roles/${roleId}/required-skills`, data),
  deleteRequiredSkill: (roleId, skillId) => api.delete(`/roles/${roleId}/required-skills/${skillId}`),

  // Module 4: HR Candidate Comparison & Summaries
  getCandidatesComparison: (roleId, params) => api.get(`/roles/${roleId}/candidates-comparison`, { params }),
  getCandidateDossier: (roleId, empId) => api.get(`/roles/${roleId}/candidates/${empId}/dossier`),
  getAssessmentScores: (roleId) => api.get(`/roles/${roleId}/assessment-scores`),
  getProjectsSummary: (roleId) => api.get(`/roles/${roleId}/projects-summary`),
  getSkillsSummary: (roleId) => api.get(`/roles/${roleId}/skills-summary`),
  getExperienceSummary: (roleId) => api.get(`/roles/${roleId}/experience-summary`),

  // Pre-Assessment Eligibility Filtering & Config
  getEligibilityConfig: (roleId) => api.get(`/roles/${roleId}/eligibility-config`),
  updateEligibilityConfig: (roleId, data) => api.put(`/roles/${roleId}/eligibility-config`, data),
  getPreAssessmentCandidates: (roleId) => api.get(`/roles/${roleId}/pre-assessment-candidates`),
};

export const suitabilityService = {
  getConfig: () => api.get('/suitability-config'),
  updateConfig: (data) => api.put('/suitability-config', data),
};

export const competencyService = {
  getAll: () => api.get('/competencies'),
  getById: (id) => api.get(`/competencies/${id}`),
  create: (data) => api.post('/competencies', data),
  update: (id, data) => api.put(`/competencies/${id}`, data),
  delete: (id) => api.delete(`/competencies/${id}`),
};

export const assessmentService = {
  getAll: () => api.get('/assessments'),
  create: (data) => api.post('/assessments', data),
  assign: (assessmentId, assignData) => api.post(`/assessments/${assessmentId}/assign`, assignData),
  getMyAssessments: (employeeId) => api.get('/me/assessments', { params: { employee_id: employeeId } }),
  getMyResults: () => api.get('/me/results'),
  getAssignmentDetail: (assignmentId) => api.get(`/assessment-assignments/${assignmentId}`),
  submitAssessment: (assignmentId, answers) => api.post(`/assessment-assignments/${assignmentId}/submit`, { answers }),
  getResult: (assignmentId) => api.get(`/assessment-results/${assignmentId}`),
  getCompletedResults: (params) => api.get('/assessment-results', { params }),

  // Module 5: HR Manual Scheduling & Timing Window Enforcement
  checkConflicts: (schedulesOrPayload) => {
    if (Array.isArray(schedulesOrPayload)) {
      return api.post('/assessment-schedules/check-conflicts', { schedules: schedulesOrPayload });
    }
    const schedules = schedulesOrPayload?.schedules || schedulesOrPayload?.assignments || [];
    return api.post('/assessment-schedules/check-conflicts', {
      schedules,
      allow_simultaneous: schedulesOrPayload?.allow_simultaneous || false
    });
  },
  checkSchedulingConflicts: (payload) => {
    if (Array.isArray(payload)) {
      return api.post('/assessment-schedules/check-conflicts', { schedules: payload });
    }
    const schedules = payload?.schedules || payload?.assignments || [];
    return api.post('/assessment-schedules/check-conflicts', {
      schedules,
      allow_simultaneous: payload?.allow_simultaneous || false
    });
  },
  batchSaveSchedules: (param1, param2) => {
    if (typeof param1 === 'object' && param1 !== null && !Array.isArray(param1)) {
      return api.post('/assessment-schedules/batch-save', param1);
    }
    return api.post('/assessment-schedules/batch-save', { assessment_id: param1, schedules: param2 });
  },
  getSchedules: (params) => api.get('/assessment-schedules', { params }),
  reschedule: (assignmentId, data) => api.put(`/assessment-schedules/${assignmentId}/reschedule`, data),
  cancelSchedule: (assignmentId, reason) => api.post(`/assessment-schedules/${assignmentId}/cancel`, { reason }),
  startAttempt: (assignmentId) => api.post(`/assessment-assignments/${assignmentId}/start`),
  getWindowStatus: (assignmentId) => api.get(`/assessment-assignments/${assignmentId}/window-status`),
};

export const notificationService = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

export const gapService = {
  getGapAnalysis: (employeeId, roleId = 1) => api.get(`/gap-analysis/${employeeId}/${roleId}`),
  getReadiness: (employeeId, roleId = 1) => api.get(`/readiness/${employeeId}/${roleId}`),
  getMyGaps: (roleId = 1) => api.get('/me/gaps', { params: { role_id: roleId } }),
  getMyReadiness: (roleId = 1) => api.get('/me/readiness', { params: { role_id: roleId } }),
};

export const successorService = {
  getByRole: (roleId) => api.get(`/successors/${roleId}`),
};

export const dashboardService = {
  getSummary: (params) => api.get('/dashboard-summary', { params }),
};

export const analyticsService = {
  getAnalytics: () => api.get('/analytics'),
};

export const aiService = {
  getRecommendation: (employeeId, roleId = 1) => api.post('/ai/recommendation', { employee_id: employeeId, role_id: roleId }),
  getRoleReplacement: (employeeId, roleId = 1) => api.post('/ai/role-replacement', { employee_id: employeeId, role_id: roleId }),
  getTopSuccessors: (roleId = 1) => api.get(`/ai/top-successors?role_id=${roleId}`),
  getManagerTopSuccessors: (roleId = 1) => api.get(`/ai/manager/top-successors?role_id=${roleId}`),
  compareCandidates: (roleId, candidateIds) => api.post('/ai/compare-candidates', { role_id: roleId, candidate_ids: candidateIds }),
  shortlistCandidate: (employeeId, roleId, action = 'Shortlist', notes = '') => api.post('/ai/shortlist', { employee_id: employeeId, role_id: roleId, action, notes }),
  getShortlists: (roleId = null) => api.get(`/ai/shortlists${roleId ? `?role_id=${roleId}` : ''}`),
  getWorkforceSummary: () => api.get('/ai/workforce-summary'),
  getCompetencyIntelligence: (managerId = null, department = null) => api.get(`/ai/competency-intelligence${managerId ? `?manager_id=${managerId}` : ''}${department ? `&department=${department}` : ''}`),
  getTeamIntelligence: (managerId = null) => api.get(`/ai/team-intelligence${managerId ? `?manager_id=${managerId}` : ''}`),
  sendChatQuery: (query) => api.post('/ai/chat', { query }),
};

export const mlService = {
  predictReadiness: (employeeId, roleId = 1) => api.post('/predict-readiness', { employee_id: employeeId, role_id: roleId }),
};

export const reportService = {
  getSummary: () => api.get('/reports/summary'),
  getExportUrl: (type = 'readiness') => `${API_BASE_URL}/reports/export-csv?type=${type}`,
};

export const questionBankService = {
  getSummary: () => api.get('/question-bank/summary'),
  getByRole: (roleId) => api.get(`/question-bank/roles/${roleId}`),
  getAll: (params) => api.get('/question-bank', { params }),
  createQuestion: (data) => api.post('/question-bank', data),
  updateQuestion: (id, data) => api.put(`/question-bank/${id}`, data),
  deleteQuestion: (id) => api.delete(`/question-bank/${id}`),
  createAssessment: (data) => api.post('/question-bank/create-assessment', data),
};

export const hierarchyService = {
  getHierarchy: () => api.get('/hierarchy'),
  getManagerHierarchy: () => api.get('/manager/hierarchy'),
  transfer: (payload) => api.post('/hierarchy/transfer', payload),
  getUnassigned: () => api.get('/employees/unassigned'),
};

export const vacancyService = {
  create: (data) => api.post('/vacancies', data),
  getAll: (params) => api.get('/vacancies', { params }),
  getById: (id) => api.get(`/vacancies/${id}`),
  getCandidates: (id) => api.get(`/vacancies/${id}/candidates`),
  getRecommendations: (id) => api.get(`/vacancies/${id}/recommendations`),
  recordAction: (id, data) => api.post(`/vacancies/${id}/action`, data),
  appoint: (id, data) => api.post(`/vacancies/${id}/appoint`, data),
  getScoringConfig: () => api.get('/vacancies/scoring-config'),
  updateScoringConfig: (data) => api.put('/vacancies/scoring-config', data),
};

export const managerService = {
  getOverview: (params) => api.get('/manager/overview', { params }),
  getTeam: (params) => api.get('/manager/team', { params }),
  getTeamMember: (empId) => api.get(`/manager/team/${empId}`),
  updateTeamMember: (empId, data) => api.put(`/manager/team/${empId}`, data),
  getTasks: (params) => api.get('/manager/tasks', { params }),
  createTask: (data) => api.post('/manager/tasks', data),
  updateTask: (id, data) => api.put(`/manager/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/manager/tasks/${id}`),
  getGoals: () => api.get('/manager/goals'),
  createGoal: (data) => api.post('/manager/goals', data),
  updateGoal: (id, data) => api.put(`/manager/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/manager/goals/${id}`),
  getIssues: () => api.get('/manager/issues'),
  createIssue: (data) => api.post('/manager/issues', data),
  updateIssue: (id, data) => api.put(`/manager/issues/${id}`, data),
  deleteIssue: (id) => api.delete(`/manager/issues/${id}`),
  getFeedback: (params) => api.get('/manager/feedback', { params }),
  createFeedback: (data) => api.post('/manager/feedback', data),
  getRecommendations: () => api.get('/manager/recommendations'),
  submitRecommendation: (data) => api.post('/manager/recommendations', data),
  recordPerformanceReview: (data) => api.post('/manager/performance-reviews', data),
};

export default api;

