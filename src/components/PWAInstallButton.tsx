import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'primary' | 'subtle';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'primary' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'primary'
            ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-4 h-4" />
        Install Aplikasi PWA
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-emerald-600" />
          Pasang di Layar Utama iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 border border-slate-200 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Install NusaHR di iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li>1. Ketuk tombol <strong>Bagikan (Share)</strong> pada bilah Safari.</li>
                <li>2. Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.</li>
                <li>3. Ketuk <strong>Tambah</strong> untuk menggunakan NusaHR sebagai aplikasi mandiri.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
