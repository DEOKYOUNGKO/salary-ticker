import { describe, expect, it } from "vitest";
import {
  calculate,
  countWorkDays,
  DEFAULT_ENGINE_SETTINGS,
  getPayPeriod,
  getStatus,
  parseTime,
  perSecondRate,
  workSegments,
  type EngineSettings,
} from "./index";

const SALARY = 3_000_000;
const work: EngineSettings = { ...DEFAULT_ENGINE_SETTINGS, monthlySalary: SALARY };
const allDay: EngineSettings = { ...work, mode: "24h" };

/** 로컬 시각 생성 (month는 1~12) */
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0) =>
  new Date(y, mo - 1, d, h, mi, s, ms);

// 2026년 1월: 1일 목요일, 평일 22일 / 2월: 1일 일요일, 평일 20일
const JAN_WORK_SECONDS = 22 * 8 * 3600;
const FEB_WORK_SECONDS = 20 * 8 * 3600;

describe("parseTime / workSegments", () => {
  it("HH:MM을 초로 바꾼다", () => {
    expect(parseTime("09:00")).toBe(32400);
    expect(parseTime("24:00")).toBe(86400);
    expect(() => parseTime("9시")).toThrow();
    expect(() => parseTime("12:60")).toThrow();
  });

  it("점심시간을 뺀 근무 구간을 만든다", () => {
    expect(workSegments(work)).toEqual([
      [9 * 3600, 12 * 3600],
      [13 * 3600, 18 * 3600],
    ]);
    expect(workSegments({ ...work, lunch: null })).toEqual([[9 * 3600, 18 * 3600]]);
    // 근무시간 밖의 점심은 무시
    expect(workSegments({ ...work, lunch: { start: "19:00", end: "20:00" } })).toEqual([
      [9 * 3600, 18 * 3600],
    ]);
  });
});

describe("근무시간 모드", () => {
  it("급여 기간 마지막 근무일 퇴근 시각의 누적액 = 월급", () => {
    const r = calculate(at(2026, 1, 30, 18), work);
    expect(Math.abs(r.periodEarned - SALARY)).toBeLessThan(1);
  });

  it("퇴근 후 기간 종료까지 누적액은 월급에서 더 늘지 않는다", () => {
    const r = calculate(at(2026, 1, 31, 23, 59, 59, 999), work);
    expect(Math.abs(r.periodEarned - SALARY)).toBeLessThan(1);
  });

  it("초당 금액 = 월급 ÷ (근무일 수 × 하루 실근무 초)", () => {
    const r = calculate(at(2026, 1, 15, 10), work);
    expect(r.perSecond).toBeCloseTo(SALARY / JAN_WORK_SECONDS, 10);
    expect(r.hourly).toBeCloseTo((SALARY / JAN_WORK_SECONDS) * 3600, 8);
  });

  it("근무 중에는 경과 시간만큼 증가한다", () => {
    const a = calculate(at(2026, 1, 15, 10), work);
    const b = calculate(at(2026, 1, 15, 10, 0, 10), work);
    expect(b.todayEarned - a.todayEarned).toBeCloseTo(a.perSecond * 10, 8);
    expect(b.periodEarned - a.periodEarned).toBeCloseTo(a.perSecond * 10, 8);
  });

  it("점심시간에는 증가 0", () => {
    const a = calculate(at(2026, 1, 15, 12, 0, 0), work);
    const b = calculate(at(2026, 1, 15, 12, 59, 59, 999), work);
    expect(b.todayEarned).toBe(a.todayEarned);
    expect(b.periodEarned).toBe(a.periodEarned);
    expect(a.status).toBe("lunch");
  });

  it("주말에는 증가 0", () => {
    const sat = calculate(at(2026, 1, 17, 0), work);
    const sun = calculate(at(2026, 1, 18, 23, 59, 59), work);
    expect(sat.todayEarned).toBe(0);
    expect(sun.todayEarned).toBe(0);
    expect(sun.periodEarned).toBe(sat.periodEarned);
    expect(sat.status).toBe("holiday");
  });

  it("출근 전에는 증가 0", () => {
    const a = calculate(at(2026, 1, 15, 0), work);
    const b = calculate(at(2026, 1, 15, 8, 59, 59, 999), work);
    expect(a.todayEarned).toBe(0);
    expect(b.todayEarned).toBe(0);
    expect(b.periodEarned).toBe(a.periodEarned);
    expect(b.status).toBe("before");
  });

  it("퇴근 후에는 증가 0", () => {
    const a = calculate(at(2026, 1, 15, 18), work);
    const b = calculate(at(2026, 1, 15, 23, 59, 59, 999), work);
    expect(b.todayEarned).toBe(a.todayEarned);
    expect(b.periodEarned).toBe(a.periodEarned);
    expect(a.todayEarned).toBeCloseTo(a.perSecond * 8 * 3600, 6);
    expect(a.todayProgress).toBe(1);
    expect(b.status).toBe("off");
  });

  it("월이 바뀌면 초당 금액이 새 달 기준으로 재계산된다", () => {
    const jan = calculate(at(2026, 1, 30, 17, 59), work);
    const feb = calculate(at(2026, 2, 2, 9, 1), work);
    expect(jan.perSecond).toBeCloseTo(SALARY / JAN_WORK_SECONDS, 10);
    expect(feb.perSecond).toBeCloseTo(SALARY / FEB_WORK_SECONDS, 10);
    expect(feb.perSecond).toBeGreaterThan(jan.perSecond);
    // 새 기간은 0부터 다시 누적
    expect(feb.periodEarned).toBeCloseTo(feb.perSecond * 60, 8);
  });

  it("공휴일 제외 시 공휴일은 근무일에서 빠진다", () => {
    const holidays = new Set(["2026-01-15"]);
    const s = { ...work, excludeHolidays: true };
    const r = calculate(at(2026, 1, 15, 10), s, holidays);
    expect(r.todayEarned).toBe(0);
    expect(r.status).toBe("holiday");
    expect(r.perSecond).toBeCloseTo(SALARY / (21 * 8 * 3600), 10);
    // 설정이 꺼져 있으면 무시
    expect(calculate(at(2026, 1, 15, 10), work, holidays).status).toBe("working");
  });

  it("근무일이 없으면 초당 금액 0", () => {
    const r = calculate(at(2026, 1, 15, 10), { ...work, workDays: [] });
    expect(r.perSecond).toBe(0);
    expect(r.secondsToNextStatus).toBeNull();
  });
});

