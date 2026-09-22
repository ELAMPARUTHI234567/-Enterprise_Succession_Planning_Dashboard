import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CheckSquare, Clock, ShieldAlert, Award, TrendingUp, RefreshCw, ArrowRight, Play, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { assessmentService, employeeService, gapService } from '../services/api';

export const EmployeeDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [myAssessments, setMyAssessments] = useState([]);
  const [gapData, setGapData] = useState(null);
  const [readinessData, setReadinessData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const userJson = localStorage.getItem('succession_user');
  const user = userJson ? JSON.parse(userJson) : { id: 3, name: 'Arun Kumar', role: 'Employee', employee_id: 1 };

  const fetchEmployeeData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Get authenticated user profile & linked employee info
      const meRes = await authService.getMe();
      if (meRes.success) {
        const empData = meRes.data.employee_profile || meRes.data;
        setEmployeeProfile(empData);
      }

      // 2. Get assigned assessments for authenticated employee
      const assRes = await assessmentService.getMyAssessments();
      if (assRes.success) {
        setMyAssessments(assRes.data || []);
      }

      // 3. Get competency gap analysis for authenticated employee
      const gapRes = await gapService.getMyGaps(1);
      if (gapRes.success) {
        setGapData(gapRes.data);
      }

      // 4. Get readiness details for authenticated employee
      const readRes = await gapService.getMyReadiness(1);
      if (readRes.success) {
        setReadinessData(readRes.data);
      }
    } catch (err) {
      setError(err.message || 'Error loading employee dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Personal Portal...</p>
      </div>
    );
  }

  const pendingAssessments = myAssessments.filter(a => a.status !== 'Completed');
  const completedAssessments = myAssessments.filter(a => a.status === 'Completed');
  const competencies = gapData?.competencies || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white card-shadow flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold mb-2">
            <User className="w-3.5 h-3.5" />
            <span>Employee Self-Service Portal</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Welcome, {employeeProfile?.name || user.name}!</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Track your assigned competency assessments, view individual performance scores, review gap analysis, and focus on recommended leadership development areas.
          </p>
        </div>

        {pendingAssessments.length > 0 && (
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => navigate(`/take-assessment/${pendingAssessments[0].id}`)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center space-x-2 animate-pulse"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Take Pending Assessment</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      {/* Profile Overview Card & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="md:col-span-4 bg-white rounded-2xl p-6 border border-slate-200/80 card-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center font-extrabold text-xl shadow-md">
                {employeeProfile?.name ? employeeProfile.name.split(' ').map(n=>n[0]).join('').slice(0,2) : 'EM'}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{employeeProfile?.name}</h3>
                <p className="text-xs text-indigo-600 font-semibold">{employeeProfile?.designation}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{employeeProfile?.department} • {employeeProfile?.employee_code}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-500">Email:</span>
                <span className="font-semibold text-slate-800">{employeeProfile?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-500">Experience:</span>
                <span className="font-semibold text-slate-800">{employeeProfile?.experience_years} years</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="font-medium text-slate-500">Performance Score:</span>
                <span className="font-semibold text-slate-800">{employeeProfile?.performance_score}/100</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-medium text-slate-500">Assigned Manager:</span>
                <span className="font-semibold text-slate-800">{employeeProfile?.manager_name || 'Sneha Reddy'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Leadership Readiness Score</p>
                <p className="text-2xl font-extrabold text-indigo-900 mt-0.5">{readinessData?.readiness_score || 82}%</p>
              </div>
              <StatusBadge status={readinessData?.readiness_level || 'High'} type="readiness" />
            </div>
            <p className="text-[9.5px] text-slate-500 mt-2 italic border-t border-indigo-100/60 pt-1.5">
              Rule Weights: Competency 40%, Performance 25%, Experience 15%, Leadership 20%
            </p>
          </div>
        </div>

        {/* Stats & Pending Assessments */}
        <div className="md:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Assigned Assessments"
              value={myAssessments.length}
              subtitle="Total assessments assigned"
              icon={CheckSquare}
              color="indigo"
            />
            <StatCard
              title="Pending Action"
              value={pendingAssessments.length}
              subtitle="Awaiting your test submission"
              icon={Clock}
              color="amber"
            />
            <StatCard
              title="Completed History"
              value={completedAssessments.length}
              subtitle="Completed evaluations"
              icon={CheckCircle2}
              color="emerald"
            />
          </div>

          {/* Assigned Assessments Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">My Assigned Competency Assessments</h3>
                <p className="text-[11px] text-slate-500">Complete assigned assessments before the due date</p>
              </div>
            </div>

            {myAssessments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Pending Assessments!</p>
                <p className="text-[11px] text-slate-400 mt-1">You are all caught up on your competency evaluations.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myAssessments.map((ass) => (
                  <div key={ass.id} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-100/50 transition-colors">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{ass.assessment_title}</span>
                        <StatusBadge status={ass.status} type="status" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Assigned by: <strong>{ass.assigned_by_name}</strong> • Role: <strong>{ass.role_name}</strong> • Duration: {ass.duration} mins • Due: {ass.due_date}
                      </p>
                    </div>

                    <div>
                      {ass.status === 'Completed' ? (
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                            Score: {ass.result?.overall_score || 85}%
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate(`/take-assessment/${ass.id}`)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-md transition-colors flex items-center space-x-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Assessment</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Competencies & Gap Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/80 card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">My Competency Breakdown &amp; Development Areas</h3>
            <p className="text-[11px] text-slate-500">Your score vs target requirement for {gapData?.role_name || 'Project Manager'}</p>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-lg">
            Target Role: {gapData?.role_name || 'Project Manager'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {competencies.map((comp) => {
            const pct = Math.min(100, Math.max(0, (comp.current_score / comp.required_score) * 100));
            const isStrength = comp.status === 'Strength';

            return (
              <div key={comp.competency_id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">{comp.competency_name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isStrength ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {isStrength ? 'Strength' : `Gap: -${comp.gap} pts (${comp.gap_level})`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Current: <strong className="text-slate-900">{comp.current_score}</strong></span>
                  <span>Required: <strong className="text-slate-900">{comp.required_score}</strong></span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isStrength ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
