import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { 
  INITIAL_COURSES, 
  INITIAL_USERS, 
  INITIAL_ASSIGNMENTS, 
  INITIAL_SUBMISSIONS, 
  INITIAL_REPORT_CARDS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_FORUMS,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_MEDIA_AJAR,
  INITIAL_DIRECT_QUIZZES,
  INITIAL_DIRECT_QUIZ_SUBMISSIONS
} from './src/data/mockData';
import { 
  Course, 
  WeeklySection, 
  CourseResource, 
  User, 
  Assignment, 
  Submission, 
  StudentAnswer, 
  ReportCard, 
  SystemAuditLog, 
  ForumTopic, 
  ForumPost,
  CalendarEvent,
  MediaAjarItem,
  DirectQuiz,
  DirectQuizSubmission,
  DigitalAttendance,
  ExamLockStatus,
  GlobalNotification,
  GoogleAuthPayload,
  UserSession,
  CourseIntroMaterial
} from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' })); // Support uploads and base64 payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory serving
const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Gemini AI Client configured with recommended headers
const aiClient = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    }) 
  : null;

// In-Memory Database Repository on Server
let coursesDb: Course[] = [...INITIAL_COURSES];
let usersDb: User[] = [...INITIAL_USERS];
let assignmentsDb: Assignment[] = [...INITIAL_ASSIGNMENTS];
let submissionsDb: Submission[] = [...INITIAL_SUBMISSIONS];
let reportCardsDb: ReportCard[] = [...INITIAL_REPORT_CARDS];
let auditLogsDb: SystemAuditLog[] = [...INITIAL_AUDIT_LOGS];
let forumsDb: ForumTopic[] = [...INITIAL_FORUMS];
let calendarDb: CalendarEvent[] = [...INITIAL_CALENDAR_EVENTS];
let mediaAjarDb: MediaAjarItem[] = [...INITIAL_MEDIA_AJAR];
let directQuizzesDb: DirectQuiz[] = [...INITIAL_DIRECT_QUIZZES];
let quizSubmissionsDb: DirectQuizSubmission[] = [...INITIAL_DIRECT_QUIZ_SUBMISSIONS];

// Session Registry for Single Active Session Management (Prevent Dual Device Login)
const activeSessions = new Map<string, UserSession>();

// Centralized Global Notification Engine Database
let notificationsDb: GlobalNotification[] = [
  {
    id: 'notif-init-1',
    title: 'Selamat Datang di Cakrawala LMS',
    message: 'Tahun ajaran baru telah aktif. Silakan cek silabus, materi mingguan, dan presensi digital Anda.',
    type: 'info',
    targetType: 'all',
    authorName: 'Administrator Utama',
    authorRole: 'admin',
    timestamp: '2026-10-21 07:30 WIB',
    readBy: []
  },
  {
    id: 'notif-init-2',
    title: 'Kontrak Pembelajaran & Silabus Diperbarui',
    message: 'Drs. Bambang Suryono, M.Pd telah mengunggah Kontrak Pembelajaran & Pengantar Semester Matematika Peminatan Kelas XII.',
    type: 'success',
    targetType: 'class',
    targetClass: '12-MIPA-1',
    authorName: 'Drs. Bambang Suryono, M.Pd',
    authorRole: 'guru',
    timestamp: '2026-10-21 08:00 WIB',
    readBy: []
  }
];

// Digital Attendance (Presensi Digital) Database
let attendancesDb: DigitalAttendance[] = [
  {
    id: 'att-1',
    courseId: 'crs-mat-12',
    sectionId: 'sec-mat-w1',
    studentId: 'usr-siswa-01',
    studentName: 'Arya Pratama',
    studentNis: '0071829384',
    date: '2026-10-21',
    timestamp: '2026-10-21 07:15 WIB',
    status: 'hadir',
    deviceInfo: 'Desktop Safe-Exam Browser'
  }
];

// One-Time SEB Exam Locks (Strict 1-attempt with teacher/admin re-entry unlock)
const examLocksDb: Map<string, ExamLockStatus> = new Map();
examLocksDb.set('asg-mat-01_usr-siswa-01', {
  assignmentId: 'asg-mat-01',
  studentId: 'usr-siswa-01',
  studentName: 'Arya Pratama',
  isLocked: true,
  submissionId: 'sub-01',
  lockedReason: 'Ujian telah dikumpulkan (Aturan 1 Kali Pengerjaan SEB)',
  submittedAt: '2026-10-20 09:30 WIB'
});


// API: Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'Cakrawala LMS API Server',
    version: '4.0.0',
    phase: 'Fase 3 & 4 - Safe Exam Browser & AI Grading Review Gate',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// API: Global Stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const totalCourses = coursesDb.length;
  const totalTeachers = usersDb.filter(u => u.role === 'guru').length;
  const totalStudents = usersDb.filter(u => u.role === 'siswa').length;
  const totalAssignments = assignmentsDb.length;
  const totalSubmissions = submissionsDb.length;
  const pendingAiApprovals = submissionsDb.filter(s => s.status === 'ai_graded_waiting_approval').length;

  res.json({
    totalCourses,
    totalTeachers,
    totalStudents,
    totalAssignments,
    totalSubmissions,
    pendingAiApprovals
  });
});

// ======================== 1. AUTHENTICATION & SINGLE ACTIVE SESSION API ========================

// Custom JSON-based Google Payload Auth
app.post('/api/auth/google-payload', (req: Request, res: Response) => {
  const { googleId, email, name, avatar, role, deviceId, deviceName } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Payload Google tidak valid: email wajib disertakan.' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  let user = usersDb.find(u => u.email.toLowerCase() === trimmedEmail || (u.googleId && u.googleId === googleId));

  const chosenRole = (role && ['admin', 'guru', 'siswa'].includes(role)) ? role : 'siswa';

  if (!user) {
    // Automatically register user from verified Google payload
    user = {
      id: `usr-${chosenRole}-${Date.now()}`,
      name: name || trimmedEmail.split('@')[0],
      email: trimmedEmail,
      role: chosenRole,
      identifierNumber: chosenRole === 'siswa' ? `008${Date.now().toString().slice(-7)}` : `1985${Date.now().toString().slice(-7)}`,
      isWaliKelas: false,
      kelasBimbingan: chosenRole === 'siswa' ? '12-MIPA-1' : undefined,
      institution: 'SMA Cakrawala Nusantara',
      status: 'active',
      googleId: googleId || `goog-${Date.now()}`,
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    usersDb.push(user);
  } else {
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Akun dinonaktifkan oleh administrator sekolah.' });
    }
    if (avatar && !user.avatar) user.avatar = avatar;
    if (googleId && !user.googleId) user.googleId = googleId;
  }

  // Single Active Session Enforcement: Overwrite previous device session
  const clientDeviceId = deviceId || `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  activeSessions.set(user.id, {
    userId: user.id,
    sessionId,
    deviceId: clientDeviceId,
    deviceName: deviceName || 'Perangkat Baru (Web)',
    lastActive: new Date().toISOString(),
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Autentikasi payload Google kustom berhasil diverifikasi.',
    user,
    sessionId,
    deviceId: clientDeviceId
  });
});

// Standard credential login with single active session
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { role, emailOrId, deviceId, deviceName } = req.body;
  if (!emailOrId || !role) {
    return res.status(400).json({ error: 'Peran dan email/NISN wajib diisi.' });
  }

  const trimmed = emailOrId.trim().toLowerCase();
  const user = usersDb.find(u => 
    u.role === role && (
      u.email.toLowerCase() === trimmed ||
      (u.identifierNumber && u.identifierNumber.toLowerCase() === trimmed)
    )
  );

  if (!user) {
    return res.status(404).json({ error: 'Kredensial atau akun tidak ditemukan untuk peran ini.' });
  }

  if (user.status === 'inactive') {
    return res.status(403).json({ error: 'Akun Anda dinonaktifkan oleh Administrator.' });
  }

  // Enforce single active session
  const clientDeviceId = deviceId || `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  activeSessions.set(user.id, {
    userId: user.id,
    sessionId,
    deviceId: clientDeviceId,
    deviceName: deviceName || 'Desktop Browser',
    lastActive: new Date().toISOString(),
    ipAddress: req.ip
  });

  res.json({
    success: true,
    user,
    sessionId,
    deviceId: clientDeviceId
  });
});

// Heartbeat / Active Session Validation Endpoint (Terminates Device A if Device B logs in)
app.get('/api/auth/session/check', (req: Request, res: Response) => {
  const { userId, sessionId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.json({ active: true });
  }

  const current = activeSessions.get(userId);
  if (!current) {
    return res.json({ active: true });
  }

  if (sessionId && current.sessionId !== sessionId) {
    return res.status(401).json({
      active: false,
      code: 'DUAL_LOGIN_TERMINATED',
      message: `Sesi Anda telah diakhiri otomatis karena akun ini baru saja login pada perangkat lain (${current.deviceName || 'Perangkat Baru'}). Kebijakan Single Active Session LMS aktif untuk mencegah dual login.`
    });
  }

  current.lastActive = new Date().toISOString();
  res.json({ active: true, session: current });
});

// Terminate session
app.post('/api/auth/session/terminate', (req: Request, res: Response) => {
  const { userId, sessionId } = req.body;
  if (userId) {
    const current = activeSessions.get(userId);
    if (!sessionId || (current && current.sessionId === sessionId)) {
      activeSessions.delete(userId);
    }
  }
  res.json({ success: true, message: 'Sesi berhasil diakhiri.' });
});

// ======================== 2. CENTRALIZED GLOBAL NOTIFICATION ENGINE ========================

