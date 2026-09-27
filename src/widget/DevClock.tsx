import { useState } from "react";
import { parseTime, type EngineSettings } from "../engine";

/** 오늘이 평일이면 오늘, 주말이면 직전 금요일 00:00 */
function baseWeekday(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

/** day 00:00에서 seconds초 뒤 */
function at(day: Date, seconds: number, addDays = 0): Date {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + addDays);
  return new Date(d.getTime() + seconds * 1000);
}

/** 프리셋: 이번 평일, 설정된 출퇴근·점심 시각 기준. "직전"은 10초 뒤 상태가 바뀌는 시각. */
function presets(settings: EngineSettings): { label: string; time: Date }[] {
  const day = baseWeekday(new Date());
  const toSaturday = 6 - day.getDay();
  const start = parseTime(settings.workStart);
  const end = parseTime(settings.workEnd);
  const lunchStart = settings.lunch ? parseTime(settings.lunch.start) : null;
  const lunchEnd = settings.lunch ? parseTime(settings.lunch.end) : null;
  const list = [
    { label: "출근 직전", time: at(day, start - 10) },
    { label: "근무 중", time: at(day, start + 3600) },
    ...(lunchStart !== null && lunchEnd !== null
      ? [
          { label: "점심 직전", time: at(day, lunchStart - 10) },
          { label: "점심", time: at(day, (lunchStart + lunchEnd) / 2) },
        ]
      : []),
    { label: "퇴근 직전", time: at(day, end - 10) },
    { label: "퇴근 후", time: at(day, end + 3600) },
    { label: "주말", time: at(day, 11 * 3600, toSaturday) },
    { label: "출근 전", time: at(day, start - 3600) },
  ];
  return list;
}

/** Date → datetime-local 입력 값 "YYYY-MM-DDTHH:MM:SS" */
function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface Props {
  settings: EngineSettings;
  now: Date;
  isFake: boolean;
  onSet: (target: Date | null) => void;
  onClose: () => void;
}

/** 개발 모드 전용 가짜 현재 시각 패널. 설정한 시각부터 시계가 계속 흐른다. */
export default function DevClock({ settings, now, isFake, onSet, onClose }: Props) {
  const [custom, setCustom] = useState(() => toInputValue(now));

  const apply = (target: Date | null) => {
    onSet(target);
    onClose();
  };

  return (
    <div className="dev-panel" role="dialog" aria-label="가짜 현재 시각">
      <div className="dev-title">
        <span>가짜 현재 시각 (DEV)</span>
        <button type="button" className="dev-close" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      <div className="dev-presets">
        {presets(settings).map((p) => (
          <button key={p.label} type="button" onClick={() => apply(p.time)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="dev-custom">
        <input
          type="datetime-local"
          step={1}
          value={custom}
          onChange={(ev) => setCustom(ev.target.value)}
        />
        <button
          type="button"
          disabled={!custom}
          onClick={() => apply(new Date(custom))}
        >
          적용
        </button>
      </div>
      <button
        type="button"
        className="dev-reset"
        disabled={!isFake}
        onClick={() => apply(null)}
      >
        실제 시각으로
      </button>
    </div>
  );
}
