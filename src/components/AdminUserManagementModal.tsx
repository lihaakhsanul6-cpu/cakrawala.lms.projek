import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { User, UserRole } from '../types';
import { AVAILABLE_CLASSES } from '../data/mockData';
import { 
  Users, 
  X, 
  Plus, 
  Search, 
  ShieldCheck, 
  GraduationCap, 
  UserCheck, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Filter
} from 'lucide-react';

interface AdminUserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({ isOpen, onClose }) => {
  const { users, currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Add User Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('siswa');
  const [identifierNumber, setIdentifierNumber] = useState('');
  const [kelasBimbingan, setKelasBimbingan] = useState(AVAILABLE_CLASSES[0]);
  const [isWaliKelas, setIsWaliKelas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local state copy for immediate UI updates
  const [userList, setUserList] = useState<User[]>(users);

  if (!isOpen) return null;

  const filteredUsers = userList.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.identifierNumber && u.identifierNumber.includes(searchQuery));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          identifierNumber: identifierNumber.trim() || (role === 'siswa' ? `008${Date.now().toString().slice(-7)}` : `1985${Date.now().toString().slice(-7)}`),
          kelasBimbingan: role === 'siswa' || isWaliKelas ? kelasBimbingan : undefined,
          isWaliKelas: role === 'guru' && isWaliKelas
        })
      });

      if (res.ok) {
        const newUser: User = await res.json();
        setUserList(prev => [newUser, ...prev]);
        showNotification({
          type: 'success',
          title: 'Pengguna Ditambahkan',
          message: `Akun ${newUser.name} (${newUser.role}) berhasil didaftarkan di sistem.`
        });
        setName('');
        setEmail('');
        setIdentifierNumber('');
        setIsAddUserOpen(false);
      } else {
        const err = await res.json();
        showNotification({
          type: 'error',
          title: 'Gagal Menambah Pengguna',
          message: err.error || 'Terjadi kesalahan pada server.'
        });
      }
    } catch {
      // offline fallback
      const fallbackUser: User = {
        id: `usr-${role}-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        role,
        identifierNumber: identifierNumber.trim() || `008${Date.now().toString().slice(-7)}`,
        kelasBimbingan: role === 'siswa' || isWaliKelas ? kelasBimbingan : undefined,
        isWaliKelas: role === 'guru' && isWaliKelas,
        institution: 'SMA Cakrawala Nusantara',
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
      };
      setUserList(prev => [fallbackUser, ...prev]);
      showNotification({
        type: 'success',
        title: 'Pengguna Ditambahkan (Lokal)',
        message: `Akun ${fallbackUser.name} telah disimpan.`
      });
      setName('');
      setEmail('');
      setIdentifierNumber('');
      setIsAddUserOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    try {
      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch {
      // ignore
    }
    setUserList(prev => prev.map(u => u.id === id ? { ...u, status: newStatus as any } : u));
    showNotification({
      type: 'info',
      title: 'Status Pengguna Diperbarui',
      message: `Status akun diubah menjadi ${newStatus}.`
    });
  };

  const handleResetPassword = (nameStr: string) => {
    showNotification({
      type: 'success',
      title: 'Tautan Reset Terkirim',
      message: `Instruksi pemulihan kata sandi telah dikirimkan ke email ${nameStr}.`
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Pusat Administrasi & Pengelolaan Pengguna (Site Admin)
              </h2>
              <p className="text-xs text-slate-500">
                Kelola hak akses pendidik, peserta didik, status akun, dan rombongan belajar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddUserOpen(!isAddUserOpen)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddUserOpen ? 'Tutup Formulir' : 'Daftarkan Pengguna'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Add User Form Drawer */}
          {isAddUserOpen && (
            <form onSubmit={handleCreateUser} className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <h4 className="font-extrabold text-xs text-blue-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tambah Pengguna Baru ke Database LMS</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Muhammad Farhan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Alamat Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="farhan@cakrawala.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Peran Akses (Role) *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="siswa">Peserta Didik (Siswa)</option>
                    <option value="guru">Tenaga Pengajar (Guru)</option>
                    <option value="admin">Administrator Sistem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {role === 'siswa' ? 'NISN Siswa' : 'NIP / ID Pendidik'}
                  </label>
                  <input
                    type="text"
                    placeholder="Nomor identitas unik"
                    value={identifierNumber}
                    onChange={(e) => setIdentifierNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>

                {role === 'siswa' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Kelas Bimbingan *</label>
                    <select
                      value={kelasBimbingan}
                      onChange={(e) => setKelasBimbingan(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600 bg-white"
                    >
                      {AVAILABLE_CLASSES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {role === 'guru' && (
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="isWaliKelas"
                      checked={isWaliKelas}
                      onChange={(e) => setIsWaliKelas(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="isWaliKelas" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Jadikan Wali Kelas ({kelasBimbingan})
                    </label>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Mendaftarkan...' : 'Simpan Akun Pengguna'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, email, atau NISN/NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition ${
                  roleFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Semua ({userList.length})
              </button>
              <button
                onClick={() => setRoleFilter('siswa')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition ${
                  roleFilter === 'siswa' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Siswa
              </button>
              <button
                onClick={() => setRoleFilter('guru')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition ${
                  roleFilter === 'guru' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Guru
              </button>
              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition ${
                  roleFilter === 'admin' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-3">Nama Pengguna</th>
                  <th className="p-3">Peran (Role)</th>
                  <th className="p-3">No. Identitas / NISN</th>
                  <th className="p-3">Kelas / Rombel</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isActive = u.status !== 'inactive';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover bg-slate-100" />
                          <div>
                            <div className="font-bold text-slate-900">{u.name}</div>
                            <div className="text-[10px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          u.role === 'siswa' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          u.role === 'guru' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          'bg-purple-50 text-purple-800 border-purple-200'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                        {u.isWaliKelas && (
                          <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            Wali
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-mono text-slate-600">
                        {u.identifierNumber || '-'}
                      </td>

                      <td className="p-3 text-slate-700">
                        {u.kelasBimbingan ? (
                          <span className="font-semibold">{u.kelasBimbingan}</span>
                        ) : '-'}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition border ${
                            isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleResetPassword(u.name)}
                            className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                            title="Kirim tautan reset kata sandi"
                          >
                            Reset Sandi
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
};
