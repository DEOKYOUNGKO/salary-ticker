import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { countWorkDays, getPayPeriod, perSecondRate } from "../engine";
import { formatWon0, formatWon2 } from "../format";
import {
  formatSalaryInput,
  formToSettings,
  settingsToForm,
  validateForm,
  type FormField,
  type SettingsForm,
} from "./form";
import { DEFAULT_SETTINGS, isConfigured, type Settings } from "./schema";
import { loadSettings, saveSettings } from "./store";
import { useTheme } from "./useTheme";
import "./SettingsPage.css";

export default function SettingsPage() {
  const [base, setBase] = useState<Settings | null>(null);
  const [form, setForm] = useState<SettingsForm>(() => settingsToForm(DEFAULT_SETTINGS));
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const salaryRef = useRef<HTMLInputElement>(null);

  // 창이 열릴 때마다 저장값으로 폼을 초기화 (저장 안 하고 닫은 입력은 버림)
  useEffect(() => {
    const reset = async () => {
      const saved = await loadSettings();
      setBase(saved);
      setForm(settingsToForm(saved ?? DEFAULT_SETTINGS));
      setTouched({});
      setSubmitted(false);
      setSaveError(null);
      salaryRef.current?.focus();
    };
    reset();
    const unlisten = listen("settings-opened", reset);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useTheme(base?.theme ?? "system");

  const firstRun = !isConfigured(base);
  const errors = useMemo(() => validateForm(form), [form]);
  const showError = (field: FormField) => (submitted || touched[field]) && errors[field];

  const preview = useMemo(() => {
    if (errors.salary || errors.workTime || errors.lunch) return null;
    const draft = formToSettings(form, base ?? DEFAULT_SETTINGS);
    const now = new Date();
    const perSecond = perSecondRate(now, draft);
    const period = getPayPeriod(now, draft.periodStartDay);
    const basis =
      draft.mode === "work"
        ? `이번 달 근무일 ${countWorkDays(period, draft)}일 기준`
        : `이번 달 ${Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000)}일 기준`;
    return { perSecond, hourly: perSecond * 3600, basis };
  }, [form, base, errors]);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K], field?: FormField) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (field) setTouched((t) => ({ ...t, [field]: true }));
  };

  const onSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const { text, caret } = formatSalaryInput(input.value, input.selectionStart ?? input.value.length);
    update("salaryText", text, "salary");
    requestAnimationFrame(() => input.setSelectionRange(caret, caret));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      if (errors.salary) salaryRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next = formToSettings(form, base ?? DEFAULT_SETTINGS);
      await saveSettings(next);
      setBase(next);
      await invoke("finish_settings");
    } catch (err) {
      setSaveError(`저장하지 못했습니다: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings" onSubmit={onSubmit} noValidate>
      <header>
        <h1>{firstRun ? "월급 티커 시작하기" : "설정"}</h1>
        {firstRun && <p className="intro">월급을 입력하면 지금까지 번 돈을 초 단위로 보여 드려요.</p>}
      </header>

      <div className="field">
        <label htmlFor="salary">
          월급 <span className="required">필수</span>
        </label>
        <div className={`input-with-unit${showError("salary") ? " invalid" : ""}`}>
          <input
            id="salary"
            ref={salaryRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="3,000,000"
            value={form.salaryText}
            onChange={onSalaryChange}
            onBlur={() => setTouched((t) => ({ ...t, salary: true }))}
            aria-invalid={!!showError("salary")}
            aria-describedby="salary-error"
          />
          <span className="unit">원</span>
        </div>
        <p id="salary-error" className="error" role="alert">
          {showError("salary") || ""}
        </p>
      </div>

      <fieldset className="field">
        <legend>계산 방식</legend>
        <div className="segmented">
          <label className={form.mode === "work" ? "selected" : ""}>
            <input
              type="radio"
              name="mode"
              checked={form.mode === "work"}
              onChange={() => update("mode", "work")}
            />
            <strong>근무시간만</strong>
            <span>근무시간에만 올라가요</span>
          </label>
          <label className={form.mode === "24h" ? "selected" : ""}>
            <input
              type="radio"
              name="mode"
              checked={form.mode === "24h"}
              onChange={() => update("mode", "24h")}
            />
            <strong>24시간</strong>
            <span>자는 동안에도 올라가요</span>
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="workStart">출퇴근 시간</label>
        <div className={`time-range${showError("workTime") ? " invalid" : ""}`}>
          <input
            id="workStart"
            type="time"
            value={form.workStart}
            onChange={(e) => update("workStart", e.target.value, "workTime")}
            aria-label="출근 시간"
          />
          <span>~</span>
          <input
            type="time"
            value={form.workEnd}
            onChange={(e) => update("workEnd", e.target.value, "workTime")}
            aria-label="퇴근 시간"
          />
        </div>
        <p className="error" role="alert">
          {showError("workTime") || ""}
        </p>
      </div>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={form.lunchEnabled}
            onChange={(e) => update("lunchEnabled", e.target.checked, "lunch")}
          />
          점심시간 제외
        </label>
        <div className={`time-range${showError("lunch") ? " invalid" : ""}`}>
          <input
            type="time"
            value={form.lunchStart}
            disabled={!form.lunchEnabled}
            onChange={(e) => update("lunchStart", e.target.value, "lunch")}
            aria-label="점심 시작"
          />
          <span>~</span>
          <input
            type="time"
            value={form.lunchEnd}
            disabled={!form.lunchEnabled}
            onChange={(e) => update("lunchEnd", e.target.value, "lunch")}
            aria-label="점심 끝"
          />
        </div>
        <p className="error" role="alert">
          {showError("lunch") || ""}
        </p>
      </div>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={form.autoStart}
            onChange={(e) => update("autoStart", e.target.checked)}
          />
          Windows 시작 시 자동 실행
        </label>
      </div>

      <div className="preview" aria-live="polite">
        {preview ? (
          <>
            <div className="preview-values">
              <span>
                초당 <strong>{formatWon2(preview.perSecond)}원</strong>
              </span>
              <span>
                시급 <strong>{formatWon0(preview.hourly)}원</strong>
              </span>
            </div>
            <div className="preview-basis">{preview.basis}</div>
          </>
        ) : (
          <div className="preview-empty">월급과 시간을 입력하면 초당 금액을 미리 보여 드려요.</div>
        )}
      </div>

      {saveError && <p className="error save-error">{saveError}</p>}

      <div className="actions">
        {!firstRun && (
          <button type="button" className="secondary" onClick={() => invoke("hide_settings")}>
            취소
          </button>
        )}
        <button type="submit" className="primary" disabled={saving}>
          {firstRun ? "시작하기" : "저장"}
        </button>
      </div>
    </form>
  );
}
