import React, { useEffect, useState } from 'react';
import { TrendingUp, Award, Crown, Cpu, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { roleService, successorService, mlService } from '../services/api';

export const Successors = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [successorData, setSuccessorData] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [mlLoading, setMlLoading] = useState(false);
  const [selectedMlCand, setSelectedMlCand] = useState(null);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [isMlModalOpen, setIsMlModalOpen] = useState(false);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await roleService.getAll();
      if (res.success && res.data.length > 0) {
        setRoles(res.data);
        setSelectedRoleId(res.data[0].id);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const loadSuccessors = async () => {
    if (!selectedRoleId) return;
    try {
      const res = await successorService.getByRole(selectedRoleId);
      if (res.success) {
        setSuccessorData(res.data);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (selectedRoleId) {
      loadSuccessors();
    }
  }, [selectedRoleId]);

  const handleTriggerMl = async (cand) => {
    setSelectedMlCand(cand);
    setMlPrediction(null);
    setIsMlModalOpen(true);
    setMlLoading(true);

    try {
      const res = await mlService.predictReadiness(cand.employee_id, selectedRoleId);
      if (res.success) {
        setMlPrediction(res.data);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setMlLoading(false);
    }
  };

  const candidates = successorData?.candidates || [];
  const topThree = candidates.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Potential Successor Identification &amp; Ranking</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ranked candidate pipeline for critical executive leadership positions</p>
        </div>

        {/* Role Selector */}
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-700">Target Position:</span>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.role_name} ({r.department})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top 3 Spotlight Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {topThree.map((cand, idx) => {
            const badgeColors = [
              'bg-amber-500 text-amber-950 border-amber-300', // Gold
              'bg-slate-300 text-slate-900 border-slate-200',  // Silver
              'bg-amber-700 text-amber-100 border-amber-600'   // Bronze
            ];
            return (
              <div key={cand.employee_id} className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow card-hover relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border ${badgeColors[idx]}`}>
                      #{idx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{cand.name}</h3>
                      <p className="text-[10px] text-slate-500">{cand.designation}</p>
                    </div>
                  </div>
                  <Crown className={`w-5 h-5 ${idx === 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                </div>

                <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Readiness Score:</span>
                    <span className="text-base font-extrabold text-indigo-700">{cand.readiness_score}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Readiness Level:</span>
                    <StatusBadge status={cand.readiness_level} type="readiness" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Major Gap:</span>
                    <span className="font-bold text-rose-600">{cand.major_gap}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTriggerMl(cand)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Run Random Forest ML</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Ranked Leaderboard Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Complete Candidate Succession Leaderboard</h3>
            <p className="text-[11px] text-slate-500">Target Role: {successorData?.role_name} ({successorData?.department})</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{candidates.length} Candidates Evaluated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-3.5">Rank</th>
                <th className="px-6 py-3.5">Employee Candidate</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Competency (40%)</th>
                <th className="px-6 py-3.5">Performance (25%)</th>
                <th className="px-6 py-3.5">Experience (15%)</th>
                <th className="px-6 py-3.5">Leadership (20%)</th>
                <th className="px-6 py-3.5">Readiness Score</th>
                <th className="px-6 py-3.5">Readiness Level</th>
                <th className="px-6 py-3.5 text-right">ML Prediction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {candidates.map((cand) => (
                <tr key={cand.employee_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-900">#{cand.rank}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900">{cand.name}</p>
                      <p className="text-[10px] text-slate-500">{cand.designation} • {cand.employee_code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{cand.department}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{cand.competency_score}%</td>
                  <td className="px-6 py-4 font-bold text-emerald-700">{cand.performance_score}%</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{cand.experience_score}%</td>
                  <td className="px-6 py-4 font-bold text-indigo-700">{cand.leadership_score}%</td>
                  <td className="px-6 py-4">
                    <span className="font-extrabold text-indigo-700 text-sm">{cand.readiness_score}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={cand.readiness_level} type="readiness" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleTriggerMl(cand)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 ml-auto"
                    >
                      <Cpu className="w-3 h-3" />
                      <span>Run ML</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ML Prediction Modal */}
      <Modal isOpen={isMlModalOpen} onClose={() => setIsMlModalOpen(false)} title={`Random Forest ML Readiness: ${selectedMlCand?.name}`}>
        {mlLoading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-500">Executing Random Forest inference model...</p>
          </div>
        ) : mlPrediction ? (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Predicted Readiness Class</p>
                <h3 className="text-xl font-black mt-0.5">{mlPrediction.predicted_class} Readiness</h3>
              </div>
              <Sparkles className="w-6 h-6 text-indigo-300" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Class Probabilities Distribution:</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-emerald-800">High</p>
                  <p className="text-lg font-extrabold text-emerald-700">{Math.round(mlPrediction.probabilities.High * 100)}%</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-amber-800">Medium</p>
                  <p className="text-lg font-extrabold text-amber-700">{Math.round(mlPrediction.probabilities.Medium * 100)}%</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-rose-800">Low</p>
                  <p className="text-lg font-extrabold text-rose-700">{Math.round(mlPrediction.probabilities.Low * 100)}%</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
              {mlPrediction.disclaimer}
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default Successors;
