import type { EngineSettings } from "../engine";
import { DEDUCTION_KEYS, type Deductions, type PayBasis, type Settings } from "./schema";

/** 공제 항목 합계 (원) */
export const deductionTotal = (deductions: Deductions): number =>
  DEDUCTION_KEYS.reduce((sum, key) => sum + (deductions[key] || 0), 0);

/** 실제로 적용되는 표시 기준. 공제 합계가 0이면 선택과 관계없이 세전. */
export function effectivePayBasis(settings: Pick<Settings, "deductions" | "payBasis">): PayBasis {
  return settings.payBasis === "net" && deductionTotal(settings.deductions) > 0 ? "net" : "gross";
}

export const PAY_BASIS_LABEL: Record<PayBasis, string> = { gross: "세전", net: "세후" };

/**
 * 엔진에 넘길 설정. 세후 기준이면 월급을 (월급 - 공제 합계)로 바꾼다.
 * 엔진은 그대로 두고 입력 월급 값만 바꿔서 초당·오늘·기간 누적·시급이 모두 세후가 된다.
 */
export function toEngineSettings(settings: Settings): EngineSettings {
  if (effectivePayBasis(settings) === "gross") return settings;
  return {
    ...settings,
    monthlySalary: Math.max(0, settings.monthlySalary - deductionTotal(settings.deductions)),
  };
}