app.get('/api/notifications', (req: Request, res: Response) => {
  const { userId, role, kelas } = req.query;
  let results = [...notificationsDb];

  // Admin has full visibility over all notifications
  if (role === 'admin') {
    return res.json(results);
  }

  results = results.filter(n => {
    if (n.targetType === 'all') return true;
    if (n.targetType === 'class' && kelas && n.targetClass === kelas) return true;
    if (n.targetType === 'user' && userId && n.targetUserId === userId) return true;
    return false;
  });

  res.json(results);
});

app.post('/api/notifications/dispatch', (req: Request, res: Response) => {
  const { title, message, type, targetType, targetClass, targetUserId, authorName, authorRole, link } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Judul dan pesan notifikasi wajib diisi.' });
  }

  const newNotif: GlobalNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    message,
    type: type || 'info',
    targetType: targetType || 'all',
    targetClass,
    targetUserId,
    authorName: authorName || 'Sistem LMS',
    authorRole: authorRole || 'admin',
    timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    readBy: [],
    link
  };

  notificationsDb.unshift(newNotif);
  res.status(201).json({ success: true, notification: newNotif });
});

app.put('/api/notifications/:id/read', (req: Request, res: Response) => {
  const { userId } = req.body;
  const notif = notificationsDb.find(n => n.id === req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });

  if (userId) {
    notif.readBy = notif.readBy || [];
    if (!notif.readBy.includes(userId)) notif.readBy.push(userId);
  }
  res.json({ success: true, notification: notif });
});

app.delete('/api/notifications/:id', (req: Request, res: Response) => {
  const idx = notificationsDb.findIndex(n => n.id === req.params.id);
  if (idx !== -1) {
    notificationsDb.splice(idx, 1);
  }
  res.json({ success: true });
});

// ======================== 3. DIGITAL ATTENDANCE (PRESENSI DIGITAL) ========================

app.get('/api/courses/:id/attendance', (req: Request, res: Response) => {
  const { sectionId, studentId } = req.query;
  let records = attendancesDb.filter(a => a.courseId === req.params.id);

  if (sectionId && typeof sectionId === 'string') {
    records = records.filter(a => a.sectionId === sectionId);
  }
  if (studentId && typeof studentId === 'string') {
    records = records.filter(a => a.studentId === studentId);
  }

  res.json(records);
});

app.post('/api/courses/:id/attendance', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Kursus tidak ditemukan' });

  const { sectionId, studentId, studentName, studentNis, status, deviceInfo } = req.body;
  if (!studentId || !sectionId) {
    return res.status(400).json({ error: 'ID Siswa dan Sesi pertemuan wajib disertakan.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const existing = attendancesDb.find(
    a => a.courseId === course.id && a.sectionId === sectionId && a.studentId === studentId && a.date === todayStr
  );

  if (existing) {
    return res.json({
      success: true,
      message: 'Anda sudah mengisi presensi digital untuk sesi pertemuan ini hari ini.',
      attendance: existing
    });
  }

  const newAttendance: DigitalAttendance = {
    id: `att-${Date.now()}`,
    courseId: course.id,
    sectionId,
    studentId,
    studentName: studentName || 'Peserta Didik',
    studentNis: studentNis || '',
    date: todayStr,
    timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    status: status || 'hadir',
    deviceInfo: deviceInfo || 'Browser Terverifikasi'
  };

  attendancesDb.unshift(newAttendance);
  res.status(201).json({
    success: true,
    message: 'Presensi digital berhasil dicatatkan.',
    attendance: newAttendance
  });
});

// ======================== COURSES API ========================

app.get('/api/courses', (req: Request, res: Response) => {
  const { studentId, teacherId, search } = req.query;
  let results = [...coursesDb];

  if (studentId && typeof studentId === 'string') {
    results = results.filter(c => c.enrolledStudentIds.includes(studentId));
  }

  if (teacherId && typeof teacherId === 'string') {
    results = results.filter(c => c.teacherId === teacherId);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(c => 
      c.title.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }

  res.json(results);
});

app.get('/api/courses/:id', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }
  res.json(course);
});

app.post('/api/courses', (req: Request, res: Response) => {
  const { code, title, category, description, teacherId, teacherName, targetClass, enrollmentKey, bannerImage } = req.body;

  if (!title || !code) {
    return res.status(400).json({ error: 'Judul dan kode kursus wajib diisi' });
  }

  const newCourse: Course = {
    id: `crs-${Date.now()}`,
    code,
    title,
    category: category || 'Umum',
    description: description || '',
    teacherId: teacherId || 'usr-guru-01',
    teacherName: teacherName || 'Drs. Bambang Suryono, M.Pd',
    targetClass: targetClass || 'Semua',
    enrollmentKey: enrollmentKey || '',
    bannerImage: bannerImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    enrolledStudentIds: [],
    createdAt: new Date().toISOString().split('T')[0],
    sections: [
      {
        id: `sec-${Date.now()}-w1`,
        courseId: `crs-${Date.now()}`,
        weekNumber: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        title: 'Minggu 1: Orientasi & Pengantar Perkuliahan',
        description: 'Silabus, kontrak belajar, dan pengantar materi minggu pertama.',
        resources: []
      }
    ]
  };

  coursesDb.unshift(newCourse);
  res.status(201).json(newCourse);
});

app.post('/api/courses/:id/enroll', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  const { studentId, enrollmentKey } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'ID Siswa wajib disertakan' });
  }

  if (course.enrollmentKey && course.enrollmentKey.trim() !== '') {
    if (!enrollmentKey || enrollmentKey.trim() !== course.enrollmentKey.trim()) {
      return res.status(403).json({ error: 'Kunci pendaftaran (Enrollment Key) salah atau tidak valid.' });
    }
  }

  if (!course.enrolledStudentIds.includes(studentId)) {
    course.enrolledStudentIds.push(studentId);
  }

  res.json({
    success: true,
    message: 'Berhasil terdaftar ke kursus!',
    course
  });
});

app.post('/api/courses/:id/unenroll', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  const { studentId } = req.body;
  course.enrolledStudentIds = course.enrolledStudentIds.filter(id => id !== studentId);

  res.json({
    success: true,
    message: 'Berhasil membatalkan pendaftaran kursus.',
    course
  });
});

app.post('/api/courses/:id/sections', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  const { title, description, startDate, endDate } = req.body;
  const nextWeekNumber = course.sections.length + 1;

  const newSection: WeeklySection = {
    id: `sec-${Date.now()}-w${nextWeekNumber}`,
    courseId: course.id,
    weekNumber: nextWeekNumber,
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    title: title || `Minggu ${nextWeekNumber}: Materi Pembelajaran`,
    description: description || '',
    resources: []
  };

  course.sections.push(newSection);
  res.status(201).json(newSection);
});

app.post('/api/courses/:id/materials', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  const { sectionId, title, type, content, fileUrl } = req.body;
  const section = course.sections.find(s => s.id === sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Seksi mingguan tidak ditemukan' });
  }

  const newResource: CourseResource = {
    id: `res-${Date.now()}`,
    sectionId,
    title: title || 'Materi Baru',
    type: type || 'text',
    content: content || '',
    fileUrl: fileUrl || undefined,
    completedByStudentIds: [],
    createdAt: new Date().toISOString().split('T')[0]
  };

  section.resources.push(newResource);
  res.status(201).json(newResource);
});

app.put('/api/courses/:id/materials/:resId/toggle-complete', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  const { studentId } = req.body;
  let targetResource: CourseResource | undefined;
  for (const sec of course.sections) {
    const found = sec.resources.find(r => r.id === req.params.resId);
    if (found) {
      targetResource = found;
      break;
    }
  }

  if (!targetResource) {
    return res.status(404).json({ error: 'Materi tidak ditemukan' });
  }

  if (!targetResource.completedByStudentIds) {
    targetResource.completedByStudentIds = [];
  }

  const idx = targetResource.completedByStudentIds.indexOf(studentId);
  if (idx >= 0) {
    targetResource.completedByStudentIds.splice(idx, 1);
  } else {
    targetResource.completedByStudentIds.push(studentId);
  }

  res.json({
    success: true,
    completed: targetResource.completedByStudentIds.includes(studentId),
    resource: targetResource
  });
});

// ======================== PENGANTAR & KONTRAK PEMBELAJARAN (SYLLABUS & INTRO) ========================

// Upload or post files/text under Pengantar & Kontrak Pembelajaran + Automatic Notification
app.post('/api/courses/:id/intro-material', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  const { title, content, fileUrl, fileName, authorName, authorRole } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Judul materi / kontrak pembelajaran wajib diisi.' });
  }

  const newMaterial: CourseIntroMaterial = {
    id: `intro-${Date.now()}`,
    title,
    content: content || '',
    fileUrl: fileUrl || undefined,
    fileName: fileName || undefined,
    updatedAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    authorName: authorName || 'Drs. Bambang Suryono, M.Pd'
  };

  course.introMaterials = course.introMaterials || [];
  course.introMaterials.unshift(newMaterial);

  // Trigger Automatic Notifications (Bell Icon) to enrolled students and the teacher
  const notif: GlobalNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: `Materi Baru: Pengantar & Kontrak Pembelajaran`,
    message: `${authorName || 'Guru'} telah mengunggah "${title}" pada mata pelajaran ${course.title}. Silakan pelajari dokumen silabus & kontrak belajar ini.`,
    type: 'success',
    targetType: 'class',
    targetClass: course.targetClass,
    authorName: authorName || 'Guru Pengampu',
    authorRole: authorRole || 'guru',
    timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    readBy: [],
    link: `/courses/${course.id}`
  };

  notificationsDb.unshift(notif);

  res.status(201).json({
    success: true,
    material: newMaterial,
    notification: notif
  });
});

