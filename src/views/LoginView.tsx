import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types';
import { 
  GraduationCap, 
  UserCheck, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowLeft, 
  Sparkles, 
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  HelpCircle,
  X
} from 'lucide-react';

interface LoginViewProps {
  initialRole: UserRole;
  onNavigate: (view: string, roleParam?: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ initialRole, onNavigate }) => {
  const { login, loginWithGoogle, users, sessionTerminationNotice, clearSessionTerminationNotice } = useAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const [role, setRole] = useState<UserRole>(() => {
    return initialRole && ['siswa', 'guru', 'admin'].includes(initialRole) ? initialRole : 'siswa';
  });
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password & Google modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role metadata styling (Academic Blue Scheme)
  const roleConfigMap = {
    siswa: {
      title: t('loginAsStudent'),
      badge: 'Portal Peserta Didik (Siswa)',
      color: 'blue',
      icon: GraduationCap,
      demoAccount: users.find(u => u.role === 'siswa') || {
        email: 'arya@siswa.cakrawala.sch.id',
        name: 'Arya Pratama',
        id: 'usr-siswa-01'
      }
    },
    guru: {
      title: t('loginAsTeacher'),
      badge: 'Portal Tenaga Pengajar & Wali Kelas',
      color: 'blue',
      icon: UserCheck,
      demoAccount: users.find(u => u.role === 'guru') || {
        email: 'bambang@cakrawala.sch.id',
        name: 'Drs. Bambang Suryono',
        id: 'usr-guru-01'
      }
    },
    admin: {
      title: t('loginAsAdmin'),
      badge: 'Portal Administrator Sistem (Site Admin)',
      color: 'blue',
      icon: ShieldCheck,
      demoAccount: users.find(u => u.role === 'admin') || {
        email: 'admin@cakrawala.sch.id',
        name: 'Administrator',
        id: 'usr-admin-01'
      }
    }
  };

  const roleConfig = roleConfigMap[role] || roleConfigMap.siswa;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!emailOrId.trim()) {
      setErrorMessage('Mohon isi email atau nomor identitas.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(role, emailOrId, password);
    setIsSubmitting(false);

    if (res.success) {
      showNotification({
        type: 'success',
        title: 'Berhasil Masuk',
        message: `Selamat datang kembali di Cakrawala LMS!`
      });
      onNavigate('dashboard');
    } else {
      setErrorMessage(res.message || 'Login gagal. Periksa kembali data Anda.');
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim()) return;

    setIsSubmitting(true);
    const res = await loginWithGoogle(
      googleEmailInput.trim(),
      googleNameInput.trim() || googleEmailInput.split('@')[0],
      role
    );
    setIsSubmitting(false);

    if (res.success) {
      setShowGoogleModal(false);
      showNotification({
        type: 'success',
        title: 'Payload Google Terverifikasi',
        message: `Autentikasi internal berhasil. Sesi tunggal aktif tercatat di server.`
      });
      onNavigate('dashboard');
    } else {
      showNotification({
        type: 'error',
        title: 'Autentikasi Gagal',
        message: res.message || 'Gagal login via Google JSON API.'
      });
    }
  };

  const handleAutofillDemo = () => {
    if (roleConfig.demoAccount) {
      setEmailOrId(roleConfig.demoAccount.email);
      setPassword('demo123');
      setErrorMessage(null);
    }
  };

  const handleGooglePreset = (presetEmail: string, presetName: string, presetRole: UserRole) => {
    setGoogleEmailInput(presetEmail);
    setGoogleNameInput(presetName);
    setRole(presetRole);
  };

  const IconComponent = roleConfig.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-600 selection:text-white">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Back Link */}
        <button
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-6 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('backToHome')}</span>
        </button>

        {/* Single Active Session Dual-Device Warning Banner */}
        {sessionTerminationNotice && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs shadow-md space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between font-bold text-amber-900">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center font-bold">⚠️</span>
                <span>Peringatan Sesi Berakhir (Single Active Session)</span>
              </div>
              <button 
                onClick={clearSessionTerminationNotice}
                className="text-amber-700 hover:text-amber-900 p-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-900 font-medium">
              {sessionTerminationNotice}
            </p>
            <div className="text-[10px] text-amber-800 bg-amber-100/70 p-2 rounded-lg font-mono">
              🛡️ Kebijakan Integritas: Akun hanya boleh aktif di 1 perangkat pada satu waktu demi keamanan data akademik & ujian.
            </div>
          </div>
        )}

        {/* Role Switcher Tabs (Moodle Navigation Tabs) */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center justify-between gap-1 mb-5">
          <button
            type="button"
            onClick={() => { setRole('siswa'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              role === 'siswa' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>Siswa</span>
          </button>
          <button
            type="button"
            onClick={() => { setRole('guru'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              role === 'guru' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Guru & Wali</span>
          </button>
          <button
            type="button"
            onClick={() => { setRole('admin'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              role === 'admin' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Admin</span>
          </button>
        </div>

        {/* Moodle Classic Login Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8 space-y-5">
          
          {/* Brand & Role Header */}
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200">
              <IconComponent className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {roleConfig.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {roleConfig.badge}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={() => {
              setGoogleEmailInput(role === 'siswa' ? 'siswa.google@sekolah.sch.id' : 'guru.google@sekolah.sch.id');
              setGoogleNameInput(role === 'siswa' ? 'Peserta Didik Google' : 'Pendidik Google');
              setShowGoogleModal(true);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 flex items-center justify-center gap-2.5 shadow-2xs transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Lanjutkan dengan Akun Google (SSO)</span>
          </button>

          <div className="flex items-center gap-2 text-slate-400 text-xs my-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span>atau email & password</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('emailOrId')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  placeholder={
                    role === 'siswa' ? 'misal: arya@siswa.cakrawala.sch.id / 0071829384' :
                    role === 'guru' ? 'misal: bambang@cakrawala.sch.id / 197604212...' :
                    'misal: admin@cakrawala.sch.id'
                  }
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {t('password')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span>{t('rememberMe')}</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs bg-blue-600 hover:bg-blue-700 shadow-xs transition cursor-pointer"
            >
              {t('signInBtn')}
            </button>
          </form>

          {/* Quick Demo Autofill Helper */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAutofillDemo}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Isi Kredensial Demo Akun {role.toUpperCase()} (1-Klik)</span>
            </button>
          </div>

          {/* Siswa Register Prompt */}
          {role === 'siswa' && (
            <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span>{t('noAccountYet')} </span>
              <button
                type="button"
                onClick={() => onNavigate('register', 'siswa')}
                className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
              >
                {t('registerNow')}
              </button>
            </div>
          )}

          {role !== 'siswa' && (
            <div className="text-center text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
              Akun {role === 'guru' ? 'Guru' : 'Admin'} diterbitkan oleh Administrator Sekolah.
            </div>
          )}
        </div>
      </div>

      {/* Google Custom JSON Payload Auth Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Autentikasi Payload JSON Google Kustom</h3>
                  <p className="text-[10px] text-slate-500 font-mono">POST /api/auth/google-payload & Single Active Session</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGoogleSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
                <strong>Alur Kustom Terintegrasi:</strong>
                <p className="text-slate-600">
                  Sistem mengekstrak payload identitas profil institusi Google secara aman via backend server tanpa ketergantungan redirect pihak ketiga.
                </p>
              </div>

              {/* Quick Profile Presets */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Pilih Profil Google Terdaftar (1-Klik):</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleGooglePreset('arya@siswa.cakrawala.sch.id', 'Arya Pratama', 'siswa')}
                    className="p-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-left transition cursor-pointer"
                  >
                    <div className="font-bold text-slate-900">Arya Pratama</div>
                    <div className="text-[10px] text-slate-500 truncate">arya@siswa...</div>
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-100 text-blue-800">Siswa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGooglePreset('bambang@cakrawala.sch.id', 'Drs. Bambang Suryono', 'guru')}
                    className="p-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-left transition cursor-pointer"
                  >
                    <div className="font-bold text-slate-900">Drs. Bambang</div>
                    <div className="text-[10px] text-slate-500 truncate">bambang@cak...</div>
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">Guru / Wali</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGooglePreset('admin@cakrawala.sch.id', 'Administrator', 'admin')}
                    className="p-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-left transition cursor-pointer"
                  >
                    <div className="font-bold text-slate-900">Admin Utama</div>
                    <div className="text-[10px] text-slate-500 truncate">admin@cak...</div>
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800">Admin</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Akun Google:</label>
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    required
                    placeholder="nama@sekolah.sch.id"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Tampilan Profil:</label>
                  <input
                    type="text"
                    value={googleNameInput}
                    onChange={(e) => setGoogleNameInput(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Peran Akses (Role Target):</label>
                <div className="flex gap-2">
                  {(['siswa', 'guru', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-1.5 rounded-lg font-bold border text-xs capitalize cursor-pointer transition ${
                        role === r ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>{isSubmitting ? 'Memverifikasi...' : 'Kirim Payload & Masuk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-xs text-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Bantuan Pemulihan Kata Sandi</span>
              </h3>
              <button onClick={() => setShowForgotModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="leading-relaxed">
              Untuk menjaga integritas dan keamanan basis data sekolah:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Siswa:</strong> Silakan hubungi wali kelas Anda untuk mereset kata sandi melalui Portal Wali Kelas.</li>
              <li><strong>Guru & Staf:</strong> Reset kata sandi dilayani oleh Administrator Sistem di menu Manajemen Pengguna.</li>
              <li>Untuk pengujian cepat aplikasi, gunakan tombol <strong>"Isi Kredensial Demo Akun (1-Klik)"</strong>.</li>
            </ul>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2 bg-blue-600 text-white font-bold rounded-xl cursor-pointer shadow-xs"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
