import type { HolidaySet } from "./types";
import { toDateKey } from "./time";
import holidayList from "./holidays-kr.json";

/** 한국 공휴일 (대체공휴일·선거일 포함). 내장 범위: 2026~2027년 */
export const KR_HOLIDAYS: HolidaySet = new Set(holidayList.map((h) => h.date));

const holidayNames = new Map(holidayList.map((h) => [h.date, h.name]));

export const HOLIDAY_YEARS = { from: 2026, to: 2027 } as const;

/** 공휴일이면 이름, 아니면 null */
export function holidayName(date: Date): string | null {
  return holidayNames.get(toDateKey(date)) ?? null;
}