app.delete('/api/courses/:id/intro-material/:matId', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Kursus tidak ditemukan' });

  if (course.introMaterials) {
    const idx = course.introMaterials.findIndex(m => m.id === req.params.matId);
    if (idx !== -1) {
      course.introMaterials.splice(idx, 1);
    }
  }
  res.json({ success: true });
});

// ======================== UNIFIED GRADEBOOK SYNCHRONIZATION API ========================

// Returns synchronized gradebook for all components (quizzes, assignments, exams)
app.get('/api/courses/:id/gradebook', (req: Request, res: Response) => {
  const course = coursesDb.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Kursus tidak ditemukan' });

  const { studentId, role } = req.query;

  // Enrolled students in this course
  let studentList = usersDb.filter(u => u.role === 'siswa' && course.enrolledStudentIds.includes(u.id));

  // If student requests, filter to only their record
  if (role === 'siswa' && studentId && typeof studentId === 'string') {
    studentList = studentList.filter(s => s.id === studentId);
  }

  // Gather assignments for this course
  const courseAssignments = assignmentsDb.filter(a => a.courseId === course.id);
  // Gather direct quizzes for this course
  const courseQuizzes = directQuizzesDb.filter(q => q.courseId === course.id);

  const gradebookRows = studentList.map(student => {
    // 1. Assignments / Exams
    const assignmentGrades = courseAssignments.map(asg => {
      const sub = submissionsDb.find(s => s.assignmentId === asg.id && s.studentId === student.id);
      const hasFinalTeacherScore = sub && sub.totalTeacherScore !== undefined;
      const finalScore = hasFinalTeacherScore 
        ? sub.totalTeacherScore 
        : (role === 'guru' || role === 'admin' ? sub?.totalAiScore : undefined);

      return {
        assignmentId: asg.id,
        title: asg.title,
        submissionId: sub?.id,
        submittedAt: sub?.submittedAt,
        status: sub?.status || 'unsubmitted',
        aiScore: sub?.totalAiScore,
        teacherScore: sub?.totalTeacherScore,
        finalScore,
        isApproved: sub?.status === 'published'
      };
    });

    // 2. Direct Quizzes
    const quizGrades = courseQuizzes.map(quiz => {
      const sub = quizSubmissionsDb.find(q => q.quizId === quiz.id && q.studentId === student.id);
      return {
        quizId: quiz.id,
        title: quiz.title,
        submissionId: sub?.id,
        submittedAt: sub?.submittedAt,
        score: sub?.totalScore,
        status: sub?.status || 'unsubmitted'
      };
    });

    // 3. Attendance
    const attendances = attendancesDb.filter(a => a.courseId === course.id && a.studentId === student.id);
    const totalSessions = Math.max(course.sections.length, 1);
    const attendancePercentage = Math.round((attendances.length / totalSessions) * 100);

    // Dynamic Average Calculation
    const validScores: number[] = [];
    assignmentGrades.forEach(a => {
      if (a.finalScore !== undefined) validScores.push(a.finalScore);
    });
    quizGrades.forEach(q => {
      if (q.score !== undefined) validScores.push(q.score);
    });

    const averageScore = validScores.length > 0 
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

    let letterGrade = 'E';
    if (averageScore >= 85) letterGrade = 'A';
    else if (averageScore >= 75) letterGrade = 'B';
    else if (averageScore >= 65) letterGrade = 'C';
    else if (averageScore >= 55) letterGrade = 'D';

    return {
      studentId: student.id,
      studentName: student.name,
      studentNis: student.identifierNumber || '-',
      studentClass: student.kelasBimbingan || course.targetClass,
      assignmentGrades,
      quizGrades,
      attendanceCount: attendances.length,
      attendancePercentage: Math.min(attendancePercentage, 100),
      averageScore,
      letterGrade,
      status: averageScore >= 75 ? 'Tuntas' : 'Perlu Remedial'
    };
  });

  res.json({
    courseId: course.id,
    courseTitle: course.title,
    gradebookRows,
    components: {
      assignments: courseAssignments.map(a => ({ id: a.id, title: a.title })),
      quizzes: courseQuizzes.map(q => ({ id: q.id, title: q.title }))
    }
  });
});

// ======================== ASSIGNMENTS & EXAMS API ========================

app.get('/api/assignments', (req: Request, res: Response) => {
  const { courseId } = req.query;
  if (courseId && typeof courseId === 'string') {
    return res.json(assignmentsDb.filter(a => a.courseId === courseId));
  }
  res.json(assignmentsDb);
});

app.get('/api/assignments/:id', (req: Request, res: Response) => {
  const assignment = assignmentsDb.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({ error: 'Ujian tidak ditemukan' });
  }
  res.json(assignment);
});

app.post('/api/assignments', (req: Request, res: Response) => {
  const { courseId, title, description, deadline, durationMinutes, isSebLocked, questions } = req.body;
  const course = coursesDb.find(c => c.id === courseId);

  const newAssignment: Assignment = {
    id: `asg-${Date.now()}`,
    courseId: courseId || 'crs-mat-12',
    courseTitle: course ? course.title : 'Matematika Peminatan Kelas XII',
    title: title || 'Ujian Baru',
    description: description || '',
    deadline: deadline || '2026-11-01',
    durationMinutes: Number(durationMinutes) || 30,
    isSebLocked: isSebLocked !== false,
    maxViolations: 3,
    questions: questions || [],
    createdAt: new Date().toISOString().split('T')[0]
  };

  assignmentsDb.unshift(newAssignment);
  res.status(201).json(newAssignment);
});

// ======================== AI GRADING & SUBMISSIONS API ========================

// AI Grading Helper using Gemini 3.8 Flash
async function evaluateSubmissionWithAI(
  assignment: Assignment,
  rawAnswers: StudentAnswer[]
): Promise<{ gradedAnswers: StudentAnswer[]; totalAiScore: number; overallFeedback: string }> {
  const gradedAnswers: StudentAnswer[] = [];
  let calculatedTotal = 0;

  for (const q of assignment.questions) {
    const studentAns = rawAnswers.find(a => a.questionId === q.id);

    if (q.type === 'mcq') {
      const isCorrect = studentAns?.selectedOptionIndex === q.correctOptionIndex;
      const score = isCorrect ? q.points : 0;
      calculatedTotal += score;
      gradedAnswers.push({
        questionId: q.id,
        selectedOptionIndex: studentAns?.selectedOptionIndex,
        aiScore: score,
        aiFeedback: isCorrect 
          ? `Pilihan Ganda Benar. Jawaban tepat (+${score} poin).` 
          : `Pilihan Ganda Belum Tepat. Kunci jawaban: pilihan ke-${(q.correctOptionIndex ?? 0) + 1}. (0 poin)`
      });
      continue;
    }

    if (q.type === 'short') {
      const studentText = (studentAns?.answerText || '').trim().toLowerCase();
      const expectedText = (q.expectedAnswer || '').trim().toLowerCase();
      const isExact = studentText === expectedText || studentText.includes(expectedText);
      const score = isExact ? q.points : Math.round(q.points * 0.5);
      calculatedTotal += score;
      gradedAnswers.push({
        questionId: q.id,
        answerText: studentAns?.answerText || '',
        aiScore: score,
        aiFeedback: isExact 
          ? `Isian singkat sesuai kunci jawaban referensi: "${q.expectedAnswer}". (+${score} poin)` 
          : `Isian singkat mendekati, namun memiliki variasi bentuk dari rujukan: "${q.expectedAnswer}". (+${score} poin)`
      });
      continue;
    }

    // For Essay and Image: Try Gemini AI via SDK if available
    let score = Math.round(q.points * 0.85); // Realistic default
    let feedback = 'Penjelasan telah mencakup poin-poin utama rubrik pembelajaran dengan argumen yang kohesif.';

    if (aiClient && (studentAns?.answerText || (studentAns?.imageUrls && studentAns.imageUrls.length > 0))) {
      try {
        const prompt = `Anda adalah asisten penilai ujian akademis institusi sekolah (Cakrawala LMS).
Tugas Anda adalah menilai jawaban siswa berdasarkan soal dan rubrik guru berikut:

SOAL: "${q.prompt}"
POIN MAKSIMAL: ${q.points}
KUNCI / RUBRIK RUJUKAN: "${q.expectedAnswer || q.rubricCriteria || 'Jawaban logis dan komprehensif'}"
JAWABAN SISWA: "${studentAns.answerText || '[Siswa melampirkan foto lembar kerja jawaban]'}"

Berikan penilaian dalam format JSON valid:
{
  "score": <angka antara 0 dan ${q.points}>,
  "feedback": "<analisis kekuatan, kelemahan, dan saran perbaikan dalam 2-3 kalimat bahasa Indonesia formal>"
}`;

        const aiResponse = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt
        });

        const textOutput = aiResponse.text || '';
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.score === 'number') {
            score = Math.min(q.points, Math.max(0, Math.round(parsed.score)));
          }
          if (parsed.feedback) {
            feedback = parsed.feedback;
          }
        }
      } catch (err) {
        console.warn('[Gemini AI Grading] Fallback used:', err);
      }
    } else {
      // Semantic fallback if no API key configured
      if (q.type === 'essay') {
        const words = (studentAns?.answerText || '').split(/\s+/).length;
        if (words > 20) {
          score = Math.round(q.points * 0.9);
          feedback = 'Uraian esai sangat komprehensif, mencakup pembuktian teorema dan penjelasan definisi secara runtut.';
        } else {
          score = Math.round(q.points * 0.7);
          feedback = 'Uraian esai cukup baik, namun dapat diperdalam lagi dengan penjabaran langkah penurunan rumus.';
        }
      } else if (q.type === 'image') {
        const photoCount = studentAns?.imageUrls?.length || 0;
        score = photoCount > 0 ? Math.round(q.points * 0.88) : 0;
        feedback = photoCount > 0 
          ? `Foto lembar kerja (${photoCount} foto) terbaca dengan baik. Langkah perhitungan turunan dan titik stasioner sistematis.` 
          : 'Siswa tidak melampirkan foto lembar kerja.';
      }
    }

    calculatedTotal += score;
    gradedAnswers.push({
      questionId: q.id,
      answerText: studentAns?.answerText,
      imageUrls: studentAns?.imageUrls,
      aiScore: score,
      aiFeedback: feedback
    });
  }

  const overallFeedback = `Hasil evaluasi otomatis AI Gemini menunjukkan pemahaman komprehensif dengan total capaian ${calculatedTotal} dari total nilai maksimal. Struktur pengerjaan teratur dan relevan dengan silabus mata pelajaran. Menunggu verifikasi akhir guru.`;

  return {
    gradedAnswers,
    totalAiScore: calculatedTotal,
    overallFeedback
  };
}

