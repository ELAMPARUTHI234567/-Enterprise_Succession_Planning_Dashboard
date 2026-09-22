import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, CheckSquare, Clock, ShieldAlert, Award, TrendingUp, RefreshCw, 
  ArrowRight, Play, CheckCircle2, Sparkles, Mail, Building2, Calendar, 
  Star, ChevronRight, Target, BookOpen, Activity, Mountain
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { authService, assessmentService, employeeService, gapService } from '../services/api';

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

  // Fallback demo data if list is empty for rich display matching mockup
  const defaultAssessments = [
    {
      id: 1,
      assessment_title: 'Leadership Competency Assessment',
      description: 'Evaluate your leadership skills and potential',
      status: 'In Progress',
      due_date: 'Dec 15, 2024',
      assigned_by_name: 'Sarah Jenkins',
      role_name: 'Senior Developer'
    },
    {
      id: 2,
      assessment_title: 'Technical Competency Assessment',
      description: 'Assess your technical knowledge and skills',
      status: 'Assigned',
      due_date: 'Dec 30, 2024',
      assigned_by_name: 'Sneha Reddy',
      role_name: 'Full Stack Engineer'
    },
    {
      id: 3,
      assessment_title: 'Communication Skills Assessment',
      description: 'Evaluate your communication and collaboration',
      status: 'Completed',
      completed_date: 'Nov 10, 2024',
      assigned_by_name: 'Sarah Jenkins',
      role_name: 'Senior Developer',
      result: { overall_score: 85 }
    }
  ];

  const displayAssessments = myAssessments.length > 0 ? myAssessments : defaultAssessments;
  const pendingAssessments = displayAssessments.filter(a => a.status !== 'Completed');
  const completedAssessments = displayAssessments.filter(a => a.status === 'Completed');
  const gapCount = gapData?.competencies?.filter(c => c.status !== 'Strength').length || 2;

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Header Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="max-w-2xl relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[11px] font-semibold">
            <User className="w-3.5 h-3.5" />
            <span>Employee Self-Service Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {employeeProfile?.name || user.name}!
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed font-normal">
            Track your assigned competency assessments, view individual performance scores, review gap analysis, and focus on recommended leadership development areas.
          </p>
        </div>

        {/* Right Side Quote Card with Mountain Graphic */}
        <div className="mt-6 md:mt-0 relative z-10 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl max-w-xs text-right hidden lg:block">
          <div className="flex items-center justify-end space-x-2 text-indigo-300 mb-1">
            <Mountain className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold italic text-white">
            "Develop your skills today for a stronger tomorrow."
          </p>
        </div>

        <div className="absolute right-0 bottom-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-2xl">
          {error}
        </div>
      )}

      {/* 2. Top 3 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Card 1: ASSIGNED ASSESSMENTS */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CheckSquare className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Assessments</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{displayAssessments.length}</p>
              <p className="text-[11px] text-slate-500 font-medium">Total assessments assigned to you</p>
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: PENDING ACTION */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pending Action</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{pendingAssessments.length}</p>
              <p className="text-[11px] text-slate-500 font-medium">Assessments awaiting your submission</p>
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 3: COMPLETED HISTORY */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Completed History</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{completedAssessments.length}</p>
              <p className="text-[11px] text-slate-500 font-medium">Completed assessments</p>
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* 3. Main Dashboard Grid (Profile Card & Assessments List) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Profile Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            {/* Header Avatar */}
            <div className="flex items-center space-x-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-indigo-600/30">
                {employeeProfile?.name ? employeeProfile.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'AK'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-slate-900">{employeeProfile?.name || 'Arun Kumar'}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                    • Active
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{employeeProfile?.designation || 'Senior Developer'}</p>
              </div>
            </div>

            {/* Profile Fields List */}
            <div className="space-y-3 border-t border-slate-100 pt-4 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center space-x-2 text-slate-500 font-medium">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email</span>
                </span>
                <span className="font-semibold text-slate-800">{employeeProfile?.email || 'arun.kumar@company.com'}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center space-x-2 text-slate-500 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Department</span>
                </span>
                <span className="font-semibold text-slate-800">{employeeProfile?.department || 'Information Technology'}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center space-x-2 text-slate-500 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Manager</span>
                </span>
                <span className="font-semibold text-slate-800">{employeeProfile?.manager_name || 'Sneha Reddy'}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center space-x-2 text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Experience</span>
                </span>
                <span className="font-semibold text-slate-800">{employeeProfile?.experience_years || 4} years</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center space-x-2 text-slate-500 font-medium">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Performance Score</span>
                </span>
                <span className="font-semibold text-slate-800">{employeeProfile?.performance_score || 78} / 100</span>
              </div>
            </div>
          </div>

          {/* Bottom Leadership Readiness Score Box */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Leadership Readiness Score</p>
                <p className="text-2xl font-extrabold text-indigo-950 mt-0.5">{readinessData?.readiness_score || 82}%</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                • High Readiness
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${readinessData?.readiness_score || 82}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: My Assigned Competency Assessments (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">My Assigned Competency Assessments</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Complete your assigned assessments before the due date</p>
              </div>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1">
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Assessments List */}
            <div className="space-y-3.5">
              {displayAssessments.map((ass) => (
                <div
                  key={ass.id}
                  className="p-4 bg-slate-50/70 hover:bg-slate-100/60 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold mt-0.5 ${
                      ass.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-600'
                        : ass.status === 'In Progress'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      <CheckSquare className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">{ass.assessment_title}</span>
                        {ass.status === 'In Progress' && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            In Progress
                          </span>
                        )}
                        {ass.status === 'Assigned' && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            Assigned
                          </span>
                        )}
                        {ass.status === 'Completed' && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{ass.description || `Assigned evaluation for ${ass.role_name}`}</p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-2 font-medium">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ass.status === 'Completed' ? `Completed On ${ass.completed_date || 'Nov 10, 2024'}` : `Due Date ${ass.due_date || 'Dec 15, 2024'}`}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {ass.status === 'Completed' ? (
                      <button
                        onClick={() => navigate(`/take-assessment/${ass.id}`)}
                        className="px-4 py-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl text-xs transition-colors"
                      >
                        View Results
                      </button>
                    ) : ass.status === 'In Progress' ? (
                      <button
                        onClick={() => navigate(`/take-assessment/${ass.id}`)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/take-assessment/${ass.id}`)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all"
                      >
                        Start Assessment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 4. Bottom 3 Column Grid (Gaps, Development Plan, Recent Activity) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: My Competency Gaps */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Target className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">My Competency Gaps</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{gapCount}</p>
              <p className="text-[11px] text-slate-500 font-medium">Areas need improvement</p>
            </div>
          </div>
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1">
            <span>View Gaps</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Development Plan */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <BookOpen className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Development Plan</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">3</p>
              <p className="text-[11px] text-slate-500 font-medium">Recommended learning areas</p>
            </div>
          </div>
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1">
            <span>View Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Recent Activity */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <Activity className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Recent Activity</p>
              <p className="text-xs font-bold text-slate-800 mt-1">Submitted Technical Assessment</p>
              <p className="text-[10px] text-slate-400">2 days ago</p>
            </div>
          </div>
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};

export default EmployeeDashboard;
