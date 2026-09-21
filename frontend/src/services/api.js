import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`;

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
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export const authService = {
  login: (credentials) => api.post('/login', credentials),
  getMe: () => api.get('/me'),
  logout: () => {
    localStorage.removeItem('succession_token');
    localStorage.removeItem('succession_user');
  }
};

export const employeeService = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id, roleId = 1) => api.get(`/employees/${id}`, { params: { role_id: roleId } }),
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
  getMyAssessments: (employeeId) => api.get('/my-assessments', { params: { employee_id: employeeId } }),
  getAssignmentDetail: (assignmentId) => api.get(`/assessment-assignments/${assignmentId}`),
  submitAssessment: (assignmentId, answers) => api.post(`/assessment-assignments/${assignmentId}/submit`, { answers }),
  getResult: (assignmentId) => api.get(`/assessment-results/${assignmentId}`),
};

export const gapService = {
  getGapAnalysis: (employeeId, roleId = 1) => api.get(`/gap-analysis/${employeeId}/${roleId}`),
  getReadiness: (employeeId, roleId = 1) => api.get(`/readiness/${employeeId}/${roleId}`),
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
