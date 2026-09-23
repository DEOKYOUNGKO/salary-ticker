import type { PayPeriod } from "./types";

/** year/month의 day일 00:00. 그 달에 없는 날짜면 마지막 날. month는 범위를 벗어나도 됨. */
function periodStartIn(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * now가 속한 급여 기간.
 * periodStartDay=1 → 1일~말일, periodStartDay=25 → 25일~다음 달 24일.
 */
export function getPayPeriod(now: Date, periodStartDay: number): PayPeriod {
  const year = now.getFullYear();
  const month = now.getMonth();
  let start = periodStartIn(year, month, periodStartDay);
  if (now < start) start = periodStartIn(year, month - 1, periodStartDay);
  const end = periodStartIn(start.getFullYear(), start.getMonth() + 1, periodStartDay);
  return { start, end };
}
