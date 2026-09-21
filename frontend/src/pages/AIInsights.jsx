import React, { useEffect, useState } from 'react';
import { Sparkles, UserX, UserCheck, Award, TrendingUp, AlertTriangle, RefreshCw, CheckCircle2, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { aiService, employeeService, roleService } from '../services/api';

export const AIInsights = () => {
  const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'replacement'
  
  // Data for Insights tab
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(1);
  const [selectedRoleId, setSelectedRoleId] = useState(1);
  const [insightsResult, setInsightsResult] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Data for Replacement tab
  const [unavailEmpId, setUnavailEmpId] = useState(1);
  const [replacementRoleId, setReplacementRoleId] = useState(1);
  const [replacementResult, setReplacementResult] = useState(null);
  const [loadingReplacement, setLoadingReplacement] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    fetchInitialLists();
  }, []);

  const fetchInitialLists = async () => {
    try {
      const empRes = await employeeService.getAll();
      if (empRes.success) setEmployees(empRes.data || []);

      const roleRes = await roleService.getAll();
      if (roleRes.success) setRoles(roleRes.data || []);
      
      // Auto trigger initial AI insights for Employee 1 & Role 1
      handleGenerateInsights(1, 1);
      handleGenerateReplacement(1, 1);
    } catch (err) {
      setError(err.message || 'Error loading employee list');
    }
  };

  const handleGenerateInsights = async (empId = selectedEmpId, rId = selectedRoleId) => {
    setLoadingInsights(true);
    setError('');
    try {
      const res = await aiService.getRecommendation(empId, rId);
      if (res.success) {
        setInsightsResult(res.data);
      } else {
        setError(res.message || 'Failed to generate AI insights');
      }
    } catch (err) {
      setError(err.message || 'AI engine error');
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleGenerateReplacement = async (empId = unavailEmpId, rId = replacementRoleId) => {
    setLoadingReplacement(true);
    setError('');
    try {
      const res = await aiService.getRoleReplacement(empId, rId);
      if (res.success) {
        setReplacementResult(res.data);
      } else {
        setError(res.message || 'Failed to run role replacement recommendation');
      }
    } catch (err) {
      setError(err.message || 'AI replacement model error');
    } finally {
      setLoadingReplacement(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>AI &amp; Machine Learning Assisted Decision Engine</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">AI-Assisted Analysis &amp; Role Replacement</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Generate predictive competency insights for candidate development and execute automated role replacement recommendations when key leaders become unavailable.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 md:mt-0 flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'insights'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Competency Insights
          </button>
          <button
            onClick={() => setActiveTab('replacement')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'replacement'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Role Replacement Engine
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      {/* TAB 1: AI COMPETENCY INSIGHTS */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 card-shadow grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.designation} • {emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Leadership Role</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.role_name} ({role.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 pt-5">
              <button
                onClick={() => handleGenerateInsights(selectedEmpId, selectedRoleId)}
                disabled={loadingInsights}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Analyze AI</span>
              </button>
            </div>
          </div>

          {/* Results Display */}
          {insightsResult && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    AI-Assisted Insights for {insightsResult.employee_name}
                  </h3>
                  <p className="text-xs text-slate-500">Target Position: <strong>{insightsResult.role_name}</strong></p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-500">Readiness Score:</span>
                  <span className="text-2xl font-extrabold text-indigo-700">{insightsResult.readiness_score}%</span>
                  <StatusBadge status={insightsResult.readiness_level} type="readiness" />
                </div>
              </div>

              {/* Strengths & Improvement Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-100 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" /> Core Strengths Identified
                  </h4>
                  <ul className="space-y-1.5 text-xs text-emerald-800">
                    {insightsResult.strengths?.map((str, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50/70 p-5 rounded-xl border border-amber-100 space-y-2">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mr-1.5" /> Key Development Areas
                  </h4>
                  <ul className="space-y-1.5 text-xs text-amber-800">
                    {insightsResult.development_areas?.map((dev, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span>{dev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Summary Insights Box */}
              <div className="bg-slate-900 text-white rounded-xl p-5 space-y-2">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center">
                  <Cpu className="w-4 h-4 mr-2 text-indigo-400" /> AI Executive Summary Recommendation
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-line">
                  {insightsResult.insights}
                </p>
              </div>

              <p className="text-[10px] text-slate-400 italic text-right">
                {insightsResult.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI ROLE REPLACEMENT ENGINE */}
      {activeTab === 'replacement' && (
        <div className="space-y-6">
          {/* Controls Bar for Scenario */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 card-shadow space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              <UserX className="w-4 h-4 text-rose-500" />
              <span>Simulate Leadership Vacancy &amp; Role Replacement</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">Unavailable Employee / Current Leader</label>
                <select
                  value={unavailEmpId}
                  onChange={(e) => setUnavailEmpId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.designation} • {emp.availability_status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1">Vacant Leadership Position</label>
                <select
                  value={replacementRoleId}
                  onChange={(e) => setReplacementRoleId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.role_name} ({role.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 pt-5">
                <button
                  onClick={() => handleGenerateReplacement(unavailEmpId, replacementRoleId)}
                  disabled={loadingReplacement}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {loadingReplacement ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>Find Replacement</span>
                </button>
              </div>
            </div>
          </div>

          {/* Replacement Results Display */}
          {replacementResult && (
            <div className="space-y-6">
              {/* Scenario Status Card */}
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
                    <UserX className="w-4 h-4" />
                    <span>Vacant Position: {replacementResult.vacant_role?.role_name}</span>
                  </div>
                  <p className="text-xs text-rose-700 mt-1">
                    Unavailable Leader: <strong>{replacementResult.unavailable_employee?.name}</strong> ({replacementResult.unavailable_employee?.availability_status})
                  </p>
                </div>

                <span className="px-3 py-1 bg-white text-rose-800 text-xs font-bold rounded-lg border border-rose-200">
                  {replacementResult.label}
                </span>
              </div>

              {/* Recommended Candidates Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Potential Successor Replacement Candidates</h3>
                    <p className="text-[11px] text-slate-500">Evaluated on Competency Match %, Readiness Score, Performance, &amp; Experience</p>
                  </div>
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
                    {replacementResult.replacement_candidates?.length} Candidates Evaluated
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                      <tr>
                        <th className="px-6 py-3">Rank</th>
                        <th className="px-6 py-3">Candidate Employee</th>
                        <th className="px-6 py-3">Role Match %</th>
                        <th className="px-6 py-3">Competency Match</th>
                        <th className="px-6 py-3">Readiness Level</th>
                        <th className="px-6 py-3">Key Competency Gap</th>
                        <th className="px-6 py-3">AI Recommendation Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {replacementResult.replacement_candidates?.map((cand, idx) => (
                        <tr key={cand.employee_id} className={`hover:bg-slate-50/80 transition-colors ${idx === 0 ? 'bg-indigo-50/40' : ''}`}>
                          <td className="px-6 py-4">
                            <span className={`w-7 h-7 rounded-full font-bold text-xs inline-flex items-center justify-center ${idx === 0 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700'}`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-slate-900 text-xs flex items-center">
                                {cand.name}
                                {idx === 0 && <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Top Match</span>}
                              </p>
                              <p className="text-[10px] text-slate-500">{cand.designation} • {cand.department}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-extrabold text-indigo-700 text-sm">{cand.role_match}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">{cand.competency_match}</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={cand.readiness_level} type="readiness" />
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-100">
                              {cand.major_gap}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 max-w-xs text-[11px]">
                            {cand.recommendation_summary}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic text-right">
                {replacementResult.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIInsights;
