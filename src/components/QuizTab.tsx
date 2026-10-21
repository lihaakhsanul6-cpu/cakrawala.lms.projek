import React, { useState, useEffect } from 'react';
import { useQuiz } from '../context/QuizContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { DirectQuiz, DirectQuizQuestion, DirectQuestionType } from '../types';

import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Play, 
  Award, 
  Send,
  Eye,
  EyeOff,
  UserCheck,
  Sliders,
  FileText
} from 'lucide-react';

interface QuizTabProps {
  courseId: string;
  courseTitle: string;
  targetClass: string;
}

export const QuizTab: React.FC<QuizTabProps> = ({ courseId, courseTitle, targetClass }) => {
  const { quizzes, submissions, createQuiz, deleteQuiz, updateQuiz, submitQuiz, reviewQuizSubmission } = useQuiz();
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const isTeacherOrAdmin = currentUser?.role === 'guru' || currentUser?.role === 'admin';

  // Filter quizzes for this course
  const relevantQuizzes = quizzes.filter(q => {
    const matches = !q.courseId || q.courseId === courseId;
    if (currentUser?.role === 'siswa') {
      return matches && q.status === 'published';
    }
    return matches;
  });

  // Modal State for Teacher Quiz Review & Scoring Override
  const [reviewModalQuiz, setReviewModalQuiz] = useState<DirectQuiz | null>(null);
  const [selectedSubToReview, setSelectedSubToReview] = useState<any | null>(null);
  const [quizItemizedScores, setQuizItemizedScores] = useState<Record<string, { score: number; teacherNotes: string }>>({});
  const [quizTeacherFeedback, setQuizTeacherFeedback] = useState('');
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Student view of their graded quiz
  const [studentViewReviewSub, setStudentViewReviewSub] = useState<any | null>(null);
  const [studentViewQuiz, setStudentViewQuiz] = useState<DirectQuiz | null>(null);

  // Modal State for Teacher Quiz Creation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [questions, setQuestions] = useState<DirectQuizQuestion[]>([
    {
      id: `q-${Date.now()}-1`,
      type: 'mcq',
      prompt: 'Berapakah nilai limit lim x->0 (sin 4x / 2x)?',
      points: 25,
      options: ['1', '2', '4', '8'],
      correctOptionIndex: 1,
      expectedAnswer: 'Gunakan teorema limit dasar trigonometri: lim x->0 (sin ax / bx) = a / b = 4 / 2 = 2.',
      rubricCriteria: 'Pemilihan opsi yang tepat.'
    },
    {
      id: `q-${Date.now()}-2`,
      type: 'true_false',
      prompt: 'Turunan dari fungsi f(x) = sin(x) adalah cos(x).',
      points: 25,
      correctBoolean: true,
      expectedAnswer: 'Benar, d/dx (sin x) = cos x.',
      rubricCriteria: 'Kebenaran konsep turunan dasar.'
    },
    {
      id: `q-${Date.now()}-3`,
      type: 'numeric',
      prompt: 'Jika f(x) = 3x² + 4x - 5, berapakah nilai turunan f\'(2)?',
      points: 25,
      expectedAnswer: '16',
      rubricCriteria: 'f\'(x) = 6x + 4. Maka f\'(2) = 6(2) + 4 = 16.'
    },
    {
      id: `q-${Date.now()}-4`,
      type: 'essay',
      prompt: 'Jelaskan konsep kekontinuan fungsi pada suatu titik c dan sebutkan 3 syarat formalnya!',
      points: 25,
      expectedAnswer: 'Fungsi f kontinu di c jika: 1) f(c) terdefinisi, 2) lim x->c f(x) ada, 3) lim x->c f(x) = f(c).',
      rubricCriteria: 'Kelengkapan 3 syarat formal limit dan kontinuitas.'
    }
  ]);

  // Student Quiz Taking State
  const [activeTakingQuiz, setActiveTakingQuiz] = useState<DirectQuiz | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: any }>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestResult, setLatestResult] = useState<any | null>(null);

  // Timer countdown
  useEffect(() => {
    if (!activeTakingQuiz || timeLeftSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTakingQuiz, timeLeftSeconds]);

  const handleStartQuiz = (quiz: DirectQuiz) => {
    setActiveTakingQuiz(quiz);
    setTimeLeftSeconds((quiz.durationMinutes || 20) * 60);
    setStudentAnswers({});
    setLatestResult(null);
  };

  const handleAutoSubmit = () => {
    showNotification({
      type: 'warning',
      title: 'Waktu Pengerjaan Habis',
      message: 'Kuis Anda otomatis dikumpulkan ke server.'
    });
    handleFinalSubmit();
  };

  const handleFinalSubmit = async () => {
    if (!activeTakingQuiz || !currentUser) return;
    setIsSubmitting(true);

    const answersPayload = activeTakingQuiz.questions.map(q => {
      const ans = studentAnswers[q.id];
      return {
        questionId: q.id,
        selectedOptionIndex: q.type === 'mcq' ? ans : undefined,
        selectedBoolean: q.type === 'true_false' ? ans : undefined,
        textAnswer: q.type === 'short' || q.type === 'numeric' || q.type === 'essay' ? ans : undefined
      };
    });

    const res = await submitQuiz(
      activeTakingQuiz.id,
      currentUser.id,
      currentUser.name,
      currentUser.kelasBimbingan || targetClass,
      answersPayload
    );

    setIsSubmitting(false);
    setActiveTakingQuiz(null);

    if (res.success && res.submission) {
      setLatestResult(res.submission);
      showNotification({
        type: 'success',
        title: 'Kuis Berhasil Dikumpulkan',
        message: `Skor awal Anda: ${res.submission.totalScore}/${res.submission.maxScore}.`
      });
    }
  };

  // Add Question in Teacher Quiz Modal
  const handleAddQuestion = () => {
    const newQ: DirectQuizQuestion = {
      id: `q-${Date.now()}-${questions.length + 1}`,
      type: 'mcq',
      prompt: 'Tuliskan pertanyaan baru di sini...',
      points: 20,
      options: ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
      correctOptionIndex: 0,
      expectedAnswer: 'Kunci jawaban dan alasan...'
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTitle.trim() || questions.length === 0) return;

    const res = await createQuiz({
      title: quizTitle.trim(),
      description: quizDesc.trim(),
      courseId,
      courseTitle,
      targetClass,
      durationMinutes,
      status,
      questions,
      teacherId: currentUser?.id || 'usr-guru-01',
      teacherName: currentUser?.name || 'Drs. Bambang Suryono'
    });

    if (res.success) {
      showNotification({
        type: 'success',
        title: 'Kuis Dibuat',
        message: `Kuis "${quizTitle}" dengan ${questions.length} soal berhasil disimpan.`
      });
      setIsCreateModalOpen(false);
      setQuizTitle('');
      setQuizDesc('');
    }
  };

  const handleOpenTeacherReview = (quiz: DirectQuiz) => {
    setReviewModalQuiz(quiz);
    const quizSubs = submissions.filter(s => s.quizId === quiz.id);
    if (quizSubs.length > 0) {
      handleSelectSubToReview(quiz, quizSubs[0]);
    } else {
      setSelectedSubToReview(null);
    }
  };

  const handleSelectSubToReview = (quiz: DirectQuiz, sub: any) => {
    setSelectedSubToReview(sub);
    setQuizTeacherFeedback(sub.teacherFeedback || '');
    const scores: Record<string, { score: number; teacherNotes: string }> = {};
    quiz.questions.forEach(q => {
      const ans = sub.answers.find((a: any) => a.questionId === q.id);
      scores[q.id] = {
        score: ans?.earnedPoints ?? 0,
        teacherNotes: ans?.teacherNotes || ''
      };
    });
    setQuizItemizedScores(scores);
  };

  const handleQuizItemScoreChange = (qId: string, maxPoints: number, val: number) => {
    const clamped = Math.max(0, Math.min(maxPoints, isNaN(val) ? 0 : val));
    setQuizItemizedScores(prev => ({
      ...prev,
      [qId]: {
        score: clamped,
        teacherNotes: prev[qId]?.teacherNotes || ''
      }
    }));
  };

  const handleQuizItemNotesChange = (qId: string, text: string) => {
    setQuizItemizedScores(prev => ({
      ...prev,
      [qId]: {
        score: prev[qId]?.score ?? 0,
        teacherNotes: text
      }
    }));
  };

  const handleSaveQuizReview = async () => {
    if (!reviewModalQuiz || !selectedSubToReview) return;
    setIsSavingReview(true);

    const res = await reviewQuizSubmission(
      reviewModalQuiz.id,
      selectedSubToReview.id,
      {
        itemizedScores: quizItemizedScores,
        teacherFeedback: quizTeacherFeedback.trim() || 'Nilai dan catatan evaluasi kuis telah disahkan oleh guru.',
        approvedBy: currentUser?.name || 'Drs. Bambang Suryono'
      }
    );

    setIsSavingReview(false);
    if (res.success) {
      showNotification({
        type: 'success',
        title: 'Nilai Kuis Berhasil Disimpan & Dirilis',
        message: `Nilai akhir siswa otomatis dikalkulasi ulang dan dikirimkan ke ikon lonceng siswa.`
      });
      if (res.submission) {
        setSelectedSubToReview(res.submission);
      }
    }
  };

  const handleToggleStatus = async (quiz: DirectQuiz) => {
    const newStatus = quiz.status === 'published' ? 'draft' : 'published';
    await updateQuiz(quiz.id, { status: newStatus });
    showNotification({
      type: 'info',
      title: 'Status Kuis Diperbarui',
      message: `Kuis "${quiz.title}" kini berstatus: ${newStatus === 'published' ? 'Dipublikasikan' : 'Draf'}.`
    });
  };

  const handleDelete = async (id: string, qTitle: string) => {
    if (!window.confirm(`Hapus kuis "${qTitle}"?`)) return;
    await deleteQuiz(id);
    showNotification({
      type: 'info',
      title: 'Kuis Dihapus',
      message: `Kuis "${qTitle}" telah dihapus.`
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Kuis & Asesmen Pembelajaran Interaktif ({relevantQuizzes.length} Aktivitas)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Latihan mandiri dan evaluasi berkala dengan penilaian otomatis untuk soal objektif dan pemeriksaan esai oleh guru
          </p>
        </div>

        {isTeacherOrAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Kuis Baru</span>
          </button>
        )}
      </div>

      {/* Latest Result Banner if student just completed a quiz */}
      {latestResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 uppercase">
                Hasil Pengerjaan Kuis
              </span>
              <h4 className="font-extrabold text-sm text-emerald-950 mt-0.5">
                Nilai Anda: {latestResult.totalScore} dari {latestResult.maxScore} Poin ({latestResult.percentage}%)
              </h4>
              <p className="text-xs text-emerald-800">
                Soal objektif telah dinilai otomatis. Nilai resmi akhir akan diverifikasi oleh guru pengampu.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLatestResult(null)}
            className="px-3 py-1.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-900 text-xs font-bold rounded-lg cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Active Quiz Taking Session (For Students) */}
      {activeTakingQuiz && (
        <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-xl p-6 space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase font-mono">
                Sesi Pengerjaan Kuis Aktif
              </span>
              <h3 className="font-extrabold text-base text-slate-900 mt-1">
                {activeTakingQuiz.title}
              </h3>
              <p className="text-xs text-slate-500">{activeTakingQuiz.description}</p>
            </div>

            {/* Countdown Clock */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold text-sm">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>
                {Math.floor(timeLeftSeconds / 60)}:{String(timeLeftSeconds % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {activeTakingQuiz.questions.map((q, idx) => (
              <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-blue-700">
                    Soal #{idx + 1} ({q.points} Poin)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase px-2 py-0.5 rounded bg-white border">
                    {q.type.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-900 leading-relaxed">{q.prompt}</p>

                {/* Question Type Controls */}
                {q.type === 'mcq' && q.options && (
                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, optIdx) => (
                      <label
                        key={optIdx}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                          studentAnswers[q.id] === optIdx
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={studentAnswers[q.id] === optIdx}
                          onChange={() => setStudentAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                          className="text-blue-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'true_false' && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStudentAnswers(prev => ({ ...prev, [q.id]: true }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        studentAnswers[q.id] === true
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Benar (True)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentAnswers(prev => ({ ...prev, [q.id]: false }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        studentAnswers[q.id] === false
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Salah (False)
                    </button>
                  </div>
                )}

                {(q.type === 'short' || q.type === 'numeric') && (
                  <input
                    type={q.type === 'numeric' ? 'number' : 'text'}
                    placeholder="Tuliskan jawaban singkat Anda di sini..."
                    value={studentAnswers[q.id] || ''}
                    onChange={(e) => setStudentAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                  />
                )}

                {q.type === 'essay' && (
                  <textarea
                    rows={3}
                    placeholder="Tuliskan penjelasan dan langkah-langkah pengerjaan esai Anda secara runtut..."
                    value={studentAnswers[q.id] || ''}
                    onChange={(e) => setStudentAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 bg-white leading-relaxed"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setActiveTakingQuiz(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Batalkan
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Mengumpulkan...' : 'Kumpulkan Jawaban Kuis'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Quiz List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {relevantQuizzes.map((q) => {
          const studentSub = submissions.find(s => s.quizId === q.id && s.studentId === currentUser?.id);

          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {q.questions.length} Butir Soal
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {q.durationMinutes} Menit
                      </span>
                      {isTeacherOrAdmin && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          q.status === 'published' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {q.status === 'published' ? 'Dipublikasikan' : 'Draf'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 mt-1.5">
                      {q.title}
                    </h4>
                  </div>

                  {isTeacherOrAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(q)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                        title={q.status === 'published' ? 'Ubah ke Draf' : 'Publikasikan'}
                      >
                        {q.status === 'published' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(q.id, q.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                        title="Hapus Kuis"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {q.description || 'Kuis pemahaman konsep terpadu.'}
                </p>
              </div>

              {/* Footer action */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                {studentSub ? (
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sudah Dikerjakan: {studentSub.totalScore}/{studentSub.maxScore}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 font-mono text-[11px]">
                    Oleh: {q.teacherName}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {/* Teacher Review Button */}
                  {isTeacherOrAdmin && (
                    <button
                      onClick={() => handleOpenTeacherReview(q)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold flex items-center gap-1 border border-blue-200 transition cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Review Nilai Siswa ({submissions.filter(s => s.quizId === q.id).length})</span>
                    </button>
                  )}

                  {/* Student Graded Review Button */}
                  {currentUser?.role === 'siswa' && studentSub && (
                    <button
                      onClick={() => {
                        setStudentViewQuiz(q);
                        setStudentViewReviewSub(studentSub);
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold flex items-center gap-1 border border-emerald-200 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Koreksi Guru</span>
                    </button>
                  )}

                  {/* Student Start/Retake Quiz */}
                  {currentUser?.role === 'siswa' && !activeTakingQuiz && (
                    <button
                      onClick={() => handleStartQuiz(q)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{studentSub ? 'Kerjakan Ulang' : 'Mulai Kuis'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Teacher Create Quiz Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Rancang Kuis Pembelajaran Baru</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuiz} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Kuis *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kuis Formatif 1: Konsep Limit Aljabar"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durasi Pengerjaan (Menit)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Publikasi</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50"
                  >
                    <option value="published">Publikasikan Langsung ke Siswa</option>
                    <option value="draft">Simpan Draf</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi & Petunjuk</label>
                <textarea
                  rows={2}
                  placeholder="Petunjuk pengerjaan dan materi prasyarat..."
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-slate-50"
                />
              </div>

              {/* Questions List Editor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-slate-800">Daftar Pertanyaan ({questions.length} Butir)</h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Soal
                  </button>
                </div>

                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-700">Soal #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, prompt: val } : item));
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      placeholder="Pertanyaan..."
                    />

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="block font-semibold text-slate-600">Tipe Pertanyaan</label>
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const val = e.target.value as DirectQuestionType;
                            setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, type: val } : item));
                          }}

                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        >
                          <option value="mcq">Pilihan Ganda (MCQ)</option>
                          <option value="true_false">Benar / Salah</option>
                          <option value="short">Jawaban Singkat</option>
                          <option value="numeric">Numerik</option>
                          <option value="essay">Esai</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600">Bobot Poin</label>
                        <input
                          type="number"
                          value={q.points}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, points: val } : item));
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>

                    {/* Answer Key & Rubric Configuration (Teacher Input) */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">
                        Kunci Jawaban Resmi & Kriteria Penilaian:
                      </span>

                      {/* MCQ Options and Correct Key */}
                      {q.type === 'mcq' && (
                        <div className="space-y-1.5 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Pilihan Opsi & Kunci Jawaban (Pilih radio untuk menandai kunci benar):
                          </label>
                          {(q.options || ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D']).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctOptionIndex === optIdx}
                                onChange={() => {
                                  setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, correctOptionIndex: optIdx } : item));
                                }}
                                className="text-blue-600"
                                title="Jadikan Kunci Benar"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuestions(prev => prev.map(item => {
                                    if (item.id !== q.id) return item;
                                    const nextOpts = [...(item.options || ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'])];
                                    nextOpts[optIdx] = val;
                                    return { ...item, options: nextOpts };
                                  }));
                                }}
                                placeholder={`Opsi ${String.fromCharCode(65 + optIdx)}`}
                                className={`flex-1 px-2 py-1 text-xs border rounded bg-white ${
                                  q.correctOptionIndex === optIdx ? 'border-blue-500 font-bold text-blue-900 bg-blue-50/30' : 'border-slate-300'
                                }`}
                              />
                              {q.correctOptionIndex === optIdx && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                  KUNCI
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* True / False Correct Key */}
                      {q.type === 'true_false' && (
                        <div className="flex items-center gap-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                          <span className="text-[11px] font-semibold text-slate-700">Kunci Benar:</span>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer font-bold text-emerald-800">
                            <input
                              type="radio"
                              name={`tf-${q.id}`}
                              checked={q.correctBoolean === true}
                              onChange={() => {
                                setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, correctBoolean: true } : item));
                              }}
                            />
                            <span>Benar (True)</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer font-bold text-rose-800">
                            <input
                              type="radio"
                              name={`tf-${q.id}`}
                              checked={q.correctBoolean === false}
                              onChange={() => {
                                setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, correctBoolean: false } : item));
                              }}
                            />
                            <span>Salah (False)</span>
                          </label>
                        </div>
                      )}

                      {/* Short / Numeric Answer Key */}
                      {(q.type === 'short' || q.type === 'numeric') && (
                        <div className="space-y-1 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Kunci Jawaban Eksak / Nilai Benar:
                          </label>
                          <input
                            type="text"
                            value={q.expectedAnswer || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, expectedAnswer: val } : item));
                            }}
                            placeholder="Contoh: 16 atau Teorema Nilai Antara"
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
                          />
                        </div>
                      )}

                      {/* Essay Rubric & Expected Concepts */}
                      {q.type === 'essay' && (
                        <div className="space-y-1 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Kunci Jawaban Esai & Pedoman Rubrik AI:
                          </label>
                          <textarea
                            rows={2}
                            value={q.expectedAnswer || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, expectedAnswer: val } : item));
                            }}
                            placeholder="Penjelasan runtut konsep, teorema, atau penurunan rumus yang diharapkan..."
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Simpan Kuis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Quiz Review & Scoring Override Modal */}
      {reviewModalQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">
                  Panel Review & Override Nilai Guru
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  {reviewModalQuiz.title}
                </h3>
              </div>
              <button
                onClick={() => setReviewModalQuiz(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submissions List & Active Student Sheet */}
            {(() => {
              const quizSubs = submissions.filter(s => s.quizId === reviewModalQuiz.id);
              if (quizSubs.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada siswa yang mengumpulkan pengerjaan kuis ini.
                  </div>
                );
              }

              // Dynamic recalculation of total score based on teacher itemized scores
              let currentTotalSum = 0;
              let totalMaxPoints = 0;
              reviewModalQuiz.questions.forEach(q => {
                totalMaxPoints += q.points;
                const scoreItem = quizItemizedScores[q.id];
                if (scoreItem !== undefined) {
                  currentTotalSum += scoreItem.score;
                } else {
                  const ans = selectedSubToReview?.answers?.find((a: any) => a.questionId === q.id);
                  currentTotalSum += (ans?.earnedPoints ?? 0);
                }
              });
              const recalculatedPercent = totalMaxPoints > 0 ? Math.round((currentTotalSum / totalMaxPoints) * 100) : currentTotalSum;

              return (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Students list */}
                  <div className="md:col-span-4 space-y-2 border-r border-slate-100 pr-3">
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      Daftar Pengerjaan ({quizSubs.length} Siswa)
                    </h4>
                    <div className="space-y-1.5">
                      {quizSubs.map(sub => {
                        const isSelected = sub.id === selectedSubToReview?.id;
                        return (
                          <div
                            key={sub.id}
                            onClick={() => handleSelectSubToReview(reviewModalQuiz, sub)}
                            className={`p-3 rounded-xl border cursor-pointer transition ${
                              isSelected
                                ? 'bg-blue-50 border-blue-500 font-bold text-blue-900 shadow-xs'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{sub.studentName}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border font-mono">
                                {sub.totalScore}/100
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {sub.submittedAt}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active student review & per-question score inputs */}
                  {selectedSubToReview ? (
                    <div className="md:col-span-8 space-y-4">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">{selectedSubToReview.studentName}</div>
                          <div className="text-[11px] text-slate-500">{selectedSubToReview.studentClass} • {selectedSubToReview.submittedAt}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Nilai Otomatis:</span>
                          <span className="text-xl font-extrabold text-blue-700">
                            {recalculatedPercent} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                          </span>
                        </div>
                      </div>

                      {/* Questions Breakdown */}
                      <div className="space-y-3">
                        {reviewModalQuiz.questions.map((q, idx) => {
                          const ans = selectedSubToReview.answers.find((a: any) => a.questionId === q.id);
                          const curItem = quizItemizedScores[q.id] || {
                            score: ans?.earnedPoints ?? 0,
                            teacherNotes: ans?.teacherNotes || ''
                          };

                          return (
                            <div key={q.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span className="font-bold text-slate-900">
                                  Soal #{idx + 1} ({q.points} Poin) - <span className="uppercase text-[10px] text-slate-500">{q.type}</span>
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Skor Butir: {curItem.score}/{q.points}
                                </span>
                              </div>

                              <p className="text-xs text-slate-800 font-medium">{q.prompt}</p>

                              {/* Student Answer */}
                              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Jawaban Siswa:</div>
                                {q.type === 'mcq' && (
                                  <div className="font-bold text-slate-800 mt-0.5">
                                    {q.options?.[ans?.selectedOptionIndex ?? 0] || 'Tidak menjawab'}
                                  </div>
                                )}
                                {q.type === 'true_false' && (
                                  <div className="font-bold text-slate-800 mt-0.5">
                                    {ans?.selectedBoolean === true ? 'Benar (True)' : ans?.selectedBoolean === false ? 'Salah (False)' : 'Tidak menjawab'}
                                  </div>
                                )}
                                {(q.type === 'short' || q.type === 'numeric' || q.type === 'essay') && (
                                  <div className="font-mono text-slate-800 mt-0.5 whitespace-pre-wrap">
                                    {ans?.textAnswer || '(Kosong)'}
                                  </div>
                                )}
                              </div>

                              {/* Teacher Per-Question Override Inputs */}
                              <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                                    <Sliders className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Override Nilai & Catatan Guru (Butir #{idx + 1}):</span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <div className="sm:col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Skor (Maks {q.points}):</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={q.points}
                                      value={curItem.score}
                                      onChange={(e) => handleQuizItemScoreChange(q.id, q.points, Number(e.target.value))}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-sm font-extrabold text-blue-700"
                                    />
                                  </div>
                                  <div className="sm:col-span-3">
                                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Catatan Koreksi:</label>
                                    <input
                                      type="text"
                                      value={curItem.teacherNotes}
                                      onChange={(e) => handleQuizItemNotesChange(q.id, e.target.value)}
                                      placeholder="Catatan koreksi untuk siswa..."
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Overall feedback & submit */}
                      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                        <div>
                          <label className="block font-bold text-xs text-slate-800 mb-1">
                            Catatan Ulasan Keseluruhan Guru:
                          </label>
                          <textarea
                            rows={2}
                            value={quizTeacherFeedback}
                            onChange={(e) => setQuizTeacherFeedback(e.target.value)}
                            placeholder="Catatan apresiasi dan rekomendasi belajar untuk siswa..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-emerald-800">
                            Total Rekalkulasi: {recalculatedPercent} / 100 Poin
                          </span>
                          <button
                            onClick={handleSaveQuizReview}
                            disabled={isSavingReview}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Award className="w-4 h-4" />
                            <span>{isSavingReview ? 'Menyimpan...' : `Simpan & Rilis Nilai (${recalculatedPercent})`}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Student Graded Quiz Review Modal */}
      {studentViewReviewSub && studentViewQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  Lembar Hasil & Koreksi Guru
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  {studentViewQuiz.title}
                </h3>
              </div>
              <button
                onClick={() => setStudentViewReviewSub(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score header */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">Nilai Resmi Akhir:</span>
                <div className="text-2xl font-extrabold text-emerald-700">
                  {studentViewReviewSub.totalScore} <span className="text-xs font-normal text-emerald-600">/ 100 Poin</span>
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5">Dikumpulkan: {studentViewReviewSub.submittedAt}</div>
              </div>
              {studentViewReviewSub.teacherFeedback && (
                <div className="max-w-xs text-right text-xs text-slate-700">
                  <div className="font-bold text-slate-900">Ulasan Guru:</div>
                  <p className="italic text-slate-600 mt-0.5">"{studentViewReviewSub.teacherFeedback}"</p>
                </div>
              )}
            </div>

            {/* Itemized questions review */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Rincian Butir Soal:</h4>
              {studentViewQuiz.questions.map((q, idx) => {
                const ans = studentViewReviewSub.answers.find((a: any) => a.questionId === q.id);

                return (
                  <div key={q.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Soal #{idx + 1}</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Skor: {ans?.earnedPoints ?? 0} / {q.points} Poin
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">{q.prompt}</p>

                    {/* Answer */}
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Jawaban Anda:</div>
                      {q.type === 'mcq' && <div className="font-bold text-slate-800">{q.options?.[ans?.selectedOptionIndex ?? 0] || 'Tidak menjawab'}</div>}
                      {q.type === 'true_false' && <div className="font-bold text-slate-800">{ans?.selectedBoolean === true ? 'Benar (True)' : 'Salah (False)'}</div>}
                      {(q.type === 'short' || q.type === 'numeric' || q.type === 'essay') && (
                        <div className="font-mono text-slate-800 whitespace-pre-wrap">{ans?.textAnswer || '(Kosong)'}</div>
                      )}
                    </div>

                    {ans?.teacherNotes && (
                      <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                        <strong>Catatan Koreksi Guru:</strong> {ans.teacherNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setStudentViewReviewSub(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