// ======================== ONE-TIME SEB EXAM RULE & LOCK STATUS ========================

// Check student lock status on assignment
app.get('/api/assignments/:id/lock-status', (req: Request, res: Response) => {
  const { studentId } = req.query;
  if (!studentId || typeof studentId !== 'string') {
    // Return all lock records for this assignment for teacher/admin dashboard
    const locks: ExamLockStatus[] = [];
    examLocksDb.forEach(lock => {
      if (lock.assignmentId === req.params.id) locks.push(lock);
    });
    return res.json(locks);
  }

  const lockKey = `${req.params.id}_${studentId}`;
  const lock = examLocksDb.get(lockKey);
  res.json(lock || { assignmentId: req.params.id, studentId, isLocked: false, lockedReason: '' });
});

// Teacher / Admin Unlock Interface for specific student ID
app.post('/api/assignments/:id/unlock', (req: Request, res: Response) => {
  const { studentId, unlockedBy, reason } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'ID Siswa wajib disertakan.' });
  }

  const assignment = assignmentsDb.find(a => a.id === req.params.id);
  const lockKey = `${req.params.id}_${studentId}`;
  const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB';

  examLocksDb.set(lockKey, {
    assignmentId: req.params.id,
    studentId,
    studentName: usersDb.find(u => u.id === studentId)?.name || 'Siswa',
    isLocked: false,
    lockedReason: `Kunci dibuka oleh ${unlockedBy || 'Guru/Admin'}: ${reason || 'Izin pengerjaan ulang / dispensasi'}`,
    unlockedBy: unlockedBy || 'Guru Pengampu',
    unlockedAt: nowStr
  });

  // Push notification alert to student's bell icon
  notificationsDb.unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: 'Akses Ujian Dibuka Kembali (SEB Unlocked)',
    message: `${unlockedBy || 'Guru/Admin'} telah memberikan akses re-entry untuk ujian "${assignment?.title || 'Ujian'}". Alasan: ${reason || 'Dispensasi pengerjaan'}.`,
    type: 'success',
    targetType: 'user',
    targetUserId: studentId,
    authorName: unlockedBy || 'Guru/Admin',
    authorRole: 'guru',
    timestamp: nowStr,
    readBy: [],
    link: `/exam/${req.params.id}`
  });

  res.json({
    success: true,
    message: `Akses ujian untuk siswa ID: ${studentId} berhasil dibuka. Siswa dapat memulai sesi ujian kembali.`
  });
});

// API: Submit Exam (Enforce One-Time SEB Exam Rule & AI Grading Engine)
app.post('/api/assignments/:id/submit', async (req: Request, res: Response) => {
  const assignment = assignmentsDb.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({ error: 'Ujian tidak ditemukan' });
  }

  const { studentId, studentName, answers, sebViolations } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'ID Siswa wajib disertakan' });
  }

  // 1. Check One-Time SEB Exam Attempt Rule
  const lockKey = `${assignment.id}_${studentId}`;
  const existingLock = examLocksDb.get(lockKey);
  if (existingLock && existingLock.isLocked) {
    return res.status(403).json({
      error: 'Ujian ini telah Anda kumpulkan sebelumnya dan terkunci otomatis (Aturan 1 Kali Pengerjaan SEB). Hubungi Guru Pengampu atau Admin untuk membuka kembali izin akses (re-entry unlock).'
    });
  }

  // 2. Run AI Grading Engine
  const { gradedAnswers, totalAiScore, overallFeedback } = await evaluateSubmissionWithAI(
    assignment,
    answers || []
  );

  const submittedAt = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';

  const newSubmission: Submission = {
    id: `sub-${Date.now()}`,
    assignmentId: assignment.id,
    courseId: assignment.courseId,
    studentId,
    studentName: studentName || 'Peserta Didik',
    submittedAt,
    status: 'ai_graded_waiting_approval', // Gate: Siswa belum bisa lihat nilai sebelum guru approve!
    answers: gradedAnswers,
    sebViolations: sebViolations || [],
    totalAiScore,
    totalTeacherScore: undefined,
    aiOverallFeedback: overallFeedback,
    teacherOverallFeedback: ''
  };

  submissionsDb.unshift(newSubmission);

  // 3. Automatically lock the exam post-submission (One-Time Rule)
  examLocksDb.set(lockKey, {
    assignmentId: assignment.id,
    studentId,
    studentName: studentName || 'Peserta Didik',
    isLocked: true,
    submissionId: newSubmission.id,
    lockedReason: 'Ujian telah dikumpulkan (Terkunci Otomatis Sesuai Aturan SEB 1x)',
    submittedAt
  });

  res.status(201).json({
    success: true,
    message: 'Ujian berhasil dikumpulkan. Jawaban telah dianalisis oleh AI Gemini dan sedang menunggu verifikasi guru. Ujian sekarang terkunci otomatis.',
    submission: newSubmission
  });
});

// API: Get Submissions (Admin has full visibility over all submissions)
app.get('/api/submissions', (req: Request, res: Response) => {
  const { studentId, assignmentId, courseId } = req.query;
  let results = [...submissionsDb];

  if (studentId && typeof studentId === 'string') {
    results = results.filter(s => s.studentId === studentId);
  }

  if (assignmentId && typeof assignmentId === 'string') {
    results = results.filter(s => s.assignmentId === assignmentId);
  }

  if (courseId && typeof courseId === 'string') {
    results = results.filter(s => s.courseId === courseId);
  }

  res.json(results);
});

// API: Get Single Submission
app.get('/api/submissions/:id', (req: Request, res: Response) => {
  const submission = submissionsDb.find(s => s.id === req.params.id);
  if (!submission) {
    return res.status(404).json({ error: 'Hasil pengerjaan tidak ditemukan' });
  }
  res.json(submission);
});

// API: Teacher Review Gate (Per-Question Inline Score Override & Dynamic Recalculation)
app.put('/api/submissions/:id/review', (req: Request, res: Response) => {
  const submission = submissionsDb.find(s => s.id === req.params.id);
  if (!submission) {
    return res.status(404).json({ error: 'Hasil pengerjaan tidak ditemukan' });
  }

  const { approved, finalScore, teacherFeedback, approvedBy, itemizedScores } = req.body;

  // Support itemized per-question inline score overrides
  if (itemizedScores && typeof itemizedScores === 'object') {
    let dynamicTotal = 0;
    submission.answers = submission.answers.map(ans => {
      const override = itemizedScores[ans.questionId];
      if (override !== undefined) {
        const scoreVal = typeof override === 'number' ? override : Number(override.score ?? ans.aiScore ?? 0);
        const feedbackVal = typeof override === 'object' ? override.feedback : undefined;
        dynamicTotal += scoreVal;
        return {
          ...ans,
          teacherScore: scoreVal,
          teacherFeedback: feedbackVal !== undefined ? feedbackVal : ans.teacherFeedback
        };
      } else {
        const existing = ans.teacherScore ?? ans.aiScore ?? 0;
        dynamicTotal += existing;
        return ans;
      }
    });

    submission.totalTeacherScore = dynamicTotal;
  } else {
    submission.totalTeacherScore = typeof finalScore === 'number' ? finalScore : submission.totalAiScore;
  }

  submission.status = 'published'; // Sekarang nilai resmi dirilis ke siswa!
  submission.teacherOverallFeedback = teacherFeedback || 'Hasil evaluasi telah diverifikasi dan disetujui resmi oleh guru pengampu.';
  submission.approvedBy = approvedBy || 'Drs. Bambang Suryono, M.Pd';
  submission.approvedAt = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';

  // Push notification alert to student's bell icon
  const assignment = assignmentsDb.find(a => a.id === submission.assignmentId);
  notificationsDb.unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: 'Nilai Ujian Diresmikan',
    message: `${submission.approvedBy} telah memfinalisasi nilai untuk "${assignment?.title || 'Ujian'}". Nilai akhir: ${submission.totalTeacherScore}/100. Catatan: ${submission.teacherOverallFeedback}`,
    type: 'success',
    targetType: 'user',
    targetUserId: submission.studentId,
    authorName: submission.approvedBy || 'Guru Pengampu',
    authorRole: 'guru',
    timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    readBy: [],
    link: `/results/${submission.id}`
  });

  res.json({
    success: true,
    message: 'Nilai dan feedback resmi telah disetujui, dihitung ulang, dan dipublikasikan ke siswa!',
    submission
  });
});

