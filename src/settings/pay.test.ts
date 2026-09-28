import { describe, expect, it } from "vitest";
import { calculate } from "../engine";
import { deductionTotal, effectivePayBasis, toEngineSettings } from "./pay";
import { DEFAULT_SETTINGS, withDefaults, type Deductions, type Settings } from "./schema";

/** 로컬 시각 생성 (month는 1~12) */
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

// 합계 338,710원
const DEDUCTIONS: Deductions = {
  nationalPension: 97_050,
  healthInsurance: 76_450,
  longTermCare: 9_900,
  employmentInsurance: 19_410,
  incomeTax: 123_550,
  localIncomeTax: 12_350,
};

// 기본값: 월급 2,156,880원, 08:30~17:30, 점심 12:30~13:30, 월~금, 1일 시작
const base: Settings = { ...DEFAULT_SETTINGS };
// 2026년 1월 급여 기간의 마지막 근무일(30일 금요일) 퇴근 시각
const LAST_WORK_END = at(2026, 1, 30, 17, 30);

const periodEarned = (s: Settings, now = LAST_WORK_END) =>
  calculate(now, toEngineSettings(s)).periodEarned;

describe("세후 계산", () => {
  it("공제 합계", () => {
    expect(deductionTotal(DEDUCTIONS)).toBe(338_710);
  });

  it("월급 2,156,880원, 공제 338,710원, 세후 → 마지막 근무일 퇴근 시각 누적액 1,818,170원", () => {
    const s: Settings = { ...base, deductions: DEDUCTIONS, payBasis: "net" };
    expect(Math.abs(periodEarned(s) - 1_818_170)).toBeLessThan(1);
  });

  it("세후면 초당 금액·시급·오늘 번 돈도 (월급 - 공제) 기준", () => {
    const now = at(2026, 1, 15, 15);
    const gross = calculate(now, toEngineSettings({ ...base, deductions: DEDUCTIONS }));
    const net = calculate(now, toEngineSettings({ ...base, deductions: DEDUCTIONS, payBasis: "net" }));
    const ratio = 1_818_170 / 2_156_880;
    expect(net.perSecond).toBeCloseTo(gross.perSecond * ratio, 10);
    expect(net.hourly).toBeCloseTo(gross.hourly * ratio, 8);
    expect(net.todayEarned).toBeCloseTo(gross.todayEarned * ratio, 6);
  });

  it("세전이면 공제가 있어도 월급 그대로", () => {
    const s: Settings = { ...base, deductions: DEDUCTIONS, payBasis: "gross" };
    expect(Math.abs(periodEarned(s) - 2_156_880)).toBeLessThan(1);
  });

  it("공제를 입력하지 않으면 표시 기준과 관계없이 누적액 2,156,880원", () => {
    for (const payBasis of ["gross", "net"] as const) {
      const s: Settings = { ...base, payBasis };
      expect(effectivePayBasis(s)).toBe("gross");
      expect(Math.abs(periodEarned(s) - 2_156_880)).toBeLessThan(1);
    }
  });

  it("기존 저장값에는 공제 0, 세전이 채워진다", () => {
    const s = withDefaults({ monthlySalary: 2_156_880 });
    expect(deductionTotal(s.deductions)).toBe(0);
    expect(s.payBasis).toBe("gross");
    // 일부 항목만 저장돼 있어도 나머지는 0
    expect(withDefaults({ deductions: { incomeTax: 1000 } as never }).deductions).toEqual({
      ...DEFAULT_SETTINGS.deductions,
      incomeTax: 1000,
    });
  });
});
