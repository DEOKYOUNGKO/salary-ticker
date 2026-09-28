import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "../engine";

export type Theme = "system" | "light" | "dark";

export interface WidgetOptions {
  /** 0~1 */
  opacity: number;
  /** 항상 위 / 바탕화면 고정 */
  placement: "top" | "bottom";
  clickThrough: boolean;
}

/** 매달 월급에서 빠지는 공제액 (원). 세율로 계산하지 않고 직접 입력한 값. */
export interface Deductions {
  /** 국민연금 */
  nationalPension: number;
  /** 건강보험 */
  healthInsurance: number;
  /** 장기요양보험 */
  longTermCare: number;
  /** 고용보험 */
  employmentInsurance: number;
  /** 소득세 */
  incomeTax: number;
  /** 지방소득세 */
  localIncomeTax: number;
}

export const DEDUCTION_KEYS = [
  "nationalPension",
  "healthInsurance",
  "longTermCare",
  "employmentInsurance",
  "incomeTax",
  "localIncomeTax",
] as const satisfies readonly (keyof Deductions)[];

/** 표시 기준: 세전(월급 그대로) / 세후(월급 - 공제 합계) */
export type PayBasis = "gross" | "net";

export interface Settings extends EngineSettings {
  deductions: Deductions;
  payBasis: PayBasis;
  autoStart: boolean;
  /** 퇴근 시각 알림 */
  notifyWorkEnd: boolean;
  theme: Theme;
  widget: WidgetOptions;
}

/** 첫 실행 폼에 미리 채워지는 기본값 */
export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_ENGINE_SETTINGS,
  monthlySalary: 2_156_880,
  workStart: "08:30",
  workEnd: "17:30",
  lunch: { start: "12:30", end: "13:30" },
  excludeHolidays: true,
  deductions: {
    nationalPension: 0,
    healthInsurance: 0,
    longTermCare: 0,
    employmentInsurance: 0,
    incomeTax: 0,
    localIncomeTax: 0,
  },
  payBasis: "gross",
  autoStart: true,
  notifyWorkEnd: true,
  theme: "system",
  widget: {
    opacity: 1,
    placement: "top",
    clickThrough: false,
  },
};

/** 저장값에 빠진 필드를 기본값으로 채운다 (스키마가 늘어나도 기존 저장값 유지). */
export function withDefaults(saved: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    deductions: { ...DEFAULT_SETTINGS.deductions, ...saved?.deductions },
    widget: { ...DEFAULT_SETTINGS.widget, ...saved?.widget },
  };
}

export const isConfigured = (settings: Settings | null): settings is Settings =>
  !!settings && settings.monthlySalary > 0;