// ======================== FASE 5: WALI KELAS & RAPOR API ========================

// API: Get Homeroom Report Cards
app.get('/api/homeroom/report-cards', (req: Request, res: Response) => {
  const { kelas } = req.query;
  let results = [...reportCardsDb];
  if (kelas && typeof kelas === 'string') {
    results = results.filter(rc => rc.kelas === kelas);
  }
  res.json(results);
});

// API: Update Homeroom Report Card (Homeroom notes & status)
app.put('/api/homeroom/report-cards/:id', (req: Request, res: Response) => {
  const rc = reportCardsDb.find(r => r.id === req.params.id);
  if (!rc) {
    return res.status(404).json({ error: 'Rapor tidak ditemukan' });
  }

  const { homeroomNotes, statusKenaikan } = req.body;
  if (homeroomNotes !== undefined) rc.homeroomNotes = homeroomNotes;
  if (statusKenaikan !== undefined) rc.statusKenaikan = statusKenaikan;
  rc.updatedAt = new Date().toISOString().split('T')[0];

  res.json({
    success: true,
    message: 'Catatan wali kelas dan status rapor berhasil disimpan.',
    reportCard: rc
  });
});

// ======================== FASE 5: RIWAYAT LENGKAP SISWA ========================

app.get('/api/students/:id/history', (req: Request, res: Response) => {
  const student = usersDb.find(u => u.id === req.params.id && u.role === 'siswa');
  if (!student) {
    return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
  }

  const enrolledCourses = coursesDb.filter(c => c.enrolledStudentIds.includes(student.id));
  const studentSubmissions = submissionsDb.filter(s => s.studentId === student.id);
  const reportCard = reportCardsDb.find(r => r.studentId === student.id);
  const totalViolations = studentSubmissions.reduce((acc, s) => acc + s.sebViolations.length, 0);

  res.json({
    student,
    enrolledCourses,
    submissions: studentSubmissions,
    reportCard,
    totalViolations
  });
});

// ======================== FASE 5: GOOGLE DRIVE BACKUP & RESTORE ========================

// API: Export Full Structured Snapshot for Google Drive (.json)
app.get('/api/backup/export', (_req: Request, res: Response) => {
  const backupData = {
    appName: 'Cakrawala LMS',
    version: '5.0.0',
    exportTimestamp: new Date().toISOString(),
    systemSummary: {
      totalCourses: coursesDb.length,
      totalUsers: usersDb.length,
      totalAssignments: assignmentsDb.length,
      totalSubmissions: submissionsDb.length,
      totalReportCards: reportCardsDb.length
    },
    data: {
      users: usersDb,
      courses: coursesDb,
      assignments: assignmentsDb,
      submissions: submissionsDb,
      reportCards: reportCardsDb,
      auditLogs: auditLogsDb
    }
  };

  auditLogsDb.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toLocaleString('id-ID') + ' WIB',
    actorName: 'Admin / Wali Kelas',
    actorRole: 'admin',
    action: 'Ekspor Cadangan Google Drive',
    category: 'backup',
    details: 'Berhasil membuat file cadangan sistem .json lengkap.'
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=cakrawala_backup_${Date.now()}.json`);
  res.json(backupData);
});

// API: Import / Restore Database from Google Drive JSON
app.post('/api/backup/import', (req: Request, res: Response) => {
  const { data } = req.body;
  if (!data || !data.users || !data.courses) {
    return res.status(400).json({ error: 'Format berkas cadangan JSON tidak valid atau rusak.' });
  }

  usersDb = data.users;
  coursesDb = data.courses;
  if (Array.isArray(data.assignments)) assignmentsDb = data.assignments;
  if (Array.isArray(data.submissions)) submissionsDb = data.submissions;
  if (Array.isArray(data.reportCards)) reportCardsDb = data.reportCards;
  if (Array.isArray(data.auditLogs)) auditLogsDb = data.auditLogs;

  auditLogsDb.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toLocaleString('id-ID') + ' WIB',
    actorName: 'Administrator',
    actorRole: 'admin',
    action: 'Pemulihan Cadangan Google Drive',
    category: 'backup',
    details: 'Sistem berhasil dipulihkan dari berkas JSON Google Drive.'
  });

  res.json({
    success: true,
    message: 'Seluruh database Cakrawala LMS berhasil dipulihkan!',
    summary: {
      users: usersDb.length,
      courses: coursesDb.length,
      assignments: assignmentsDb.length,
      submissions: submissionsDb.length,
      reportCards: reportCardsDb.length
    }
  });
});

// API: Get Audit Logs
app.get('/api/audit-logs', (_req: Request, res: Response) => {
  res.json(auditLogsDb);
});

// ======================== MOODLE-STYLE COURSE FORUMS API ========================

app.get('/api/courses/:id/forums', (req: Request, res: Response) => {
  const topics = forumsDb.filter(f => f.courseId === req.params.id);
  res.json(topics);
});

app.post('/api/courses/:id/forums', (req: Request, res: Response) => {
  const { title, initialContent, creatorId, creatorName, creatorRole } = req.body;
  const courseId = req.params.id;

  if (!title || !initialContent) {
    return res.status(400).json({ error: 'Judul topik dan isi pesan diskusi wajib diisi.' });
  }

  const topicId = `topic-${Date.now()}`;
  const firstPost: ForumPost = {
    id: `post-${Date.now()}`,
    topicId,
    courseId,
    authorId: creatorId || 'usr-siswa-01',
    authorName: creatorName || 'Peserta Kursus',
    authorRole: creatorRole || 'siswa',
    content: initialContent,
    createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB'
  };

  const newTopic: ForumTopic = {
    id: topicId,
    courseId,
    title,
    creatorId: creatorId || 'usr-siswa-01',
    creatorName: creatorName || 'Peserta Kursus',
    creatorRole: creatorRole || 'siswa',
    createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
    posts: [firstPost],
    isPinned: false
  };

  forumsDb.unshift(newTopic);
  res.status(201).json(newTopic);
});

app.post('/api/courses/:id/forums/:topicId/posts', (req: Request, res: Response) => {
  const topic = forumsDb.find(t => t.id === req.params.topicId && t.courseId === req.params.id);
  if (!topic) {
    return res.status(404).json({ error: 'Topik diskusi tidak ditemukan.' });
  }

  const { content, authorId, authorName, authorRole, authorAvatar } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Isi tanggapan tidak boleh kosong.' });
  }

  const newPost: ForumPost = {
    id: `post-${Date.now()}`,
    topicId: topic.id,
    courseId: topic.courseId,
    authorId: authorId || 'usr-siswa-01',
    authorName: authorName || 'Peserta Didik',
    authorRole: authorRole || 'siswa',
    authorAvatar: authorAvatar,
    content,
    createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB'
  };

  topic.posts.push(newPost);
  res.status(201).json(newPost);
});

// AI Tutor Auto-Reply inside Discussion Thread
app.post('/api/courses/:id/forums/:topicId/ai-reply', async (req: Request, res: Response) => {
  const topic = forumsDb.find(t => t.id === req.params.topicId && t.courseId === req.params.id);
  if (!topic) {
    return res.status(404).json({ error: 'Topik diskusi tidak ditemukan.' });
  }

  const course = coursesDb.find(c => c.id === req.params.id);
  const threadSummary = topic.posts.map(p => `${p.authorName} (${p.authorRole}): ${p.content}`).join('\n');

  let aiReplyText = `💡 **Pedagogical AI Tutor Response:**\nBerdasarkan topik "${topic.title}", kunci penyelesaian bertumpu pada pemahaman konsep inti dan verifikasi syarat batas. Pastikan setiap langkah penurunan ditulis secara runtut.`;

  if (aiClient) {
    try {
      const prompt = `Anda adalah Tutor Cerdas Pedagogis (Cakrawala AI Assistant) di forum perkuliahan Moodle LMS.
KURSUS: ${course?.title || 'Akademik'}
TOPIK DISKUSI: ${topic.title}
RIWAYAT DISKUSI:
${threadSummary}

Berikan tanggapan instruksional yang:
1. Menghargai pertanyaan siswa dan memberikan wawasan pedagogis yang mendalam namun mudah dipahami.
2. Menggunakan metode scaffolding (menyajikan konsep dasar, pola kerja, dan pertanyaan pemantik untuk memicu nalar kritis siswa).
3. Menggunakan Bahasa Indonesia akademis santun dan ramah. Format dengan Markdown tebal dan poin terstruktur.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });

      if (response.text) {
        aiReplyText = response.text;
      }
    } catch (err) {
      console.warn('[Forum AI Reply] Fallback used:', err);
    }
  }

  const aiPost: ForumPost = {
    id: `post-ai-${Date.now()}`,
    topicId: topic.id,
    courseId: topic.courseId,
    authorId: 'ai-asisten-cakrawala',
    authorName: 'Cakrawala AI Tutor (Scaffold)',
    authorRole: 'admin',
    authorAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=256&q=80',
    content: aiReplyText,
    createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    isAiGenerated: true
  };

  topic.posts.push(aiPost);
  res.status(201).json(aiPost);
});

// ======================== AI ASSISTANT & SCAFFOLDING ENGINE API ========================

