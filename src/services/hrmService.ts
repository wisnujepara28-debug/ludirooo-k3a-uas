import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  type AdminUser,
  type AttendanceRecord,
  BLUEPRINT_LIMITS,
  type Employee,
  type PayrollRecord,
  type Position,
  sanitizeText,
  slugifyId,
  type WorkSchedule,
} from '../types/hrm';
import {
  computeWorkMinutes,
  evaluateClockInStatus,
  formatDateDDMMMYYYY,
  formatPeriodLabel,
  getDateKey,
  getTimeHHMM,
} from '../utils/formatters';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'wisnujepara28@gmail.com';
export const DEFAULT_ADMIN_AVATAR = '/src/assets/images/avatar_hr_admin_1795141552279.jpg';
export const DEFAULT_EMPLOYEE_AVATAR = '/src/assets/images/avatar_employee_sample_1795141552614.jpg';

const SEEDED_POSITIONS: Array<Omit<Position, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'pos-software-engineer',
    title: 'Software Engineer',
    department: 'Teknologi',
    dailyRate: 350000,
    dailyAllowance: 50000,
  },
  {
    id: 'pos-hr-specialist',
    title: 'HR & People Specialist',
    department: 'Sumber Daya Manusia',
    dailyRate: 275000,
    dailyAllowance: 45000,
  },
  {
    id: 'pos-finance-officer',
    title: 'Finance & Payroll Officer',
    department: 'Keuangan',
    dailyRate: 280000,
    dailyAllowance: 45000,
  },
  {
    id: 'pos-operasional',
    title: 'Staff Operasional',
    department: 'Operasional',
    dailyRate: 185000,
    dailyAllowance: 35000,
  },
];

