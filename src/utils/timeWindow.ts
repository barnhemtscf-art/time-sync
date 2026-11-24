import type { AttendanceStatus, ButtonCutoffConfig, TimeTask } from '../types/system';

export function parseTimeToMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return -1;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isTimeInWindow(startTime: string, endTime: string, currentMinutes: number): boolean {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start < 0 || end < 0) return false;
  if (start <= end) {
    return currentMinutes >= start && currentMinutes <= end;
  }
  // Overnight window (e.g. 22:00 to 05:00)
  return currentMinutes >= start || currentMinutes <= end;
}

export function isTaskActiveAt(task: TimeTask, date: Date): boolean {
  if (!task.enabled || task.approvalStatus !== 'approved') return false;
  const day = date.getDay();
  if (task.daysOfWeek.length > 0 && !task.daysOfWeek.includes(day)) {
    return false;
  }
  const currentMinutes = getMinutesOfDay(date);
  return isTimeInWindow(task.startTime, task.endTime, currentMinutes);
}

export function isButtonAllowedAt(
  status: AttendanceStatus,
  cutoffs: ButtonCutoffConfig,
  taskStartTime: string,
  taskEndTime: string,
  date: Date
): { allowed: boolean; cutoffTime?: string; reason?: 'before_window' | 'cutoff_passed' } {
  const currentMinutes = getMinutesOfDay(date);
  if (!isTimeInWindow(taskStartTime, taskEndTime, currentMinutes)) {
    return { allowed: false, reason: 'before_window' };
  }
  const cutoffStr = cutoffs[status];
  if (!cutoffStr) {
    return { allowed: true };
  }
  const startMins = parseTimeToMinutes(taskStartTime);
  const cutoffMins = parseTimeToMinutes(cutoffStr);
  if (cutoffMins < 0) return { allowed: true };

  // Handle overnight tasks cleanly
  if (startMins > parseTimeToMinutes(taskEndTime)) {
    const adjustedNow = currentMinutes < startMins ? currentMinutes + 1440 : currentMinutes;
    const adjustedCutoff = cutoffMins < startMins ? cutoffMins + 1440 : cutoffMins;
    if (adjustedNow > adjustedCutoff) {
      return { allowed: false, cutoffTime: cutoffStr, reason: 'cutoff_passed' };
    }
    return { allowed: true, cutoffTime: cutoffStr };
  }

  if (currentMinutes > cutoffMins) {
    return { allowed: false, cutoffTime: cutoffStr, reason: 'cutoff_passed' };
  }
  return { allowed: true, cutoffTime: cutoffStr };
}

export function generateDailyQrToken(orgId: string, taskId: string, dateKey: string): string {
  const raw = `${orgId}:${taskId}:${dateKey}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  const code = hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `DQR-${orgId}-${dateKey.replace(/-/g, '')}-${code}`;
}

export function needsDailyReset(lastResetDateKey: string, currentDateKey: string): boolean {
  return Boolean(currentDateKey) && lastResetDateKey !== currentDateKey;
}
