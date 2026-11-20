import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Shield,
  Smartphone,
  Trash2,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AdminUser,
  AttendanceRecord,
  Employee,
  PayrollRecord,
  Position,
  WorkSchedule,
} from '../types/hrm';
import {
  addAdminUser,
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_EMPLOYEE_AVATAR,
  deleteAttendance,
  deleteEmployee,
  deletePosition,
  removeAdminUser,
  saveEmployee,
  savePayrollRecord,
  savePosition,
  saveWorkSchedule,
  updateAttendanceAdmin,
} from '../services/hrmService';
import {
  formatCurrencyIDR,
  formatDateDDMMMYYYY,
  formatDuration,
  formatPeriodLabel,
  getDateKey,
  getPeriodKey,
} from '../utils/formatters';

type AdminSection = 'overview' | 'employees' | 'schedule' | 'attendance' | 'payroll' | 'admins';

interface BackofficeAdminViewProps {
  currentUserEmail: string;
  currentUserName: string;
  positions: Position[];
  schedule: WorkSchedule;
  employees: Employee[];
  attendances: AttendanceRecord[];
  payrolls: PayrollRecord[];
  admins: AdminUser[];
  hasEmployeeProfile: boolean;
  onSwitchToMobile: () => void;
  onLogout: () => Promise<void>;
}

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const BackofficeAdminView: React.FC<BackofficeAdminViewProps> = ({
  currentUserEmail,
  currentUserName,
  positions,
  schedule,
  employees,
  attendances,
  payrolls,
  admins,
  hasEmployeeProfile,
  onSwitchToMobile,
  onLogout,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption: string } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Employees & Positions state
  const [empTab, setEmpTab] = useState<'employees' | 'positions'>('employees');
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'Semua' | 'Aktif' | 'Nonaktif'>('Semua');
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({
    nik: '',
    name: '',
    email: '',
    phone: '',
    positionId: '',
    dailyRate: 0,
    dailyAllowance: 0,
    status: 'Aktif' as 'Aktif' | 'Nonaktif',
    joinDate: formatDateDDMMMYYYY(new Date()),
  });

  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState({
    title: '',
    department: '',
    dailyRate: 200000,
    dailyAllowance: 35000,
  });

  // Schedule state
  const [schedDraft, setSchedDraft] = useState<Omit<WorkSchedule, 'updatedAt'>>({
    id: schedule.id || 'default',
    name: schedule.name,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    lateToleranceMinutes: schedule.lateToleranceMinutes,
    activeDays: schedule.activeDays,
  });

  useEffect(() => {
    setSchedDraft({
      id: schedule.id || 'default',
      name: schedule.name,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      lateToleranceMinutes: schedule.lateToleranceMinutes,
      activeDays: schedule.activeDays,
    });
  }, [schedule]);

  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Attendance filter state
  const [attDateFilter, setAttDateFilter] = useState('');
  const [attEmpFilter, setAttEmpFilter] = useState('all');
  const [attStatusFilter, setAttStatusFilter] = useState<'Semua' | 'Tepat Waktu' | 'Terlambat'>('Semua');

  // Payroll state
  const [payrollPeriod, setPayrollPeriod] = useState(() => getPeriodKey(new Date()));
  const [deductionDrafts, setDeductionDrafts] = useState<Record<string, number>>({});
  const [processingPayrollId, setProcessingPayrollId] = useState<string | null>(null);

  // Admin management state
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const todayKey = getDateKey(new Date());
  const todayFormatted = formatDateDDMMMYYYY(new Date());
  const currentMonthKey = getPeriodKey(new Date());

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Aktif'),
    [employees]
  );

  const todayAttendances = useMemo(
    () =>
      attendances
        .filter((a) => a.dateKey === todayKey)
        .sort((a, b) => b.clockInTime.localeCompare(a.clockInTime)),
    [attendances, todayKey]
  );

  const monthEstimatedPayroll = useMemo(() => {
    return attendances
      .filter((a) => a.dateKey.startsWith(currentMonthKey) && a.verificationStatus !== 'Ditolak')
      .reduce((sum, a) => sum + (a.dailyRateSnapshot || 0) + (a.dailyAllowanceSnapshot || 0), 0);
  }, [attendances, currentMonthKey]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = empSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.nik.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.positionTitle.toLowerCase().includes(q);
      const matchStatus = empStatusFilter === 'Semua' || emp.status === empStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [employees, empSearch, empStatusFilter]);

  const filteredAttendances = useMemo(() => {
    return [...attendances]
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.clockInTime.localeCompare(a.clockInTime))
      .filter((item) => {
        const matchDate = !attDateFilter || item.dateKey === attDateFilter;
        const matchEmp = attEmpFilter === 'all' || item.employeeId === attEmpFilter;
        const matchStatus = attStatusFilter === 'Semua' || item.clockInStatus === attStatusFilter;
        return matchDate && matchEmp && matchStatus;
      });
  }, [attendances, attDateFilter, attEmpFilter, attStatusFilter]);

  // Computed Daily Payroll rows for selected period
  const payrollRows = useMemo(() => {
    return employees.map((emp) => {
      const empMonthAtt = attendances.filter(
        (a) =>
          a.employeeId === emp.id &&
          a.dateKey.startsWith(payrollPeriod) &&
          a.verificationStatus !== 'Ditolak'
      );
      const daysPresent = empMonthAtt.length;
      const basePayTotal = empMonthAtt.reduce(
        (sum, a) => sum + (a.dailyRateSnapshot ?? emp.dailyRate),
        0
      );
      const allowanceTotal = empMonthAtt.reduce(
        (sum, a) => sum + (a.dailyAllowanceSnapshot ?? emp.dailyAllowance),
        0
      );
      const existingPayroll = payrolls.find(
        (p) => p.employeeId === emp.id && p.periodKey === payrollPeriod
      );
      const deductionTotal =
        deductionDrafts[emp.id] !== undefined
          ? deductionDrafts[emp.id]
          : existingPayroll?.deductionTotal ?? 0;
      const netPay = Math.max(0, basePayTotal + allowanceTotal - deductionTotal);

      return {
        employee: emp,
        daysPresent,
        basePayTotal,
        allowanceTotal,
        deductionTotal,
        netPay,
        existingPayroll,
      };
    });
  }, [employees, attendances, payrolls, payrollPeriod, deductionDrafts]);

  const totalPeriodPayroll = useMemo(
    () => payrollRows.reduce((sum, r) => sum + r.netPay, 0),
    [payrollRows]
  );

  // Handlers
  const openCreateEmployee = () => {
    const defaultPos = positions[0];
    setEditingEmp(null);
    setEmpForm({
      nik: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
      name: '',
      email: '',
      phone: '',
      positionId: defaultPos?.id || '',
      dailyRate: defaultPos?.dailyRate || 200000,
      dailyAllowance: defaultPos?.dailyAllowance || 35000,
      status: 'Aktif',
      joinDate: formatDateDDMMMYYYY(new Date()),
    });
    setShowEmpModal(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({
      nik: emp.nik,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      positionId: emp.positionId,
      dailyRate: emp.dailyRate,
      dailyAllowance: emp.dailyAllowance,
      status: emp.status,
      joinDate: emp.joinDate,
    });
    setShowEmpModal(true);
  };

  const handlePositionSelectInEmpForm = (posId: string) => {
    const pos = positions.find((p) => p.id === posId);
    setEmpForm((prev) => ({
      ...prev,
      positionId: posId,
      dailyRate: pos ? pos.dailyRate : prev.dailyRate,
      dailyAllowance: pos ? pos.dailyAllowance : prev.dailyAllowance,
    }));
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const pos = positions.find((p) => p.id === empForm.positionId) || positions[0];
    if (!pos) {
      showToast('Buat master jabatan terlebih dahulu.');
      return;
    }

    await saveEmployee({
      id: editingEmp?.id,
      nik: empForm.nik,
      name: empForm.name,
      email: empForm.email,
      phone: empForm.phone || '-',
      positionId: pos.id,
      positionTitle: pos.title,
      department: pos.department,
      dailyRate: Number(empForm.dailyRate) || pos.dailyRate,
      dailyAllowance: Number(empForm.dailyAllowance) || pos.dailyAllowance,
      status: empForm.status,
      authUid: editingEmp?.authUid || '',
      avatarUrl: editingEmp?.avatarUrl || DEFAULT_EMPLOYEE_AVATAR,
      joinDate: empForm.joinDate || formatDateDDMMMYYYY(new Date()),
    });

    setShowEmpModal(false);
    showToast(editingEmp ? 'Data karyawan berhasil diperbarui.' : 'Karyawan baru berhasil ditambahkan.');
  };

  const openCreatePosition = () => {
    setEditingPos(null);
    setPosForm({ title: '', department: '', dailyRate: 200000, dailyAllowance: 35000 });
    setShowPosModal(true);
  };

  const openEditPosition = (pos: Position) => {
    setEditingPos(pos);
    setPosForm({
      title: pos.title,
      department: pos.department,
      dailyRate: pos.dailyRate,
      dailyAllowance: pos.dailyAllowance,
    });
    setShowPosModal(true);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePosition({
      id: editingPos?.id,
      ...posForm,
    });
    setShowPosModal(false);
    showToast(editingPos ? 'Jabatan berhasil diperbarui.' : 'Jabatan baru berhasil disimpan.');
  };

  const handleToggleDay = (day: string) => {
    setSchedDraft((prev) => {
      const exists = prev.activeDays.includes(day);
      const next = exists
        ? prev.activeDays.filter((d) => d !== day)
        : [...prev.activeDays, day];
      return { ...prev, activeDays: next };
    });
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);
    try {
      await saveWorkSchedule(schedDraft);
      showToast('Pengaturan hari dan jam kerja berhasil disimpan.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSavePayroll = async (
    row: (typeof payrollRows)[number],
    status: 'Draft' | 'Dibayarkan'
  ) => {
    setProcessingPayrollId(row.employee.id);
    try {
      await savePayrollRecord({
        employee: row.employee,
        periodKey: payrollPeriod,
        daysPresent: row.daysPresent,
        basePayTotal: row.basePayTotal,
        allowanceTotal: row.allowanceTotal,
        deductionTotal: row.deductionTotal,
        status,
        existingId: row.existingPayroll?.id,
      });
      showToast(
        status === 'Dibayarkan'
          ? `Gaji ${row.employee.name} (${formatPeriodLabel(payrollPeriod)}) ditandai Dibayarkan.`
          : `Draft payroll ${row.employee.name} disimpan.`
      );
    } finally {
      setProcessingPayrollId(null);
    }
  };

  const handleExportPayrollCSV = () => {
    const header = [
      'NIK',
      'Nama Karyawan',
      'Jabatan',
      'Periode',
      'Hari Masuk',
      'Gaji Harian (Rp)',
      'Tunjangan Harian (Rp)',
      'Total Pokok (Rp)',
      'Total Tunjangan (Rp)',
      'Potongan (Rp)',
      'Total Diterima (Rp)',
      'Status',
      'Tanggal Bayar',
    ];
    const lines = payrollRows.map((r) => [
      r.employee.nik,
      `"${r.employee.name.replace(/"/g, '""')}"`,
      `"${r.employee.positionTitle.replace(/"/g, '""')}"`,
      formatPeriodLabel(payrollPeriod),
      r.daysPresent,
      r.employee.dailyRate,
      r.employee.dailyAllowance,
      r.basePayTotal,
      r.allowanceTotal,
      r.deductionTotal,
      r.netPay,
      r.existingPayroll?.status || 'Belum Diproses',
      r.existingPayroll?.paidDateFormatted || '-',
    ]);
    const csv = [header.join(','), ...lines.map((l) => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-nusahr-${payrollPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUid.trim() || !newAdminEmail.trim()) return;
    await addAdminUser({
      uid: newAdminUid.trim(),
      email: newAdminEmail.trim(),
      name: newAdminName.trim() || newAdminEmail.trim(),
    });
    setNewAdminUid('');
    setNewAdminEmail('');
    setNewAdminName('');
    showToast('Admin baru berhasil ditambahkan.');
  };

  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'employees', label: 'Karyawan & Jabatan', icon: Users },
    { id: 'schedule', label: 'Hari & Jam Kerja', icon: CalendarClock },
    { id: 'attendance', label: 'Data Kehadiran', icon: CheckCircle2 },
    { id: 'payroll', label: 'Payroll Harian', icon: Wallet },
    { id: 'admins', label: 'Akses Admin', icon: Shield },
  ];

  const sectionLabels: Record<AdminSection, string> = {
    overview: 'Ringkasan Operasional',
    employees: 'Data Karyawan & Jabatan',
    schedule: 'Hari & Jam Kerja',
    attendance: 'Data Kehadiran & Selfie',
    payroll: 'Payroll Gajian Harian',
    admins: 'Pengelolaan Akses Admin',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B1220] text-slate-200 z-30">
        <div className="px-6 h-16 flex items-center justify-between border-b border-slate-800">
          <span className="text-lg font-extrabold tracking-tight text-white font-display">
            NusaHR
          </span>
          <span className="text-xs font-medium text-emerald-400">Backoffice</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2.5">
          {hasEmployeeProfile && (
            <button
              type="button"
              onClick={onSwitchToMobile}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Buka Mobile PWA Karyawan
            </button>
          )}
          <div className="px-1 pt-1">
            <p className="text-xs font-semibold text-white truncate">{currentUserName}</p>
            <p className="text-[11px] text-slate-400 truncate">{currentUserEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-[#0B1220] text-slate-200 flex flex-col z-10 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-lg font-extrabold text-white font-display">NusaHR Backoffice</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                      active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="pt-3 border-t border-slate-800 space-y-2">
              {hasEmployeeProfile && (
                <button
                  type="button"
                  onClick={onSwitchToMobile}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Buka Mobile PWA
                </button>
              )}
              <button
                type="button"
                onClick={() => void onLogout()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Canvas */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Backoffice</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-bold text-slate-950 truncate">{sectionLabels[section]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
              {todayFormatted}
            </span>
            {hasEmployeeProfile && (
              <button
                type="button"
                onClick={onSwitchToMobile}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                Mode Mobile PWA
              </button>
            )}
          </div>
        </header>

        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-950 text-white px-4 py-3 text-xs font-semibold shadow-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* SECTION 1: OVERVIEW */}
          {section === 'overview' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">Karyawan Aktif</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-950 tabular-nums">
                    {activeEmployees.length}
                    <span className="text-xs font-normal text-slate-500 ml-1.5">dari {employees.length} terdaftar</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">Hadir Hari Ini ({todayFormatted})</p>
                  <p className="mt-2 text-3xl font-extrabold text-emerald-700 tabular-nums">
                    {todayAttendances.length}
                    <span className="text-xs font-normal text-slate-500 ml-1.5">karyawan</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">Terlambat Hari Ini</p>
                  <p className="mt-2 text-3xl font-extrabold text-amber-600 tabular-nums">
                    {todayAttendances.filter((a) => a.clockInStatus === 'Terlambat').length}
                    <span className="text-xs font-normal text-slate-500 ml-1.5">catatan</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-[#0B1220] text-white p-5">
                  <p className="text-xs font-medium text-slate-400">
                    Akumulasi Payroll · {formatPeriodLabel(currentMonthKey)}
                  </p>
                  <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
                    {formatCurrencyIDR(monthEstimatedPayroll)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-950">
                      Presensi Masuk Hari Ini ({todayFormatted})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('attendance')}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      Kelola Semua
                    </button>
                  </div>
                  {todayAttendances.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Belum ada karyawan yang melakukan Clock In pada {todayFormatted}. Data dari Mobile PWA akan muncul secara langsung di sini.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {todayAttendances.map((item) => (
                        <div key={item.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  url: item.clockInPhoto,
                                  caption: `${item.employeeName} · Clock In ${item.dateFormatted} ${item.clockInTime}`,
                                })
                              }
                              className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                            >
                              <img src={item.clockInPhoto} alt={item.employeeName} className="w-full h-full object-cover" />
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950 truncate">{item.employeeName}</p>
                              <p className="text-xs text-slate-500 truncate tabular-nums">
                                {item.employeeNik} · {item.positionTitle}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <p className="text-xs font-bold text-slate-950">
                              Masuk {item.clockInTime} {item.hasClockOut ? `· Pulang ${item.clockOutTime}` : ''}
                            </p>
                            <p
                              className={`text-xs font-semibold ${
                                item.clockInStatus === 'Tepat Waktu' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {item.clockInStatus}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-950">Jadwal Kerja Berlaku</h2>
                    <button
                      type="button"
                      onClick={() => setSection('schedule')}
                      className="text-xs font-semibold text-emerald-700 cursor-pointer"
                    >
                      Ubah
                    </button>
                  </div>
                  <div className="space-y-3 text-xs pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nama Shift</span>
                      <span className="font-semibold text-slate-900">{schedule.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jam Masuk – Pulang</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {schedule.startTime} – {schedule.endTime} WIB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Toleransi Terlambat</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {schedule.lateToleranceMinutes} menit
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-500 block mb-1.5">Hari Kerja Aktif</span>
                      <p className="font-semibold text-slate-900 leading-relaxed">
                        {schedule.activeDays.join(' · ') || 'Belum dipilih'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SECTION 2: EMPLOYEES & POSITIONS */}
          {section === 'employees' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start">
                  <button
                    type="button"
                    onClick={() => setEmpTab('employees')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      empTab === 'employees' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Data Karyawan ({employees.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmpTab('positions')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      empTab === 'positions' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Master Jabatan ({positions.length})
                  </button>
                </div>

                {empTab === 'employees' ? (
                  <button
                    type="button"
                    onClick={openCreateEmployee}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Karyawan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openCreatePosition}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Jabatan
                  </button>
                )}
              </div>

              {empTab === 'employees' ? (
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        placeholder="Cari nama, NIK, email, atau jabatan..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
                      {(['Semua', 'Aktif', 'Nonaktif'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEmpStatusFilter(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            empStatusFilter === s ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-5 font-semibold">Karyawan</th>
                          <th className="py-3 px-4 font-semibold">Jabatan & Dept</th>
                          <th className="py-3 px-4 font-semibold">Tgl Bergabung</th>
                          <th className="py-3 px-4 font-semibold text-right">Gaji / Hari</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-5 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredEmployees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5">
                              <p className="font-bold text-slate-950">{emp.name}</p>
                              <p className="text-slate-500 tabular-nums">
                                {emp.nik} · {emp.email}
                              </p>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-900">{emp.positionTitle}</p>
                              <p className="text-slate-500">{emp.department}</p>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 tabular-nums">{emp.joinDate}</td>
                            <td className="py-3.5 px-4 text-right tabular-nums">
                              <p className="font-bold text-slate-950">{formatCurrencyIDR(emp.dailyRate)}</p>
                              <p className="text-slate-500">+ {formatCurrencyIDR(emp.dailyAllowance)} tunj.</p>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-semibold ${
                                  emp.status === 'Aktif' ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {emp.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditEmployee(emp)}
                                  className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950 cursor-pointer"
                                  title="Edit Karyawan"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void deleteEmployee(emp.id);
                                    showToast(`Karyawan ${emp.name} dihapus.`);
                                  }}
                                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Hapus Karyawan"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-500">
                              Tidak ada data karyawan yang sesuai filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-5 font-semibold">Nama Jabatan</th>
                          <th className="py-3 px-4 font-semibold">Departemen</th>
                          <th className="py-3 px-4 font-semibold text-right">Gaji Harian Pokok</th>
                          <th className="py-3 px-4 font-semibold text-right">Tunjangan / Hari</th>
                          <th className="py-3 px-4 font-semibold text-right">Total Rate / Hari</th>
                          <th className="py-3 px-5 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {positions.map((pos) => (
                          <tr key={pos.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5 font-bold text-slate-950">{pos.title}</td>
                            <td className="py-3.5 px-4 text-slate-600">{pos.department}</td>
                            <td className="py-3.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                              {formatCurrencyIDR(pos.dailyRate)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-slate-600 tabular-nums">
                              {formatCurrencyIDR(pos.dailyAllowance)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                              {formatCurrencyIDR(pos.dailyRate + pos.dailyAllowance)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditPosition(pos)}
                                  className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                                  title="Edit Jabatan"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void deletePosition(pos.id);
                                    showToast(`Jabatan ${pos.title} dihapus.`);
                                  }}
                                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Hapus Jabatan"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: WORK SCHEDULE */}
          {section === 'schedule' && (
            <div className="max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 sm:p-8">
              <div className="pb-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-950">Pengaturan Hari dan Jam Kerja</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Aturan ini digunakan secara real-time oleh Mobile PWA Karyawan untuk menentukan status Tepat Waktu atau Terlambat saat Clock In.
                </p>
              </div>

              <form onSubmit={handleSaveSchedule} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="sched-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Jadwal / Shift Kerja
                  </label>
                  <input
                    id="sched-name"
                    type="text"
                    required
                    value={schedDraft.name}
                    onChange={(e) => setSchedDraft((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="sched-start" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Jam Masuk (WIB)
                    </label>
                    <input
                      id="sched-start"
                      type="time"
                      required
                      value={schedDraft.startTime}
                      onChange={(e) => setSchedDraft((p) => ({ ...p, startTime: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="sched-end" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Jam Pulang (WIB)
                    </label>
                    <input
                      id="sched-end"
                      type="time"
                      required
                      value={schedDraft.endTime}
                      onChange={(e) => setSchedDraft((p) => ({ ...p, endTime: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="sched-tol" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Toleransi Telat (Menit)
                    </label>
                    <input
                      id="sched-tol"
                      type="number"
                      min={0}
                      max={180}
                      required
                      value={schedDraft.lateToleranceMinutes}
                      onChange={(e) =>
                        setSchedDraft((p) => ({
                          ...p,
                          lateToleranceMinutes: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    Hari Kerja Aktif
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DAYS.map((day) => {
                      const active = schedDraft.activeDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleDay(day)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-slate-950 text-white border-slate-950'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSchedule}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingSchedule ? 'Menyimpan...' : 'Simpan Jadwal Kerja'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 4: ATTENDANCE DATA */}
          {section === 'attendance' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={attDateFilter}
                    onChange={(e) => setAttDateFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                  {attDateFilter && (
                    <button
                      type="button"
                      onClick={() => setAttDateFilter('')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Reset Tanggal
                    </button>
                  )}
                </div>

                <select
                  value={attEmpFilter}
                  onChange={(e) => setAttEmpFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="all">Semua Karyawan</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.nik})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {(['Semua', 'Tepat Waktu', 'Terlambat'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAttStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        attStatusFilter === s ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-5 font-semibold">Tanggal</th>
                        <th className="py-3 px-4 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold">Bukti Selfie</th>
                        <th className="py-3 px-4 font-semibold">Masuk / Pulang</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Verifikasi</th>
                        <th className="py-3 px-5 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAttendances.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-5 font-bold text-slate-950 tabular-nums whitespace-nowrap">
                            {item.dateFormatted}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-950">{item.employeeName}</p>
                            <p className="text-slate-500 tabular-nums">
                              {item.employeeNik} · {item.positionTitle}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: item.clockInPhoto,
                                    caption: `${item.employeeName} · Clock In ${item.dateFormatted} (${item.clockInTime})`,
                                  })
                                }
                                className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
                                title="Selfie Masuk"
                              >
                                <img src={item.clockInPhoto} alt="Masuk" className="w-full h-full object-cover" />
                              </button>
                              {item.hasClockOut && item.clockOutPhoto && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewPhoto({
                                      url: item.clockOutPhoto,
                                      caption: `${item.employeeName} · Clock Out ${item.dateFormatted} (${item.clockOutTime})`,
                                    })
                                  }
                                  className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
                                  title="Selfie Pulang"
                                >
                                  <img src={item.clockOutPhoto} alt="Pulang" className="w-full h-full object-cover" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 tabular-nums">
                            <p className="font-semibold text-slate-900">
                              {item.clockInTime} – {item.hasClockOut ? item.clockOutTime : 'Aktif'}
                            </p>
                            <p className="text-slate-500">
                              {item.hasClockOut ? formatDuration(item.workMinutes) : 'Belum Clock Out'}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-semibold ${
                                item.clockInStatus === 'Tepat Waktu' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {item.clockInStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-semibold ${
                                item.verificationStatus === 'Terverifikasi'
                                  ? 'text-emerald-700'
                                  : item.verificationStatus === 'Ditolak'
                                  ? 'text-rose-600'
                                  : 'text-slate-700'
                              }`}
                            >
                              {item.verificationStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void updateAttendanceAdmin(item.id, {
                                    verificationStatus: 'Terverifikasi',
                                    notes: item.notes,
                                  });
                                  showToast(`Presensi ${item.employeeName} terverifikasi.`);
                                }}
                                className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                title="Verifikasi Hadir"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void updateAttendanceAdmin(item.id, {
                                    verificationStatus: 'Ditolak',
                                    notes: item.notes,
                                  });
                                  showToast(`Presensi ${item.employeeName} ditandai Ditolak.`);
                                }}
                                className="p-2 rounded-lg text-amber-700 hover:bg-amber-50 cursor-pointer"
                                title="Tolak (Tidak Dihitung Payroll)"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteAttendance(item.id);
                                  showToast('Catatan presensi dihapus.');
                                }}
                                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredAttendances.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500">
                            Belum ada catatan kehadiran untuk filter yang dipilih.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: PAYROLL (DAILY MODEL) */}
          {section === 'payroll' && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#0B1220] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-emerald-400">
                    Skema Penggajian Harian · Dihitung per Hari Masuk Tercatat
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold tabular-nums">
                    Total Payroll {formatPeriodLabel(payrollPeriod)}: {formatCurrencyIDR(totalPeriodPayroll)}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Rumus: (Jumlah Hari Masuk × Tarif Gaji Harian) + (Jumlah Hari Masuk × Tunjangan Harian) − Potongan
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <input
                    type="month"
                    value={payrollPeriod}
                    onChange={(e) => setPayrollPeriod(e.target.value)}
                    className="rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleExportPayrollCSV}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Ekspor CSV
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-5 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold text-right">Tarif / Hari</th>
                        <th className="py-3 px-4 font-semibold text-right">Hari Masuk</th>
                        <th className="py-3 px-4 font-semibold text-right">Gaji + Tunjangan</th>
                        <th className="py-3 px-4 font-semibold text-right">Potongan (Rp)</th>
                        <th className="py-3 px-4 font-semibold text-right">Total Diterima</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-5 font-semibold text-right">Proses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {payrollRows.map((row) => {
                        const isPaid = row.existingPayroll?.status === 'Dibayarkan';
                        const isProcessing = processingPayrollId === row.employee.id;
                        return (
                          <tr key={row.employee.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5">
                              <p className="font-bold text-slate-950">{row.employee.name}</p>
                              <p className="text-slate-500">
                                {row.employee.nik} · {row.employee.positionTitle}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <p className="font-semibold text-slate-900">
                                {formatCurrencyIDR(row.employee.dailyRate)}
                              </p>
                              <p className="text-slate-500">+ {formatCurrencyIDR(row.employee.dailyAllowance)}</p>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-950">
                              {row.daysPresent} hari
                            </td>
                            <td className="py-3.5 px-4 text-right text-slate-700">
                              {formatCurrencyIDR(row.basePayTotal + row.allowanceTotal)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <input
                                type="number"
                                min={0}
                                step={5000}
                                value={row.deductionTotal}
                                onChange={(e) =>
                                  setDeductionDrafts((prev) => ({
                                    ...prev,
                                    [row.employee.id]: Math.max(0, Number(e.target.value) || 0),
                                  }))
                                }
                                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                              />
                            </td>
                            <td className="py-3.5 px-4 text-right font-extrabold text-slate-950">
                              {formatCurrencyIDR(row.netPay)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`font-semibold ${
                                  isPaid
                                    ? 'text-emerald-700'
                                    : row.existingPayroll
                                    ? 'text-amber-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {row.existingPayroll?.status || 'Belum Diproses'}
                              </span>
                              {row.existingPayroll?.paidDateFormatted && (
                                <p className="text-[11px] text-slate-500">
                                  {row.existingPayroll.paidDateFormatted}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => void handleSavePayroll(row, 'Draft')}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  Draft
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => void handleSavePayroll(row, 'Dibayarkan')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white cursor-pointer"
                                >
                                  {isPaid ? 'Perbarui' : 'Bayarkan'}
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
          )}

          {/* SECTION 6: ADMIN ACCESS */}
          {section === 'admins' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-6">
                <h2 className="text-base font-bold text-slate-950">Tambah Admin Backoffice</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Berikan hak akses Backoffice kepada manajer HR lain menggunakan Firebase UID dan email Google mereka.
                </p>
                <form onSubmit={handleAddAdmin} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="admin-uid" className="block text-xs font-semibold text-slate-700 mb-1">
                      Firebase User UID
                    </label>
                    <input
                      id="admin-uid"
                      type="text"
                      required
                      value={newAdminUid}
                      onChange={(e) => setNewAdminUid(e.target.value)}
                      placeholder="UID akun Firebase pengguna"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Google
                    </label>
                    <input
                      id="admin-email"
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="hr@perusahaan.id"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Lengkap
                    </label>
                    <input
                      id="admin-name"
                      type="text"
                      required
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="Nama Manajer HR"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-slate-950 hover:bg-slate-800 py-2.5 text-sm font-semibold text-white cursor-pointer"
                  >
                    Tambahkan Admin
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-950">Daftar Administrator Aktif</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="px-6 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-950">Admin Utama Sistem</p>
                      <p className="text-xs text-slate-500">{BOOTSTRAPPED_ADMIN_EMAIL}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Super Admin</span>
                  </div>
                  {admins.map((adm) => (
                    <div key={adm.uid} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{adm.name}</p>
                        <p className="text-xs text-slate-500">
                          {adm.email} · UID {adm.uid}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void removeAdminUser(adm.uid);
                          showToast(`Akses admin ${adm.email} dicabut.`);
                        }}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Add/Edit Employee */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">
                {editingEmp ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEmpModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIK / ID Karyawan</label>
                  <input
                    type="text"
                    required
                    value={empForm.nik}
                    onChange={(e) => setEmpForm((p) => ({ ...p, nik: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={empForm.status}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, status: e.target.value as 'Aktif' | 'Nonaktif' }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={empForm.name}
                  onChange={(e) => setEmpForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Google (Login PWA)</label>
                  <input
                    type="email"
                    required
                    value={empForm.email}
                    onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. Telepon</label>
                  <input
                    type="tel"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan</label>
                <select
                  value={empForm.positionId}
                  onChange={(e) => handlePositionSelectInEmpForm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title} — {pos.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gaji Harian Pokok (Rp/hari)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={empForm.dailyRate}
                    onChange={(e) => setEmpForm((p) => ({ ...p, dailyRate: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tunjangan Harian (Rp/hari)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={empForm.dailyAllowance}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, dailyAllowance: Number(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white cursor-pointer"
                >
                  Simpan Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Position */}
      {showPosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">
                {editingPos ? 'Edit Master Jabatan' : 'Tambah Jabatan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPosModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePosition} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Jabatan</label>
                <input
                  type="text"
                  required
                  value={posForm.title}
                  onChange={(e) => setPosForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Contoh: Supervisor Gudang"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departemen</label>
                <input
                  type="text"
                  required
                  value={posForm.department}
                  onChange={(e) => setPosForm((p) => ({ ...p, department: e.target.value }))}
                  placeholder="Contoh: Operasional"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gaji Harian (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={posForm.dailyRate}
                    onChange={(e) => setPosForm((p) => ({ ...p, dailyRate: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tunjangan / Hari (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={posForm.dailyAllowance}
                    onChange={(e) =>
                      setPosForm((p) => ({ ...p, dailyAllowance: Number(e.target.value) || 0 }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPosModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white cursor-pointer"
                >
                  Simpan Jabatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Inspection Lightbox */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-800 truncate tabular-nums">
                {previewPhoto.caption}
              </p>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewPhoto.url}
              alt={previewPhoto.caption}
              className="w-full max-h-[70vh] object-contain bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};