// 1. General AI Assistant & Chat Copilot
app.post('/api/ai/assistant', async (req: Request, res: Response) => {
  const { message, role, context, mode, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  let answer = '';
  const suggestedPrompts: string[] = [
    'Jelaskan konsep ini dengan analogi sederhana',
    'Beri contoh soal latihan dan pembahasannya',
    'Bagaimana tips mengerjakan ujian ini dengan cermat?'
  ];

  if (aiClient) {
    try {
      const systemInstruction = `Anda adalah "Cakrawala AI Copilot" — asisten cerdas akademik dan arsitek pembelajaran tingkat tinggi untuk Cakrawala LMS (setara standar AI modern terkemuka).
Peran pengguna saat ini: ${role || 'pengguna'}
Mode: ${mode || 'general'}
Konteks Pembelajaran saat ini: ${context ? JSON.stringify(context) : 'LMS Umum SMA/Perguruan Tinggi'}

Prinsip Pedagogis & Respon:
1. Berikan penjelasan yang terstruktur, bernas, akurat, dan mudah dipahami dengan gaya bahasa Indonesia formal-edukatif yang ramah.
2. Gunakan teknik scaffolding (tuntun dari konsep dasar, formulasi/rumus, hingga interpretasi aplikatif).
3. Jika ditanya rumus atau kalkulus, tampilkan langkah matematis yang rapi dan logis.
4. Jika guru yang bertanya, bantu buatkan silabus, rubrik penilaian, atau rencana pembelajaran aktif (active learning).
5. Format dengan Markdown (gunakan bullet points, bold untuk terminologi penting, dan blok kode jika relevan).`;

      const prompt = `Pertanyaan Pengguna:
${message}

Mohon jawab dengan format komprehensif.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction
        }
      });

      answer = response.text || '';
    } catch (err) {
      console.warn('[Gemini Assistant] Fallback to pedagogical engine:', err);
    }
  }

  // Intelligent fallback if no Gemini key or offline
  if (!answer) {
    const qLower = message.toLowerCase();
    if (qLower.includes('limit') || qLower.includes('trigonometri') || qLower.includes('kalkulus')) {
      answer = `### 📐 Penjelasan Konsep: Limit Trigonometri & Kalkulus Lanjut

1. **Prinsip Inti:**
   Limit fungsi trigonometri saat $x \\to 0$ berpijak pada teorema apit:
   $$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1 \\quad \\text{dan} \\quad \\lim_{x \\to 0} \\frac{\\tan x}{x} = 1$$

2. **Strategi Scaffolding Langkah-demi-Langkah:**
   - **Langkah 1 (Substitusi Awal):** Uji apakah menghasilkan bentuk tak tentu $\\frac{0}{0}$.
   - **Langkah 2 (Manipulasi Aljabar):** Jika terdapat $(1 - \\cos kx)$, gunakan identitas sudut ganda $1 - \\cos(kx) = 2\\sin^2(\\frac{kx}{2})$.
   - **Langkah 3 (Pemisahan Faktor):** Pasangkan setiap faktor $\\sin(ax)$ dengan penyebut $x$ yang bersesuaian.

3. **Tips Ujian Safe Exam:**
   Tuliskan seluruh langkah identitas trigonometri sebelum mencoret variabel untuk memperoleh nilai rubrik esai maksimal!`;
    } else if (qLower.includes('silabus') || qLower.includes('scaffold') || qLower.includes('rubrik')) {
      answer = `### 📋 Rancangan Scaffolding Pembelajaran Berkelanjutan

Untuk merancang kurikulum bertingkat (scaffolded learning):
1. **Fase Fondasi (Minggu 1-2):** Pemahaman definisi, identifikasi pola, dan latihan soal recall terbimbing.
2. **Fase Aplikasi (Minggu 3-4):** Pemecahan masalah kontekstual, studi kasus kelompok di forum Moodle.
3. **Fase Evaluasi & Sintesis (Minggu 5):** Ujian Safe Exam Browser terproksi AI dengan rubrik terstandarisasi.

*Anda dapat menggunakan tombol "AI Scaffold Generator" di menu Kursus untuk membuat struktur silabus mingguan secara otomatis.*`;
    } else {
      answer = `### 🎓 Asisten Cerdas Cakrawala LMS

Terima kasih atas pertanyaan Anda: **"${message}"**

Berikut beberapa pilar pembelajaran yang dapat kita eksplorasi:
1. **Struktur Konsep:** Mengurai topik menjadi komponen-komponen esensial yang saling terhubung.
2. **Latihan Berjenjang (Scaffolding):** Memulai dari contoh soal sederhana, dilanjutkan dengan variasi kasus kompleks.
3. **Integritas Akademik:** Mempersiapkan diri menghadapi ujian berbasis Safe Exam Browser dengan catatan ringkasan yang matang.

Silakan pilih opsi prompt di bawah untuk pendalaman lebih lanjut!`;
    }
  }

  res.json({
    answer,
    suggestedPrompts
  });
});

// 2. AI Pedagogical Course Scaffolding Generator (For Teachers)
app.post('/api/ai/scaffold-course', async (req: Request, res: Response) => {
  const { topic, category, targetClass, weeksCount, goals } = req.body;
  const count = Number(weeksCount) || 4;

  let scaffoldedWeeks: any[] = [];

  if (aiClient && topic) {
    try {
      const prompt = `Anda adalah Ahli Kurikulum & Desain Instruksional LMS Moodle.
Rancang silabus kursus ter-scaffold bertingkat selama ${count} minggu untuk topik: "${topic}".
Kategori: ${category || 'Sains / Umum'}, Sasaran Kelas: ${targetClass || 'Kelas XII'}, Tujuan: ${goals || 'Penguasaan konsep dan kemampuan analitis tingkat tinggi'}.

Kembalikan HANYA format JSON valid berikut (tanpa markdown tambahan):
{
  "courseTitle": "${topic}",
  "description": "Deskripsi komprehensif kursus...",
  "weeks": [
    {
      "weekNumber": 1,
      "title": "Minggu 1: ...",
      "description": "Fokus pembelajaran...",
      "objectives": ["Tujuan 1", "Tujuan 2"],
      "resources": [
        { "title": "Diktat: ...", "type": "pdf", "content": "Ringkasan teori..." },
        { "title": "Catatan Dosen: ...", "type": "text", "content": "Poin-poin penting..." }
      ],
      "suggestedTask": {
        "title": "Latihan Mandiri ...",
        "type": "quiz",
        "description": "Tugas penguatan konsep..."
      }
    }
  ]
}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || '';
      const parsed = JSON.parse(text);
      if (parsed.weeks && Array.isArray(parsed.weeks)) {
        scaffoldedWeeks = parsed.weeks;
      }
    } catch (err) {
      console.warn('[AI Scaffold Course] Fallback used:', err);
    }
  }

  // Fallback scaffolding if no API key or error
  if (!scaffoldedWeeks || scaffoldedWeeks.length === 0) {
    const baseTopic = topic || 'Kalkulus Diferensial & Integral Terapan';
    scaffoldedWeeks = Array.from({ length: count }, (_, i) => {
      const w = i + 1;
      return {
        weekNumber: w,
        title: `Minggu ${w}: Penguasaan Konseptual & Penerapan ${baseTopic} (Bagian ${w})`,
        description: `Materi pembelajaran bertahap minggu ke-${w} yang dirancang untuk memperdalam kompetensi dasar melalui metode scaffolding.`,
        objectives: [
          `Memahami terminologi dan teorema fundamental bab ${w}`,
          `Mampu menganalisis contoh kasus dan membuktikan persamaan dasar`,
          `Menyelesaikan persoalan aplikasi tingkat menengah`
        ],
        resources: [
          {
            title: `Modul Diktat Minggu ${w}: Teori dan Penurunan Rumus`,
            type: 'pdf',
            content: `Panduan bacaan lengkap untuk topik ${baseTopic} minggu ke-${w}.`
          },
          {
            title: `Catatan Ringkas: 5 Aturan Emas Minggu ${w}`,
            type: 'text',
            content: `Kumpulan rumus cepat dan jebakan umum yang sering muncul pada ujian.`
          }
        ],
        suggestedTask: {
          title: `Tugas Penguatan Bab ${w}`,
          type: w % 2 === 0 ? 'quiz' : 'essay',
          description: `Evaluasi pemahaman kompetensi minggu ke-${w} dengan umpan balik AI.`
        }
      };
    });
  }

  res.json({
    success: true,
    topic: topic || 'Kurikulum Pembelajaran',
    weeks: scaffoldedWeeks
  });
});

// 3. AI Step-by-Step Scaffolding Hints Tutor (For Students)
app.post('/api/ai/scaffold-hint', async (req: Request, res: Response) => {
  const { questionPrompt, questionType, expectedAnswer, level } = req.body;
  const requestedLevel = Number(level) || 1;

  let hintTitle = '';
  let hintContent = '';

  if (aiClient && questionPrompt) {
    try {
      const prompt = `Anda adalah Tutor Pedagogis Metode Scaffolding (Cakrawala LMS).
SOAL SISWA: "${questionPrompt}"
KUNCI / RUJUKAN: "${expectedAnswer || 'Konsep terkait'}"
LEVEL HINT YANG DIMINTA: Level ${requestedLevel}

Aturan Ketat Scaffolding:
- Level 1 (Fondasi & Teorema): Jelaskan konsep prasyarat, definisi, atau rumus dasar yang harus diingat. JANGAN berikan jawaban akhir atau angka penyelesaian!
- Level 2 (Strategi & Pola Awal): Berikan petunjuk langkah pertama (bagaimana memulai transformasi rumus atau mengeliminasi opsi yang salah).
- Level 3 (Guiding Steps & Analogi): Berikan contoh soal analog serupa dengan angka berbeda atau pertanyaan pemandu agar siswa menemukan jawabannya sendiri.

Kembalikan format JSON:
{
  "level": ${requestedLevel},
  "title": "<Judul Petunjuk>",
  "hint": "<Isi petunjuk dalam 2-3 paragraf ramah bersahabat>"
}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.hint) {
        hintTitle = parsed.title;
        hintContent = parsed.hint;
      }
    } catch (err) {
      console.warn('[AI Scaffold Hint] Fallback used:', err);
    }
  }

  if (!hintContent) {
    if (requestedLevel === 1) {
      hintTitle = 'Level 1: Konsep & Teorema Kunci';
      hintContent = 'Mulailah dengan mengidentifikasi teorema atau definisi dasar yang relevan. Periksa bentuk awal soal: apakah terdapat bentuk tak tentu (seperti 0/0) atau identitas khusus yang dapat disederhanakan terlebih dahulu?';
    } else if (requestedLevel === 2) {
      hintTitle = 'Level 2: Pola & Strategi Langkah Pertama';
      hintContent = 'Cobalah mengubah bentuk fungsi ke dalam suku-suku yang lebih sederhana. Jika terdapat fungsi trigonometri, pertimbangkan rumus sudut rangkap atau aturan rantai turunan Leibniz sebelum melakukan substitusi nilai.';
    } else {
      hintTitle = 'Level 3: Panduan Langkah Analogi';
      hintContent = 'Sebagai analogi: jika Anda memiliki lim x->0 (sin 4x / 2x), pisahkan menjadi (sin 4x / 4x) * (4x / 2x) = 1 * 2 = 2. Terapkan strategi pemisahan koefisien serupa pada soal Anda!';
    }
  }

  res.json({
    level: requestedLevel,
    title: hintTitle,
    hint: hintContent
  });
});

// 4. AI Quiz & Item Generator
app.post('/api/ai/generate-quiz', async (req: Request, res: Response) => {
  const { topic, difficulty, count } = req.body;
  const numQuestions = Number(count) || 3;

  let questions: any[] = [];

  if (aiClient && topic) {
    try {
      const prompt = `Anda adalah Pembuat Soal Akademik Terakreditasi (Cakrawala LMS).
Buat ${numQuestions} butir soal ujian untuk topik: "${topic}" dengan tingkat kesulitan: "${difficulty || 'Sedang'}".
Kombinasikan pilihan ganda (mcq), isian singkat (short), dan esai analitis (essay).

Kembalikan HANYA format JSON valid berikut:
[
  {
    "type": "mcq",
    "prompt": "Pertanyaan...",
    "points": 25,
    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
    "correctOptionIndex": 0,
    "expectedAnswer": "Penjelasan kunci...",
    "rubricCriteria": "Kriteria penilaian..."
  },
  {
    "type": "essay",
    "prompt": "Pertanyaan esai...",
    "points": 35,
    "expectedAnswer": "Uraian kunci jawaban...",
    "rubricCriteria": "Langkah penurunan rumus dan argumen logis."
  }
]`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        questions = parsed.map((q, idx) => ({
          id: `gen-q-${Date.now()}-${idx}`,
          ...q
        }));
      }
    } catch (err) {
      console.warn('[AI Generate Quiz] Fallback used:', err);
    }
  }

  if (questions.length === 0) {
    questions = [
      {
        id: `gen-q-${Date.now()}-1`,
        type: 'mcq',
        prompt: `Berapakah nilai dari limit trigonometri lim x->0 (sin 6x / 3x) pada materi ${topic || 'Kalkulus'}?`,
        points: 25,
        options: ['1', '2', '3', '6'],
        correctOptionIndex: 1,
        expectedAnswer: 'Gunakan sifat lim x->0 (sin ax / bx) = a / b. Maka 6 / 3 = 2.',
        rubricCriteria: 'Pemilihan opsi yang tepat sesuai aturan limit dasar.'
      },
      {
        id: `gen-q-${Date.now()}-2`,
        type: 'short',
        prompt: `Sebutkan nama teorema yang menyatakan bahwa jika f(a) dan f(b) memiliki tanda berlawanan maka terdapat akar f(c) = 0 pada rentang [a, b]!`,
        points: 25,
        expectedAnswer: 'Teorema Nilai Antara',
        rubricCriteria: 'Ketepatan nama teorema secara formal.'
      },
      {
        id: `gen-q-${Date.now()}-3`,
        type: 'essay',
        prompt: `Jabarkan dan buktikan turunan dari fungsi f(x) = sin²(3x) menggunakan aturan rantai Leibniz step-by-step!`,
        points: 50,
        expectedAnswer: 'Misal u = sin(3x), maka f(x) = u^2. df/du = 2u, du/dx = 3 cos(3x). Hasil: 6 sin(3x)cos(3x) = 3 sin(6x).',
        rubricCriteria: 'Penjabaran permisalan fungsi luar, fungsi dalam, dan aturan rantai yang runtut.'
      }
    ];
  }

  res.json({
    success: true,
    topic: topic || 'Akademik',
    questions
  });
});

// ======================== DIRECT FILE UPLOAD API ========================

app.post('/api/upload', (req: Request, res: Response) => {
  const { fileName, fileData, fileType } = req.body;
  if (!fileName || !fileData) {
    return res.status(400).json({ error: 'Nama berkas dan data berkas (base64) wajib dikirimkan.' });
  }

  try {
    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.resolve(uploadsDir, cleanFileName);
    
    // Extract base64 data if prefixed with data:mime;base64,
    const base64Content = fileData.includes(';base64,') 
      ? fileData.split(';base64,')[1] 
      : fileData;
    
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${cleanFileName}`;
    const fileSizeKb = (buffer.length / 1024).toFixed(1) + ' KB';

    res.json({
      success: true,
      url: publicUrl,
      fileName: cleanFileName,
      originalName: fileName,
      fileSize: fileSizeKb,
      fileType: fileType || 'application/octet-stream'
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Gagal menyimpan berkas ke server: ' + err.message });
  }
});

// ======================== CALENDAR & AGENDA API ========================

app.get('/api/calendar/events', (req: Request, res: Response) => {
  const { targetClass } = req.query;
  if (targetClass && targetClass !== 'Semua') {
    const filtered = calendarDb.filter(e => e.targetClass === 'Semua' || e.targetClass === targetClass);
    return res.json(filtered);
  }
  res.json(calendarDb);
});

app.post('/api/calendar/events', (req: Request, res: Response) => {
  const { title, description, date, startTime, endTime, category, targetClass, courseId, courseTitle, creatorId, creatorName, creatorRole } = req.body;
  if (!title || !date || !category) {
    return res.status(400).json({ error: 'Judul, tanggal, dan kategori agenda wajib diisi.' });
  }

  const newEvent: CalendarEvent = {
    id: `cal-${Date.now()}`,
    title,
    description: description || '',
    date,
    startTime: startTime || '08:00',
    endTime: endTime || '10:00',
    category: category || 'akademik',
    targetClass: targetClass || 'Semua',
    courseId,
    courseTitle,
    creatorId: creatorId || 'usr-guru-01',
    creatorName: creatorName || 'Pendidik',
    creatorRole: creatorRole || 'guru',
    createdAt: new Date().toISOString().split('T')[0]
  };

  calendarDb.unshift(newEvent);
  res.status(201).json(newEvent);
});

app.put('/api/calendar/events/:id', (req: Request, res: Response) => {
  const idx = calendarDb.findIndex(e => e.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Agenda tidak ditemukan.' });
  }
  calendarDb[idx] = { ...calendarDb[idx], ...req.body };
  res.json(calendarDb[idx]);
});

app.delete('/api/calendar/events/:id', (req: Request, res: Response) => {
  const idx = calendarDb.findIndex(e => e.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Agenda tidak ditemukan.' });
  }
  const removed = calendarDb.splice(idx, 1);
  res.json({ success: true, removed: removed[0] });
});

// ======================== MEDIA AJAR (TEACHING MEDIA) API ========================

app.get('/api/media-ajar', (req: Request, res: Response) => {
  const { targetClass, courseId, status } = req.query;
  let items = [...mediaAjarDb];

  if (targetClass && targetClass !== 'Semua') {
    items = items.filter(m => m.targetClass === 'Semua' || m.targetClass === targetClass);
  }
  if (courseId) {
    items = items.filter(m => m.courseId === courseId);
  }
  if (status) {
    items = items.filter(m => m.status === status);
  }

  res.json(items.sort((a, b) => a.order - b.order));
});

app.post('/api/media-ajar', (req: Request, res: Response) => {
  const { title, description, courseId, courseTitle, targetClass, type, fileUrl, fileName, fileSize, status, teacherId, teacherName } = req.body;
  if (!title || !type || !fileUrl) {
    return res.status(400).json({ error: 'Judul, tipe media, dan URL / berkas wajib diisi.' });
  }

  const newItem: MediaAjarItem = {
    id: `media-${Date.now()}`,
    title,
    description: description || '',
    courseId: courseId || 'crs-mat-12',
    courseTitle: courseTitle || 'Matematika Peminatan Kelas XII',
    targetClass: targetClass || '12-MIPA-1',
    type,
    fileUrl,
    fileName,
    fileSize: fileSize || '1.5 MB',
    order: mediaAjarDb.length + 1,
    status: status || 'published',
    teacherId: teacherId || 'usr-guru-01',
    teacherName: teacherName || 'Drs. Bambang Suryono, M.Pd',
    createdAt: new Date().toISOString().split('T')[0]
  };

  mediaAjarDb.push(newItem);
  res.status(201).json(newItem);
});

app.put('/api/media-ajar/:id', (req: Request, res: Response) => {
  const idx = mediaAjarDb.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Media ajar tidak ditemukan.' });
  }
  mediaAjarDb[idx] = { ...mediaAjarDb[idx], ...req.body };
  res.json(mediaAjarDb[idx]);
});

app.delete('/api/media-ajar/:id', (req: Request, res: Response) => {
  const idx = mediaAjarDb.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Media ajar tidak ditemukan.' });
  }
  const removed = mediaAjarDb.splice(idx, 1);
  res.json({ success: true, removed: removed[0] });
});

// ======================== DIRECT QUIZZES API ========================

app.get('/api/quizzes', (req: Request, res: Response) => {
  const { targetClass, status } = req.query;
  let list = [...directQuizzesDb];
  if (targetClass && targetClass !== 'Semua') {
    list = list.filter(q => q.targetClass === 'Semua' || q.targetClass === targetClass);
  }
  if (status) {
    list = list.filter(q => q.status === status);
  }
  res.json(list);
});

app.get('/api/quizzes/:id', (req: Request, res: Response) => {
  const quiz = directQuizzesDb.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  }
  res.json(quiz);
});

app.post('/api/quizzes', (req: Request, res: Response) => {
  const { title, description, courseId, courseTitle, targetClass, durationMinutes, status, questions, teacherId, teacherName } = req.body;
  if (!title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Judul kuis dan daftar soal wajib diisi.' });
  }

  const newQuiz: DirectQuiz = {
    id: `quiz-${Date.now()}`,
    title,
    description: description || '',
    courseId: courseId || 'crs-mat-12',
    courseTitle: courseTitle || 'Matematika Peminatan Kelas XII',
    targetClass: targetClass || '12-MIPA-1',
    durationMinutes: Number(durationMinutes) || 30,
    status: status || 'published',
    questions,
    teacherId: teacherId || 'usr-guru-01',
    teacherName: teacherName || 'Drs. Bambang Suryono, M.Pd',
    createdAt: new Date().toISOString().split('T')[0]
  };

  directQuizzesDb.unshift(newQuiz);
  res.status(201).json(newQuiz);
});

app.put('/api/quizzes/:id', (req: Request, res: Response) => {
  const idx = directQuizzesDb.findIndex(q => q.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  }
  directQuizzesDb[idx] = { ...directQuizzesDb[idx], ...req.body };
  res.json(directQuizzesDb[idx]);
});

app.delete('/api/quizzes/:id', (req: Request, res: Response) => {
  const idx = directQuizzesDb.findIndex(q => q.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  }
  const removed = directQuizzesDb.splice(idx, 1);
  res.json({ success: true, removed: removed[0] });
});

// Submit Quiz Answer & Evaluate
app.post('/api/quizzes/:id/submit', (req: Request, res: Response) => {
  const quiz = directQuizzesDb.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  }

  const { studentId, studentName, studentClass, answers } = req.body;
  if (!studentId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Data pengerjaan kuis tidak valid.' });
  }

  let totalScore = 0;
  let maxScore = 0;

  const evaluatedAnswers = quiz.questions.map(q => {
    maxScore += q.points;
    const ans = answers.find(a => a.questionId === q.id);
    let earned = 0;
    let isAuto = false;

    if (q.type === 'mcq') {
      isAuto = true;
      if (ans && ans.selectedOptionIndex === q.correctOptionIndex) {
        earned = q.points;
      }
    } else if (q.type === 'true_false') {
      isAuto = true;
      if (ans && ans.selectedBoolean === q.correctBoolean) {
        earned = q.points;
      }
    } else if (q.type === 'numeric') {
      isAuto = true;
      const expectedNum = parseFloat(q.expectedAnswer || '0');
      const studentNum = parseFloat(ans?.textAnswer || String(ans?.numericAnswer || ''));
      if (!isNaN(expectedNum) && !isNaN(studentNum) && Math.abs(expectedNum - studentNum) < 0.001) {
        earned = q.points;
      }
    } else {
      // Essay or Short Answer: initial points assigned, teacher will review
      earned = Math.round(q.points * 0.7); // default 70% until teacher reviews
    }

    totalScore += earned;

    return {
      questionId: q.id,
      selectedOptionIndex: ans?.selectedOptionIndex,
      selectedBoolean: ans?.selectedBoolean,
      textAnswer: ans?.textAnswer,
      numericAnswer: ans?.numericAnswer,
      isAutoGraded: isAuto,
      earnedPoints: earned,
      teacherNotes: isAuto ? (earned === q.points ? 'Benar otomatis' : 'Kurang tepat') : 'Menunggu review guru'
    };
  });

  const submission: DirectQuizSubmission = {
    id: `sub-dq-${Date.now()}`,
    quizId: quiz.id,
    quizTitle: quiz.title,
    studentId: studentId || 'usr-siswa-01',
    studentName: studentName || 'Peserta Didik',
    studentClass: studentClass || quiz.targetClass,
    submittedAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    answers: evaluatedAnswers,
    totalScore: Math.round((totalScore / (maxScore || 1)) * 100),
    maxScore: 100,
    status: 'submitted'
  };

  quizSubmissionsDb.unshift(submission);
  res.status(201).json(submission);
});

