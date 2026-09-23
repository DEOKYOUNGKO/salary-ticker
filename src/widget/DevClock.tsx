import { useState } from "react";

/** 오늘이 평일이면 오늘, 주말이면 직전 금요일 00:00 */
function baseWeekday(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

function at(day: Date, h: number, m: number, s = 0, addDays = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + addDays, h, m, s);
}

/** 프리셋: 이번 평일 기준. "직전"은 10초 뒤 상태가 바뀌는 시각. */
function presets(): { label: string; time: Date }[] {
  const day = baseWeekday(new Date());
  const toSaturday = 6 - day.getDay();
  return [
    { label: "출근 직전", time: at(day, 8, 59, 50) },
    { label: "근무 중", time: at(day, 10, 0) },
    { label: "점심 직전", time: at(day, 11, 59, 50) },
    { label: "점심", time: at(day, 12, 30) },
    { label: "퇴근 직전", time: at(day, 17, 59, 50) },
    { label: "퇴근 후", time: at(day, 19, 0) },
    { label: "주말", time: at(day, 11, 0, 0, toSaturday) },
    { label: "출근 전", time: at(day, 7, 30) },
  ];
}

/** Date → datetime-local 입력 값 "YYYY-MM-DDTHH:MM:SS" */
function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface Props {
  now: Date;
  isFake: boolean;
  onSet: (target: Date | null) => void;
  onClose: () => void;
}

/** 개발 모드 전용 가짜 현재 시각 패널. 설정한 시각부터 시계가 계속 흐른다. */
export default function DevClock({ now, isFake, onSet, onClose }: Props) {
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
        {presets().map((p) => (
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
