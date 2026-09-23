import type { Earnings, EngineSettings, HolidaySet, Status } from "./types";
import { getPayPeriod } from "./period";
import {
  countWorkDays,
  dailyWorkSeconds,
  isWorkDay,
  workSegments,
  workedSeconds,
  type Segment,
} from "./schedule";
import { addDays, secondsOfDay, startOfDay } from "./time";

/** 다음 근무일 출근 시각까지 남은 초. 1년 안에 근무일이 없으면 null. */
function secondsToNextWorkStart(
  now: Date,
  segments: readonly Segment[],
  settings: EngineSettings,
  holidays?: HolidaySet,
): number | null {
  if (segments.length === 0) return null;
  const workStart = segments[0][0];
  for (let k = 1; k <= 366; k++) {
    const day = addDays(now, k);
    if (isWorkDay(day, settings, holidays)) {
      return (day.getTime() + workStart * 1000 - now.getTime()) / 1000;
    }
  }
  return null;
}

/**
 * 근무 일정 기준 현재 상태와 다음 상태까지 남은 초.
 * 퇴근/휴일의 "다음 상태"는 다음 근무일 출근(근무 중)으로 본다.
 */
export function getStatus(
  now: Date,
  settings: EngineSettings,
  holidays?: HolidaySet,
): { status: Status; nextStatus: Status | null; secondsToNextStatus: number | null } {
  const segments = workSegments(settings);
  const sec = secondsOfDay(now);
  const untilNextWork = () => secondsToNextWorkStart(now, segments, settings, holidays);

  if (segments.length === 0 || !isWorkDay(now, settings, holidays)) {
    const secondsToNextStatus = untilNextWork();
    return {
      status: "holiday",
      nextStatus: secondsToNextStatus === null ? null : "working",
      secondsToNextStatus,
    };
  }

  const first = segments[0][0];
  const last = segments[segments.length - 1][1];

  if (sec < first) {
    return { status: "before", nextStatus: "working", secondsToNextStatus: first - sec };
  }
  if (sec >= last) {
    return { status: "off", nextStatus: "working", secondsToNextStatus: untilNextWork() };
  }
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    if (sec >= a && sec < b) {
      const isLast = i === segments.length - 1;
      return {
        status: "working",
        nextStatus: isLast ? "off" : "lunch",
        secondsToNextStatus: b - sec,
      };
    }
    const next = segments[i + 1];
    if (next && sec >= b && sec < next[0]) {
      return { status: "lunch", nextStatus: "working", secondsToNextStatus: next[0] - sec };
    }
  }
  // 도달하지 않음 (구간이 정렬되어 있으므로)
  return { status: "off", nextStatus: "working", secondsToNextStatus: untilNextWork() };
}

/** now가 속한 급여 기간 기준 초당 금액 */
export function perSecondRate(
  now: Date,
  settings: EngineSettings,
  holidays?: HolidaySet,
): number {
  const period = getPayPeriod(now, settings.periodStartDay);
  const totalSeconds =
    settings.mode === "24h"
      ? (period.end.getTime() - period.start.getTime()) / 1000
      : countWorkDays(period, settings, holidays) * dailyWorkSeconds(workSegments(settings));
  return totalSeconds > 0 ? settings.monthlySalary / totalSeconds : 0;
}

/**
 * (now, settings)로 모든 표시 값을 새로 계산한다. 누적 상태 없음.
 */
export function calculate(
  now: Date,
  settings: EngineSettings,
  holidays?: HolidaySet,
): Earnings {
  const period = getPayPeriod(now, settings.periodStartDay);
  const today = startOfDay(now);
  const sec = secondsOfDay(now);
  const perSecond = perSecondRate(now, settings, holidays);

  let todayEarned: number;
  let periodEarned: number;
  let todayProgress: number;

  if (settings.mode === "24h") {
    const daySeconds = (addDays(today, 1).getTime() - today.getTime()) / 1000;
    todayEarned = sec * perSecond;
    periodEarned = ((now.getTime() - period.start.getTime()) / 1000) * perSecond;
    todayProgress = sec / daySeconds;
  } else {
    const segments = workSegments(settings);
    const daily = dailyWorkSeconds(segments);
    const workedToday = isWorkDay(now, settings, holidays) ? workedSeconds(segments, sec) : 0;
    const pastWorkDays = countWorkDays({ start: period.start, end: today }, settings, holidays);
    todayEarned = workedToday * perSecond;
    periodEarned = (pastWorkDays * daily + workedToday) * perSecond;
    todayProgress = daily > 0 ? workedToday / daily : 0;
  }

  return {
    todayEarned,
    periodEarned,
    perSecond,
    hourly: perSecond * 3600,
    todayProgress,
    ...getStatus(now, settings, holidays),
    period,
  };
}
