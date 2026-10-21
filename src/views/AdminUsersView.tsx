import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { User, UserRole } from '../types';
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  UserCheck, 
  GraduationCap, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  X,
  Mail,
  Building,
  Phone
} from 'lucide-react';

interface AdminUsersViewProps {
  onNavigate: (view: string, param?: string) => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ onNavigate }) => {
  const { currentUser, users, addUser, updateUser, toggleUserStatus, deleteUser } = useAuth();
  const { showNotification } = useNotification();
  const { t } = useLanguage();

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('siswa');
  const [formIdentifier, setFormIdentifier] = useState('');
  const [formClass, setFormClass] = useState('12-MIPA-1');
  const [formIsWali, setFormIsWali] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If not admin, restrict view
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center text-xs">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <p className="font-bold text-rose-600">Akses Dibatasi: Halaman ini hanya diperuntukkan bagi Administrator Sistem.</p>
          <button onClick={() => onNavigate('dashboard')} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold cursor-pointer">
            Kembali ke Dasbor
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (u.identifierNumber && u.identifierNumber.includes(searchQuery));
    return matchRole && matchSearch;
  });

  const countStudents = users.filter(u => u.role === 'siswa').length;
  const countTeachers = users.filter(u => u.role === 'guru').length;
  const countAdmins = users.filter(u => u.role === 'admin').length;

  const openAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRole('siswa');
    setFormIdentifier('');
    setFormClass('12-MIPA-1');
    setFormIsWali(false);
    setFormPhone('');
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormIdentifier(u.identifierNumber || '');
    setFormClass(u.kelasBimbingan || '12-MIPA-1');
    setFormIsWali(!!u.isWaliKelas);
    setFormPhone(u.phone || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showNotification({
        type: 'warning',
        title: 'Formulir Belum Lengkap',
        message: 'Nama dan email wajib diisi.'
      });
      return;
    }

    setIsSubmitting(true);
    if (editingUser) {
      const res = await updateUser(editingUser.id, {
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formRole,
        identifierNumber: formIdentifier.trim(),
        kelasBimbingan: formRole === 'siswa' || formIsWali ? formClass : undefined,
        isWaliKelas: formRole === 'guru' ? formIsWali : false,
        phone: formPhone.trim()
      });
      setIsSubmitting(false);
      setIsModalOpen(false);
      if (res.success) {
        showNotification({
          type: 'success',
          title: 'Akun Diperbarui',
          message: `Data pengguna "${formName}" berhasil diperbarui.`
        });
      }
    } else {
      const res = await addUser({
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formRole,
        identifierNumber: formIdentifier.trim(),
        kelasBimbingan: formRole === 'siswa' || formIsWali ? formClass : undefined,
        isWaliKelas: formRole === 'guru' ? formIsWali : false,
        phone: formPhone.trim()
      });
      setIsSubmitting(false);
      if (res.success) {
        setIsModalOpen(false);
        showNotification({
          type: 'success',
          title: 'Akun Pengguna Dibuat',
          message: `Pengguna "${formName}" (${formRole.toUpperCase()}) telah terdaftar.`
        });
      } else {
        showNotification({
          type: 'error',
          title: 'Gagal Membuat Akun',
          message: res.message || 'Email sudah terdaftar.'
        });
      }
    }
  };

  const handleToggle = async (u: User) => {
    const res = await toggleUserStatus(u.id);
    if (res.success) {
      const nextStatus = u.status === 'inactive' ? 'diaktifkan' : 'dinonaktifkan';
      showNotification({
        type: 'info',
        title: 'Status Akun Berubah',
        message: `Akun "${u.name}" berhasil ${nextStatus}.`
      });
    }
  };

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Yakin ingin menghapus akun "${u.name}" (${u.email})?`)) return;
    const res = await deleteUser(u.id);
    if (res.success) {
      showNotification({
        type: 'info',
        title: 'Akun Dihapus',
        message: `Pengguna "${u.name}" telah dihapus dari sistem.`
      });
    } else {
      showNotification({
        type: 'error',
        title: 'Gagal Menghapus',
        message: res.message || 'Tidak dapat menghapus akun.'
      });
    }
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
          <span className="text-slate-800 font-bold">Administrasi Sistem / Manajemen Pengguna</span>
        </div>

        {/* Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Moodle Site Administration
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Total {users.length} Akun
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Pengelolaan Akun Pengguna & Hak Akses
              </h1>
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900">{countStudents}</div>
              <div className="text-xs text-slate-500 font-medium">Peserta Didik (Siswa)</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900">{countTeachers}</div>
              <div className="text-xs text-slate-500 font-medium">Tenaga Pengajar (Guru)</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900">{countAdmins}</div>
              <div className="text-xs text-slate-500 font-medium">Administrator Sistem</div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Peran:</span>
            {['all', 'siswa', 'guru', 'admin'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg font-semibold cursor-pointer transition ${
                  roleFilter === r 
                    ? 'bg-blue-600 text-white shadow-2xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'all' ? 'Semua' : r.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / email / ID..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Identitas Pengguna</th>
                  <th className="p-4">Peran & Rombel</th>
                  <th className="p-4">No. Induk (NISN/NIP)</th>
                  <th className="p-4">Status Akun</th>
                  <th className="p-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isInactive = u.status === 'inactive';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 flex items-center gap-3">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
                          alt={u.name}
                          className="w-9 h-9 rounded-full object-cover bg-slate-100 border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-block font-bold px-2 py-0.5 rounded-full text-[10px] uppercase border ${
                          u.role === 'admin' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                          u.role === 'guru' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}>
                          {u.role}
                        </span>
                        {u.kelasBimbingan && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {u.isWaliKelas ? `Wali: ${u.kelasBimbingan}` : u.kelasBimbingan}
                          </div>
                        )}
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-700">
                        {u.identifierNumber || '-'}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleToggle(u)}
                          title="Klik untuk ubah status aktif/nonaktif"
                          className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full text-[10px] cursor-pointer transition ${
                            isInactive 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                          }`}
                        >
                          {isInactive ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>{isInactive ? 'Nonaktif' : 'Aktif'}</span>
                        </button>
                      </td>

                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            title="Edit Akun"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 cursor-pointer shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={currentUser?.id === u.id}
                            title={currentUser?.id === u.id ? 'Tidak dapat menghapus akun sendiri' : 'Hapus Akun'}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-slate-50 cursor-pointer shadow-2xs disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nama Lengkap dengan Gelar"
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Email:</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@cakrawala.sch.id"
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Peran Akun:</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="siswa">Peserta Didik (Siswa)</option>
                    <option value="guru">Tenaga Pengajar (Guru)</option>
                    <option value="admin">Administrator Sistem</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {formRole === 'siswa' ? 'NISN (10 Digit):' : 'NIP / ID Pendidik:'}
                  </label>
                  <input
                    type="text"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    placeholder="Contoh: 0081234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {formRole === 'guru' && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-950">
                    <input
                      type="checkbox"
                      checked={formIsWali}
                      onChange={(e) => setFormIsWali(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Guru ini juga bertugas sebagai Wali Kelas</span>
                  </label>
                  {formIsWali && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rombel Bimbingan Wali:</label>
                      <select
                        value={formClass}
                        onChange={(e) => setFormClass(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="12-MIPA-1">12-MIPA-1</option>
                        <option value="12-MIPA-2">12-MIPA-2</option>
                        <option value="12-IPS-1">12-IPS-1</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {formRole === 'siswa' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rombongan Belajar (Kelas):</label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="12-MIPA-1">12-MIPA-1</option>
                    <option value="12-MIPA-2">12-MIPA-2</option>
                    <option value="12-IPS-1">12-IPS-1</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : (editingUser ? 'Simpan Perubahan' : 'Buat Akun')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
