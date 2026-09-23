import axios from 'axios';

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
      return Promise.reject(new Error(`[HTTP ${error.response.status}] ${detailStr}`));
    }

    if (error.code === 'ERR_NETWORK' || !error.response) {
      return Promise.reject(new Error(`Unable to connect to backend server at ${API_BASE_URL}. Please check if backend is running on http://localhost:5000.`));
    }

    return Promise.reject(new Error(errMessage));
  }
);

export const authService = {
  login: (credentials) => api.post('/login', credentials),
  getMe: () => api.get('/me'),
  getUserAccounts: () => api.get('/user-accounts'),
  createUserAccount: (data) => api.post('/user-accounts', data),
  updateUserAccount: (id, data) => api.put(`/user-accounts/${id}`, data),
  toggleUserStatus: (id) => api.post(`/user-accounts/${id}/toggle-status`),
  logout: () => {
    localStorage.removeItem('succession_token');
    localStorage.removeItem('succession_user');
  }
};

export const employeeService = {
  getAll: (params, config = {}) => api.get('/employees', { params, ...config }),
  getById: (id, roleId = 1, config = {}) => api.get(`/employees/${id}`, { params: { role_id: roleId }, ...config }),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
};

export const roleService = {
  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  getCompetencies: (roleId) => api.get(`/roles/${roleId}/competencies`),
  saveCompetencies: (roleId, competencies) => api.post(`/roles/${roleId}/competencies`, { competencies }),
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

export default api;
