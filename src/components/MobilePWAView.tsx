import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  LogOut,
  Phone,
  Save,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AttendanceRecord,
  Employee,
  PayrollRecord,
  WorkSchedule,
} from '../types/hrm';
import {
  DEFAULT_EMPLOYEE_AVATAR,
  submitClockIn,
  submitClockOut,
  updateEmployeeSelfProfile,
} from '../services/hrmService';
import {
  formatCurrencyIDR,
  formatDateDDMMMYYYY,
  formatDuration,
  formatPeriodLabel,
  getDateKey,
  getIndonesianDayName,
  getPeriodKey,
  getTimeHHMMSS,
} from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';
import { SelfieCameraModal } from './SelfieCameraModal';

type MobileTab = 'home' | 'attendance' | 'reports' | 'profile';

interface MobilePWAViewProps {
  employee: Employee;
  authUid: string;
  authEmail: string;
  schedule: WorkSchedule;
  attendances: AttendanceRecord[];
  todayTeamAttendances: AttendanceRecord[];
  payrolls: PayrollRecord[];
  isAdmin: boolean;
  onSwitchToBackoffice: () => void;
  onLogout: () => Promise<void>;
}

export const MobilePWAView: React.FC<MobilePWAViewProps> = ({
  employee,
  authUid,
  authEmail,
  schedule,
  attendances,
  todayTeamAttendances,
  payrolls,
  isAdmin,
  onSwitchToBackoffice,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [now, setNow] = useState(() => new Date());
  const [cameraMode, setCameraMode] = useState<'clock-in' | 'clock-out' | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Tepat Waktu' | 'Terlambat'>('Semua');
  const [selectedPeriod, setSelectedPeriod] = useState(() => getPeriodKey(new Date()));

  // Profile phone edit state
  const [phoneDraft, setPhoneDraft] = useState(employee.phone || '');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneSavedMsg, setPhoneSavedMsg] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setPhoneDraft(employee.phone || '');
  }, [employee.phone]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayKey = getDateKey(now);
  const todayFormatted = formatDateDDMMMYYYY(now);
  const todayDayName = getIndonesianDayName(now);
  const isWorkDayToday = schedule.activeDays.includes(todayDayName);

  const todayAttendance = useMemo(
    () => attendances.find((a) => a.dateKey === todayKey),
    [attendances, todayKey]
  );

  const sortedAttendances = useMemo(
    () => [...attendances].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [attendances]
  );

  const currentMonthKey = getPeriodKey(now);
  const currentMonthAttendances = useMemo(
    () =>
      sortedAttendances.filter(
        (a) => a.dateKey.startsWith(currentMonthKey) && a.verificationStatus !== 'Ditolak'
      ),
    [sortedAttendances, currentMonthKey]
  );

  const currentMonthEarnings = useMemo(() => {
    return currentMonthAttendances.reduce(
      (sum, item) => sum + (item.dailyRateSnapshot || 0) + (item.dailyAllowanceSnapshot || 0),
      0
    );
  }, [currentMonthAttendances]);

  const filteredAttendances = useMemo(() => {
    return sortedAttendances.filter((a) => {
      const matchPeriod = a.dateKey.startsWith(selectedPeriod);
      const matchStatus = statusFilter === 'Semua' || a.clockInStatus === statusFilter;
      return matchPeriod && matchStatus;
    });
  }, [sortedAttendances, selectedPeriod, statusFilter]);

  const reportStats = useMemo(() => {
    const monthRows = sortedAttendances.filter(
      (a) => a.dateKey.startsWith(selectedPeriod) && a.verificationStatus !== 'Ditolak'
    );
    const onTimeCount = monthRows.filter((a) => a.clockInStatus === 'Tepat Waktu').length;
    const lateCount = monthRows.filter((a) => a.clockInStatus === 'Terlambat').length;
    const totalMinutes = monthRows.reduce((sum, a) => sum + (a.workMinutes || 0), 0);
    const baseTotal = monthRows.reduce((sum, a) => sum + (a.dailyRateSnapshot || 0), 0);
    const allowanceTotal = monthRows.reduce((sum, a) => sum + (a.dailyAllowanceSnapshot || 0), 0);
    return {
      rows: monthRows,
      daysPresent: monthRows.length,
      onTimeCount,
      lateCount,
      totalMinutes,
      baseTotal,
      allowanceTotal,
      grandTotal: baseTotal + allowanceTotal,
    };
  }, [sortedAttendances, selectedPeriod]);

  const handleConfirmSelfie = async (photoDataUrl: string, notes: string) => {
    if (cameraMode === 'clock-in') {
      await submitClockIn({
        employee,
        authUid,
        authEmail,
        photoDataUrl,
        schedule,
        notes,
      });
    } else if (cameraMode === 'clock-out' && todayAttendance) {
      await submitClockOut({
        attendance: todayAttendance,
        photoDataUrl,
      });
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPhone(true);
    setPhoneSavedMsg('');
    try {
      await updateEmployeeSelfProfile(employee.id, {
        phone: phoneDraft,
        avatarUrl: employee.avatarUrl || DEFAULT_EMPLOYEE_AVATAR,
        authUid,
      });
      setPhoneSavedMsg('Biodata diperbarui.');
      setTimeout(() => setPhoneSavedMsg(''), 3000);
    } finally {
      setIsSavingPhone(false);
    }
  };

  const navItems: Array<{ id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: 'Beranda', icon: Home },
    { id: 'attendance', label: 'Presensi', icon: Calendar },
    { id: 'reports', label: 'Laporan', icon: FileText },
    { id: 'profile', label: 'Profil', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop Left Navigation Rail (for >= md viewports so desktop never collapses to a narrow strip) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-6 h-16 flex items-center justify-between border-b border-slate-100">
          <span className="text-lg font-extrabold tracking-tight text-slate-950 font-display whitespace-nowrap">
            NusaHR
          </span>
          <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">Mobile PWA</span>
        </div>

        <div className="p-4 flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2.5">
          <PWAInstallButton variant="subtle" />
          {isAdmin && (
            <button
              type="button"
              onClick={onSwitchToBackoffice}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                Backoffice Admin
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void onLogout()}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* Mobile Compact Sticky Header (h-12 = 48px) */}
      <header className="md:hidden sticky top-0 z-30 h-12 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 flex items-center justify-between gap-3">
        <span className="text-base font-extrabold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0">
          NusaHR
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={onSwitchToBackoffice}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer"
            aria-label="Buka profil"
          >
            {!avatarFailed ? (
              <img
                src={employee.avatarUrl || DEFAULT_EMPLOYEE_AVATAR}
                alt={employee.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-700">
                {employee.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 md:pl-64 lg:pl-72 pb-20 md:pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
          {/* TAB 1: BERANDA */}
          {activeTab === 'home' && (
            <>
              {/* Greeting & Date Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 tabular-nums">
                    {todayDayName}, {todayFormatted}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 truncate">
                    Halo, {employee.name}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {employee.nik} · {employee.positionTitle} · {employee.department}
                  </p>
                </div>
                <div className="hidden sm:block shrink-0">
                  <PWAInstallButton variant="subtle" />
                </div>
              </div>

              {/* Fintech Obsidian Balance + Clock Action Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Obsidian Fintech Earnings Card */}
                <div className="lg:col-span-6 rounded-3xl bg-[#0B1220] text-white p-6 flex flex-col justify-between shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Estimasi Gaji Berjalan · {formatPeriodLabel(currentMonthKey)}
                      </p>
                      <p className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
                        {formatCurrencyIDR(currentMonthEarnings)}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400">Hari Masuk</p>
                      <p className="mt-1 text-sm font-bold tabular-nums">
                        {currentMonthAttendances.length} hari
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Tarif / Hari</p>
                      <p className="mt-1 text-sm font-bold tabular-nums">
                        {formatCurrencyIDR(employee.dailyRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Tunjangan / Hari</p>
                      <p className="mt-1 text-sm font-bold tabular-nums">
                        {formatCurrencyIDR(employee.dailyAllowance)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Clock-In / Clock-Out Card */}
                <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        {schedule.name} · {isWorkDayToday ? 'Hari Kerja Aktif' : 'Hari Libur Jadwal'}
                      </p>
                      <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950 font-mono tabular-nums">
                        {getTimeHHMMSS(now)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        Jam Kerja {schedule.startTime} – {schedule.endTime} WIB · Toleransi {schedule.lateToleranceMinutes} mnt
                      </p>
                    </div>
                    <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>

                  {/* Today's Selfie Status */}
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-4">
                    {todayAttendance ? (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                url: todayAttendance.clockInPhoto,
                                caption: `Clock In ${todayAttendance.dateFormatted} · ${todayAttendance.clockInTime}`,
                              })
                            }
                            className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                          >
                            <img
                              src={todayAttendance.clockInPhoto}
                              alt="Selfie Clock In"
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500">Clock In Tercatat</p>
                            <p className="text-sm font-bold text-slate-950 tabular-nums">
                              {todayAttendance.clockInTime} WIB ·{' '}
                              <span
                                className={
                                  todayAttendance.clockInStatus === 'Tepat Waktu'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }
                              >
                                {todayAttendance.clockInStatus}
                              </span>
                            </p>
                          </div>
                        </div>

                        {todayAttendance.hasClockOut && (
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  url: todayAttendance.clockOutPhoto,
                                  caption: `Clock Out ${todayAttendance.dateFormatted} · ${todayAttendance.clockOutTime}`,
                                })
                              }
                              className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer"
                            >
                              <img
                                src={todayAttendance.clockOutPhoto}
                                alt="Selfie Clock Out"
                                className="w-full h-full object-cover"
                              />
                            </button>
                            <div className="min-w-0 text-right">
                              <p className="text-xs text-slate-500">Clock Out</p>
                              <p className="text-sm font-bold text-slate-950 tabular-nums">
                                {todayAttendance.clockOutTime} WIB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Anda belum melakukan presensi masuk hari ini ({todayFormatted}).
                      </p>
                    )}

                    {!todayAttendance ? (
                      <button
                        type="button"
                        onClick={() => setCameraMode('clock-in')}
                        className="w-full min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                      >
                        <Camera className="w-5 h-5" />
                        Clock In Selfie Sekarang
                      </button>
                    ) : !todayAttendance.hasClockOut ? (
                      <button
                        type="button"
                        onClick={() => setCameraMode('clock-out')}
                        className="w-full min-h-[52px] rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-[0.99] transition-all text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                      >
                        <Camera className="w-5 h-5 text-emerald-400" />
                        Clock Out Selfie Sekarang
                      </button>
                    ) : (
                      <div className="w-full min-h-[48px] rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-sm flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Presensi Hari Ini Selesai ({formatDuration(todayAttendance.workMinutes)})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Attendance Feed */}
              <section className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <h2 className="text-base font-bold text-slate-950">Riwayat Presensi Terkini</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('attendance')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    Lihat Semua
                  </button>
                </div>

                {sortedAttendances.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-700">Belum ada riwayat presensi</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tekan tombol Clock In Selfie di atas untuk mencatat kehadiran pertama Anda.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sortedAttendances.slice(0, 5).map((item) => (
                      <div key={item.id} className="px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                url: item.clockInPhoto,
                                caption: `Clock In ${item.dateFormatted} · ${item.clockInTime}`,
                              })
                            }
                            className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer"
                          >
                            <img
                              src={item.clockInPhoto}
                              alt={`Selfie ${item.dateFormatted}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950 tabular-nums">
                              {item.dateFormatted}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums truncate">
                              Masuk {item.clockInTime} · Pulang {item.hasClockOut ? item.clockOutTime : 'Belum'} ·{' '}
                              <span
                                className={
                                  item.clockInStatus === 'Tepat Waktu'
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-amber-700 font-medium'
                                }
                              >
                                {item.clockInStatus}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-950 tabular-nums">
                            + {formatCurrencyIDR(item.dailyRateSnapshot + item.dailyAllowanceSnapshot)}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {item.hasClockOut ? formatDuration(item.workMinutes) : 'Sedang bekerja'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Live Team Attendance Today (Cross-User Real-Time Sync) */}
              <section className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <h2 className="text-base font-bold text-slate-950">Tim Hadir Hari Ini</h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {todayFormatted} · {todayTeamAttendances.length} tercatat
                  </span>
                </div>
                {todayTeamAttendances.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Belum ada rekan kerja yang melakukan Clock In hari ini.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {todayTeamAttendances.slice(0, 8).map((member) => (
                      <div key={member.id} className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950 truncate">
                            {member.employeeName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {member.positionTitle} ·{' '}
                            <span
                              className={
                                member.clockInStatus === 'Tepat Waktu'
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-amber-700 font-medium'
                              }
                            >
                              {member.clockInStatus}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <p className="text-xs font-bold text-slate-900">
                            Masuk {member.clockInTime}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {member.hasClockOut ? `Pulang ${member.clockOutTime}` : 'Sedang bertugas'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 2: PRESENSI */}
          {activeTab === 'attendance' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                    Catatan Presensi
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ketuk foto selfie untuk memeriksa bukti waktu masuk dan pulang.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 tabular-nums focus:border-emerald-600 focus:outline-none"
                  />
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                    {(['Semua', 'Tepat Waktu', 'Terlambat'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          statusFilter === status
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                {filteredAttendances.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Tidak ada data presensi pada {formatPeriodLabel(selectedPeriod)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ubah filter bulan atau lakukan Clock In selfie pada hari kerja.
                    </p>
                    {!todayAttendance && (
                      <button
                        type="button"
                        onClick={() => setCameraMode('clock-in')}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        Clock In Hari Ini
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredAttendances.map((item) => (
                      <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  url: item.clockInPhoto,
                                  caption: `Clock In ${item.dateFormatted} · ${item.clockInTime} WIB`,
                                })
                              }
                              className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 cursor-pointer"
                              title="Lihat Selfie Clock In"
                            >
                              <img src={item.clockInPhoto} alt="Clock In" className="w-full h-full object-cover" />
                            </button>
                            {item.hasClockOut && item.clockOutPhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: item.clockOutPhoto,
                                    caption: `Clock Out ${item.dateFormatted} · ${item.clockOutTime} WIB`,
                                  })
                                }
                                className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 cursor-pointer"
                                title="Lihat Selfie Clock Out"
                              >
                                <img src={item.clockOutPhoto} alt="Clock Out" className="w-full h-full object-cover" />
                              </button>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-950 tabular-nums">
                              <span>{item.dateFormatted}</span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span
                                className={
                                  item.clockInStatus === 'Tepat Waktu'
                                    ? 'text-emerald-700 text-xs font-semibold'
                                    : 'text-amber-700 text-xs font-semibold'
                                }
                              >
                                {item.clockInStatus}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 tabular-nums">
                              Masuk {item.clockInTime} WIB · Pulang{' '}
                              {item.hasClockOut ? `${item.clockOutTime} WIB` : 'Belum Clock Out'}
                              {item.hasClockOut ? ` · Durasi ${formatDuration(item.workMinutes)}` : ''}
                            </p>
                            {item.notes && (
                              <p className="text-xs text-slate-500 mt-1 truncate">Catatan: {item.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <span className="text-xs font-medium text-slate-500">
                            Status: {item.verificationStatus}
                          </span>
                          <span className="text-sm font-bold text-slate-950 tabular-nums">
                            {formatCurrencyIDR(item.dailyRateSnapshot + item.dailyAllowanceSnapshot)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LAPORAN */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                    Laporan Kehadiran & Pendapatan
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rekapitulasi performa kehadiran dan akumulasi gajian harian periode {formatPeriodLabel(selectedPeriod)}.
                  </p>
                </div>
                <input
                  type="month"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 tabular-nums focus:border-emerald-600 focus:outline-none self-start"
                />
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">Total Hari Masuk</p>
                  <p className="mt-1.5 text-2xl font-extrabold text-slate-950 tabular-nums">
                    {reportStats.daysPresent} <span className="text-xs font-medium text-slate-500">hari</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">Ketepatan Waktu</p>
                  <p className="mt-1.5 text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {reportStats.onTimeCount}{' '}
                    <span className="text-xs font-medium text-slate-500">/ {reportStats.lateCount} telat</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">Total Jam Kerja</p>
                  <p className="mt-1.5 text-2xl font-extrabold text-slate-950 tabular-nums">
                    {formatDuration(reportStats.totalMinutes)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#0B1220] text-white p-4">
                  <p className="text-xs text-slate-400">Estimasi Pendapatan</p>
                  <p className="mt-1.5 text-xl sm:text-2xl font-extrabold text-emerald-400 tabular-nums">
                    {formatCurrencyIDR(reportStats.grandTotal)}
                  </p>
                </div>
              </div>

              {/* Breakdown Table */}
              <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-950">Rincian Perhitungan Harian</h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Pokok {formatCurrencyIDR(reportStats.baseTotal)} · Tunjangan {formatCurrencyIDR(reportStats.allowanceTotal)}
                  </span>
                </div>
                {reportStats.rows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada hari masuk tercatat pada {formatPeriodLabel(selectedPeriod)}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-5 font-semibold">Tanggal</th>
                          <th className="py-3 px-4 font-semibold">Jam Masuk–Pulang</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-5 font-semibold text-right">Gaji Harian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {reportStats.rows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5 font-semibold text-slate-900">{row.dateFormatted}</td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {row.clockInTime} – {row.hasClockOut ? row.clockOutTime : 'Aktif'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={
                                  row.clockInStatus === 'Tepat Waktu'
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-amber-700 font-medium'
                                }
                              >
                                {row.clockInStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right font-bold text-slate-950">
                              {formatCurrencyIDR(row.dailyRateSnapshot + row.dailyAllowanceSnapshot)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROFIL (BIODATA & GAJI) */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                  Profil, Biodata & Gaji
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informasi kepegawaian, skema tarif harian, dan slip payroll resmi Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Biodata Card */}
                <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 p-6 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                      {!avatarFailed ? (
                        <img
                          src={employee.avatarUrl || DEFAULT_EMPLOYEE_AVATAR}
                          alt={employee.name}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-700">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-950 truncate">{employee.name}</h2>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">
                        {employee.positionTitle} · {employee.department}
                      </p>
                      <p className="text-xs font-medium text-emerald-700 mt-1 tabular-nums">
                        {employee.nik} · Status {employee.status}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Email Akun</span>
                      <span className="font-medium text-slate-900 truncate">{employee.email}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Tanggal Bergabung</span>
                      <span className="font-medium text-slate-900 tabular-nums">{employee.joinDate}</span>
                    </div>
                  </div>

                  <form onSubmit={handleSavePhone} className="pt-4 border-t border-slate-100 space-y-3">
                    <label htmlFor="profile-phone" className="block text-xs font-semibold text-slate-700">
                      Nomor Telepon / WhatsApp
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="profile-phone"
                          type="tel"
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none tabular-nums"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSavingPhone}
                        className="min-h-[44px] px-4 rounded-xl bg-slate-950 text-xs font-semibold text-white hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingPhone ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                    {phoneSavedMsg && <p className="text-xs font-medium text-emerald-700">{phoneSavedMsg}</p>}
                  </form>
                </div>

                {/* Salary Schema & Payroll Slips */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="rounded-3xl bg-[#0B1220] text-white p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold">Skema Gaji Harian</h2>
                      <span className="text-xs text-emerald-400 font-medium">Per Kehadiran Masuk</span>
                    </div>
                    <div className="space-y-2.5 text-sm pt-2 border-t border-white/10 tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gaji Pokok Harian</span>
                        <span className="font-semibold">{formatCurrencyIDR(employee.dailyRate)} / hari</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tunjangan Makan & Transport</span>
                        <span className="font-semibold">{formatCurrencyIDR(employee.dailyAllowance)} / hari</span>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-base">
                        <span className="font-semibold text-slate-200">Total Rate per Hari Masuk</span>
                        <span className="font-extrabold text-emerald-400">
                          {formatCurrencyIDR(employee.dailyRate + employee.dailyAllowance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h2 className="text-sm font-bold text-slate-950">Riwayat Slip Payroll</h2>
                    </div>
                    {payrolls.length === 0 ? (
                      <div className="p-6 text-xs text-slate-500">
                        Belum ada slip payroll yang difinalisasi oleh admin untuk akun Anda. Estimasi gaji berjalan tetap dapat dipantau pada menu Beranda & Laporan.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {payrolls.map((slip) => (
                          <div key={slip.id} className="px-6 py-4 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-bold text-slate-950">{slip.periodLabel}</p>
                              <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                                {slip.daysPresent} hari masuk ·{' '}
                                <span
                                  className={
                                    slip.status === 'Dibayarkan'
                                      ? 'text-emerald-700 font-semibold'
                                      : 'text-amber-700 font-semibold'
                                  }
                                >
                                  {slip.status}
                                </span>
                                {slip.paidDateFormatted ? ` (${slip.paidDateFormatted})` : ''}
                              </p>
                            </div>
                            <p className="text-sm font-extrabold text-slate-950 tabular-nums">
                              {formatCurrencyIDR(slip.netPay)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mobile Install & Logout actions */}
                  <div className="md:hidden flex flex-col gap-3 pt-2">
                    <PWAInstallButton variant="primary" />
                    <button
                      type="button"
                      onClick={() => void onLogout()}
                      className="w-full min-h-[48px] rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar dari Akun
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (h-14 = 56px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-4 h-14 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <Icon className={`w-5 h-5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span
                  className={`text-[11px] font-semibold tracking-tight ${
                    active ? 'text-slate-950' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Selfie Capture Modal */}
      {cameraMode && (
        <SelfieCameraModal
          mode={cameraMode}
          employeeName={employee.name}
          scheduleSummary={`${schedule.startTime} – ${schedule.endTime} WIB`}
          onClose={() => setCameraMode(null)}
          onConfirm={handleConfirmSelfie}
        />
      )}

      {/* Photo Lightbox Preview Modal */}
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
                aria-label="Tutup foto"
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