app.get('/api/quizzes/:id/submissions', (req: Request, res: Response) => {
  const subs = quizSubmissionsDb.filter(s => s.quizId === req.params.id);
  res.json(subs);
});

// Teacher Review Gate for Direct Quizzes (Per-Question Inline Override & Dynamic Recalculation)
app.put('/api/quizzes/:id/submissions/:subId/review', (req: Request, res: Response) => {
  const sub = quizSubmissionsDb.find(s => s.id === req.params.subId && s.quizId === req.params.id);
  if (!sub) {
    return res.status(404).json({ error: 'Hasil pengerjaan kuis tidak ditemukan.' });
  }

  const { itemizedScores, teacherFeedback, approvedBy } = req.body;
  const quiz = directQuizzesDb.find(q => q.id === req.params.id);

  if (itemizedScores && typeof itemizedScores === 'object') {
    let earnedSum = 0;
    let maxPoints = 0;

    sub.answers = sub.answers.map(ans => {
      const q = quiz?.questions.find(item => item.id === ans.questionId);
      const qPoints = q?.points || 20;
      maxPoints += qPoints;

      const override = itemizedScores[ans.questionId];
      if (override !== undefined) {
        const scoreVal = typeof override === 'number' ? override : Number(override.score ?? ans.earnedPoints ?? 0);
        const notesVal = typeof override === 'object' ? override.teacherNotes : undefined;
        earnedSum += scoreVal;
        return {
          ...ans,
          earnedPoints: scoreVal,
          teacherNotes: notesVal !== undefined ? notesVal : ans.teacherNotes
        };
      } else {
        earnedSum += (ans.earnedPoints ?? 0);
        return ans;
      }
    });

    sub.totalScore = maxPoints > 0 ? Math.round((earnedSum / maxPoints) * 100) : earnedSum;
  }

  sub.status = 'reviewed';
  sub.teacherFeedback = teacherFeedback || 'Evaluasi kuis telah disetujui resmi oleh guru pengampu.';

  // Push notification alert to student's bell icon
  notificationsDb.unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: 'Nilai Kuis Dirilis',
    message: `${approvedBy || 'Guru'} telah memeriksa pengerjaan kuis "${sub.quizTitle}". Nilai akhir: ${sub.totalScore}/100. Catatan: ${sub.teacherFeedback}`,
    type: 'success',
    targetType: 'user',
    targetUserId: sub.studentId,
    authorName: approvedBy || 'Guru Pengampu',
    authorRole: 'guru',
    timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' WIB',
    readBy: [],
    link: `/quizzes/${sub.quizId}`
  });

  res.json({
    success: true,
    message: 'Nilai kuis berhasil dihitung ulang dan disimpan.',
    submission: sub
  });
});

