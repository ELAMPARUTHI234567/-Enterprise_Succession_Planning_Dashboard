import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, AlertTriangle, ArrowLeft, ArrowRight, Save, ShieldCheck, Loader2, Check } from 'lucide-react';
import { assessmentService } from '../services/api';

export const TakeAssessment = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // question_id -> string answer
  const [savedStatus, setSavedStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds

  const fetchAssignmentData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await assessmentService.getAssignmentDetail(assignmentId);
      if (res.success) {
        setAssignment(res.data);
        setQuestions(res.data.questions || []);
        setTimeLeft((res.data.duration || 30) * 60);

        // Pre-fill default answers if options exist
        const initialAnswers = {};
        (res.data.questions || []).forEach(q => {
          if (q.options && q.options.length > 0) {
            initialAnswers[q.id] = q.options[0];
          }
        });
        setAnswers(initialAnswers);
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

  // Timer countdown hook
  useEffect(() => {
    if (!assignment || submittedResult || timeLeft <= 0) return;
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
  }, [assignment, submittedResult, timeLeft]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (qId, answerVal) => {
    setAnswers(prev => ({ ...prev, [qId]: answerVal }));
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 1500);
  };

  const handleSubmitFinal = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setError('');
    try {
      const res = await assessmentService.submitAssessment(assignmentId, answers);
      if (res.success) {
        setSubmittedResult(res.data);
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

  if (submittedResult) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200/80 card-shadow text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Assessment Submitted Successfully</h2>
          <p className="text-xs text-slate-500 mt-1">
            Your competency evaluation has been processed and saved to the database.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Assessment Score</p>
            <p className="text-3xl font-extrabold text-indigo-600 mt-1">{submittedResult.overall_score}%</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Readiness Level</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">{submittedResult.readiness_level}</p>
          </div>
        </div>

        <div className="text-left bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
          <p className="font-bold flex items-center"><Sparkles className="w-4 h-4 mr-1.5 text-indigo-600" /> Automated Model Actions Completed:</p>
          <p>• Employee competency scores updated in database</p>
          <p>• Competency gap analysis recalculated against target role</p>
          <p>• Successor readiness score updated automatically</p>
        </div>

        <button
          onClick={() => navigate('/employee-dashboard')}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
        >
          Return to My Dashboard
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const progressPct = totalQ > 0 ? Math.round(((currentIndex + 1) / totalQ) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans py-4">
      {/* Test Top Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/employee-dashboard')}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 mb-2 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Assessment</span>
          </button>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">{assignment?.assessment_title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Target Role: <strong>{assignment?.role_name}</strong> • Assigned by: {assignment?.assigned_by_name}</p>
        </div>

        {/* Timer Card */}
        <div className="flex items-center space-x-3 bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100">
          <Clock className="w-5 h-5 text-indigo-600 animate-pulse" />
          <div>
            <p className="text-[10px] font-bold uppercase text-indigo-500 leading-none">Time Remaining</p>
            <p className="text-base font-extrabold text-indigo-950 font-mono mt-0.5">{formatTimer(timeLeft)}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar & Status */}
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

      {/* Question Card */}
      {currentQ && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 card-shadow space-y-6">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold">
              Competency: {currentQ.competency_name}
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Max Score: {currentQ.max_score} pts • {currentQ.difficulty} Difficulty
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {currentQ.question}
          </h3>

          {/* Options List according to Question Type */}
          <div className="space-y-3 pt-2">
            {currentQ.options && currentQ.options.length > 0 ? (
              currentQ.options.map((opt, oIdx) => {
                const isSelected = answers[currentQ.id] === opt;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectAnswer(currentQ.id, opt)}
                    className={`w-full text-left p-4 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 font-bold shadow-sm'
                        : 'bg-slate-50/50 border-slate-200/80 text-slate-800 hover:bg-slate-100/70'
                    }`}
                  >
                    <span>{opt}</span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <textarea
                value={answers[currentQ.id] || ''}
                onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                rows={4}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                placeholder="Type your response here..."
              />
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
            >
              Previous Question
            </button>

            <div className="flex items-center space-x-3">
              {savedStatus && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center">
                  <Save className="w-3.5 h-3.5 mr-1" /> Answer Saved
                </span>
              )}

              {currentIndex === totalQ - 1 ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center space-x-2"
                >
                  <span>Submit Assessment</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.min(totalQ - 1, prev + 1))}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center space-x-1.5"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Assessment Submission</h3>
                <p className="text-xs text-slate-500">Prevent accidental submission</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to submit your assessment answers now? You have answered all {totalQ} questions. Once submitted, your answers will be processed and calculated by the competency model.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                Review Answers
              </button>
              <button
                type="button"
                onClick={handleSubmitFinal}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-md flex items-center space-x-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Yes, Submit Now</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeAssessment;
