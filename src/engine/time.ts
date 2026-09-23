/** "HH:MM" → 자정부터의 초. "24:00"까지 허용. */
export function parseTime(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time: ${hhmm}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (m > 59 || h > 24 || (h === 24 && m !== 0)) {
    throw new Error(`Invalid time: ${hhmm}`);
  }
  return h * 3600 + m * 60;
}

/** 해당 날짜의 로컬 00:00 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** date가 속한 날의 00:00에서 n일 뒤의 00:00 */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** 그날 00:00부터 지난 초 (밀리초 포함) */
export function secondsOfDay(date: Date): number {
  return (date.getTime() - startOfDay(date).getTime()) / 1000;
}

/** 로컬 날짜 → "YYYY-MM-DD" */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
