import React, { useEffect, useState } from 'react';
import { ShieldAlert, Filter, AlertOctagon, CheckCircle2, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import CompetencyBarChart from '../charts/CompetencyBarChart';
import CompetencyRadarChart from '../charts/CompetencyRadarChart';
import { employeeService, roleService, gapService } from '../services/api';

export const GapAnalysis = () => {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [gapData, setGapData] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOptions = async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, roleRes] = await Promise.all([
        (employeeService.getAll || employeeService.getEmployees)(),
        (roleService.getAll || roleService.getRoles)()
      ]);

      const empList = (empRes && empRes.success && Array.isArray(empRes.data)) ? empRes.data : [];
      const roleList = (roleRes && roleRes.success && Array.isArray(roleRes.data)) ? roleRes.data : [];

      setEmployees(empList);
      setRoles(roleList);

      if (empList.length > 0) {
        setSelectedEmpId(empList[0].id);
      }
      if (roleList.length > 0) {
        setSelectedRoleId(roleList[0].id);
      }
    } catch (err) {
      console.error('Error fetching options for Gap Analysis:', err);
      setError(err.message || 'Failed to load options for gap analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const loadGapAnalysis = async () => {
    if (!selectedEmpId || !selectedRoleId) return;
    try {
      const res = await gapService.getGapAnalysis(selectedEmpId, selectedRoleId);
      if (res.success) {
        setGapData(res.data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (selectedEmpId && selectedRoleId) {
      loadGapAnalysis();
    }
  }, [selectedEmpId, selectedRoleId]);

  const competencies = gapData?.competencies || [];
  const selectedEmpObj = employees.find(e => e.id === Number(selectedEmpId));
  const selectedRoleObj = roles.find(r => r.id === Number(selectedRoleId));

  const labels = competencies.map(c => c.competency_name);
  const currentScores = competencies.map(c => c.current_score);
  const requiredScores = competencies.map(c => c.required_score);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Automated Leadership Competency Gap Analysis</h2>
        <p className="text-xs text-slate-500 mt-0.5">Quantitative gap identification and strength/improvement categorization</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchOptions}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Selectors */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee:</label>
          {loading && employees.length === 0 ? (
            <div className="h-9 bg-slate-100 rounded-lg animate-pulse flex items-center px-3 text-xs text-slate-400">
              Loading employees...
            </div>
          ) : (
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {employees.length === 0 ? (
                <option value="">No authorized employees found</option>
              ) : (
                employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employee_code} • {e.department})</option>
                ))
              )}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Select Target Leadership Position:</label>
          {loading && roles.length === 0 ? (
            <div className="h-9 bg-slate-100 rounded-lg animate-pulse flex items-center px-3 text-xs text-slate-400">
              Loading leadership positions...
            </div>
          ) : (
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {roles.length === 0 ? (
                <option value="">No leadership positions found</option>
              ) : (
                roles.map(r => (
                  <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
                ))
              )}
            </select>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      {gapData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Role Standard</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">{gapData.role_name}</p>
            <p className="text-[10px] text-slate-500">{selectedRoleObj?.department}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall Competency Average</p>
            <p className="text-xl font-extrabold text-indigo-600 mt-1">{gapData.overall_competency_score}%</p>
            <p className="text-[10px] text-slate-500">Across 8 core competencies</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 card-shadow">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Major Development Gap</p>
            <p className="text-lg font-extrabold text-rose-600 mt-1">{gapData.major_gap}</p>
            <p className="text-[10px] text-slate-500">Requires targeted mentorship</p>
          </div>
        </div>
      )}

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Current vs Required Bar Comparison</h3>
          <CompetencyBarChart
            labels={labels}
            currentScores={currentScores}
            requiredScores={requiredScores}
          />
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Radar Competency Blueprint</h3>
          <CompetencyRadarChart
            labels={labels}
            currentScores={currentScores}
            requiredScores={requiredScores}
            employeeName={selectedEmpObj?.name || 'Employee'}
          />
        </div>
      </div>

      {/* Competency Gap Detailed Cards */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Detailed Competency Gap Breakdown</h3>
          <span className="text-[11px] text-slate-500 font-medium">Formula: Gap = max(0, Required - Current)</span>
        </div>

        <div className="divide-y divide-slate-100">
          {competencies.map((item) => (
            <div key={item.competency_id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center space-x-3">
                  <h4 className="text-xs font-bold text-slate-900">{item.competency_name}</h4>
                  <StatusBadge status={item.gap_level} type="gap" />
                </div>
                <p className="text-[10px] text-slate-500">{item.description}</p>
              </div>

              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-[10px] font-semibold text-slate-400">Current</p>
                  <p className="text-sm font-extrabold text-slate-900">{item.current_score}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-semibold text-slate-400">Required</p>
                  <p className="text-sm font-extrabold text-slate-700">{item.required_score}%</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-semibold text-slate-400">Gap</p>
                  <p className={`text-sm font-extrabold ${item.gap > 20 ? 'text-rose-600' : item.gap > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {item.gap} pts
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GapAnalysis;
