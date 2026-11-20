import React, { useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import type { AppWorkspace } from '../types/hrm';
import { formatDateDDMMMYYYY } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginViewProps {
  onGoogleLogin: (targetWorkspace: AppWorkspace) => Promise<void>;
  authError: string;
  isSigningIn: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onGoogleLogin,
  authError,
  isSigningIn,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [signingTarget, setSigningTarget] = useState<AppWorkspace | null>(null);

  const handleLoginClick = async (target: AppWorkspace) => {
    setSigningTarget(target);
    await onGoogleLogin(target);
    setSigningTarget(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar (Clean 3-Zone Contract) */}
      <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-extrabold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0">
            NusaHR
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="whitespace-nowrap shrink-0">Presensi Selfie</span>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="whitespace-nowrap shrink-0">Payroll Harian</span>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="whitespace-nowrap shrink-0">Backoffice Manajemen</span>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton variant="subtle" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Frictionless 1-Tap Login */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <p className="text-xs font-semibold text-emerald-700">
                  Akses Instan · Multi-Device
                </p>
                <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                  Masuk ke NusaHR
                </h1>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Siapa saja dapat langsung masuk menggunakan akun Google tanpa registrasi manual. Pilih tujuan portal di bawah ini.
                </p>
              </div>

              {authError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {authError}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => void handleLoginClick('mobile')}
                  className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-5 py-3.5 flex items-center justify-between gap-3 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">
                        {isSigningIn && signingTarget === 'mobile'
                          ? 'Menghubungkan...'
                          : 'Masuk Portal Karyawan (Mobile PWA)'}
                      </p>
                      <p className="text-xs text-emerald-100 mt-0.5">
                        Clock-In/Out selfie, laporan & slip gaji
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => void handleLoginClick('backoffice')}
                  className="w-full min-h-[56px] rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-[0.99] text-white px-5 py-3.5 flex items-center justify-between gap-3 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 text-left">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">
                        {isSigningIn && signingTarget === 'backoffice'
                          ? 'Menghubungkan...'
                          : 'Masuk Panel Admin (Backoffice)'}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Kelola karyawan, jam kerja, kehadiran & payroll
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Otomatis aktif untuk semua akun Google dengan database real-time.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Tanggal sistem{' '}
                    <span className="font-mono text-slate-700">{formatDateDDMMMYYYY(new Date())}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Architectural Visual */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="relative flex-1 min-h-[280px] lg:min-h-[500px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-200">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hrm_login_hero_1795141552997.jpg"
                  alt="Ruang kerja korporat modern NusaHR"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 text-white">
                <p className="text-xs font-medium text-emerald-300">
                  Mobile PWA Karyawan · Backoffice SDM
                </p>
                <h2
                  className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight max-w-xl"
                  style={{ textWrap: 'balance' }}
                >
                  Presensi selfie instan dengan kalkulasi payroll harian otomatis.
                </h2>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-white/15 text-xs">
                  <div>
                    <p className="text-slate-300">Clock-In & Clock-Out</p>
                    <p className="mt-0.5 font-semibold text-white">Verifikasi Foto Selfie</p>
                  </div>
                  <div>
                    <p className="text-slate-300">Model Penggajian</p>
                    <p className="mt-0.5 font-semibold text-white">Tarif Harian per Kehadiran</p>
                  </div>
                  <div>
                    <p className="text-slate-300">Sinkronisasi Data</p>
                    <p className="mt-0.5 font-semibold text-white">Real-Time Multi-Device</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
