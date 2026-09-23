import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { countWorkDays, getPayPeriod, HOLIDAY_YEARS, KR_HOLIDAYS, perSecondRate } from "../engine";
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
import { loadSettings, onSettingsChanged, saveSettings } from "./store";
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
    // 트레이 메뉴에서 클릭 통과를 바꾸면 열려 있는 폼에도 반영 (저장 시 되돌리지 않게)
    const unlistenChanged = onSettingsChanged((s) => {
      setBase(s);
      setForm((f) => ({ ...f, clickThrough: s.widget.clickThrough }));
    });
    return () => {
      unlisten.then((fn) => fn());
      unlistenChanged.then((fn) => fn());
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
    const last = new Date(period.end.getTime() - 1);
    const range = `${period.start.getMonth() + 1}/${period.start.getDate()}~${last.getMonth() + 1}/${last.getDate()}`;
    const basis =
      draft.mode === "work"
        ? `급여 기간 ${range} · 근무일 ${countWorkDays(period, draft, KR_HOLIDAYS)}일 기준`
        : `급여 기간 ${range} · ${Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000)}일 기준`;
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
            checked={form.excludeHolidays}
            onChange={(e) => update("excludeHolidays", e.target.checked)}
          />
          공휴일은 쉬는 날로 계산
        </label>
        <p className="hint">
          대체공휴일·선거일 포함, {HOLIDAY_YEARS.from}~{HOLIDAY_YEARS.to}년 공휴일 내장
        </p>
      </div>

      <div className="field">
        <label htmlFor="periodStartDay">급여 기간</label>
        <div className="inline-select">
          매월
          <select
            id="periodStartDay"
            value={form.periodStartDay}
            onChange={(e) => update("periodStartDay", Number(e.target.value))}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}일
              </option>
            ))}
          </select>
          부터
          <span className="hint-inline">
            {form.periodStartDay === 1
              ? "1일~말일"
              : `${form.periodStartDay}일~다음 달 ${form.periodStartDay - 1}일`}
          </span>
        </div>
        <p className="hint flush">그 달에 없는 날짜(예: 31일)는 말일부터 시작해요.</p>
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

      <h2 className="section">위젯</h2>

      <div className="field">
        <label htmlFor="opacity">
          불투명도 <span className="value">{Math.round(form.opacity * 100)}%</span>
        </label>
        <input
          id="opacity"
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={form.opacity}
          onChange={(e) => update("opacity", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={form.compact}
            onChange={(e) => update("compact", e.target.checked)}
          />
          미니 모드
        </label>
        <p className="hint">오늘 번 돈과 진행 바만 작게 보여 줘요. 설정은 트레이 메뉴에서 열어요.</p>
      </div>

      <fieldset className="field">
        <legend>창 배치</legend>
        <div className="segmented">
          <label className={form.placement === "top" ? "selected" : ""}>
            <input
              type="radio"
              name="placement"
              checked={form.placement === "top"}
              onChange={() => update("placement", "top")}
            />
            <strong>항상 위</strong>
            <span>다른 창 위에 떠 있어요</span>
          </label>
          <label className={form.placement === "bottom" ? "selected" : ""}>
            <input
              type="radio"
              name="placement"
              checked={form.placement === "bottom"}
              onChange={() => update("placement", "bottom")}
            />
            <strong>바탕화면 고정</strong>
            <span>다른 창 아래에 깔려요</span>
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={form.clickThrough}
            onChange={(e) => update("clickThrough", e.target.checked)}
          />
          클릭 통과
        </label>
        <p className="hint">
          위젯을 눌러도 뒤의 창이 클릭돼요. 켜면 위젯을 클릭·이동할 수 없으니 트레이 아이콘 메뉴의
          "클릭 통과"로 꺼 주세요.
        </p>
      </div>

      <h2 className="section">기타</h2>

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={form.notifyWorkEnd}
            onChange={(e) => update("notifyWorkEnd", e.target.checked)}
          />
          퇴근 시각 알림
        </label>
        <p className="hint">퇴근 시간이 되면 오늘 번 돈과 함께 알려 드려요.</p>
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
