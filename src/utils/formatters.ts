const MONTHS_MMM = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const DAYS_ID = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
] as const;

/**
 * Formats a Date or YYYY-MM-DD string strictly into DD-MMM-YYYY (e.g., 13-Nov-2026)
 */
export function formatDateDDMMMYYYY(input: Date | string): string {
  let d: Date;
  if (typeof input === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const day = Number(match[3]);
      d = new Date(year, monthIndex, day);
    } else {
      d = new Date(input);
    }
  } else {
    d = input;
  }

  if (Number.isNaN(d.getTime())) {
    return '-';
  }

  const dayStr = String(d.getDate()).padStart(2, '0');
  const monthStr = MONTHS_MMM[d.getMonth()];
  const yearStr = String(d.getFullYear());
  return `${dayStr}-${monthStr}-${yearStr}`;
}

export function getDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPeriodKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatPeriodLabel(periodKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return periodKey;
  const year = match[1];
  const monthIndex = Math.max(0, Math.min(11, Number(match[2]) - 1));
  return `${MONTHS_MMM[monthIndex]} ${year}`;
}

export function getTimeHHMM(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getTimeHHMMSS(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function getIndonesianDayName(date: Date = new Date()): string {
  return DAYS_ID[date.getDay()];
}

export function formatCurrencyIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return 0;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function computeWorkMinutes(clockInHHMM: string, clockOutHHMM: string): number {
  const start = parseTimeToMinutes(clockInHHMM);
  const end = parseTimeToMinutes(clockOutHHMM);
  if (end <= start) return 0;
  return Math.min(1440, end - start);
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0j 0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}j ${mins}m`;
}

export function evaluateClockInStatus(
  clockInHHMM: string,
  scheduleStartHHMM: string,
  toleranceMinutes: number
): 'Tepat Waktu' | 'Terlambat' {
  const inMins = parseTimeToMinutes(clockInHHMM);
  const limitMins = parseTimeToMinutes(scheduleStartHHMM) + toleranceMinutes;
  return inMins <= limitMins ? 'Tepat Waktu' : 'Terlambat';
}
