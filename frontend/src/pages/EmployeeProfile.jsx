import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Award, ShieldAlert, Cpu, CheckCircle, RefreshCw, BarChart2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import CompetencyRadarChart from '../charts/CompetencyRadarChart';
import { employeeService, roleService, mlService } from '../services/api';

export const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlResult, setMlResult] = useState(null);
  const [error, setError] = useState('');

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const rolesRes = await roleService.getAll();
      if (rolesRes.success) setRoles(rolesRes.data);

      const empRes = await employeeService.getById(id, selectedRoleId);
      if (empRes.success) setEmployee(empRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [id, selectedRoleId]);

  const handleRunMlPrediction = async () => {
    setMlLoading(true);
    try {
      const res = await mlService.predictReadiness(id, selectedRoleId);
      if (res.success) {
        setMlResult(res.data);
      }
    } catch (err) {
      alert("ML Prediction Error: " + err.message);
    } finally {
      setMlLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Profile Details...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center text-xs text-rose-600 font-semibold bg-rose-50 rounded-xl">
        Employee profile not found.
      </div>
    );
  }

  const gapAnalysis = employee.gap_analysis || {};
  const readiness = employee.readiness || {};
  const competencies = gapAnalysis.competencies || [];

  const radarLabels = competencies.map(c => c.competency_name);
  const radarCurrent = competencies.map(c => c.current_score);
  const radarRequired = competencies.map(c => c.required_score);

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <button
        onClick={() => navigate('/employees')}
        className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Employees</span>
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            {employee.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">{employee.name}</h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {employee.employee_code}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {employee.designation} • <span className="text-indigo-600 font-semibold">{employee.department}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{employee.email}</p>
          </div>
        </div>

        {/* Target Leadership Role Selector */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left w-full md:w-auto">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Target Leadership Standard:
          </label>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(Number(e.target.value))}
            className="w-full md:w-56 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Experience</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{employee.experience_years} Yrs</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Performance Rating</p>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">{employee.performance_score}%</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Competency Average</p>
          <p className="text-xl font-extrabold text-indigo-600 mt-1">{gapAnalysis.overall_competency_score || 0}%</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Readiness Score</p>
          <p className="text-xl font-extrabold text-indigo-700 mt-1">{readiness.readiness_score || 0}%</p>
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow">
        <div className="flex border-b border-slate-200 px-6 pt-3 space-x-6">
          {['overview', 'competencies', 'performance', 'succession'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs font-bold capitalize transition-colors relative ${
                activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Readiness Summary</h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Target Leadership Role:</span>
                    <span className="font-bold text-slate-900">{gapAnalysis.role_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Readiness Status:</span>
                    <StatusBadge status={readiness.readiness_level} type="readiness" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Major Competency Gap:</span>
                    <span className="font-bold text-rose-600">{readiness.major_gap}</span>
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Competency Breakdown</h3>
                  <div className="space-y-3">
                    {competencies.slice(0, 4).map((c) => (
                      <div key={c.competency_id} className="text-xs">
                        <div className="flex justify-between font-semibold mb-1">
                          <span>{c.competency_name}</span>
                          <span>{c.current_score} / {c.required_score} Target</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.current_score >= c.required_score ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, c.current_score)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Radar Competency Mapping</h3>
                <CompetencyRadarChart
                  labels={radarLabels}
                  currentScores={radarCurrent}
                  requiredScores={radarRequired}
                  employeeName={employee.name}
                />
              </div>
            </div>
          )}

          {/* Competencies Tab */}
          {activeTab === 'competencies' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800">All Core Leadership Competencies</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {competencies.map((c) => (
                  <div key={c.competency_id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{c.competency_name}</h4>
                        <p className="text-[10px] text-slate-500">{c.description}</p>
                      </div>
                      <StatusBadge status={c.gap_level} type="gap" />
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mt-3 mb-1">
                      <span>Current: {c.current_score}%</span>
                      <span>Target: {c.required_score}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${Math.min(100, c.current_score)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Performance &amp; Experience Metrics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Performance Score</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{employee.performance_score}%</p>
                  <p className="text-[10px] text-slate-500 mt-1">Weight in Readiness: 25%</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Experience Normalized</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{readiness.experience_score || 0}%</p>
                  <p className="text-[10px] text-slate-500 mt-1">{employee.experience_years} Years (Weight: 15%)</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Leadership Rating</p>
                  <p className="text-2xl font-extrabold text-indigo-700 mt-1">{employee.leadership_score}%</p>
                  <p className="text-[10px] text-slate-500 mt-1">Weight in Readiness: 20%</p>
                </div>
              </div>
            </div>
          )}

          {/* Succession & ML Tab */}
          {activeTab === 'succession' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl">
                <div>
                  <h4 className="text-sm font-bold">Random Forest Machine Learning Readiness Prediction</h4>
                  <p className="text-xs text-indigo-200 mt-0.5">Run automated Random Forest classifier model inference</p>
                </div>
                <button
                  onClick={handleRunMlPrediction}
                  disabled={mlLoading}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg text-xs transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{mlLoading ? 'Predicting...' : 'Run ML Prediction'}</span>
                </button>
              </div>

              {mlResult && (
                <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-bold text-indigo-900 uppercase">ML Predicted Class:</h5>
                    <StatusBadge status={mlResult.predicted_class} type="readiness" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Class Probabilities:</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                      <p className="text-[10px] font-bold text-slate-500">High</p>
                      <p className="text-base font-extrabold text-emerald-600">{Math.round(mlResult.probabilities.High * 100)}%</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                      <p className="text-[10px] font-bold text-slate-500">Medium</p>
                      <p className="text-base font-extrabold text-amber-600">{Math.round(mlResult.probabilities.Medium * 100)}%</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                      <p className="text-[10px] font-bold text-slate-500">Low</p>
                      <p className="text-base font-extrabold text-rose-600">{Math.round(mlResult.probabilities.Low * 100)}%</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-2">{mlResult.disclaimer}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;
