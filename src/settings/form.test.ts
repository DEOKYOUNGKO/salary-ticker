import { describe, expect, it } from "vitest";
import {
  formatSalary,
  formatSalaryInput,
  formToSettings,
  parseSalary,
  settingsToForm,
  validateForm,
  type SettingsForm,
} from "./form";
import { DEFAULT_SETTINGS, withDefaults } from "./schema";

const valid: SettingsForm = {
  salaryText: "3,000,000",
  mode: "work",
  workStart: "09:00",
  workEnd: "18:00",
  lunchEnabled: true,
  lunchStart: "12:00",
  lunchEnd: "13:00",
  excludeHolidays: true,
  periodStartDay: 1,
  deductionTexts: {
    nationalPension: "",
    healthInsurance: "",
    longTermCare: "",
    employmentInsurance: "",
    incomeTax: "",
    localIncomeTax: "",
  },
  payBasis: "gross",
  opacity: 1,
  placement: "top",
  clickThrough: false,
  notifyWorkEnd: true,
  autoStart: true,
};

describe("월급 입력", () => {
  it("콤마를 붙이고 숫자 외 문자를 버린다", () => {
    expect(formatSalary("3000000")).toBe("3,000,000");
    expect(formatSalary("3,0a00,000원")).toBe("3,000,000");
    expect(formatSalary("000123")).toBe("123");
    expect(formatSalary("")).toBe("");
    expect(parseSalary("3,000,000")).toBe(3_000_000);
    expect(parseSalary("")).toBeNull();
  });

  it("콤마가 생겨도 커서가 같은 숫자 뒤에 머문다", () => {
    // "300000|" 에 0 입력 → "3,000,000|"
    expect(formatSalaryInput("3000000", 7)).toEqual({ text: "3,000,000", caret: 9 });
    // "3|00,000" 앞쪽에 5 입력: "35|00,000" → "3,500,000" 커서는 5 뒤
    expect(formatSalaryInput("3500,000", 2)).toEqual({ text: "3,500,000", caret: 3 });
    // "1,000" 에서 콤마 뒤 0 삭제: "1,|00" → "100" 커서는 1 뒤
    expect(formatSalaryInput("1,00", 2)).toEqual({ text: "100", caret: 1 });
  });
});

describe("validateForm", () => {
  it("올바른 입력은 에러 없음", () => {
    expect(validateForm(valid)).toEqual({});
  });

  it("월급 필수, 0 초과", () => {
    expect(validateForm({ ...valid, salaryText: "" }).salary).toBe("월급을 입력해 주세요.");
    expect(validateForm({ ...valid, salaryText: "0" }).salary).toBeDefined();
  });

  it("퇴근 시간이 출근 시간보다 이르거나 같으면 에러", () => {
    expect(validateForm({ ...valid, workStart: "18:00", workEnd: "09:00" }).workTime).toBe(
      "퇴근 시간은 출근 시간보다 늦어야 합니다.",
    );
    expect(validateForm({ ...valid, workEnd: "09:00" }).workTime).toBeDefined();
    expect(validateForm({ ...valid, workEnd: "" }).workTime).toBeDefined();
  });

  it("점심은 끝 > 시작, 근무시간 안", () => {
    expect(validateForm({ ...valid, lunchEnd: "11:00" }).lunch).toBeDefined();
    expect(validateForm({ ...valid, lunchStart: "08:00", lunchEnd: "09:30" }).lunch).toBeDefined();
    // 점심 제외를 끄면 검사 안 함
    expect(validateForm({ ...valid, lunchEnabled: false, lunchEnd: "11:00" })).toEqual({});
  });
});

describe("공제", () => {
  const withDeductions = (texts: Partial<SettingsForm["deductionTexts"]>): SettingsForm => ({
    ...valid,
    deductionTexts: { ...valid.deductionTexts, ...texts },
  });

  it("빈칸은 0으로 저장한다", () => {
    const s = formToSettings(withDeductions({ incomeTax: "123,550" }), DEFAULT_SETTINGS);
    expect(s.deductions).toEqual({ ...DEFAULT_SETTINGS.deductions, incomeTax: 123_550 });
  });

  it("공제 합계가 월급 이상이면 에러", () => {
    expect(validateForm(withDeductions({ incomeTax: "2,999,999" })).deductions).toBeUndefined();
    expect(validateForm(withDeductions({ incomeTax: "3,000,000" })).deductions).toBe(
      "공제 합계는 월급보다 작아야 합니다.",
    );
    expect(
      validateForm(withDeductions({ incomeTax: "2,000,000", nationalPension: "1,500,000" })).deductions,
    ).toBeDefined();
  });

  it("공제가 없으면 세후를 골라도 세전으로 저장", () => {
    expect(formToSettings({ ...valid, payBasis: "net" }, DEFAULT_SETTINGS).payBasis).toBe("gross");
    const s = formToSettings({ ...withDeductions({ incomeTax: "1,000" }), payBasis: "net" }, DEFAULT_SETTINGS);
    expect(s.payBasis).toBe("net");
    expect(settingsToForm(s).deductionTexts.incomeTax).toBe("1,000");
  });
});

describe("기본값", () => {
  it("월급 2,156,880원, 08:30~17:30, 점심 12:30~13:30이 첫 실행 폼에 채워진다", () => {
    const form = settingsToForm(DEFAULT_SETTINGS);
    expect(form.salaryText).toBe("2,156,880");
    expect(form.workStart).toBe("08:30");
    expect(form.workEnd).toBe("17:30");
    expect(form.lunchEnabled).toBe(true);
    expect([form.lunchStart, form.lunchEnd]).toEqual(["12:30", "13:30"]);
    expect(validateForm(form)).toEqual({});
  });
});

describe("폼 ↔ 설정 변환", () => {
  it("왕복 변환 시 값 유지", () => {
    const settings = formToSettings(valid, DEFAULT_SETTINGS);
    expect(settings.monthlySalary).toBe(3_000_000);
    expect(settings.lunch).toEqual({ start: "12:00", end: "13:00" });
    expect(settingsToForm(settings)).toEqual(valid);
  });

  it("급여 기간 시작일을 그대로 저장", () => {
    expect(formToSettings({ ...valid, periodStartDay: 25 }, DEFAULT_SETTINGS).periodStartDay).toBe(25);
  });

  it("위젯 불투명도는 widget.opacity에 저장", () => {
    const s = formToSettings({ ...valid, opacity: 0.6 }, DEFAULT_SETTINGS);
    expect(s.widget).toEqual({ ...DEFAULT_SETTINGS.widget, opacity: 0.6 });
  });

  it("점심 제외를 끄면 lunch=null", () => {
    expect(formToSettings({ ...valid, lunchEnabled: false }, DEFAULT_SETTINGS).lunch).toBeNull();
  });

  it("저장값에 없는 필드는 기본값으로 채운다", () => {
    const s = withDefaults({ monthlySalary: 1, widget: { opacity: 0.5 } as never });
    expect(s.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(s.notifyWorkEnd).toBe(true);
    expect(s.widget).toEqual({ ...DEFAULT_SETTINGS.widget, opacity: 0.5 });
  });
});
