import type { EngineSettings, HolidaySet, PayPeriod } from "./types";
import { addDays, parseTime, toDateKey } from "./time";

/** 하루 중 근무 구간 [시작초, 종료초). 점심시간은 빠져 있음. */
export type Segment = readonly [number, number];

/**
 * 하루의 근무 구간 목록. 점심이 근무시간과 겹치는 만큼만 빼며,
 * 퇴근이 출근보다 이르거나 같으면 (야간 근무 미지원) 빈 배열.
 */
export function workSegments(settings: EngineSettings): Segment[] {
  const start = parseTime(settings.workStart);
  const end = parseTime(settings.workEnd);
  if (end <= start) return [];
  if (!settings.lunch) return [[start, end]];

  const clamp = (v: number) => Math.min(Math.max(v, start), end);
  const lunchStart = clamp(parseTime(settings.lunch.start));
  const lunchEnd = clamp(parseTime(settings.lunch.end));
  if (lunchEnd <= lunchStart) return [[start, end]];

  const segments: Segment[] = [
    [start, lunchStart],
    [lunchEnd, end],
  ];
  return segments.filter(([a, b]) => b > a);
}

/** 하루 실근무 초 */
export function dailyWorkSeconds(segments: readonly Segment[]): number {
  return segments.reduce((sum, [a, b]) => sum + (b - a), 0);
}

/** 00:00부터 sec초까지 실제로 근무한 초 */
export function workedSeconds(segments: readonly Segment[], sec: number): number {
  return segments.reduce(
    (sum, [a, b]) => sum + Math.max(0, Math.min(sec, b) - a),
    0,
  );
}

/** 근무 요일이고, 공휴일 제외 설정 시 공휴일이 아닌 날 */
export function isWorkDay(
  date: Date,
  settings: EngineSettings,
  holidays?: HolidaySet,
): boolean {
  if (!settings.workDays.includes(date.getDay())) return false;
  if (settings.excludeHolidays && holidays?.has(toDateKey(date))) return false;
  return true;
}

/** [start, end) 구간의 근무일 수 */
export function countWorkDays(
  range: PayPeriod,
  settings: EngineSettings,
  holidays?: HolidaySet,
): number {
  let count = 0;
  for (let d = range.start; d < range.end; d = addDays(d, 1)) {
    if (isWorkDay(d, settings, holidays)) count++;
  }
  return count;
}
