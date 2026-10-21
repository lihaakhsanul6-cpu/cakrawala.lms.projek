import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useGoogleWorkspace } from '../context/GoogleWorkspaceContext';
import { Submission, StudentAnswer } from '../types';
import { 
  CheckCircle2, 
  ShieldAlert, 
  Cpu, 
  UserCheck, 
  Clock, 
  ArrowLeft, 
  Eye, 
  Sparkles, 
  FileText, 
  Camera, 
  AlertTriangle, 
  Award,
  Send,
  X,
  Sliders,
  Settings,
  Brain,
  FolderSync,
  Folder,
  Check
} from 'lucide-react';

interface TeacherReviewViewProps {
  onNavigate: (view: string, param?: string) => void;
}

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { submissions, reviewSubmission, assignments } = useExam();
  const { isGoogleConnected, autoSyncEnabled, dedicatedFolder } = useGoogleWorkspace();

  const [selectedSubId, setSelectedSubId] = useState<string | null>(
    submissions.length > 0 ? submissions[0].id : null
  );

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const activeSub = submissions.find(s => s.id === selectedSubId);
  const activeAssignment = assignments.find(a => a.id === activeSub?.assignmentId);

  const [finalScoreInput, setFinalScoreInput] = useState<number>(
    activeSub?.totalTeacherScore ?? activeSub?.totalAiScore ?? 85
  );
  const [feedbackInput, setFeedbackInput] = useState<string>(
    activeSub?.teacherOverallFeedback || ''
  );
  const [itemizedScores, setItemizedScores] = useState<Record<string, { score: number; feedback: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initialize or re-sync itemized scores when activeSub changes
  React.useEffect(() => {
    if (!activeSub || !activeAssignment) return;
    const initialScores: Record<string, { score: number; feedback: string }> = {};
    activeAssignment.questions.forEach(q => {
      const ans = activeSub.answers.find(a => a.questionId === q.id);
      initialScores[q.id] = {
        score: ans?.teacherScore ?? ans?.aiScore ?? 0,
        feedback: ans?.teacherFeedback ?? ''
      };
    });
    setItemizedScores(initialScores);
    setFinalScoreInput(activeSub.totalTeacherScore ?? activeSub.totalAiScore ?? 85);
    setFeedbackInput(activeSub.teacherOverallFeedback || '');
  }, [activeSub?.id]);

  const handleSelectSubmission = (sub: Submission) => {
    setSelectedSubId(sub.id);
    setSuccessNotice(null);
  };

  const handleItemScoreChange = (qId: string, maxPoints: number, val: number) => {
    const clamped = Math.max(0, Math.min(maxPoints, isNaN(val) ? 0 : val));
    setItemizedScores(prev => {
      const next = {
        ...prev,
        [qId]: {
          score: clamped,
          feedback: prev[qId]?.feedback || ''
        }
      };

      // Recalculate total score dynamically
      const totalPoints = Object.values(next).reduce((sum, item) => sum + (Number(item.score) || 0), 0);
      setFinalScoreInput(totalPoints);
      return next;
    });
  };

  const handleItemFeedbackChange = (qId: string, text: string) => {
    setItemizedScores(prev => ({
      ...prev,
      [qId]: {
        score: prev[qId]?.score ?? 0,
        feedback: text
      }
    }));
  };

  const handleApproveAiScore = async () => {
    if (!activeSub) return;
    setIsSaving(true);
    setSuccessNotice(null);

    await reviewSubmission(activeSub.id, {
      finalScore: activeSub.totalAiScore,
      teacherFeedback: feedbackInput.trim() || 'Hasil evaluasi dan rekomendasi AI Gemini telah disetujui resmi oleh guru.',
      approvedBy: currentUser?.name || 'Drs. Bambang Suryono, M.Pd'
    });

    setIsSaving(false);
    setSuccessNotice('Rekomendasi AI Gemini berhasil disetujui & dipublikasikan ke siswa!');
  };

  const handleSaveManualOverride = async () => {
    if (!activeSub) return;
    setIsSaving(true);
    setSuccessNotice(null);

    await reviewSubmission(activeSub.id, {
      finalScore: Number(finalScoreInput),
      teacherFeedback: feedbackInput.trim() || 'Nilai resmi telah disesuaikan dan difinalisasi oleh guru pengampu.',
      approvedBy: currentUser?.name || 'Drs. Bambang Suryono, M.Pd',
      itemizedScores
    });

    setIsSaving(false);
    setSuccessNotice('Nilai per-soal dan nilai akhir berhasil difinalisasi & dirilis ke siswa!');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-6 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* Moodle Classic Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-blue-600 transition cursor-pointer">
            Beranda
          </button>
          <span>/</span>
          <span className="text-slate-800 font-bold">Penilaian & Review AI (Grader Report)</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Moodle Grader Gate
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Gemini AI Evaluator
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Portal Review Koreksi AI & Validasi Nilai Guru
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs">
            <FolderSync className="w-4 h-4 text-indigo-600" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Penyimpanan Cloud GDrive</div>
              <div className="font-extrabold text-slate-800 flex items-center gap-1">
                <span>{isGoogleConnected && autoSyncEnabled ? 'Auto-Sync Aktif' : 'Tersinkron Lokal'}</span>
                {isGoogleConnected && autoSyncEnabled && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
            </div>
          </div>
        </div>

        {successNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* 2-Column Review Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Submissions List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider px-1">
              Hasil Pengerjaan Siswa ({submissions.length})
            </h3>

            <div className="space-y-2">
              {submissions.map((sub) => {
                const isSelected = sub.id === selectedSubId;
                const isApproved = sub.status === 'published';

                return (
                  <div
                    key={sub.id}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-4 rounded-xl border transition cursor-pointer space-y-1.5 ${
                      isSelected 
                        ? 'bg-white border-blue-600 shadow-xs ring-2 ring-blue-200' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sub.studentName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isApproved ? 'Disetujui' : 'Draft AI'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Waktu: {sub.submittedAt.split(' ')[1] || sub.submittedAt}</span>
                      <span className="font-bold text-blue-600">Skor AI: {sub.totalAiScore}</span>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                      <span>{sub.sebViolations.length} Pelanggaran SEB</span>
                      {sub.totalTeacherScore !== undefined && (
                        <span className="font-extrabold text-emerald-700">Final: {sub.totalTeacherScore}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Review Box (8 cols) */}
          {activeSub ? (
            <div className="lg:col-span-8 space-y-4">
              
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{activeSub.studentName}</h2>
                    <p className="text-xs text-slate-500">{activeAssignment?.title} • {activeSub.submittedAt}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Rekomendasi AI</div>
                      <div className="text-2xl font-extrabold text-blue-600">{activeSub.totalAiScore}</div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-800">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Catatan Keseluruhan Analisis AI Gemini:</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{activeSub.aiOverallFeedback}</p>
                </div>

                {activeSub.sebViolations.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-amber-800">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Log Pelanggaran Safe Exam Browser ({activeSub.sebViolations.length}x):</span>
                    </div>
                    {activeSub.sebViolations.map((v, idx) => (
                      <div key={idx} className="text-[11px] text-slate-600">• {v.description} ({v.timestamp})</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Questions Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Lembar Jawaban Siswa & Koreksi Per Butir Soal</span>
                  </h3>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                    Otomatis Menghitung Ulang Total Nilai
                  </span>
                </div>

                {activeAssignment?.questions.map((q, idx) => {
                  const ans = activeSub.answers.find(a => a.questionId === q.id);
                  const currentItem = itemizedScores[q.id] || {
                    score: ans?.teacherScore ?? ans?.aiScore ?? 0,
                    feedback: ans?.teacherFeedback ?? ''
                  };
                  const isOverridden = ans && currentItem.score !== (ans.aiScore ?? 0);

                  return (
                    <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-xs transition hover:border-slate-300">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <span className="font-extrabold text-xs text-slate-900">
                          Soal #{idx + 1} <span className="text-[10px] uppercase font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-1">{q.type}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Bobot: {q.points} Poin</span>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                            Rekomendasi AI: {ans?.aiScore ?? 0}/{q.points}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 font-semibold leading-relaxed">{q.prompt}</p>

                      {/* Student Submitted Answer */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                        <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Lembar Jawaban Siswa:</div>
                        {q.type === 'mcq' && (
                          <div className="font-semibold text-slate-800">
                            Pilihan Siswa: <span className="text-blue-700 font-bold">{q.options?.[ans?.selectedOptionIndex ?? 0] || 'Tidak menjawab'}</span>
                          </div>
                        )}
                        {q.type === 'short' && (
                          <div className="font-mono text-slate-900 bg-white p-2 rounded-lg border border-slate-200 inline-block">
                            {ans?.answerText || '(Kosong)'}
                          </div>
                        )}
                        {q.type === 'essay' && (
                          <div className="text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                            {ans?.answerText || '(Tidak ada teks pengerjaan)'}
                          </div>
                        )}
                        {q.type === 'image' && (
                          <div className="space-y-2">
                            <div className="text-[11px] text-slate-600">Lampiran Foto Lembar Pengerjaan (Klik untuk memperbesar):</div>
                            <div className="flex flex-wrap gap-2.5 pt-1">
                              {ans?.imageUrls && ans.imageUrls.length > 0 ? (
                                ans.imageUrls.map((url, i) => (
                                  <div
                                    key={i}
                                    onClick={() => setZoomedImage(url)}
                                    className="w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-300 hover:border-blue-500 cursor-pointer shadow-xs transition group relative"
                                    title="Klik untuk zoom berkas"
                                  >
                                    <img src={url} alt={`Lampiran ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                      <Eye className="w-4 h-4" />
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Tidak ada lampiran foto</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI Evaluation */}
                      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-slate-700 space-y-1">
                        <div className="font-bold text-blue-700 text-[11px] flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" />
                          <span>Evaluasi Cerdas AI Gemini:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600">{ans?.aiFeedback || 'Evaluasi AI otomatis diterapkan.'}</p>
                      </div>

                      {/* Guru Score Override & Notes per Question */}
                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-amber-600" />
                            <span>Koreksi & Edit Nilai Guru (Override Skor Butir Ini):</span>
                          </span>
                          {isOverridden && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                              Diedit Guru (AI: {ans?.aiScore ?? 0} → {currentItem.score})
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Skor Soal (Maks {q.points}):
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={q.points}
                              value={currentItem.score}
                              onChange={(e) => handleItemScoreChange(q.id, q.points, Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-extrabold text-blue-700 focus:outline-none focus:border-blue-600"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Catatan Koreksi Guru (Tampil di Lembar Siswa):
                            </label>
                            <input
                              type="text"
                              value={currentItem.feedback}
                              onChange={(e) => handleItemFeedbackChange(q.id, e.target.value)}
                              placeholder={`Contoh: Langkah pengerjaan benar, tetapi ada kesalahan kalkulasi limit akhir.`}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Teacher Decision Box */}
              <div className="bg-white rounded-2xl border-2 border-blue-400 p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Otoritas Penilaian Guru & Rekalkulasi Otomatis (Teacher Final Authority):</span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200">
                    Total Dihitung Otomatis: {finalScoreInput}/100
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total Nilai Akhir (0-100):</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={finalScoreInput}
                      onChange={(e) => setFinalScoreInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-lg font-extrabold text-blue-700 focus:outline-none focus:border-blue-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Otomatis terakumulasi dari total per butir soal di atas.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Evaluasi Resmi Guru (Global):</label>
                    <input
                      type="text"
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="Tuliskan umpan balik untuk siswa..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={handleApproveAiScore}
                    disabled={isSaving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui Hasil AI ({activeSub.totalAiScore}) & Publikasikan</span>
                  </button>
                  <button
                    onClick={handleSaveManualOverride}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Award className="w-4 h-4" />
                    <span>Simpan Nilai Hasil Edit Guru ({finalScoreInput}) & Rilis ke Siswa</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="lg:col-span-8 p-12 text-center text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
              Pilih salah satu siswa di sebelah kiri untuk memeriksa jawaban.
            </div>
          )}

        </div>

      </div>

      {zoomedImage && (
        <div onClick={() => setZoomedImage(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs cursor-zoom-out">
          <img src={zoomedImage} alt="Zoom" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
};
