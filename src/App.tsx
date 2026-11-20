import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  formatFirestoreError,
  googleProvider,
  OperationType,
  testConnection,
} from './firebase';
import {
  DEFAULT_EMPLOYEE_AVATAR,
  ensureEmployeeProfileForUser,
  ensureInitialMasterData,
  updateEmployeeSelfProfile,
} from './services/hrmService';
import type {
  AdminUser,
  AppWorkspace,
  AttendanceRecord,
  Employee,
  PayrollRecord,
  Position,
  WorkSchedule,
} from './types/hrm';
import { getDateKey } from './utils/formatters';
import { BackofficeAdminView } from './components/BackofficeAdminView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { MobilePWAView } from './components/MobilePWAView';
import { OfflineIndicator } from './components/OfflineIndicator';

const DEFAULT_SCHEDULE: WorkSchedule = {
  id: 'default',
  name: 'Shift Reguler Kantor',
  startTime: '08:00',
  endTime: '17:00',
  lateToleranceMinutes: 15,
  activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
};

const WORKSPACE_STORAGE_KEY = 'nusahr_workspace';

function mapAuthError(err: unknown): { message: string; canFallbackRedirect: boolean } {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
    return {
      message: 'Popup Google diblokir peramban. Silakan izinkan popup atau gunakan tombol Login Alternatif di bawah.',
      canFallbackRedirect: true,
    };
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    return {
      message: `Domain "${window.location.hostname}" belum terdaftar di Authorized Domains Firebase Auth (Project: mesmerizing-amp-2n96h). Silakan tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`,
      canFallbackRedirect: false,
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      message: 'Provider Google Sign-In belum diaktifkan di Firebase Console.',
      canFallbackRedirect: false,
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      message: 'Koneksi jaringan ke server Firebase terputus. Periksa internet Anda dan coba lagi.',
      canFallbackRedirect: false,
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return { message: '', canFallbackRedirect: false };
  }
  return {
    message: msg || 'Gagal melakukan autentikasi dengan Google.',
    canFallbackRedirect: true,
  };
}

