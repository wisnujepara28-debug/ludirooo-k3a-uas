import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Upload, X } from 'lucide-react';
import { formatDateDDMMMYYYY, getTimeHHMM } from '../utils/formatters';

interface SelfieCameraModalProps {
  mode: 'clock-in' | 'clock-out';
  employeeName: string;
  scheduleSummary: string;
  onClose: () => void;
  onConfirm: (photoDataUrl: string, notes: string) => Promise<void>;
}

function compressImageToDataUrl(source: HTMLVideoElement | HTMLImageElement, width: number, height: number): string {
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / Math.max(1, width));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (source instanceof HTMLVideoElement) {
    // Mirror selfie preview back to natural orientation
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.65);
}

export const SelfieCameraModal: React.FC<SelfieCameraModalProps> = ({
  mode,
  employeeName,
  scheduleSummary,
  onClose,
  onConfirm,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraError, setCameraError] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraReady(false);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Kamera langsung tidak tersedia pada peramban ini. Silakan unggah foto selfie dari perangkat.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError('Izin kamera belum diberikan atau perangkat tidak memiliki kamera depan. Gunakan tombol Unggah Selfie di bawah.');
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const dataUrl = compressImageToDataUrl(video, video.videoWidth, video.videoHeight);
    if (dataUrl) {
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto('');
    setSubmitError('');
    void startCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageToDataUrl(img, img.width, img.height);
        if (compressed) {
          setCapturedPhoto(compressed);
          stopCamera();
          setCameraError('');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!capturedPhoto) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onConfirm(capturedPhoto, notes);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal menyimpan presensi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const now = new Date();
  const isClockIn = mode === 'clock-in';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isClockIn ? 'Selfie Clock In' : 'Selfie Clock Out'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {formatDateDDMMMYYYY(now)} · {getTimeHHMM(now)} WIB · {employeeName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup kamera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="relative aspect-[4/3] w-full rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center">
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Hasil foto selfie presensi"
                className="w-full h-full object-cover"
              />
            ) : cameraError ? (
              <div className="p-6 text-center space-y-3">
                <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Ambil / Unggah Foto Selfie
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover -scale-x-100"
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-xs text-slate-300">
                    Menyiapkan kamera depan...
                  </div>
                )}
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Jadwal Shift</span>
            <span className="font-medium text-slate-800 tabular-nums">{scheduleSummary}</span>
          </div>

          {isClockIn && (
            <div>
              <label htmlFor="attendance-notes" className="block text-xs font-medium text-slate-600 mb-1.5">
                Catatan Kehadiran (Opsional)
              </label>
              <input
                id="attendance-notes"
                type="text"
                maxLength={250}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: WFO Kantor Pusat / Visit Klien"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          {submitError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 rounded-xl px-3.5 py-2.5">
              {submitError}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-3">
          {!capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Unggah
              </button>
              <button
                type="button"
                disabled={!cameraReady}
                onClick={handleCapture}
                className="flex-1 min-h-[48px] rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Ambil Foto Selfie
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRetake}
                className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Ulangi
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {isSubmitting
                  ? 'Menyimpan...'
                  : isClockIn
                  ? 'Konfirmasi Clock In'
                  : 'Konfirmasi Clock Out'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