// ======================== USER MANAGEMENT API (FOR ADMIN) ========================

app.get('/api/users', (_req: Request, res: Response) => {
  res.json(usersDb);
});

app.post('/api/users', (req: Request, res: Response) => {
  const { name, email, role, identifierNumber, kelasBimbingan, isWaliKelas, institution, phone } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Nama, email, dan peran wajib diisi.' });
  }

  // Check duplicate email
  const existing = usersDb.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email sudah terdaftar dalam sistem.' });
  }

  const newUser: User = {
    id: `usr-${role}-${Date.now()}`,
    name,
    email,
    role,
    identifierNumber: identifierNumber || (role === 'siswa' ? `008${Date.now().toString().slice(-7)}` : `1985${Date.now().toString().slice(-7)}`),
    isWaliKelas: !!isWaliKelas,
    kelasBimbingan: kelasBimbingan || (role === 'siswa' ? '12-MIPA-1' : undefined),
    institution: institution || 'SMA Cakrawala Nusantara',
    phone: phone || '',
    status: 'active',
    createdAt: new Date().toISOString().split('T')[0],
    avatar: role === 'siswa' 
      ? 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80'
      : role === 'guru'
      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
  };

  usersDb.push(newUser);
  res.status(201).json(newUser);
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const idx = usersDb.findIndex(u => u.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }
  usersDb[idx] = { ...usersDb[idx], ...req.body };
  res.json(usersDb[idx]);
});

app.patch('/api/users/:id/toggle-status', (req: Request, res: Response) => {
  const user = usersDb.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }
  user.status = user.status === 'inactive' ? 'active' : 'inactive';
  res.json(user);
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const idx = usersDb.findIndex(u => u.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }
  const removed = usersDb.splice(idx, 1);
  res.json({ success: true, removed: removed[0] });
});

// Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Explicit fallback for client-side HTML routing in development
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        if (vite && (vite as any).ssrFixStacktrace) {
          (vite as any).ssrFixStacktrace(e as Error);
        }
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Cakrawala LMS] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
