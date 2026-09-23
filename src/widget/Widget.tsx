import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { calculate } from "../engine";
import {
  formatDuration,
  formatWon0,
  formatWon2,
  nextStatusLabel,
  STATUS_LABEL,
} from "../format";
import type { Settings } from "../settings/schema";
import { useTheme } from "../settings/useTheme";
import { useNow } from "./useNow";
import { useSettings } from "./useSettings";
import DevClock from "./DevClock";
import "./Widget.css";

const TICK_MS = 100;

const clockFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function Widget() {
  const settings = useSettings();
  useTheme(settings?.theme ?? "system");
  // 첫 실행에는 설정 저장 전까지 숨겨져 있으므로 빈 화면
  return settings ? <WidgetCard settings={settings} /> : null;
}

function WidgetCard({ settings }: { settings: Settings }) {
  // 개발 모드 가짜 시각: 실제 시각과의 차이(ms). 프로덕션에서는 항상 0.
  const [offsetMs, setOffsetMs] = useState(0);
  const [devOpen, setDevOpen] = useState(false);
  const getNow = useCallback(() => new Date(Date.now() + offsetMs), [offsetMs]);
  const now = useNow(TICK_MS, getNow);
  const e = useMemo(() => calculate(now, settings), [now, settings]);

  const progress = Math.round(e.todayProgress * 1000) / 10;

  return (
    <main className={`card status-${e.status}`}>
      <header className="card-header">
        <span className="status-pill">
          <span className="status-dot" aria-hidden />
          {STATUS_LABEL[e.status]}
        </span>
        <span className="header-right">
          <span className="clock">{clockFormat.format(now)}</span>
          {import.meta.env.DEV && (
            <button
              type="button"
              className={`dev-chip${offsetMs !== 0 ? " active" : ""}`}
              onClick={() => setDevOpen(true)}
              title="가짜 현재 시각 설정 (개발 모드 전용)"
            >
              {offsetMs !== 0 ? "가짜" : "DEV"}
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => invoke("open_settings")}
            title="설정"
            aria-label="설정"
          >
            <GearIcon />
          </button>
        </span>
      </header>

      <section className="today">
        <div className="label">오늘 번 돈</div>
        <div className="amount">
          {formatWon2(e.todayEarned)}
          <span className="unit">원</span>
        </div>
      </section>

      <div
        className="progress"
        role="progressbar"
        aria-label="오늘 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-meta">
        <span>
          {e.secondsToNextStatus === null
            ? "근무일 없음"
            : `${nextStatusLabel(e)} ${formatDuration(e.secondsToNextStatus)}`}
        </span>
        <span>{progress.toFixed(1)}%</span>
      </div>

      <dl className="stats">
        <div>
          <dt>이번 달 누적</dt>
          <dd>{formatWon0(e.periodEarned)}원</dd>
        </div>
        <div>
          <dt>초당</dt>
          <dd>{formatWon2(e.perSecond)}원</dd>
        </div>
        <div>
          <dt>시급 환산</dt>
          <dd>{formatWon0(e.hourly)}원</dd>
        </div>
      </dl>

      {import.meta.env.DEV && devOpen && (
        <DevClock
          now={now}
          isFake={offsetMs !== 0}
          onSet={(target) => setOffsetMs(target ? target.getTime() - Date.now() : 0)}
          onClose={() => setDevOpen(false)}
        />
      )}
    </main>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
