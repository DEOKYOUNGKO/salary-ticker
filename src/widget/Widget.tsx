import { useCallback, useMemo, useState } from "react";
import { calculate, type EngineSettings } from "../engine";
import {
  formatDuration,
  formatWon0,
  formatWon2,
  nextStatusLabel,
  STATUS_LABEL,
} from "../format";
import { useNow } from "./useNow";
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

interface Props {
  settings: EngineSettings;
}

export default function Widget({ settings }: Props) {
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
