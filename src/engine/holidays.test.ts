import { describe, expect, it } from "vitest";
import {
  calculate,
  countWorkDays,
  DEFAULT_ENGINE_SETTINGS,
  getPayPeriod,
  holidayName,
  isWorkDay,
  KR_HOLIDAYS,
  type EngineSettings,
} from "./index";
import holidayList from "./holidays-kr.json";

const SALARY = 3_000_000;
const work: EngineSettings = {
  ...DEFAULT_ENGINE_SETTINGS,
  monthlySalary: SALARY,
  excludeHolidays: true,
};
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe("내장 공휴일 데이터", () => {
  it("2026~2027년 날짜만, 중복 없이, 날짜순", () => {
    const dates = holidayList.map((h) => h.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
    expect(dates.every((d) => /^202[67]-\d{2}-\d{2}$/.test(d))).toBe(true);
  });

  it("대체공휴일은 모두 평일 (주말에 겹친 공휴일을 평일로 옮긴 것)", () => {
    const substitutes = holidayList.filter((h) => h.name.startsWith("대체공휴일"));
    expect(substitutes.map((h) => h.date)).toEqual([
      "2026-03-02",
      "2026-05-25",
      "2026-08-17",
      "2026-10-05",
      "2027-02-09",
      "2027-08-16",
      "2027-10-04",
      "2027-10-11",
      "2027-12-27",
    ]);
    for (const h of substitutes) {
      const [y, m, d] = h.date.split("-").map(Number);
      expect([1, 2, 3, 4, 5]).toContain(new Date(y, m - 1, d).getDay());
    }
  });
});

describe("2026년 추석 (9/24~9/26)", () => {
  it("9/24(목), 9/25(금), 9/26(토)은 근무일이 아니다", () => {
    for (const d of [24, 25, 26]) {
      expect(KR_HOLIDAYS.has(`2026-09-${d}`)).toBe(true);
      expect(isWorkDay(at(2026, 9, d), work, KR_HOLIDAYS)).toBe(false);
    }
    expect(holidayName(at(2026, 9, 25))).toBe("추석");
    // 앞뒤 평일은 근무일
    expect(isWorkDay(at(2026, 9, 23), work, KR_HOLIDAYS)).toBe(true);
    expect(isWorkDay(at(2026, 9, 28), work, KR_HOLIDAYS)).toBe(true);
  });

  it("추석 당일 근무시간에도 증가 0, 상태는 휴일", () => {
    const a = calculate(at(2026, 9, 24, 10), work);
    const b = calculate(at(2026, 9, 24, 17), work);
    expect(a.todayEarned).toBe(0);
    expect(b.periodEarned).toBe(a.periodEarned);
    expect(a.status).toBe("holiday");
  });

  it("9월 근무일은 평일 22일에서 추석 평일 2일을 뺀 20일", () => {
    const period = getPayPeriod(at(2026, 9, 10), 1);
    expect(countWorkDays(period, work, KR_HOLIDAYS)).toBe(20);
    expect(calculate(at(2026, 9, 10, 10), work).perSecond).toBeCloseTo(
      SALARY / (20 * 8 * 3600),
      10,
    );
    // 마지막 근무일(9/30 수) 퇴근 시각 누적 = 월급
    const last = calculate(at(2026, 9, 30, 18), work);
    expect(Math.abs(last.periodEarned - SALARY)).toBeLessThan(1);
  });

  it("추석 전날 퇴근 후 다음 출근은 9/28(월) 09:00", () => {
    const r = calculate(at(2026, 9, 23, 19), work);
    expect(r.secondsToNextStatus).toBe((4 * 24 + 14) * 3600);
  });
});

describe("대체공휴일", () => {
  it.each([
    ["2026-03-02", at(2026, 3, 2, 10)],
    ["2026-05-25", at(2026, 5, 25, 10)],
    ["2026-08-17", at(2026, 8, 17, 10)],
    ["2026-10-05", at(2026, 10, 5, 10)],
    ["2027-02-09", at(2027, 2, 9, 10)],
    ["2027-12-27", at(2027, 12, 27, 10)],
  ])("%s는 휴일", (_, date) => {
    expect(calculate(date, work).status).toBe("holiday");
  });

  it("공휴일 제외를 끄면 평일로 계산", () => {
    expect(calculate(at(2026, 9, 24, 10), { ...work, excludeHolidays: false }).status).toBe(
      "working",
    );
  });
});
