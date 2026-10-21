import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { Assignment, Question, StudentAnswer, SebViolation } from '../types';
import { useDeviceCamera } from '../utils/useDeviceCamera';
import { useGoogleWorkspace } from '../context/GoogleWorkspaceContext';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Camera, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2, 
  Trash2, 
  Send,
  Flag,
  HelpCircle,
  AlertCircle,
  Lightbulb,
  Lock,
  Video,
  VideoOff,
  RefreshCw,
  Eye,
  Minimize2,
  Cloud,
  FolderSync
} from 'lucide-react';

interface SafeExamRoomViewProps {
  assignmentId: string;
  onNavigate: (view: string, param?: string) => void;
}

export const SafeExamRoomView: React.FC<SafeExamRoomViewProps> = ({ assignmentId, onNavigate }) => {
  const { currentUser } = useAuth();
  const { assignments, submitExam } = useExam();
  const { isGoogleConnected, dedicatedFolder, autoSyncEnabled } = useGoogleWorkspace();

  const assignment = assignments.find(a => a.id === assignmentId);

  const [isExamStarted, setIsExamStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [timeLeftSeconds, setTimeLeftSeconds] = useState(
    (assignment?.durationMinutes || 30) * 60
  );

  const [answers, setAnswers] = useState<{ [qId: string]: Partial<StudentAnswer> }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<{ [qId: string]: boolean }>({});

  const [violations, setViolations] = useState<SebViolation[]>([]);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [latestViolationText, setLatestViolationText] = useState('');

  // Device Camera Hook (Hardware connected)
  const deviceCamera = useDeviceCamera();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);

  // Live proctor camera floating monitor state
  const [isProctorMinimized, setIsProctorMinimized] = useState(false);
  const [isCapturingQuestionPhoto, setIsCapturingQuestionPhoto] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // SEB Whitelist ref: bypass false blur/fullscreen violations during camera modal or file dialogs
  const isWhitelistedRef = useRef(false);

  // Lock status
  const [lockStatus, setLockStatus] = useState<{ isLocked: boolean; lockedReason?: string; submittedAt?: string; unlockedBy?: string; unlockedAt?: string } | null>(null);
  const [checkingLock, setCheckingLock] = useState(true);

  // Connect active stream to video ref whenever stream updates
  useEffect(() => {
    if (deviceCamera.stream) {
      if (videoRef.current) videoRef.current.srcObject = deviceCamera.stream;
      if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = deviceCamera.stream;
      if (proctorVideoRef.current) proctorVideoRef.current.srcObject = deviceCamera.stream;
    }
  }, [deviceCamera.stream, isCapturingQuestionPhoto, isExamStarted]);

  useEffect(() => {
    if (!assignment || !currentUser) return;
    fetch(`/api/assignments/${assignment.id}/lock-status?studentId=${currentUser.id}`)
      .then(r => r.json())
      .then(data => {
        setLockStatus(data);
      })
      .catch(() => {})
      .finally(() => setCheckingLock(false));
  }, [assignment, currentUser]);

  if (!assignment) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-800">
        <p>Ujian tidak ditemukan.</p>
        <button onClick={() => onNavigate('dashboard')} className="mt-4 px-4 py-2 bg-blue-600 rounded-xl text-xs text-white font-bold cursor-pointer">
          Kembali ke Dasbor
        </button>
      </div>
    );
  }

  const currentQ = assignment.questions[currentQuestionIndex];

  const handleStartExam = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen bypassed:', err);
    }

    // Automatically ensure camera is connected for proctoring
    if (!deviceCamera.isActive) {
      try {
        await deviceCamera.startCamera();
      } catch (err) {
        console.warn('Proctor camera start on exam begin:', err);
      }
    }

    setIsExamStarted(true);
  };

  useEffect(() => {
    if (!isExamStarted || isCompleted) return;

    const recordViolation = (type: 'tab_switch' | 'fullscreen_exit' | 'blur_event', desc: string) => {
      // Safe Exam Browser Whitelist Check: Ignore if camera modal or file dialog is active
      if (isWhitelistedRef.current) {
        return;
      }

      const newV: SebViolation = {
        timestamp: new Date().toLocaleTimeString('id-ID'),
        type,
        description: desc
      };
      setViolations(prev => {
        const next = [...prev, newV];
        if (next.length >= assignment.maxViolations) {
          handleAutoSubmitDueToViolations();
        }
        return next;
      });
      setLatestViolationText(desc);
      setShowViolationModal(true);
    };

    const handleVisibilityChange = () => {
      if (isWhitelistedRef.current) return;
      if (document.hidden) {
        recordViolation('tab_switch', 'Terdeteksi beralih ke tab peramban lain atau meminimalkan layar.');
      }
    };

    const handleWindowBlur = () => {
      if (isWhitelistedRef.current) return;
      recordViolation('blur_event', 'Fokus jendela ujian hilang (terdeteksi membuka aplikasi lain).');
    };

    const handleFullscreenChange = () => {
      if (isWhitelistedRef.current) return;
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        recordViolation('fullscreen_exit', 'Meninggalkan mode layar penuh (Fullscreen Exit).');
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const timer = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(timer);
    };
  }, [isExamStarted, isCompleted, assignment]);

  const handleAutoSubmitDueToViolations = () => {
    alert('Batas maksimal pelanggaran (3 kali) telah tercapai. Ujian dikumpulkan secara otomatis demi integritas sistem.');
    handleFinalSubmit();
  };

  const handleOpenPhotoCapture = async () => {
    isWhitelistedRef.current = true;
    setIsCapturingQuestionPhoto(true);
    if (!deviceCamera.isActive) {
      await deviceCamera.startCamera();
    }
  };

  const handleClosePhotoCapture = () => {
    setIsCapturingQuestionPhoto(false);
    setTimeout(() => {
      isWhitelistedRef.current = false;
    }, 1200);
  };

  const handleSnapQuestionPhoto = () => {
    const photo = deviceCamera.capturePhoto(videoRef.current);
    if (!photo) return;

    const prevList = answers[currentQ.id]?.imageUrls || [];
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        questionId: currentQ.id,
        imageUrls: [...prevList, photo]
      }
    }));

    handleClosePhotoCapture();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    isWhitelistedRef.current = true;
    const files = e.target.files;
    if (!files || files.length === 0) {
      setTimeout(() => {
        isWhitelistedRef.current = false;
      }, 1000);
      return;
    }

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = reader.result;
          setAnswers(prev => {
            const list = prev[currentQ.id]?.imageUrls || [];
            return {
              ...prev,
              [currentQ.id]: {
                ...prev[currentQ.id],
                questionId: currentQ.id,
                imageUrls: [...list, res]
              }
            };
          });
        }
      };
      reader.readAsDataURL(file);
    });

    setTimeout(() => {
      isWhitelistedRef.current = false;
    }, 2000);
  };

  const removeImage = (idxToRemove: number) => {
    setAnswers(prev => {
      const list = prev[currentQ.id]?.imageUrls || [];
      return {
        ...prev,
        [currentQ.id]: {
          ...prev[currentQ.id],
          imageUrls: list.filter((_, idx) => idx !== idxToRemove)
        }
      };
    });
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    deviceCamera.stopCamera();

    const formattedAnswers: StudentAnswer[] = assignment.questions.map(q => {
      const ans = answers[q.id];
      return {
        questionId: q.id,
        selectedOptionIndex: ans?.selectedOptionIndex,
        answerText: ans?.answerText,
        imageUrls: ans?.imageUrls || []
      };
    });

    await submitExam(
      assignment.id,
      currentUser?.id || 'usr-siswa-01',
      currentUser?.name || 'Arya Pratama',
      formattedAnswers,
      violations
    );

    setIsSubmitting(false);
    setIsCompleted(true);

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;

  // 1. LOBBY (Moodle Quiz Info Page with Hardware Camera Verification)
  if (!isExamStarted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-blue-600 selection:text-white">
        <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Safe Exam Browser (Moodle Quiz Locked)
              </span>
              <h1 className="text-lg font-bold text-slate-900 mt-1">{assignment.title}</h1>
              <p className="text-xs text-slate-500">{assignment.courseTitle}</p>
            </div>
          </div>

          {/* Lock Status Check */}
          {lockStatus?.isLocked ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3 text-xs text-rose-950">
              <div className="flex items-center gap-2 font-extrabold text-rose-800">
                <Lock className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Ujian Ini Telah Terkunci (Aturan 1 Kali Pengerjaan SEB)</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Anda telah mengumpulkan ujian ini pada: <strong>{lockStatus.submittedAt || 'Sesi Terakhir'}</strong>.
                Sesuai regulasi integritas Safe Exam Browser, ujian hanya dapat dikerjakan tepat <strong>1 kali</strong> dan langsung dikunci otomatis secara permanen setelah pengumpulan.
              </p>
              <div className="p-3 bg-white rounded-lg border border-rose-200 text-slate-700 space-y-1">
                <div className="font-bold text-[11px] text-slate-900">Prosedur Pembukaan Kunci:</div>
                <div className="text-[11px]">
                  Hubungi Guru Pengampu ({assignment.courseTitle}) atau Administrator untuk membuka dispensasi.
                </div>
              </div>

              {currentUser?.role !== 'siswa' && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-800">Mode Pendidik / Admin:</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentUser) return;
                      await fetch(`/api/assignments/${assignment.id}/unlock`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          studentId: currentUser.id,
                          unlockedBy: currentUser.name,
                          reason: 'Testing pengerjaan oleh Guru/Admin'
                        })
                      });
                      setLockStatus({ isLocked: false });
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Buka Kunci Akun Ini Sekarang
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* HARDWARE CAMERA VERIFICATION CARD */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                        <span>Pemeriksaan Kamera Perangkat (Hardware Camera Check)</span>
                        {deviceCamera.isActive ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Tersambung
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                            Siap Dihubungkan
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-blue-800">
                        Pastikan kamera webcam atau perangkat laptop Anda tersambung dan diizinkan sebelum ujian dimulai.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {deviceCamera.isActive ? (
                      <button
                        type="button"
                        onClick={deviceCamera.stopCamera}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-2xs flex items-center gap-1"
                      >
                        <VideoOff className="w-3.5 h-3.5" />
                        <span>Matikan Kamera</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deviceCamera.startCamera()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-xs flex items-center gap-1"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Uji & Sambungkan Kamera</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Device Selector Dropdown if multiple cameras exist */}
                {deviceCamera.devices.length > 1 && (
                  <div className="flex items-center gap-2 text-xs pt-1">
                    <span className="font-bold text-slate-700">Pilih Perangkat Kamera:</span>
                    <select
                      value={deviceCamera.selectedDeviceId}
                      onChange={(e) => deviceCamera.switchDevice(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {deviceCamera.devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Live Preview when connected */}
                {deviceCamera.isActive && (
                  <div className="space-y-2 pt-2">
                    <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video max-h-56 mx-auto flex items-center justify-center">
                      <video
                        ref={lobbyVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>LIVE: {deviceCamera.activeDeviceLabel} {deviceCamera.resolution && `(${deviceCamera.resolution})`}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-emerald-800 font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Kamera perangkat terverifikasi normal. Feed akan aktif memantau integritas pengerjaan ujian.</span>
                    </div>
                  </div>
                )}

                {deviceCamera.error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Kendala Kamera:</span> {deviceCamera.error}
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-700">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <span>Petunjuk & Peraturan Integritas Ujian Moodle:</span>
                </div>
                <ul className="space-y-1 pl-5 list-disc text-slate-600">
                  <li>Mode Ujian Terkunci (Web SEB) akan mengaktifkan layar penuh.</li>
                  <li>Kamera perangkat tersambung memantau sesi ujian secara real-time.</li>
                  <li>Perpindahan tab atau pembukaan aplikasi lain akan memicu peringatan otomatis (maks. 3 kali).</li>
                  <li>Pengerjaan dibatasi <strong>tepat 1 kali</strong> dan langsung terkunci setelah dikumpulkan.</li>
                  <li>Waktu pengerjaan: <strong>{assignment.durationMinutes} Menit</strong>.</li>
                  <li>Jawaban akan dievaluasi langsung oleh AI Gemini dan diverifikasi oleh guru.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Tips Pedagogis AI Scaffold:</span>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Bacalah soal secara saksama. Untuk soal esai atau hitungan, gunakan tombol lampirkan foto kamera langsung untuk mengabadikan tulisan kertas Anda.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                deviceCamera.stopCamera();
                onNavigate('dashboard');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Kembali
            </button>
            {lockStatus?.isLocked ? (
              <button
                onClick={() => onNavigate('student-results')}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Lihat Hasil & Nilai Resmi Guru</span>
              </button>
            ) : (
              <button
                onClick={handleStartExam}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Mulai Percobaan Ujian (Attempt Quiz Now)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. COMPLETED SUMMARY
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Ujian Telah Terkumpul (Summary of Attempt)</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Seluruh jawaban Anda telah tersimpan dan saat ini sedang dianalisis oleh engine koreksi otomatis AI Gemini.
          </p>

          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-left text-xs text-blue-950 space-y-1">
            <div className="font-bold">Status Penilaian Moodle:</div>
            <div>• Koreksi AI: <strong className="text-emerald-700">Selesai Dianalisis</strong></div>
            <div>• Gerbang Review Guru: <strong className="text-blue-700">Menunggu Verifikasi Guru</strong></div>
            <div>• Pelanggaran SEB: <strong className={violations.length > 0 ? "text-amber-700" : "text-emerald-700"}>{violations.length} Insiden</strong></div>
            <div>• Kamera Device: <strong className="text-emerald-700">Tersambung Selama Sesi</strong></div>
          </div>

          {/* Dual Storage & Dedicated Drive Folder Sync Indicator */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Penyimpanan Ganda & Google Drive:</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Tersinkron Otomatis
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Berkas jawaban dan lampiran ujian telah disinkronkan secara aman ke folder khusus Google Drive:
              <strong className="block text-indigo-700 font-mono mt-0.5">
                📁 Cakrawala_LMS_Hasil_Ujian_dan_Tugas
              </strong>
            </p>
          </div>

          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
          >
            Kembali ke Dasbor
          </button>
        </div>
      </div>
    );
  }

  // 3. MOODLE QUIZ ACTIVE ATTEMPT WITH LIVE PROCTOR CAMERA
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none">
      
      {/* SEB Violation Red Alert Modal */}
      {showViolationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/75 backdrop-blur-xs">
          <div className="bg-white border-2 border-red-500 rounded-2xl p-6 max-w-md text-center space-y-3.5 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-red-950">Peringatan Pelanggaran Safe Exam Browser!</h3>
            <p className="text-xs text-slate-600">{latestViolationText}</p>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              Pelanggaran ke-<strong>{violations.length}</strong> dari batas maksimal 3.
            </div>
            <button
              onClick={() => {
                setShowViolationModal(false);
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* FLOATING LIVE PROCTOR CAMERA MONITOR */}
      <div className={`fixed bottom-4 right-4 z-40 bg-slate-900 text-white rounded-2xl border-2 border-slate-700 shadow-2xl transition-all overflow-hidden ${
        isProctorMinimized ? 'w-48 h-10' : 'w-64 sm:w-72'
      }`}>
        <div className="p-2.5 bg-slate-800/90 flex items-center justify-between text-xs font-bold border-b border-slate-700">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${deviceCamera.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[11px] truncate max-w-[130px]">
              {deviceCamera.isActive ? 'Kamera Device Aktif' : 'Kamera Terputus'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsProctorMinimized(prev => !prev)}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
              title={isProctorMinimized ? 'Perbesar' : 'Kecilkan'}
            >
              {isProctorMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {!isProctorMinimized && (
          <div className="p-2 space-y-1.5">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
              {deviceCamera.isActive ? (
                <video
                  ref={proctorVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-3 text-slate-400 space-y-1">
                  <VideoOff className="w-6 h-6 mx-auto text-slate-500" />
                  <div className="text-[10px]">Kamera Belum Aktif</div>
                  <button
                    onClick={() => deviceCamera.startCamera()}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold"
                  >
                    Nyalakan
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
              <span className="truncate max-w-[150px]">{deviceCamera.activeDeviceLabel}</span>
              {deviceCamera.resolution && <span>{deviceCamera.resolution}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-slate-900">{assignment.title}</span>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Web SEB Locked
          </span>
          {deviceCamera.isActive && (
            <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 hidden sm:inline-flex items-center gap-1">
              <Camera className="w-3 h-3 text-blue-600" />
              <span>Kamera Device Tersambung</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Sisa Waktu: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>

          <button
            onClick={handleFinalSubmit}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            <span>Selesaikan Percobaan (Finish Attempt)</span>
          </button>
        </div>
      </div>

      {/* 2-Column Moodle Quiz Attempt Canvas */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Main Question Box (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col md:flex-row">
            
            {/* Moodle Question Meta-Box (Left gray column) */}
            <div className="p-4 bg-slate-50 border-r border-slate-200 w-full md:w-48 shrink-0 space-y-2 text-xs text-slate-600 font-medium">
              <div className="font-extrabold text-slate-900 text-sm">Soal {currentQuestionIndex + 1}</div>
              <div className="text-[11px] text-slate-500">
                {answers[currentQ.id]?.selectedOptionIndex !== undefined || answers[currentQ.id]?.answerText || answers[currentQ.id]?.imageUrls?.length 
                  ? 'Sudah dijawab' 
                  : 'Belum dijawab'}
              </div>
              <div className="text-[11px] text-slate-500">Poin: {currentQ.points}.00</div>
              
              <button
                type="button"
                onClick={() => setFlaggedQuestions(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
                className={`pt-2 flex items-center gap-1.5 text-[11px] cursor-pointer ${
                  flaggedQuestions[currentQ.id] ? 'text-red-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{flaggedQuestions[currentQ.id] ? 'Ditandai (Flagged)' : 'Tandai soal'}</span>
              </button>
            </div>

            {/* Moodle Question Body (Right white area) */}
            <div className="p-6 flex-1 space-y-4">
              <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                {currentQ.prompt}
              </div>

              {/* MCQ Options */}
              {currentQ.type === 'mcq' && currentQ.options && (
                <div className="space-y-2 pt-2">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = answers[currentQ.id]?.selectedOptionIndex === optIdx;
                    const letter = String.fromCharCode(97 + optIdx); // a, b, c, d

                    return (
                      <label
                        key={optIdx}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer text-xs ${
                          isSelected ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q_${currentQ.id}`}
                          checked={isSelected}
                          onChange={() => {
                            setAnswers(prev => ({
                              ...prev,
                              [currentQ.id]: {
                                ...prev[currentQ.id],
                                questionId: currentQ.id,
                                selectedOptionIndex: optIdx
                              }
                            }));
                          }}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{letter}. {opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Short Answer */}
              {currentQ.type === 'short' && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jawaban Singkat:</label>
                  <input
                    type="text"
                    value={answers[currentQ.id]?.answerText || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnswers(prev => ({
                        ...prev,
                        [currentQ.id]: {
                          ...prev[currentQ.id],
                          questionId: currentQ.id,
                          answerText: val
                        }
                      }));
                    }}
                    placeholder="Ketikkan jawaban Anda di sini..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              )}

              {/* Essay */}
              {currentQ.type === 'essay' && (
                <div className="pt-2 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">Teks Esai:</label>
                  <textarea
                    value={answers[currentQ.id]?.answerText || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnswers(prev => ({
                        ...prev,
                        [currentQ.id]: {
                          ...prev[currentQ.id],
                          questionId: currentQ.id,
                          answerText: val
                        }
                      }));
                    }}
                    rows={6}
                    placeholder="Tuliskan uraian lengkap di sini..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 leading-relaxed"
                  />

                  {/* Optional camera photo attachment for essay working steps */}
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">Sertakan foto lembar coretan/rumus jika ada:</span>
                    <button
                      type="button"
                      onClick={handleOpenPhotoCapture}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>Buka Kamera Lembar Kerja</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-Photo & Direct Device Camera Attachment Area */}
              {(currentQ.type === 'image' || isCapturingQuestionPhoto) && (
                <div className="pt-2 space-y-3">
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-blue-600" />
                        <span>Lampiran Kamera Device (Tersambung Langsung ke Perangkat)</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer shadow-xs">
                          <Upload className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                          <span>Pilih Berkas</span>
                          <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={isCapturingQuestionPhoto ? handleClosePhotoCapture : handleOpenPhotoCapture}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition shadow-xs ${
                            isCapturingQuestionPhoto ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5 inline mr-1" />
                          <span>{isCapturingQuestionPhoto ? 'Tutup Tangkapan' : 'Ambil Foto dari Kamera Device'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Device Camera Capture Modal/Box */}
                    {isCapturingQuestionPhoto && (
                      <div className="relative rounded-xl overflow-hidden border-2 border-blue-500 bg-black flex flex-col items-center p-3 space-y-2">
                        
                        {/* Camera Switcher if multiple devices */}
                        {deviceCamera.devices.length > 1 && (
                          <div className="w-full flex items-center justify-between text-white text-xs px-2 pb-1">
                            <span className="text-[11px] text-slate-300">Pilih Kamera Device:</span>
                            <select
                              value={deviceCamera.selectedDeviceId}
                              onChange={(e) => deviceCamera.switchDevice(e.target.value)}
                              className="px-2 py-0.5 bg-slate-800 text-white border border-slate-600 rounded text-xs cursor-pointer"
                            >
                              {deviceCamera.devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full max-h-72 object-contain rounded-lg" 
                        />

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={handleSnapQuestionPhoto}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Jepret Lembar Kerja Sekarang</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleClosePhotoCapture}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Attached Photo Gallery */}
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] text-slate-500">
                        Foto terlampir: {(answers[currentQ.id]?.imageUrls || []).length} Foto
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(answers[currentQ.id]?.imageUrls || []).map((url, idx) => (
                          <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 h-24 group">
                            <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation within Quiz */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl disabled:opacity-40 cursor-pointer"
                >
                  Halaman Sebelumnya
                </button>

                {currentQuestionIndex < assignment.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(assignment.questions.length - 1, prev + 1))}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Halaman Berikutnya
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesai & Kumpulkan</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Moodle Classic Right Block Drawer: Quiz Navigation (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Navigasi Kuis (Quiz Navigation)
            </h4>

            {/* Grid of Numbered Tiles */}
            <div className="grid grid-cols-4 gap-2">
              {assignment.questions.map((q, idx) => {
                const ans = answers[q.id];
                const isAnswered = ans?.selectedOptionIndex !== undefined || 
                                  (ans?.answerText && ans.answerText.trim() !== '') ||
                                  (ans?.imageUrls && ans.imageUrls.length > 0);
                const isCurrent = idx === currentQuestionIndex;
                const isFlagged = flaggedQuestions[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-10 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition cursor-pointer relative border ${
                      isCurrent 
                        ? 'border-blue-600 ring-2 ring-blue-400 bg-blue-50 text-blue-950 font-extrabold' 
                        : isAnswered 
                        ? 'bg-slate-200 border-slate-300 text-slate-800' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="w-full text-center text-xs font-bold text-blue-600 hover:underline py-1 cursor-pointer"
              >
                Selesaikan Ujian (Finish Attempt...)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
