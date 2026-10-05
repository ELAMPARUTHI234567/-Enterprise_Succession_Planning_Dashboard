import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Clock, AlertTriangle, ArrowLeft, ArrowRight, Save, 
  ShieldCheck, Loader2, Check, Play, Maximize2, MonitorOff, HelpCircle 
} from 'lucide-react';
import { assessmentService } from '../services/api';
import AssessmentResultView from '../components/AssessmentResultView';

export const TakeAssessment = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Requirement 2 & 13: Initial selected state must be empty (NO default answer pre-selected)
  const [answers, setAnswers] = useState({}); // question_id -> option label e.g. "A"
  
  // Requirement 4: Start screen state
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  
  // Requirement 5 & 14: Fullscreen state & exit warning
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);

  // Requirement 6: Tab switch / Window switch violation tracking
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);

  const [savedStatus, setSavedStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(1800); // Default 30 minutes

  // Fetch assessment assignment details
  const fetchAssignmentData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await assessmentService.getAssignmentDetail(assignmentId);
      if (res.success) {
        setAssignment(res.data);
        
        // Requirement 1: Only MCQ questions returned from API
        const mcqOnly = (res.data.questions || []).filter(
          q => !q.question_type || q.question_type.toLowerCase() === 'mcq' || q.question_type.toLowerCase() === 'multiple choice'
        );
        setQuestions(mcqOnly);
        setTimeLeft((res.data.duration || 30) * 60);

        // Requirement 2: Do NOT pre-fill default answers. Keep answers object empty.
        setAnswers({});

        // If assessment is already completed, load result directly
        if (res.data.status === 'Completed') {
          const resultRes = await assessmentService.getResult(assignmentId);
          if (resultRes.success) {
            setSubmittedResult(resultRes.data);
          }
        }
      } else {
        setError(res.message || 'Failed to load assessment data');
      }
    } catch (err) {
      setError(err.message || 'Error loading test interface');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentData();
  }, [assignmentId]);

  // Requirement 5: Request Fullscreen Mode when clicking START ASSESSMENT
  const handleStartAssessment = () => {
    setAssessmentStarted(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request rejected by browser:', err);
      });
    }
  };

  // Requirement 14: Monitor Fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && assessmentStarted && !submittedResult) {
        setShowFullscreenWarning(true);
      } else {
        setShowFullscreenWarning(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [assessmentStarted, submittedResult]);

  // Requirement 6 & 7: Tab switch / Window switch detection without losing answers
  useEffect(() => {
    if (!assessmentStarted || submittedResult) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitchCount(prev => prev + 1);
        setShowVisibilityWarning(true);
      }
    };

    const handleBlur = () => {
      setTabSwitchCount(prev => prev + 1);
      setShowVisibilityWarning(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [assessmentStarted, submittedResult]);

  // Timer countdown hook (starts only after clicking START ASSESSMENT)
  useEffect(() => {
    if (!assessmentStarted || submittedResult || timeLeft <= 0 || assignment?.status === 'Completed') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitFinal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [assessmentStarted, submittedResult, timeLeft]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Requirement 3: Mouse click answer selection & immediate visual feedback
  const handleSelectAnswer = (qId, optionLabel) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: optionLabel
    }));
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 1200);
  };

  const handleSubmitFinal = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setError('');
    try {
      const res = await assessmentService.submitAssessment(assignmentId, answers);
      if (res.success) {
        // Exit fullscreen upon completion if currently active
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        const fullResultRes = await assessmentService.getResult(assignmentId);
        if (fullResultRes.success) {
          setSubmittedResult(fullResultRes.data);
        } else {
          setSubmittedResult({
            overall_score: res.data.overall_score,
            total_score: res.data.total_score,
            total_possible: res.data.total_possible,
            readiness_level: res.data.readiness_level,
            detail: res.data.competency_scores,
            assignment: assignment,
            gap_analysis: res.data.updated_gaps,
            readiness: res.data.updated_readiness
          });
        }
      } else {
        setError(res.message || 'Failed to submit assessment');
      }
    } catch (err) {
      setError(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Preparing Secure Assessment Interface...</p>
      </div>
    );
  }

  // Show Completed Assessment Results View if submitted
  if (submittedResult) {
    return (
      <div className="max-w-5xl mx-auto py-4 font-sans">
        <AssessmentResultView
          result={submittedResult}
          onBack={() => navigate('/employee-dashboard')}
        />
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const totalMaxScore = questions.reduce((sum, q) => sum + (q.max_score || 10), 0);
  const progressPct = totalQ > 0 ? Math.round(((currentIndex + 1) / totalQ) * 100) : 0;
  const isCurrentAnswered = currentQ && !!answers[currentQ.id];

  // Requirement 4: START ASSESSMENT SCREEN (Shown before clicking START ASSESSMENT)
  if (!assessmentStarted) {
    return (
      <div className="max-w-3xl mx-auto py-8 font-sans space-y-6">
        <button
          onClick={() => navigate('/employee-dashboard')}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1.5 font-medium transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Dashboard</span>
        </button>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 card-shadow space-y-6">
          <div className="border-b border-slate-100 pb-5">
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold uppercase tracking-wider">
              Target Role: {assignment?.role_name || 'Leadership Pipeline'}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-3 leading-snug">
              {assignment?.assessment_title}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Assigned by: <strong>{assignment?.assigned_by_name || 'HR Manager'}</strong> • Completion Due Date: {assignment?.due_date || 'N/A'}
            </p>
          </div>

          {/* Assessment Metadata Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Questions</p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">{totalQ}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Question Type</p>
              <p className="text-sm font-extrabold text-indigo-700 mt-1">Multiple Choice</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maximum Score</p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">{totalMaxScore} pts</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Difficulty</p>
              <p className="text-sm font-extrabold text-slate-800 mt-1">{questions[0]?.difficulty || 'Medium'}</p>
            </div>
          </div>

          {/* Assessment Instructions */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Assessment Rules &amp; Instructions</span>
            </h3>
            <ul className="text-xs text-slate-700 space-y-2 font-medium">
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>Select one answer for each multiple-choice question.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>You must use the assessment screen continuously in fullscreen mode.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>Do not switch tabs, minimize, or switch windows during the assessment. Tab switches are logged.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>Submit the assessment after answering all questions to calculate your competency readiness score.</span>
              </li>
            </ul>
          </div>

          {/* START ASSESSMENT BUTTON */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleStartAssessment}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl text-xs shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2.5"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>START ASSESSMENT</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper to get option label and option text cleanly
  const parseOptionObj = (opt, index) => {
    const labels = ["A", "B", "C", "D", "E", "F"];
    if (typeof opt === 'object' && opt !== null) {
      return { label: opt.label || labels[index], text: opt.text || '' };
    }
    const str = String(opt).strip ? String(opt).strip() : String(opt);
    if (str.length >= 3 && str[0] in {A:1,B:1,C:1,D:1,E:1,F:1} && (str[1] === '.' || str[1] === ')')) {
      return { label: str[0], text: str.substring(2).trim() };
    }
    return { label: labels[index] || String(index + 1), text: str };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans py-4">
      {/* Assessment Top Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-bold text-slate-800">{assignment?.assessment_title}</span>
            {tabSwitchCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Tab Switches: {tabSwitchCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Target Role: <strong>{assignment?.role_name}</strong> • Assigned by: {assignment?.assigned_by_name}
          </p>
        </div>

        {/* Timer Box */}
        <div className="flex items-center space-x-3 bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100">
          <Clock className="w-5 h-5 text-indigo-600 animate-pulse" />
          <div>
            <p className="text-[10px] font-bold uppercase text-indigo-500 leading-none">Time Remaining</p>
            <p className="text-base font-extrabold text-indigo-950 font-mono mt-0.5">{formatTimer(timeLeft)}</p>
          </div>
        </div>
      </div>

      {/* Requirement 12: Question Header & Progress */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 card-shadow space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-slate-700">
          <span>Question {currentIndex + 1} of {totalQ}</span>
          <span>{progressPct}% Completed</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }}></div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      {/* Requirement 12: Question Card Header & Details */}
      {currentQ && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 card-shadow space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold">
              Competency: {currentQ.competency_name || 'Leadership'}
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Max Score: {currentQ.max_score || 10} pts • {currentQ.difficulty || 'Medium'} Difficulty
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {currentQ.question}
          </h3>

          {/* Requirement 1, 2, 3: MCQ OPTIONS (Mouse click full option card, no pre-selected answer) */}
          <div className="space-y-3 pt-2">
            {currentQ.options && currentQ.options.length > 0 ? (
              currentQ.options.map((optRaw, oIdx) => {
                const optObj = parseOptionObj(optRaw, oIdx);
                // Compare with selected answer
                const isSelected = answers[currentQ.id] === optObj.label || answers[currentQ.id] === optObj.text;

                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectAnswer(currentQ.id, optObj.label)}
                    className={`w-full text-left p-4 rounded-2xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 font-bold shadow-md ring-1 ring-indigo-600'
                        : 'bg-slate-50/50 border-slate-200/80 text-slate-800 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3 pr-4">
                      {/* Option Radio Circle Visual Indicator */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected ? (
                          <Check className="w-3 h-3 stroke-[3]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent" />
                        )}
                      </div>

                      <span className="font-extrabold text-indigo-900 text-xs w-5 flex-shrink-0">{optObj.label}.</span>
                      <span className="font-medium">{optObj.text}</span>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md flex-shrink-0">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 italic">No multiple choice options defined.</div>
            )}
          </div>

          {/* Footer Controls: Navigation & Progress */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            {/* Requirement 8: Previous Button */}
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex items-center space-x-3">
              {savedStatus && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center">
                  <Save className="w-3.5 h-3.5 mr-1" /> Choice Saved
                </span>
              )}

              {/* Requirement 8: Next / Submit button handling */}
              {currentIndex === totalQ - 1 ? (
                <button
                  type="button"
                  disabled={!isCurrentAnswered}
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center space-x-2"
                >
                  <span>SUBMIT ASSESSMENT</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isCurrentAnswered}
                  onClick={() => setCurrentIndex(prev => Math.min(totalQ - 1, prev + 1))}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center space-x-1.5"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requirement 8: Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Submission</h3>
                <p className="text-xs text-slate-500">Are you sure you want to submit your assessment?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You have completed all {totalQ} questions. Once submitted, your score and competency gap analysis will be calculated.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFinal}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md flex items-center space-x-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 6: Tab Switch / Window Switch Warning Modal */}
      {showVisibilityWarning && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <MonitorOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Assessment Warning</h3>
                <p className="text-xs text-rose-600 font-semibold">You left the assessment screen</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please return to continue your assessment. Continuous focus is required during this evaluation.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between text-xs font-semibold">
              <span className="text-slate-500">Tab / Window Switches Logged:</span>
              <span className="text-rose-600 font-extrabold">{tabSwitchCount}</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowVisibilityWarning(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Resume Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 14: Fullscreen Exit Warning Modal */}
      {showFullscreenWarning && !showVisibilityWarning && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-indigo-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Fullscreen Required</h3>
                <p className="text-xs text-slate-500">Please return to fullscreen mode to continue</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The assessment requires fullscreen mode to maintain a secure evaluation environment. Your selected answers have been saved.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowFullscreenWarning(false);
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Return to Fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeAssessment;
