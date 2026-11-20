import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
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
  const [isSigningIn, setIsSigningIn] = useState(false);

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
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setPositionsLoaded(false);
      setEmployeesLoaded(false);
      attInitializedRef.current = false;
      if (!nextUser) {
        autoProvisionedUidRef.current = null;
        setPositions([]);
        setEmployees([]);
        setAttendances([]);
        setPayrolls([]);
        setAdmins([]);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Seed initial master data on first sign-in if database is empty
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;
    void ensureInitialMasterData(user.email, user.uid, user.displayName);
  }, [authReady, user]);

  // Real-time Firestore subscriptions (single source of truth across all connected users)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      return;
    }

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      onSnapshot(
        collection(db, 'positions'),
        (snap) => {
          setPositions(snap.docs.map((d) => d.data() as Position));
          setPositionsLoaded(true);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'positions')
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
        (err) => handleFirestoreError(err, OperationType.GET, 'workSchedules/default')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'employees'),
        (snap) => {
          setEmployees(snap.docs.map((d) => d.data() as Employee));
          setEmployeesLoaded(true);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
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
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'payrolls'),
        (snap) => {
          setPayrolls(snap.docs.map((d) => d.data() as PayrollRecord));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'payrolls')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'admins'),
        (snap) => {
          setAdmins(snap.docs.map((d) => d.data() as AdminUser));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, user]);

  const myEmployee = useMemo(() => {
    if (!user || !user.email) return null;
    const emailLower = user.email.toLowerCase();
    return (
      employees.find((e) => e.authUid === user.uid || e.email.toLowerCase() === emailLower) || null
    );
  }, [employees, user]);

  // Automatically create an employee profile if signed-in user doesn't have one yet
  useEffect(() => {
    if (!user || !user.email || !positionsLoaded || !employeesLoaded) return;
    if (myEmployee) {
      if (myEmployee.authUid !== user.uid) {
        void updateEmployeeSelfProfile(myEmployee.id, {
          phone: myEmployee.phone || '-',
          avatarUrl: myEmployee.avatarUrl || user.photoURL || DEFAULT_EMPLOYEE_AVATAR,
          authUid: user.uid,
        });
      }
      return;
    }

    if (autoProvisionedUidRef.current === user.uid) return;
    autoProvisionedUidRef.current = user.uid;

    void ensureEmployeeProfileForUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      positions,
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

  const handleGoogleLogin = async (targetWorkspace: AppWorkspace) => {
    setAuthError('');
    switchWorkspace(targetWorkspace);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (message.includes('popup-blocked')) {
        setAuthError('Popup login diblokir oleh peramban. Izinkan popup untuk situs ini lalu coba lagi.');
      } else if (!message.includes('popup-closed-by-user')) {
        setAuthError(message);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAuthError('');
  };

  const dataReady = positionsLoaded && employeesLoaded;

  if (!authReady || (user && user.emailVerified && (!dataReady || (activeWorkspace === 'mobile' && !myEmployee)))) {
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
