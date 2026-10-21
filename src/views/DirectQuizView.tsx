import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuiz } from '../context/QuizContext';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { DirectQuiz, DirectQuizQuestion, DirectQuestionType, DirectQuizSubmission } from '../types';
import { 
  FileCheck2, 
  Plus, 
  Clock, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Play, 
  Award, 
  Send,
  HelpCircle,
  Users,
  Check,
  ChevronRight
} from 'lucide-react';

interface DirectQuizViewProps {
  onNavigate: (view: string, param?: string) => void;
}

export const DirectQuizView: React.FC<DirectQuizViewProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { quizzes, submissions, createQuiz, updateQuiz, deleteQuiz, submitQuiz } = useQuiz();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const isTeacherOrAdmin = currentUser?.role === 'guru' || currentUser?.role === 'admin';

  // Mode: 'list' | 'taking' | 'creating' | 'result'
  const [mode, setMode] = useState<'list' | 'taking' | 'creating' | 'result'>('list');
  const [activeQuiz, setActiveQuiz] = useState<DirectQuiz | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<DirectQuizSubmission | null>(null);

  // Student Taking State
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: any }>({});
  const [quizTimeLeft, setQuizTimeLeft] = useState<number>(30 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quiz Builder State (Teacher)
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderClass, setBuilderClass] = useState('12-MIPA-1');
  const [builderDuration, setBuilderDuration] = useState(25);
  const [builderStatus, setBuilderStatus] = useState<'draft' | 'published'>('published');
  const [builderQuestions, setBuilderQuestions] = useState<DirectQuizQuestion[]>([
    {
      id: `q-init-1`,
      type: 'mcq',
      prompt: 'Berapakah turunan dari fungsi f(x) = 5x³ - 4x + 9?',
      points: 25,
      options: ['15x² - 4', '15x² + 4', '5x² - 4', '15x - 4'],
      correctOptionIndex: 0
    },
    {
      id: `q-init-2`,
      type: 'true_false',
      prompt: 'Turunan dari fungsi konstan f(x) = 100 selalu bernilai 0.',
      points: 25,
      correctBoolean: true
    }
  ]);

  // Question Form State (Inside Builder)
  const [qPrompt, setQPrompt] = useState('');
  const [qType, setQType] = useState<DirectQuestionType>('mcq');
  const [qPoints, setQPoints] = useState(25);
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qCorrectBool, setQCorrectBool] = useState(true);
  const [qExpectedAnswer, setQExpectedAnswer] = useState('');
  const [qRubric, setQRubric] = useState('');

  // Start taking a quiz (Student)
  const handleStartQuiz = (quiz: DirectQuiz) => {
    setActiveQuiz(quiz);
    setStudentAnswers({});
    setQuizTimeLeft(quiz.durationMinutes * 60);
    setMode('taking');
  };

  // Submit quiz answers (Student)
  const handleFinishAttempt = async () => {
    if (!activeQuiz) return;
    setIsSubmitting(true);

    const answersArray = activeQuiz.questions.map(q => {
      const val = studentAnswers[q.id];
      return {
        questionId: q.id,
        selectedOptionIndex: q.type === 'mcq' ? val?.selectedOptionIndex : undefined,
        selectedBoolean: q.type === 'true_false' ? val?.selectedBoolean : undefined,
        textAnswer: q.type === 'short' || q.type === 'essay' ? val?.textAnswer : undefined,
        numericAnswer: q.type === 'numeric' ? Number(val?.textAnswer) : undefined
      };
    });

    const res = await submitQuiz(
      activeQuiz.id,
      currentUser?.id || 'usr-siswa-01',
      currentUser?.name || 'Arya Pratama',
      currentUser?.kelasBimbingan || activeQuiz.targetClass,
      answersArray
    );

    setIsSubmitting(false);
    if (res.success && res.submission) {
      setActiveSubmission(res.submission);
      setMode('result');
      showNotification({
        type: 'success',
        title: 'Kuis Berhasil Dikumpulkan',
        message: `Pengerjaan kuis selesai. Skor sementara: ${res.submission.totalScore}/100.`
      });
    }
  };

  // Add question into builder (Teacher)
  const handleAddQuestionToBuilder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qPrompt.trim()) return;

    const newQ: DirectQuizQuestion = {
      id: `q-bld-${Date.now()}`,
      type: qType,
      prompt: qPrompt.trim(),
      points: Number(qPoints) || 20,
      options: qType === 'mcq' ? [qOptA || 'Opsi A', qOptB || 'Opsi B', qOptC || 'Opsi C', qOptD || 'Opsi D'] : undefined,
      correctOptionIndex: qType === 'mcq' ? qCorrectIdx : undefined,
      correctBoolean: qType === 'true_false' ? qCorrectBool : undefined,
      expectedAnswer: qType === 'short' || qType === 'numeric' || qType === 'essay' ? qExpectedAnswer : undefined,
      rubricCriteria: qType === 'essay' ? qRubric : undefined
    };

    setBuilderQuestions(prev => [...prev, newQ]);
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQExpectedAnswer('');
    setQRubric('');
    showNotification({
      type: 'info',
      title: 'Soal Ditambahkan',
      message: `Soal #${builderQuestions.length + 1} (${qType.toUpperCase()}) telah dimasukkan ke daftar kuis.`
    });
  };

  const handleSaveQuiz = async () => {
    if (!builderTitle.trim()) {
      showNotification({
        type: 'warning',
        title: 'Judul Kuis Kosong',
        message: 'Mohon tuliskan judul kuis sebelum menyimpan.'
      });
      return;
    }
    if (builderQuestions.length === 0) {
      showNotification({
        type: 'warning',
        title: 'Daftar Soal Kosong',
        message: 'Minimal tambahkan 1 pertanyaan ke dalam kuis.'
      });
      return;
    }

    const res = await createQuiz({
      title: builderTitle.trim(),
      description: builderDesc.trim(),
      courseId: 'crs-mat-12',
      courseTitle: 'Matematika Peminatan Kelas XII',
      targetClass: builderClass,
      durationMinutes: builderDuration,
      status: builderStatus,
      questions: builderQuestions,
      teacherId: currentUser?.id || 'usr-guru-01',
      teacherName: currentUser?.name || 'Drs. Bambang Suryono, M.Pd'
    });

    if (res.success) {
      showNotification({
        type: 'success',
        title: 'Kuis Berhasil Diterbitkan',
        message: `Kuis "${builderTitle}" dengan ${builderQuestions.length} butir soal telah aktif.`
      });
      setMode('list');
    }
  };

  const minutes = Math.floor(quizTimeLeft / 60);
  const seconds = quizTimeLeft % 60;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-6 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-blue-600 transition cursor-pointer">
            Beranda
          </button>
          <span>/</span>
          <span className="text-slate-800 font-bold">Kuis Interaktif Langsung & Bank Soal</span>
        </div>

        {/* ===================== MODE 1: LIST QUIZZES ===================== */}
        {mode === 'list' && (
          <div className="space-y-6">
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                      Moodle Direct Quiz Engine
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Penilaian Otomatis & Rubrik Guru
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                    Kuis & Uji Kompetensi Langsung
                  </h1>
                </div>
              </div>

              {isTeacherOrAdmin && (
                <button
                  onClick={() => {
                    setBuilderTitle('Kuis Topik Baru: ');
                    setBuilderDesc('');
                    setBuilderQuestions([]);
                    setMode('creating');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Kuis Baru (Authoring Tool)</span>
                </button>
              )}
            </div>

            {/* Quizzes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => {
                const mySubmissions = submissions.filter(s => s.quizId === quiz.id && s.studentId === currentUser?.id);
                const hasCompleted = mySubmissions.length > 0;
                const latestSub = mySubmissions[0];

                return (
                  <div
                    key={quiz.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {quiz.targetClass}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1 font-semibold">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{quiz.durationMinutes} Menit</span>
                          </span>
                          <span>•</span>
                          <span>{quiz.questions.length} Butir Soal</span>
                        </div>
                      </div>

                      <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {quiz.description || 'Kuis pemahaman konsep terpadu.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      {currentUser?.role === 'siswa' ? (
                        hasCompleted ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Selesai (Nilai: {latestSub.totalScore}/100)</span>
                            </span>
                            <button
                              onClick={() => {
                                setActiveSubmission(latestSub);
                                setActiveQuiz(quiz);
                                setMode('result');
                              }}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                            >
                              Lihat Hasil
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartQuiz(quiz)}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Mulai Kerjakan Kuis</span>
                          </button>
                        )
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-slate-500">
                            Pengampu: {quiz.teacherName.split(',')[0]}
                          </span>
                          <button
                            onClick={() => handleStartQuiz(quiz)}
                            className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs cursor-pointer"
                          >
                            Uji Pratinjau
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ===================== MODE 2: TAKING QUIZ (STUDENT) ===================== */}
        {mode === 'taking' && activeQuiz && (
          <div className="space-y-6">
            
            {/* Sticky Header with Timer */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between sticky top-4 z-40">
              <div>
                <h2 className="font-extrabold text-sm text-slate-900">{activeQuiz.title}</h2>
                <p className="text-[11px] text-slate-500">{activeQuiz.questions.length} Butir Soal • {activeQuiz.targetClass}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sisa: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
                </div>
                <button
                  onClick={handleFinishAttempt}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Mengirim...' : 'Kumpulkan Kuis'}</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-5">
              {activeQuiz.questions.map((q, idx) => {
                const ans = studentAnswers[q.id];

                return (
                  <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        Soal #{idx + 1} ({q.type.toUpperCase()})
                      </span>
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Bobot: {q.points} Poin
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                      {q.prompt}
                    </p>

                    {/* MCQ Type */}
                    {q.type === 'mcq' && q.options && (
                      <div className="space-y-2 pt-1">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = ans?.selectedOptionIndex === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-300 font-bold text-blue-950' 
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={isSelected}
                                onChange={() => {
                                  setStudentAnswers(prev => ({
                                    ...prev,
                                    [q.id]: { selectedOptionIndex: optIdx }
                                  }));
                                }}
                                className="text-blue-600"
                              />
                              <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* True / False Type */}
                    {q.type === 'true_false' && (
                      <div className="flex items-center gap-4 pt-1">
                        {[
                          { label: 'Benar / True', val: true },
                          { label: 'Salah / False', val: false }
                        ].map((b, bIdx) => {
                          const isSelected = ans?.selectedBoolean === b.val;
                          return (
                            <label
                              key={bIdx}
                              className={`flex-1 p-3 rounded-xl border text-xs font-bold text-center cursor-pointer transition ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-300 text-blue-900' 
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={isSelected}
                                onChange={() => {
                                  setStudentAnswers(prev => ({
                                    ...prev,
                                    [q.id]: { selectedBoolean: b.val }
                                  }));
                                }}
                                className="hidden"
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Numeric or Short Answer */}
                    {(q.type === 'numeric' || q.type === 'short') && (
                      <div className="pt-1">
                        <input
                          type={q.type === 'numeric' ? 'number' : 'text'}
                          value={ans?.textAnswer || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStudentAnswers(prev => ({
                              ...prev,
                              [q.id]: { textAnswer: val }
                            }));
                          }}
                          placeholder={q.type === 'numeric' ? 'Ketik angka jawaban...' : 'Ketik jawaban singkat...'}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    )}

                    {/* Essay */}
                    {q.type === 'essay' && (
                      <div className="pt-1">
                        <textarea
                          value={ans?.textAnswer || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStudentAnswers(prev => ({
                              ...prev,
                              [q.id]: { textAnswer: val }
                            }));
                          }}
                          rows={4}
                          placeholder="Jabarkan penjelasan dan langkah pengerjaanmu di sini..."
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600 leading-relaxed"
                        />
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal & Keluar
              </button>
              <button
                type="button"
                onClick={handleFinishAttempt}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Kumpulkan & Lihat Hasil</span>
              </button>
            </div>

          </div>
        )}

        {/* ===================== MODE 3: RESULT SUMMARY ===================== */}
        {mode === 'result' && activeSubmission && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-2xl shadow-xs">
                <Award className="w-9 h-9" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">Hasil Pengerjaan Kuis Siswa</h2>
              <p className="text-xs text-slate-500">{activeSubmission.quizTitle} • {activeSubmission.submittedAt}</p>
              
              <div className="inline-block p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Skor Diperoleh</span>
                <div className="text-4xl font-extrabold text-emerald-700 mt-0.5">
                  {activeSubmission.totalScore}<span className="text-base text-emerald-600 font-normal">/100</span>
                </div>
              </div>
            </div>

            {activeSubmission.teacherFeedback && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="font-bold">Catatan Pendidik:</div>
                <p>{activeSubmission.teacherFeedback}</p>
              </div>
            )}

            {/* Answer Review list */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Ulasan Jawaban per Soal:</h3>
              {activeSubmission.answers.map((a, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Nomor #{i + 1}</span>
                    <span className="font-bold text-emerald-700">Poin: +{a.earnedPoints}</span>
                  </div>
                  {a.textAnswer && <p className="text-slate-600 italic">"Jawaban: {a.textAnswer}"</p>}
                  {a.selectedOptionIndex !== undefined && <p className="text-slate-600">Pilihan: Opsi {String.fromCharCode(65 + a.selectedOptionIndex)}</p>}
                  {a.selectedBoolean !== undefined && <p className="text-slate-600">Pilihan: {a.selectedBoolean ? 'Benar' : 'Salah'}</p>}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setMode('list')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Kembali ke Daftar Kuis
              </button>
            </div>
          </div>
        )}

        {/* ===================== MODE 4: CREATING QUIZ (TEACHER) ===================== */}
        {mode === 'creating' && (
          <div className="space-y-6">
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Perancang Kuis Baru (Quiz Authoring Tool)</h2>
                <p className="text-xs text-slate-500">Buat pertanyaan pilihan ganda, benar/salah, isian, numerik, dan esai secara mandiri.</p>
              </div>
              <button
                onClick={() => setMode('list')}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Kembali
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Form 1: General Quiz Meta (4 cols) */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                  1. Pengaturan Kuis
                </h3>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul Kuis:</label>
                  <input
                    type="text"
                    value={builderTitle}
                    onChange={(e) => setBuilderTitle(e.target.value)}
                    placeholder="Contoh: Kuis Harian Bab 2 Turunan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deskripsi & Petunjuk:</label>
                  <textarea
                    value={builderDesc}
                    onChange={(e) => setBuilderDesc(e.target.value)}
                    rows={2}
                    placeholder="Petunjuk pengerjaan bagi siswa..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kelas:</label>
                    <select
                      value={builderClass}
                      onChange={(e) => setBuilderClass(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="12-MIPA-1">12-MIPA-1</option>
                      <option value="12-MIPA-2">12-MIPA-2</option>
                      <option value="12-IPS-1">12-IPS-1</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Durasi (Menit):</label>
                    <input
                      type="number"
                      value={builderDuration}
                      onChange={(e) => setBuilderDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <span className="block font-bold text-slate-700 mb-1">Total Soal Dirancang:</span>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-bold text-center">
                    {builderQuestions.length} Butir Soal Terdaftar
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveQuiz}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Simpan & Terbitkan Kuis
                </button>
              </div>

              {/* Form 2: Question Builder & List (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Add Question Box */}
                <form onSubmit={handleAddQuestionToBuilder} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    2. Tambah Butir Soal
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">Tipe Soal:</label>
                      <select
                        value={qType}
                        onChange={(e) => setQType(e.target.value as DirectQuestionType)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 cursor-pointer"
                      >
                        <option value="mcq">Pilihan Ganda (MCQ)</option>
                        <option value="true_false">Benar / Salah (True / False)</option>
                        <option value="short">Jawaban Singkat</option>
                        <option value="numeric">Jawaban Numerik</option>
                        <option value="essay">Uraian / Esai Panjang</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Bobot Poin:</label>
                      <input
                        type="number"
                        value={qPoints}
                        onChange={(e) => setQPoints(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Teks Pertanyaan / Soal:</label>
                    <textarea
                      value={qPrompt}
                      onChange={(e) => setQPrompt(e.target.value)}
                      rows={2}
                      placeholder="Tuliskan soal secara runtut..."
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* MCQ Options input */}
                  {qType === 'mcq' && (
                    <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-700 block">Pilihan Jawaban (Tandai yang Benar):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correct" checked={qCorrectIdx === 0} onChange={() => setQCorrectIdx(0)} />
                          <input type="text" placeholder="Opsi A" value={qOptA} onChange={(e) => setQOptA(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correct" checked={qCorrectIdx === 1} onChange={() => setQCorrectIdx(1)} />
                          <input type="text" placeholder="Opsi B" value={qOptB} onChange={(e) => setQOptB(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correct" checked={qCorrectIdx === 2} onChange={() => setQCorrectIdx(2)} />
                          <input type="text" placeholder="Opsi C" value={qOptC} onChange={(e) => setQOptC(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correct" checked={qCorrectIdx === 3} onChange={() => setQCorrectIdx(3)} />
                          <input type="text" placeholder="Opsi D" value={qOptD} onChange={(e) => setQOptD(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* True / False input */}
                  {qType === 'true_false' && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4">
                      <span className="font-bold text-slate-700">Kunci Jawaban yang Benar:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="tf" checked={qCorrectBool === true} onChange={() => setQCorrectBool(true)} />
                        <span>Benar (True)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="tf" checked={qCorrectBool === false} onChange={() => setQCorrectBool(false)} />
                        <span>Salah (False)</span>
                      </label>
                    </div>
                  )}

                  {/* Numeric / Short / Essay key */}
                  {(qType === 'short' || qType === 'numeric' || qType === 'essay') && (
                    <div className="space-y-2">
                      <label className="block font-bold text-slate-700">Kunci Jawaban Rujukan:</label>
                      <input
                        type={qType === 'numeric' ? 'number' : 'text'}
                        value={qExpectedAnswer}
                        onChange={(e) => setQExpectedAnswer(e.target.value)}
                        placeholder="Kunci jawaban acuan penilaian..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambahkan Butir Soal Ini</span>
                    </button>
                  </div>
                </form>

                {/* Question List Preview */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                    Daftar Pertanyaan Terdaftar ({builderQuestions.length})
                  </h4>

                  {builderQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">#{idx + 1}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                            {q.type}
                          </span>
                          <span className="text-slate-400 font-bold">{q.points} Poin</span>
                        </div>
                        <p className="text-slate-700">{q.prompt}</p>
                      </div>

                      <button
                        onClick={() => setBuilderQuestions(prev => prev.filter(x => x.id !== q.id))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
