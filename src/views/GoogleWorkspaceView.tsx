import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHomeroom } from '../context/HomeroomContext';
import { useExam } from '../context/ExamContext';
import { useCourse } from '../context/CourseContext';
import { useGoogleWorkspace } from '../context/GoogleWorkspaceContext';
import { useNotification } from '../context/NotificationContext';
import { 
  FileSpreadsheet, 
  Mail, 
  FileText, 
  FormInput, 
  Video, 
  ExternalLink, 
  Send, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Sparkles, 
  Download, 
  RefreshCw,
  FolderSync,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface GoogleWorkspaceViewProps {
  onNavigate: (view: string, param?: string) => void;
}

type WorkspaceTab = 'sheets' | 'gmail' | 'docs' | 'forms' | 'meet';

export const GoogleWorkspaceView: React.FC<GoogleWorkspaceViewProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { reportCards } = useHomeroom();
  const { assignments, submissions } = useExam();
  const { courses } = useCourse();
  const { 
    isGoogleConnected, 
    googleUser, 
    isConnecting, 
    connectGoogle, 
    disconnectGoogle,
    createSheet,
    sendEmail,
    createDoc,
    createForm,
    createMeetRoom
  } = useGoogleWorkspace();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('sheets');

  // Sheets state
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [createdSheets, setCreatedSheets] = useState<Array<{ id: string; title: string; url: string; timestamp: string }>>([]);

  // Gmail state
  const [recipientEmail, setRecipientEmail] = useState('siswa@cakrawala.sch.id');
  const [emailSubject, setEmailSubject] = useState('Pemberitahuan Capaian Belajar & Rapor Akademik');
  const [emailBody, setEmailBody] = useState(
    'Yth. Siswa & Orang Tua/Wali,\n\nBerikut kami informasikan bahwa nilai evaluasi blok dan modul pembelajaran telah diperbarui pada sistem Cakrawala LMS. Silakan periksa hasil belajar secara berkala.\n\nSalam hormat,\nPendidik Cakrawala LMS'
  );
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [sentEmails, setSentEmails] = useState<Array<{ to: string; subject: string; time: string; id?: string }>>([]);

  // Docs state
  const [docTitle, setDocTitle] = useState('Silabus & Modul Ajar Matematika Peminatan');
  const [docContent, setDocContent] = useState(
    'MODUL PEMBELAJARAN & SILABUS MATEMATIKA PEMINATAN KELAS XII\n\n1. Identitas Modul:\n- Satuan Pendidikan: SMA Cakrawala Cendekia\n- Fase/Kelas: F / XII\n- Alokasi Waktu: 4 Pertemuan (8 JP)\n\n2. Capaian Pembelajaran:\nPeserta didik mampu memahami konsep turunan fungsi trigonometri, limit fungsi, dan penerapannya dalam pemodelan kalkulus diferensial.\n\n3. Rencana Kegiatan Pembelajaran:\n- Minggu 1: Eksplorasi konsep laju perubahan sesaat.\n- Minggu 2: Teorema aturan rantai turunan trigonometri.\n- Minggu 3: Ujian Blok Terkunci (Safe Exam Browser Cakrawala LMS).'
  );
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [createdDocs, setCreatedDocs] = useState<Array<{ id: string; title: string; url: string; time: string }>>([]);

  // Forms state
  const [formTitle, setFormTitle] = useState('Kuis & Survei Refleksi Pemahaman Belajar');
  const [formDesc, setFormDesc] = useState('Kuesioner diagnostik mandiri untuk mengevaluasi pemahaman materi kalkulus.');
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [createdForms, setCreatedForms] = useState<Array<{ id: string; title: string; url: string; time: string }>>([]);

  // Meet state
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);
  const [activeMeetRoom, setActiveMeetRoom] = useState<{ uri: string; code: string; time: string } | null>(null);
  const [isCopiedMeet, setIsCopiedMeet] = useState(false);

  // 1. Export Gradebook to Google Sheets
  const handleExportToGoogleSheets = async () => {
    if (!isGoogleConnected) {
      const connected = await connectGoogle();
      if (!connected) return;
    }

    const confirmed = window.confirm(
      `Ekspor seluruh data rekap nilai siswa (${reportCards.length} siswa) ke lembar kerja baru di Google Sheets Anda?`
    );
    if (!confirmed) return;

    setIsExportingSheet(true);
    try {
      const title = `Rekap Nilai Siswa Cakrawala LMS - ${new Date().toLocaleDateString('id-ID')}`;
      
      // Construct spreadsheet rows
      const headerRow = [
        'No', 
        'NIS / ID Siswa', 
        'Nama Lengkap', 
        'Kelas', 
        'Mata Pelajaran', 
        'Nilai Akhir', 
        'Predikat', 
        'Kehadiran (%)', 
        'Catatan Integritas'
      ];

      const rows: string[][] = [headerRow];
      reportCards.forEach((rc, idx) => {
        const primaryGrade = rc.grades?.[0];
        rows.push([
          String(idx + 1),
          rc.studentId,
          rc.studentName,
          rc.kelas,
          primaryGrade?.courseTitle || 'Matematika Peminatan',
          String(rc.averageScore),
          primaryGrade?.letterGrade || 'A',
          `${primaryGrade?.attendancePercent || 95}%`,
          rc.homeroomNotes || 'Memenuhi KKM'
        ]);
      });

      const res = await createSheet(title, rows);
      if (res.success && res.spreadsheet) {
        showNotification({
          type: 'success',
          title: 'Google Sheet Berhasil Dibuat',
          message: `Rekap nilai telah diekspor ke Google Sheets: "${res.spreadsheet.title}"`
        });
        setCreatedSheets(prev => [
          {
            id: res.spreadsheet!.spreadsheetId,
            title: res.spreadsheet!.title,
            url: res.spreadsheet!.spreadsheetUrl,
            timestamp: new Date().toLocaleTimeString('id-ID')
          },
          ...prev
        ]);
      } else {
        showNotification({
          type: 'error',
          title: 'Gagal Membuat Sheet',
          message: res.error || 'Terjadi kesalahan saat membuat Google Sheet.'
        });
      }
    } finally {
      setIsExportingSheet(false);
    }
  };

  // 2. Send Email via Gmail
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleConnected) {
      const connected = await connectGoogle();
      if (!connected) return;
    }

    const confirmed = window.confirm(
      `Kirim pesan email ke ${recipientEmail} dengan subjek "${emailSubject}" melalui akun Gmail ${googleUser?.email}?`
    );
    if (!confirmed) return;

    setIsSendingEmail(true);
    try {
      const res = await sendEmail(recipientEmail, emailSubject, emailBody);
      if (res.success) {
        showNotification({
          type: 'success',
          title: 'Email Terkirim via Gmail',
          message: `Surat elektronik resmi berhasil dikirim ke ${recipientEmail}`
        });
        setSentEmails(prev => [
          {
            to: recipientEmail,
            subject: emailSubject,
            time: new Date().toLocaleTimeString('id-ID'),
            id: res.id
          },
          ...prev
        ]);
      } else {
        showNotification({
          type: 'error',
          title: 'Gagal Mengirim Email',
          message: res.error || 'Terjadi kendala saat mengirim pesan melalui Gmail.'
        });
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 3. Create Google Doc
  const handleCreateGoogleDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleConnected) {
      const connected = await connectGoogle();
      if (!connected) return;
    }

    const confirmed = window.confirm(
      `Buat dokumen Google Docs baru "${docTitle}" di akun Google Drive Anda?`
    );
    if (!confirmed) return;

    setIsCreatingDoc(true);
    try {
      const res = await createDoc(docTitle, docContent);
      if (res.success && res.document) {
        showNotification({
          type: 'success',
          title: 'Google Doc Dibuat',
          message: `Dokumen "${res.document.title}" berhasil dibuat dan siap diedit.`
        });
        setCreatedDocs(prev => [
          {
            id: res.document!.documentId,
            title: res.document!.title,
            url: res.document!.webViewLink || `https://docs.google.com/document/d/${res.document!.documentId}/edit`,
            time: new Date().toLocaleTimeString('id-ID')
          },
          ...prev
        ]);
      } else {
        showNotification({
          type: 'error',
          title: 'Gagal Membuat Dokumen',
          message: res.error || 'Terjadi kendala saat membuat Google Docs.'
        });
      }
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // 4. Create Google Form
  const handleCreateGoogleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleConnected) {
      const connected = await connectGoogle();
      if (!connected) return;
    }

    const confirmed = window.confirm(
      `Buat formulir Google Forms baru "${formTitle}" di akun Google Anda?`
    );
    if (!confirmed) return;

    setIsCreatingForm(true);
    try {
      const sampleQuestions = [
        {
          title: 'Bagaimana tingkat pemahaman Anda terhadap konsep turunan fungsi trigonometri?',
          options: ['Sangat Paham', 'Cukup Paham', 'Perlu Pendalaman Teori', 'Belum Mengerti']
        },
        {
          title: 'Apakah petunjuk pengerjaan ujian Safe Exam Browser (SEB) mudah dipahami?',
          options: ['Sangat Jelas', 'Cukup Jelas', 'Perlu Penjelasan Guru']
        },
        {
          title: 'Tuliskan topik matematika atau kalkulus yang paling ingin Anda bahas pada sesi tatap muka berikutnya:'
        }
      ];

      const res = await createForm(formTitle, formDesc, sampleQuestions);
      if (res.success && res.form) {
        showNotification({
          type: 'success',
          title: 'Google Form Dibuat',
          message: `Formulir "${res.form.title}" berhasil dibuat dengan pertanyaan diagnostik.`
        });
        setCreatedForms(prev => [
          {
            id: res.form!.formId,
            title: res.form!.title,
            url: res.form!.responderUri,
            time: new Date().toLocaleTimeString('id-ID')
          },
          ...prev
        ]);
      } else {
        showNotification({
          type: 'error',
          title: 'Gagal Membuat Form',
          message: res.error || 'Terjadi kesalahan saat membuat Google Forms.'
        });
      }
    } finally {
      setIsCreatingForm(false);
    }
  };

  // 5. Create Google Meet Room
  const handleCreateGoogleMeet = async () => {
    if (!isGoogleConnected) {
      const connected = await connectGoogle();
      if (!connected) return;
    }

    const confirmed = window.confirm(
      `Buat ruang tatap maya baru dengan Google Meet resmi?`
    );
    if (!confirmed) return;

    setIsCreatingMeet(true);
    try {
      const res = await createMeetRoom();
      if (res.success && res.meet) {
        setActiveMeetRoom({
          uri: res.meet.meetingUri,
          code: res.meet.meetingCode,
          time: new Date().toLocaleTimeString('id-ID')
        });
        showNotification({
          type: 'success',
          title: 'Google Meet Siap',
          message: `Ruang pertemuan berhasil dibuat: ${res.meet.meetingUri}`
        });
      } else {
        showNotification({
          type: 'error',
          title: 'Gagal Membuat Meet',
          message: res.error || 'Terjadi kendala saat membuat Google Meet space.'
        });
      }
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const copyMeetLink = () => {
    if (!activeMeetRoom) return;
    navigator.clipboard.writeText(activeMeetRoom.uri);
    setIsCopiedMeet(true);
    setTimeout(() => setIsCopiedMeet(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-6 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-blue-600 transition cursor-pointer">
            Beranda
          </button>
          <span>/</span>
          <span className="text-slate-800 font-bold">Integrasi Google Workspace Suite</span>
        </div>

        {/* Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Google Workspace Suite
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Sheets • Gmail • Docs • Forms • Meet
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Pusat Alat Terintegrasi Google Workspace
              </h1>
              <p className="text-xs text-slate-500">
                Akses terpadu Google Sheets, Gmail, Docs, Forms, dan Meet langsung dari Cakrawala LMS
              </p>
            </div>
          </div>

          {/* Google Auth Status Widget */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            {isGoogleConnected && googleUser ? (
              <div className="flex items-center gap-2.5">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt={googleUser.displayName || 'Google'} className="w-8 h-8 rounded-full border border-blue-300" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {googleUser.email?.[0]?.toUpperCase() || 'G'}
                  </div>
                )}
                <div className="text-left text-xs">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1">
                    <span>{googleUser.displayName || 'Akun Google'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{googleUser.email}</div>
                </div>
                <button
                  onClick={disconnectGoogle}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition ml-1"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                onClick={() => connectGoogle()}
                disabled={isConnecting}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Akun Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Workspace Suite Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'sheets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheets</span>
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'gmail'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail</span>
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'docs'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Google Docs</span>
          </button>

          <button
            onClick={() => setActiveTab('forms')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'forms'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FormInput className="w-4 h-4" />
            <span>Google Forms</span>
          </button>

          <button
            onClick={() => setActiveTab('meet')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'meet'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Google Meet</span>
          </button>
        </div>

        {/* TAB 1: GOOGLE SHEETS */}
        {activeTab === 'sheets' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Ekspor Buku Nilai & Rapor ke Google Sheets
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Hasilkan *spreadsheet* resmi berisikan data {reportCards.length} siswa, nilai tugas, ujian SEB, kehadiran, dan predikat belajar secara langsung.
                  </p>
                </div>

                <button
                  onClick={handleExportToGoogleSheets}
                  disabled={isExportingSheet}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition shrink-0 disabled:opacity-50"
                >
                  <FileSpreadsheet className={`w-4 h-4 ${isExportingSheet ? 'animate-spin' : ''}`} />
                  <span>{isExportingSheet ? 'Membuat Spreadsheet...' : 'Buat Rekap di Google Sheets'}</span>
                </button>
              </div>

              {/* Preview Data Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between">
                  <span>Pratinjau Data yang Diekspor (Tabel Rapor & Nilai):</span>
                  <span className="text-[11px] text-slate-500 font-mono">{reportCards.length} Baris Data</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-2.5">No</th>
                        <th className="p-2.5">NIS</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5">Kelas</th>
                        <th className="p-2.5">Nilai Akhir</th>
                        <th className="p-2.5">Predikat</th>
                        <th className="p-2.5">Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportCards.slice(0, 5).map((rc, idx) => {
                        const primaryGrade = rc.grades?.[0];
                        return (
                          <tr key={rc.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-2.5 font-mono text-blue-700">{rc.studentId}</td>
                            <td className="p-2.5 font-bold text-slate-900">{rc.studentName}</td>
                            <td className="p-2.5">{rc.kelas}</td>
                            <td className="p-2.5 font-extrabold text-emerald-700">{rc.averageScore}</td>
                            <td className="p-2.5 font-bold">{primaryGrade?.letterGrade || 'A'}</td>
                            <td className="p-2.5 font-mono">{primaryGrade?.attendancePercent || 95}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Created Sheets History */}
            {createdSheets.length > 0 && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
                <h4 className="font-extrabold text-slate-900">Daftar Spreadsheet yang Dibuat Sesi Ini:</h4>
                <div className="divide-y divide-slate-100">
                  {createdSheets.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{s.title}</div>
                        <div className="text-[10px] text-slate-500">Dibuat: {s.timestamp}</div>
                      </div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka di Google Sheets Web</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GMAIL */}
        {activeTab === 'gmail' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Mail className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Kirim Surel Pengumuman & Rapor via Akun Gmail
                </h3>
              </div>

              <form onSubmit={handleSendEmail} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kepada (Alamat Email Siswa/Orang Tua):</label>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="nama.siswa@domain.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subjek Surel:</label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Isi Pesan Surat:</label>
                  <textarea
                    rows={6}
                    required
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">
                    Pengirim: <strong>{googleUser?.email || 'Akun Google Anda'}</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                    <span>{isSendingEmail ? 'Mengirim Surel...' : 'Kirim Sekarang via Gmail'}</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
                Riwayat Surel Terkirim ({sentEmails.length})
              </h4>
              {sentEmails.length === 0 ? (
                <div className="py-8 text-center text-slate-400">Belum ada email yang dikirim pada sesi ini.</div>
              ) : (
                <div className="space-y-2">
                  {sentEmails.map((e, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900">{e.subject}</div>
                      <div className="text-slate-500 text-[10px] font-mono">Ke: {e.to}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">Terkirim: {e.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GOOGLE DOCS */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Buat Dokumen Silabus & Modul Ajar Resmi di Google Docs
                </h3>
              </div>

              <form onSubmit={handleCreateGoogleDoc} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul Dokumen:</label>
                  <input
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Isi Dokumen (Rencana Pelaksanaan Pembelajaran / Silabus):</label>
                  <textarea
                    rows={8}
                    required
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingDoc}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isCreatingDoc ? 'Membuat di Google Docs...' : 'Buat Dokumen di Google Docs'}</span>
                  </button>
                </div>
              </form>
            </div>

            {createdDocs.length > 0 && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
                <h4 className="font-extrabold text-slate-900">Dokumen Google Docs yang Baru Dibuat:</h4>
                <div className="divide-y divide-slate-100">
                  {createdDocs.map((d) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{d.title}</div>
                        <div className="text-[10px] text-slate-500">Waktu pembuatan: {d.time}</div>
                      </div>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-lg border border-blue-200 flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka & Edit di Google Docs Web</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GOOGLE FORMS */}
        {activeTab === 'forms' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FormInput className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Buat Kuis Diagnostik & Survei di Google Forms
                </h3>
              </div>

              <form onSubmit={handleCreateGoogleForm} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul Formulir:</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deskripsi Formulir:</label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-xs space-y-1">
                  <div className="font-bold">Pertanyaan Otomatis yang Disertakan:</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-purple-800">
                    <li>Skala pemahaman materi kalkulus (Pilihan Ganda Radio)</li>
                    <li>Evaluasi kepuasan sistem ujian Safe Exam Browser (Pilihan Ganda Radio)</li>
                    <li>Saran & topik pembahasan kelas berikutnya (Teks Uraian Panjang)</li>
                  </ul>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingForm}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isCreatingForm ? 'Membuat Google Form...' : 'Buat Formulir Google Forms'}</span>
                  </button>
                </div>
              </form>
            </div>

            {createdForms.length > 0 && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 text-xs">
                <h4 className="font-extrabold text-slate-900">Formulir yang Telah Dibuat:</h4>
                <div className="divide-y divide-slate-100">
                  {createdForms.map((f) => (
                    <div key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{f.title}</div>
                        <div className="text-[10px] text-slate-500">Tautan Pengisian: {f.url}</div>
                      </div>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold rounded-lg border border-purple-200 flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Form Pengisian</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GOOGLE MEET */}
        {activeTab === 'meet' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Video className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Ruang Kelas Tatap Maya Resmi Google Meet (REST API v2)
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Buat ruang konferensi video Google Meet instan untuk sesi kuliah umum daring, responsi tutorial kalkulus, atau konsultasi wali kelas secara aman.
              </p>

              <button
                onClick={handleCreateGoogleMeet}
                disabled={isCreatingMeet}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Video className={`w-4 h-4 ${isCreatingMeet ? 'animate-spin' : ''}`} />
                <span>{isCreatingMeet ? 'Membuat Ruang Meet...' : 'Buat Ruang Tatap Maya Google Meet Sekarang'}</span>
              </button>

              {activeMeetRoom && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 space-y-3 mt-4">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Ruang Google Meet Berhasil Dibuka!</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-mono text-xs text-slate-900 font-bold">
                      {activeMeetRoom.uri}
                    </code>

                    <button
                      onClick={copyMeetLink}
                      className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      {isCopiedMeet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedMeet ? 'Tersalin!' : 'Salin Tautan'}</span>
                    </button>

                    <a
                      href={activeMeetRoom.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <span>Masuk ke Google Meet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