export async function ensureInitialMasterData(
  currentUserEmail?: string | null,
  currentUserUid?: string | null,
  currentUserName?: string | null
) {
  try {
    const posSnap = await getDocs(collection(db, 'positions'));
    if (posSnap.empty) {
      for (const pos of SEEDED_POSITIONS) {
        await setDoc(doc(db, 'positions', pos.id), {
          ...pos,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const schedSnap = await getDocs(collection(db, 'workSchedules'));
    if (schedSnap.empty) {
      await setDoc(doc(db, 'workSchedules', 'default'), {
        id: 'default',
        name: 'Shift Reguler Kantor',
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 15,
        activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
        updatedAt: serverTimestamp(),
      });
    }

    const empSnap = await getDocs(collection(db, 'employees'));
    if (empSnap.empty) {
      const initialEmployees: Array<Omit<Employee, 'createdAt' | 'updatedAt'>> = [
        {
          id: 'emp-sample-01',
          nik: 'EMP-001',
          name: 'Rina Kusuma',
          email: 'rina.kusuma@nusahr.id',
          phone: '0812-3456-7890',
          positionId: 'pos-hr-specialist',
          positionTitle: 'HR & People Specialist',
          department: 'Sumber Daya Manusia',
          dailyRate: 275000,
          dailyAllowance: 45000,
          status: 'Aktif',
          authUid: '',
          avatarUrl: DEFAULT_ADMIN_AVATAR,
          joinDate: formatDateDDMMMYYYY(new Date()),
        },
        {
          id: 'emp-sample-02',
          nik: 'EMP-002',
          name: 'Aditya Nugroho',
          email: 'aditya.nugroho@nusahr.id',
          phone: '0813-9876-5432',
          positionId: 'pos-software-engineer',
          positionTitle: 'Software Engineer',
          department: 'Teknologi',
          dailyRate: 350000,
          dailyAllowance: 50000,
          status: 'Aktif',
          authUid: '',
          avatarUrl: DEFAULT_EMPLOYEE_AVATAR,
          joinDate: '01-Nov-2026',
        },
        {
          id: 'emp-sample-03',
          nik: 'EMP-003',
          name: 'Siti Rahmawati',
          email: 'siti.rahmawati@nusahr.id',
          phone: '0856-1122-3344',
          positionId: 'pos-operasional',
          positionTitle: 'Staff Operasional',
          department: 'Operasional',
          dailyRate: 185000,
          dailyAllowance: 35000,
          status: 'Aktif',
          authUid: '',
          avatarUrl: DEFAULT_EMPLOYEE_AVATAR,
          joinDate: '05-Nov-2026',
        },
      ];

      for (const emp of initialEmployees) {
        await setDoc(doc(db, 'employees', emp.id), {
          ...emp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'positions/workSchedules/employees');
  }
}

export async function ensureEmployeeProfileForUser(params: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  positions: Position[];
}) {
  const defaultPos =
    params.positions.find((p) => p.id === 'pos-operasional') ||
    params.positions[0] ||
    SEEDED_POSITIONS[3];

  const empId = `emp-${slugifyId(params.uid).slice(0, 24)}`;
  const nikSuffix = params.uid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '1001';

  const payload = {
    id: empId,
    nik: `EMP-${nikSuffix}`,
    name: sanitizeText(params.displayName || params.email.split('@')[0] || 'Karyawan NusaHR', BLUEPRINT_LIMITS.NAME_MAX),
    email: sanitizeText(params.email.toLowerCase(), BLUEPRINT_LIMITS.EMAIL_MAX),
    phone: '-',
    positionId: defaultPos.id,
    positionTitle: sanitizeText(defaultPos.title, BLUEPRINT_LIMITS.TITLE_MAX),
    department: sanitizeText(defaultPos.department, BLUEPRINT_LIMITS.DEPT_MAX),
    dailyRate: defaultPos.dailyRate,
    dailyAllowance: defaultPos.dailyAllowance,
    status: 'Aktif' as const,
    authUid: params.uid,
    avatarUrl: sanitizeText(params.photoURL || DEFAULT_EMPLOYEE_AVATAR, 500),
    joinDate: formatDateDDMMMYYYY(new Date()),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'employees', empId), payload);
    return empId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `employees/${empId}`);
  }
}

export async function savePosition(
  input: { id?: string; title: string; department: string; dailyRate: number; dailyAllowance: number }
) {
  const id = input.id && BLUEPRINT_LIMITS.ID_PATTERN.test(input.id)
    ? input.id
    : `pos-${slugifyId(input.title)}-${Date.now().toString().slice(-4)}`;

  const payload = {
    id,
    title: sanitizeText(input.title, BLUEPRINT_LIMITS.TITLE_MAX),
    department: sanitizeText(input.department, BLUEPRINT_LIMITS.DEPT_MAX),
    dailyRate: Math.max(0, Math.round(Number(input.dailyRate) || 0)),
    dailyAllowance: Math.max(0, Math.round(Number(input.dailyAllowance) || 0)),
    updatedAt: serverTimestamp(),
  };

  try {
    if (input.id) {
      await updateDoc(doc(db, 'positions', id), payload);
    } else {
      await setDoc(doc(db, 'positions', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, `positions/${id}`);
  }
}

export async function deletePosition(positionId: string) {
  try {
    await deleteDoc(doc(db, 'positions', positionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `positions/${positionId}`);
  }
}

export async function saveWorkSchedule(schedule: Omit<WorkSchedule, 'updatedAt'>) {
  const id = schedule.id || 'default';
  try {
    await setDoc(doc(db, 'workSchedules', id), {
      id,
      name: sanitizeText(schedule.name, BLUEPRINT_LIMITS.TITLE_MAX),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      lateToleranceMinutes: Math.max(0, Math.min(180, Math.round(Number(schedule.lateToleranceMinutes) || 0))),
      activeDays: schedule.activeDays.slice(0, 7),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workSchedules/${id}`);
  }
}

export async function saveEmployee(
  input: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
) {
  const id = input.id && BLUEPRINT_LIMITS.ID_PATTERN.test(input.id)
    ? input.id
    : `emp-${slugifyId(input.nik || input.name)}-${Date.now().toString().slice(-4)}`;

  const payload = {
    id,
    nik: sanitizeText(input.nik, BLUEPRINT_LIMITS.NIK_MAX),
    name: sanitizeText(input.name, BLUEPRINT_LIMITS.NAME_MAX),
    email: sanitizeText(input.email.toLowerCase(), BLUEPRINT_LIMITS.EMAIL_MAX),
    phone: sanitizeText(input.phone, BLUEPRINT_LIMITS.PHONE_MAX),
    positionId: input.positionId,
    positionTitle: sanitizeText(input.positionTitle, BLUEPRINT_LIMITS.TITLE_MAX),
    department: sanitizeText(input.department, BLUEPRINT_LIMITS.DEPT_MAX),
    dailyRate: Math.max(0, Math.round(Number(input.dailyRate) || 0)),
    dailyAllowance: Math.max(0, Math.round(Number(input.dailyAllowance) || 0)),
    status: input.status,
    authUid: sanitizeText(input.authUid || '', 128),
    avatarUrl: sanitizeText(input.avatarUrl || DEFAULT_EMPLOYEE_AVATAR, 500),
    joinDate: sanitizeText(input.joinDate || formatDateDDMMMYYYY(new Date()), 20),
    updatedAt: serverTimestamp(),
  };

  try {
    if (input.id) {
      await updateDoc(doc(db, 'employees', id), payload);
    } else {
      await setDoc(doc(db, 'employees', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, `employees/${id}`);
  }
}

export async function updateEmployeeSelfProfile(
  employeeId: string,
  updates: { phone: string; avatarUrl: string; authUid: string }
) {
  try {
    await updateDoc(doc(db, 'employees', employeeId), {
      phone: sanitizeText(updates.phone, BLUEPRINT_LIMITS.PHONE_MAX),
      avatarUrl: sanitizeText(updates.avatarUrl, 500),
      authUid: sanitizeText(updates.authUid, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${employeeId}`);
  }
}

export async function deleteEmployee(employeeId: string) {
  try {
    await deleteDoc(doc(db, 'employees', employeeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `employees/${employeeId}`);
  }
}

export async function submitClockIn(params: {
  employee: Employee;
  authUid: string;
  authEmail: string;
  photoDataUrl: string;
  schedule: WorkSchedule;
  notes?: string;
}) {
  const now = new Date();
  const dateKey = getDateKey(now);
  const dateFormatted = formatDateDDMMMYYYY(now);
  const clockInTime = getTimeHHMM(now);
  const clockInStatus = evaluateClockInStatus(
    clockInTime,
    params.schedule.startTime,
    params.schedule.lateToleranceMinutes
  );

  const attendanceId = `${params.employee.id}_${dateKey}`;
  const docData = {
    id: attendanceId,
    employeeId: params.employee.id,
    employeeNik: sanitizeText(params.employee.nik, BLUEPRINT_LIMITS.NIK_MAX),
    employeeName: sanitizeText(params.employee.name, BLUEPRINT_LIMITS.NAME_MAX),
    positionTitle: sanitizeText(params.employee.positionTitle, BLUEPRINT_LIMITS.TITLE_MAX),
    authUid: params.authUid,
    employeeEmail: sanitizeText(params.authEmail.toLowerCase(), BLUEPRINT_LIMITS.EMAIL_MAX),
    dateKey,
    dateFormatted,
    clockInTime,
    clockInPhoto: params.photoDataUrl.slice(0, BLUEPRINT_LIMITS.PHOTO_MAX),
    clockInStatus,
    clockOutTime: '',
    clockOutPhoto: '',
    hasClockOut: false,
    workMinutes: 0,
    dailyRateSnapshot: params.employee.dailyRate,
    dailyAllowanceSnapshot: params.employee.dailyAllowance,
    verificationStatus: 'Tercatat' as const,
    notes: sanitizeText(params.notes || '', BLUEPRINT_LIMITS.NOTES_MAX),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'attendance', attendanceId), docData);
    return attendanceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `attendance/${attendanceId}`);
  }
}

export async function submitClockOut(params: {
  attendance: AttendanceRecord;
  photoDataUrl: string;
}) {
  const now = new Date();
  const clockOutTime = getTimeHHMM(now);
  const workMinutes = computeWorkMinutes(params.attendance.clockInTime, clockOutTime);

  try {
    await updateDoc(doc(db, 'attendance', params.attendance.id), {
      clockOutTime,
      clockOutPhoto: params.photoDataUrl.slice(0, BLUEPRINT_LIMITS.PHOTO_MAX),
      hasClockOut: true,
      workMinutes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attendance/${params.attendance.id}`);
  }
}

export async function updateAttendanceAdmin(
  attendanceId: string,
  updates: { verificationStatus: 'Tercatat' | 'Terverifikasi' | 'Ditolak'; notes?: string }
) {
  try {
    await updateDoc(doc(db, 'attendance', attendanceId), {
      verificationStatus: updates.verificationStatus,
      notes: sanitizeText(updates.notes ?? '', BLUEPRINT_LIMITS.NOTES_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attendance/${attendanceId}`);
  }
}

export async function deleteAttendance(attendanceId: string) {
  try {
    await deleteDoc(doc(db, 'attendance', attendanceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendance/${attendanceId}`);
  }
}

export async function savePayrollRecord(params: {
  employee: Employee;
  periodKey: string;
  daysPresent: number;
  basePayTotal: number;
  allowanceTotal: number;
  deductionTotal: number;
  status: 'Draft' | 'Dibayarkan';
  existingId?: string;
}) {
  const payrollId = params.existingId || `${params.employee.id}_${params.periodKey}`;
  const netPay = Math.max(0, params.basePayTotal + params.allowanceTotal - params.deductionTotal);
  const paidDateFormatted =
    params.status === 'Dibayarkan' ? formatDateDDMMMYYYY(new Date()) : '';

  const payload = {
    id: payrollId,
    employeeId: params.employee.id,
    employeeNik: sanitizeText(params.employee.nik, BLUEPRINT_LIMITS.NIK_MAX),
    employeeName: sanitizeText(params.employee.name, BLUEPRINT_LIMITS.NAME_MAX),
    employeeEmail: sanitizeText(params.employee.email.toLowerCase(), BLUEPRINT_LIMITS.EMAIL_MAX),
    positionTitle: sanitizeText(params.employee.positionTitle, BLUEPRINT_LIMITS.TITLE_MAX),
    periodKey: params.periodKey,
    periodLabel: formatPeriodLabel(params.periodKey),
    daysPresent: Math.min(31, Math.max(0, params.daysPresent)),
    dailyRate: params.employee.dailyRate,
    dailyAllowance: params.employee.dailyAllowance,
    basePayTotal: Math.max(0, Math.round(params.basePayTotal)),
    allowanceTotal: Math.max(0, Math.round(params.allowanceTotal)),
    deductionTotal: Math.max(0, Math.round(params.deductionTotal)),
    netPay: Math.round(netPay),
    status: params.status,
    paidDateFormatted,
    updatedAt: serverTimestamp(),
  };

  try {
    if (params.existingId) {
      await updateDoc(doc(db, 'payrolls', payrollId), payload);
    } else {
      await setDoc(doc(db, 'payrolls', payrollId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    return payrollId;
  } catch (error) {
    handleFirestoreError(
      error,
      params.existingId ? OperationType.UPDATE : OperationType.CREATE,
      `payrolls/${payrollId}`
    );
  }
}

export async function addAdminUser(admin: Omit<AdminUser, 'createdAt'>) {
  try {
    await setDoc(doc(db, 'admins', admin.uid), {
      uid: sanitizeText(admin.uid, 128),
      email: sanitizeText(admin.email.toLowerCase(), BLUEPRINT_LIMITS.EMAIL_MAX),
      name: sanitizeText(admin.name, BLUEPRINT_LIMITS.NAME_MAX),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admins/${admin.uid}`);
  }
}

export async function removeAdminUser(uid: string) {
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
  }
}
