export type Mode = "work" | "24h";

export interface TimeRange {
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
}

/** 계산 엔진이 필요로 하는 설정 값 (전체 설정 스키마의 부분집합). */
export interface EngineSettings {
  monthlySalary: number;
  mode: Mode;
  /** "HH:MM" */
  workStart: string;
  /** "HH:MM" */
  workEnd: string;
  lunch: TimeRange | null;
  /** 0=일, 1=월, ... 6=토 */
  workDays: number[];
  /** 급여 기간 시작일 (1~31). 해당 월에 없는 날짜면 그 달 마지막 날로 맞춤. */
  periodStartDay: number;
  excludeHolidays: boolean;
}

export type Status = "before" | "working" | "lunch" | "off" | "holiday";

export interface PayPeriod {
  /** 기간 시작 (포함, 00:00) */
  start: Date;
  /** 기간 종료 (미포함, 다음 기간 시작 00:00) */
  end: Date;
}

/** "YYYY-MM-DD" 형식의 공휴일 목록 */
export type HolidaySet = ReadonlySet<string>;

export interface Earnings {
  /** 오늘 번 돈 */
  todayEarned: number;
  /** 급여 기간 누적 */
  periodEarned: number;
  /** 초당 금액 */
  perSecond: number;
  /** 시급 환산 (초당 금액 × 3600) */
  hourly: number;
  /** 오늘 진행률 0~1 */
  todayProgress: number;
  status: Status;
  /** 다음 상태 (출근 전/점심/퇴근/휴일 다음은 근무 중) */
  nextStatus: Status | null;
  /** 다음 상태까지 남은 초. 근무일이 하나도 없으면 null */
  secondsToNextStatus: number | null;
  period: PayPeriod;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  monthlySalary: 0,
  mode: "work",
  workStart: "09:00",
  workEnd: "18:00",
  lunch: { start: "12:00", end: "13:00" },
  workDays: [1, 2, 3, 4, 5],
  periodStartDay: 1,
  excludeHolidays: false,
};