describe("24시간 모드", () => {
  it("급여 기간 종료 시각의 누적액 = 월급", () => {
    const r = calculate(at(2026, 1, 31, 23, 59, 59, 999), allDay);
    expect(Math.abs(r.periodEarned - SALARY)).toBeLessThan(1);
  });

  it("초당 금액 = 월급 ÷ 급여 기간 총 초", () => {
    expect(perSecondRate(at(2026, 2, 10), allDay)).toBeCloseTo(SALARY / (28 * 86400), 10);
  });

  it("주말·점심·퇴근 후에도 계속 증가한다", () => {
    const a = calculate(at(2026, 1, 17, 12, 30), allDay);
    const b = calculate(at(2026, 1, 17, 12, 30, 10), allDay);
    expect(b.todayEarned - a.todayEarned).toBeCloseTo(a.perSecond * 10, 8);
  });

  it("오늘 번 돈은 자정부터, 진행률은 하루 기준", () => {
    const r = calculate(at(2026, 1, 17, 12), allDay);
    expect(r.todayEarned).toBeCloseTo(r.perSecond * 12 * 3600, 6);
    expect(r.todayProgress).toBeCloseTo(0.5, 10);
  });
});

describe("급여 기간", () => {
  it("periodStartDay=1이면 1일~말일", () => {
    const p = getPayPeriod(at(2026, 2, 14), 1);
    expect(p.start).toEqual(at(2026, 2, 1));
    expect(p.end).toEqual(at(2026, 3, 1));
  });

  it("periodStartDay=25이면 25일~다음 달 24일", () => {
    const before25 = getPayPeriod(at(2026, 3, 24, 23, 59), 25);
    expect(before25.start).toEqual(at(2026, 2, 25));
    expect(before25.end).toEqual(at(2026, 3, 25)); // 3/24까지 포함

    const on25 = getPayPeriod(at(2026, 3, 25), 25);
    expect(on25.start).toEqual(at(2026, 3, 25));
    expect(on25.end).toEqual(at(2026, 4, 25));

    // 연도 경계
    const jan = getPayPeriod(at(2026, 1, 10), 25);
    expect(jan.start).toEqual(at(2025, 12, 25));
    expect(jan.end).toEqual(at(2026, 1, 25));
  });

  it("periodStartDay=25 기간 전체로 초당 금액과 월급 누적을 계산한다", () => {
    const s = { ...work, periodStartDay: 25 };
    // 2/25(수)~3/24(화): 평일 20일
    const period = getPayPeriod(at(2026, 3, 10), 25);
    expect(countWorkDays(period, s)).toBe(20);
    const last = calculate(at(2026, 3, 24, 18), s);
    expect(Math.abs(last.periodEarned - SALARY)).toBeLessThan(1);
    // 25일에 새 기간 시작
    const next = calculate(at(2026, 3, 25, 9, 0, 1), s);
    expect(next.periodEarned).toBeCloseTo(next.perSecond, 8);
  });

  it("periodStartDay가 그 달에 없으면 말일로 맞춘다", () => {
    const p = getPayPeriod(at(2026, 2, 28), 31);
    expect(p.start).toEqual(at(2026, 2, 28));
    expect(p.end).toEqual(at(2026, 3, 31));
  });
});

describe("상태와 다음 상태까지 남은 시간", () => {
  it("평일 하루의 상태 전환", () => {
    expect(getStatus(at(2026, 1, 15, 8, 30), work)).toEqual({
      status: "before",
      nextStatus: "working",
      secondsToNextStatus: 1800,
    });
    expect(getStatus(at(2026, 1, 15, 11), work)).toEqual({
      status: "working",
      nextStatus: "lunch",
      secondsToNextStatus: 3600,
    });
    expect(getStatus(at(2026, 1, 15, 12, 45), work)).toEqual({
      status: "lunch",
      nextStatus: "working",
      secondsToNextStatus: 900,
    });
    expect(getStatus(at(2026, 1, 15, 17), work)).toEqual({
      status: "working",
      nextStatus: "off",
      secondsToNextStatus: 3600,
    });
  });

  it("금요일 퇴근 후와 주말은 월요일 출근까지 남은 시간", () => {
    expect(getStatus(at(2026, 1, 16, 19), work).secondsToNextStatus).toBe(62 * 3600);
    expect(getStatus(at(2026, 1, 17, 9), work)).toEqual({
      status: "holiday",
      nextStatus: "working",
      secondsToNextStatus: 48 * 3600,
    });
  });
});
