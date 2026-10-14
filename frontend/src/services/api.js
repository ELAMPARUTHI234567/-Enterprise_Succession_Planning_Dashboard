import axios from 'axios';
import { supabase } from '../utils/supabaseClient';

let rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim();
if (rawApiUrl.includes('enterprise-succession-dashboard.onrender.com')) {
  rawApiUrl = rawApiUrl.replace('enterprise-succession-dashboard.onrender.com', 'enterprise-succession-planning-dashboard.onrender.com');
}

const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`;

if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'development')) {
  console.log(`[API Service] Base URL: ${API_BASE_URL}`);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
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

    console.error(`[API Error Diagnostic] Status: ${status} | Code: ${errCode} | Message: ${errMessage} | Details: ${responseData || 'N/A'} | Target: ${API_BASE_URL}${error.config?.url || ''}`);

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

    if (error.code === 'ERR_NETWORK' || !error.response) {
      return Promise.reject(new Error(`Unable to communicate with API server at ${API_BASE_URL}. Please check internet connection or verify backend service health.`));
    }

    return Promise.reject(new Error(errMessage));
  }
);

export const authService = {
  login: (credentials) => api.post('/login', credentials),
  loginSupabase: (accessToken, metadata = {}) => api.post('/supabase', { 
    access_token: accessToken,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    user_metadata: metadata
  }),
  onboardEmployee: (data) => api.post('/onboard-employee', data),
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

  // Module 4: HR Candidate Comparison
  getCandidatesComparison: (roleId, params) => api.get(`/roles/${roleId}/candidates-comparison`, { params }),
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

export default api;
