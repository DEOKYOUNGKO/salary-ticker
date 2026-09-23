import { parseTime, type Mode } from "../engine";
import type { Settings } from "./schema";

/** 설정 창 입력 상태 (문자열 그대로) */
export interface SettingsForm {
  salaryText: string;
  mode: Mode;
  workStart: string;
  workEnd: string;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  excludeHolidays: boolean;
  /** 1~31 */
  periodStartDay: number;
  /** 위젯 불투명도 0.2~1 */
  opacity: number;
  compact: boolean;
  placement: "top" | "bottom";
  autoStart: boolean;
}

export type FormField = "salary" | "workTime" | "lunch";
export type FormErrors = Partial<Record<FormField, string>>;

const MAX_SALARY = 10_000_000_000; // 100억

export function settingsToForm(s: Settings): SettingsForm {
  return {
    salaryText: s.monthlySalary > 0 ? formatSalary(String(s.monthlySalary)) : "",
    mode: s.mode,
    workStart: s.workStart,
    workEnd: s.workEnd,
    lunchEnabled: s.lunch !== null,
    lunchStart: s.lunch?.start ?? "12:00",
    lunchEnd: s.lunch?.end ?? "13:00",
    excludeHolidays: s.excludeHolidays,
    periodStartDay: s.periodStartDay,
    opacity: s.widget.opacity,
    compact: s.widget.compact,
    placement: s.widget.placement,
    autoStart: s.autoStart,
  };
}

/** 폼 값을 기존 설정에 덮어쓴다. validateForm 통과 후에 호출. */
export function formToSettings(form: SettingsForm, base: Settings): Settings {
  return {
    ...base,
    monthlySalary: parseSalary(form.salaryText) ?? 0,
    mode: form.mode,
    workStart: form.workStart,
    workEnd: form.workEnd,
    lunch: form.lunchEnabled ? { start: form.lunchStart, end: form.lunchEnd } : null,
    excludeHolidays: form.excludeHolidays,
    periodStartDay: form.periodStartDay,
    autoStart: form.autoStart,
    widget: {
      ...base.widget,
      opacity: form.opacity,
      compact: form.compact,
      placement: form.placement,
    },
  };
}

/** "3,000,000" → 3000000, 빈 값 → null */
export function parseSalary(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function tryParseTime(value: string): number | null {
  try {
    return parseTime(value);
  } catch {
    return null;
  }
}

export function validateForm(form: SettingsForm): FormErrors {
  const errors: FormErrors = {};

  const salary = parseSalary(form.salaryText);
  if (salary === null) errors.salary = "월급을 입력해 주세요.";
  else if (salary <= 0) errors.salary = "0원보다 큰 금액을 입력해 주세요.";
  else if (salary > MAX_SALARY) errors.salary = "100억 원 이하로 입력해 주세요.";

  const start = tryParseTime(form.workStart);
  const end = tryParseTime(form.workEnd);
  if (start === null || end === null) errors.workTime = "출근·퇴근 시간을 입력해 주세요.";
  else if (end <= start) errors.workTime = "퇴근 시간은 출근 시간보다 늦어야 합니다.";

  if (form.lunchEnabled) {
    const ls = tryParseTime(form.lunchStart);
    const le = tryParseTime(form.lunchEnd);
    if (ls === null || le === null) errors.lunch = "점심 시작·끝 시간을 입력해 주세요.";
    else if (le <= ls) errors.lunch = "점심 끝 시간은 시작 시간보다 늦어야 합니다.";
    else if (!errors.workTime && start !== null && end !== null && (ls < start || le > end)) {
      errors.lunch = "점심시간은 출근~퇴근 시간 안에 있어야 합니다.";
    }
  }

  return errors;
}

const MAX_DIGITS = 11;

/** 숫자만 남기고 세 자리마다 콤마 */
export function formatSalary(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

/**
 * 입력 중 콤마 자동 표시. 커서 앞의 숫자 개수를 유지해서
 * 콤마가 추가/삭제돼도 커서가 튀지 않게 한다.
 */
export function formatSalaryInput(raw: string, caret: number): { text: string; caret: number } {
  const text = formatSalary(raw);
  const leadingZeros = /^0+(?=\d)/.exec(raw.replace(/\D/g, ""))?.[0].length ?? 0;
  const digitsBefore = Math.max(0, raw.slice(0, caret).replace(/\D/g, "").length - leadingZeros);

  let seen = 0;
  let pos = 0;
  while (pos < text.length && seen < digitsBefore) {
    if (/\d/.test(text[pos])) seen++;
    pos++;
  }
  return { text, caret: pos };
}
