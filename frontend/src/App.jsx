import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import LeadershipRoles from './pages/LeadershipRoles';
import Competencies from './pages/Competencies';
import Assessments from './pages/Assessments';
import TakeAssessment from './pages/TakeAssessment';
import GapAnalysis from './pages/GapAnalysis';
import Successors from './pages/Successors';
import AIInsights from './pages/AIInsights';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

// Role Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('succession_token');
  const userJson = localStorage.getItem('succession_user');

  if (!token || !userJson) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userJson);
  const userRole = user.role || 'Employee';

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirect based on role if trying to access unauthorized URL
    if (userRole === 'Employee') {
      return <Navigate to="/employee-dashboard" replace />;
    } else if (userRole === 'Manager') {
      return <Navigate to="/manager-dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <MainLayout>{children}</MainLayout>;
};

export const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* HR & Admin Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin']}>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees/:id"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin', 'Manager']}>
              <EmployeeProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin']}>
              <LeadershipRoles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/competencies"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin']}>
              <Competencies />
            </ProtectedRoute>
          }
        />

        {/* Manager Protected Routes */}
        <Route
          path="/manager-dashboard"
          element={
            <ProtectedRoute allowedRoles={['Manager', 'HR', 'Admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-team"
          element={
            <ProtectedRoute allowedRoles={['Manager', 'HR', 'Admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Employee Self-Service Protected Routes */}
        <Route
          path="/employee-dashboard"
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-profile"
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-assessments"
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-competencies"
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-development"
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        {/* Interactive Assessment & Test Taking */}
        <Route
          path="/assessments"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin', 'Manager']}>
              <Assessments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/take-assessment/:assignmentId"
          element={
            <ProtectedRoute allowedRoles={['Employee', 'Manager', 'HR', 'Admin']}>
              <TakeAssessment />
            </ProtectedRoute>
          }
        />

        {/* Analytics, Gap Analysis, Successors & AI Insights */}
        <Route
          path="/gap-analysis"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin', 'Manager']}>
              <GapAnalysis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/successors"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin', 'Manager']}>
              <Successors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-insights"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin', 'Manager']}>
              <AIInsights />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin']}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['HR', 'Admin', 'Manager']}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Fallback Root Route */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </Router>
  );
};

export default App;