function AppContent() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (saved === 'backoffice' || saved === 'mobile') return saved;
    }
    return 'mobile';
  });
  const [authError, setAuthError] = useState('');
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  // Firestore synced state
  const [positions, setPositions] = useState<Position[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [positionsLoaded, setPositionsLoaded] = useState(false);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [liveNotice, setLiveNotice] = useState('');

  const autoProvisionedUidRef = useRef<string | null>(null);
  const attInitializedRef = useRef(false);

  const switchWorkspace = (ws: AppWorkspace) => {
    setActiveWorkspace(ws);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, ws);
    }
  };

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      const mapped = mapAuthError(err);
      if (mapped.message) setAuthError(mapped.message);
    });

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setPositionsLoaded(false);
      setEmployeesLoaded(false);
      setFirebaseError(null);
      attInitializedRef.current = false;
      if (!nextUser) {
        autoProvisionedUidRef.current = null;
        setPositions([]);
        setEmployees([]);
        setAttendances([]);
        setPayrolls([]);
        setAdmins([]);
      } else {
        void testConnection();
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Seed initial master data on first sign-in if database is empty
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;
    ensureInitialMasterData().catch((err) => {
      setFirebaseError(err instanceof Error ? err.message : String(err));
    });
  }, [authReady, user, retryCounter]);

  // Real-time Firestore subscriptions
  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    const reportSnapshotError = (err: unknown, op: OperationType, path: string) => {
      const info = formatFirestoreError(err, op, path);
      console.error('Firestore Error: ', JSON.stringify(info));
      setFirebaseError(`Koneksi database gagal (${info.operationType} ${info.path}): ${info.error}`);
    };

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      onSnapshot(
        collection(db, 'positions'),
        (snap) => {
          setPositions(snap.docs.map((d) => d.data() as Position));
          setPositionsLoaded(true);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'positions')
      )
    );

    unsubscribers.push(
      onSnapshot(
        doc(db, 'workSchedules', 'default'),
        (snap) => {
          if (snap.exists()) {
            setSchedule(snap.data() as WorkSchedule);
          }
        },
        (err) => reportSnapshotError(err, OperationType.GET, 'workSchedules/default')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'employees'),
        (snap) => {
          setEmployees(snap.docs.map((d) => d.data() as Employee));
          setEmployeesLoaded(true);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'employees')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'attendance'),
        (snap) => {
          if (attInitializedRef.current) {
            const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites);
            if (changes.length > 0) {
              const latest = changes[0].doc.data() as AttendanceRecord;
              const actionText = latest.hasClockOut ? 'Clock Out' : 'Clock In';
              setLiveNotice(`Pembaruan langsung: ${latest.employeeName} (${actionText} ${latest.dateFormatted})`);
              setTimeout(() => setLiveNotice(''), 4000);
            }
          }
          attInitializedRef.current = true;
          setAttendances(snap.docs.map((d) => d.data() as AttendanceRecord));
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'attendance')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'payrolls'),
        (snap) => {
          setPayrolls(snap.docs.map((d) => d.data() as PayrollRecord));
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'payrolls')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'admins'),
        (snap) => {
          setAdmins(snap.docs.map((d) => d.data() as AdminUser));
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'admins')
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, user, retryCounter]);

  const myEmployee = useMemo(() => {
    if (!user || !user.email) return null;
    const emailLower = user.email.toLowerCase();
    return (
      employees.find((e) => e.authUid === user.uid || e.email.toLowerCase() === emailLower) || null
    );
  }, [employees, user]);

  // Automatically create an employee profile if signed-in user doesn't have one yet
  useEffect(() => {
    if (!user || !user.email || !user.emailVerified || !positionsLoaded || !employeesLoaded) return;
    if (myEmployee) {
      if (myEmployee.authUid !== user.uid) {
        updateEmployeeSelfProfile(myEmployee.id, {
          phone: myEmployee.phone || '-',
          avatarUrl: myEmployee.avatarUrl || user.photoURL || DEFAULT_EMPLOYEE_AVATAR,
          authUid: user.uid,
        }).catch((err) => {
          console.error('Auto-bind employee authUid failed:', err);
        });
      }
      return;
    }

    if (autoProvisionedUidRef.current === user.uid) return;
    autoProvisionedUidRef.current = user.uid;

    ensureEmployeeProfileForUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      positions,
    }).catch((err) => {
      autoProvisionedUidRef.current = null;
      setFirebaseError(err instanceof Error ? err.message : String(err));
    });
  }, [user, positionsLoaded, employeesLoaded, myEmployee, positions]);

  const myAttendances = useMemo(() => {
    if (!myEmployee) return [];
    return attendances.filter((a) => a.employeeId === myEmployee.id);
  }, [attendances, myEmployee]);

  const todayTeamAttendances = useMemo(() => {
    const todayKey = getDateKey(new Date());
    return attendances
      .filter((a) => a.dateKey === todayKey)
      .sort((a, b) => b.clockInTime.localeCompare(a.clockInTime));
  }, [attendances]);

  const myPayrolls = useMemo(() => {
    if (!myEmployee) return [];
    return payrolls.filter((p) => p.employeeId === myEmployee.id);
  }, [payrolls, myEmployee]);

  const handleGoogleLogin = async (targetWorkspace: AppWorkspace, useRedirect = false) => {
    setAuthError('');
    setShowRedirectFallback(false);
    switchWorkspace(targetWorkspace);
    setIsSigningIn(true);
    try {
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      const mapped = mapAuthError(err);
      if (mapped.message) setAuthError(mapped.message);
      setShowRedirectFallback(mapped.canFallbackRedirect);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAuthError('');
    setFirebaseError(null);
  };

  if (firebaseError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-950">Kendala Koneksi Firebase</h2>
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3.5 break-words leading-relaxed">
            {firebaseError}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFirebaseError(null);
                setRetryCounter((c) => c + 1);
              }}
              className="flex-1 rounded-xl bg-slate-950 text-white py-2.5 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Coba Sambungkan Ulang
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="px-4 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-950">Email Akun Belum Terverifikasi</h2>
          <p className="text-sm text-slate-600">
            Akun {user.email || 'ini'} belum memiliki status verifikasi email dari Google. Silakan gunakan akun Google yang sudah terverifikasi.
          </p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full rounded-xl bg-slate-950 text-white py-2.5 text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Ganti Akun Google
          </button>
        </div>
      </div>
    );
  }

  const dataReady = positionsLoaded && employeesLoaded;

  if (!authReady || (user && (!dataReady || (activeWorkspace === 'mobile' && !myEmployee)))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0B1220] text-emerald-400 font-display font-extrabold flex items-center justify-center mx-auto">
            N
          </div>
          <p className="text-sm font-semibold text-slate-700">Menghubungkan ke server NusaHR...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <OfflineIndicator />
        <LoginView
          onGoogleLogin={handleGoogleLogin}
          authError={authError}
          showRedirectFallback={showRedirectFallback}
          isSigningIn={isSigningIn}
        />
      </>
    );
  }

  const liveBanner = liveNotice ? (
    <div className="fixed top-4 right-4 z-50 rounded-xl bg-slate-950 text-white px-4 py-2.5 text-xs font-semibold shadow-xl border border-emerald-500/40">
      {liveNotice}
    </div>
  ) : null;

  if (activeWorkspace === 'backoffice') {
    return (
      <>
        <OfflineIndicator />
        {liveBanner}
        <BackofficeAdminView
          currentUserEmail={user.email || ''}
          currentUserName={user.displayName || 'Manajemen HR'}
          positions={positions}
          schedule={schedule}
          employees={employees}
          attendances={attendances}
          payrolls={payrolls}
          admins={admins}
          hasEmployeeProfile={!!myEmployee}
          onSwitchToMobile={() => switchWorkspace('mobile')}
          onLogout={handleLogout}
        />
      </>
    );
  }

  if (!myEmployee) {
    return null;
  }

  return (
    <>
      <OfflineIndicator />
      {liveBanner}
      <MobilePWAView
        employee={myEmployee}
        authUid={user.uid}
        authEmail={user.email || ''}
        schedule={schedule}
        attendances={myAttendances}
        todayTeamAttendances={todayTeamAttendances}
        payrolls={myPayrolls}
        isAdmin={true}
        onSwitchToBackoffice={() => switchWorkspace('backoffice')}
        onLogout={handleLogout}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
