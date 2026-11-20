import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'employee';
export type AppWorkspace = 'mobile' | 'backoffice';

export interface Position {
  id: string;
  title: string;
  department: string;
  dailyRate: number;
  dailyAllowance: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkSchedule {
  id: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  lateToleranceMinutes: number;
  activeDays: string[]; // e.g. ['Senin', 'Selasa', ...]
  updatedAt?: Timestamp;
}

export interface Employee {
  id: string;
  nik: string;
  name: string;
  email: string;
  phone: string;
  positionId: string;
  positionTitle: string;
  department: string;
  dailyRate: number;
  dailyAllowance: number;
  status: 'Aktif' | 'Nonaktif';
  authUid: string;
  avatarUrl: string;
  joinDate: string; // DD-MMM-YYYY
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeNik: string;
  employeeName: string;
  positionTitle: string;
  authUid: string;
  employeeEmail: string;
  dateKey: string; // YYYY-MM-DD
  dateFormatted: string; // DD-MMM-YYYY
  clockInTime: string; // HH:MM
  clockInPhoto: string;
  clockInStatus: 'Tepat Waktu' | 'Terlambat';
  clockOutTime: string;
  clockOutPhoto: string;
  hasClockOut: boolean;
  workMinutes: number;
  dailyRateSnapshot: number;
  dailyAllowanceSnapshot: number;
  verificationStatus: 'Tercatat' | 'Terverifikasi' | 'Ditolak';
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeNik: string;
  employeeName: string;
  employeeEmail: string;
  positionTitle: string;
  periodKey: string; // YYYY-MM
  periodLabel: string; // e.g. Nov 2026
  daysPresent: number;
  dailyRate: number;
  dailyAllowance: number;
  basePayTotal: number;
  allowanceTotal: number;
  deductionTotal: number;
  netPay: number;
  status: 'Draft' | 'Dibayarkan';
  paidDateFormatted: string; // DD-MMM-YYYY or ""
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  createdAt?: Timestamp;
}

// Validation constants synchronized verbatim with firebase-blueprint.json
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  TIME_PATTERN: /^\d{2}:\d{2}$/,
  DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  PERIOD_KEY_PATTERN: /^\d{4}-\d{2}$/,
  TITLE_MAX: 80,
  DEPT_MAX: 60,
  NAME_MAX: 100,
  NIK_MAX: 30,
  EMAIL_MAX: 120,
  PHONE_MAX: 30,
  NOTES_MAX: 300,
  PHOTO_MAX: 250000,
} as const;

export function sanitizeText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function slugifyId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || `id-${Date.now()}`;
}
