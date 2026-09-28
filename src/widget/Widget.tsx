import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { calculate, holidayName } from "../engine";
import {
  formatDuration,
  formatWon0,
  formatWon2,
  nextStatusLabel,
  STATUS_LABEL,
} from "../format";
import { effectivePayBasis, PAY_BASIS_LABEL, toEngineSettings } from "../settings/pay";
import type { Settings } from "../settings/schema";
import { useTheme } from "../settings/useTheme";
import { useNow } from "./useNow";
import { useSettings } from "./useSettings";
import { useTrayTooltip } from "./useTrayTooltip";
import { useWorkEndNotification } from "./useWorkEndNotification";
import { useWidgetVisible } from "./useWidgetVisible";
import { amountFontSize, layoutTier, showTodayLabel } from "./layout";
import { useWindowSize } from "./useWindowSize";
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
  const visible = useWidgetVisible();
  // 창이 숨겨져 있으면 화면 갱신 중지 (트레이 툴팁은 1초마다 따로 갱신)
  const now = useNow(TICK_MS, getNow, !visible);
  // 세후 기준이면 월급만 (월급 - 공제 합계)로 바꿔서 엔진에 넘긴다
  const engineSettings = useMemo(() => toEngineSettings(settings), [settings]);
  const payLabel = PAY_BASIS_LABEL[effectivePayBasis(settings)];
  useTrayTooltip(engineSettings, getNow, payLabel);
  useWorkEndNotification(engineSettings, settings.notifyWorkEnd, getNow);
  const e = useMemo(() => calculate(now, engineSettings), [now, engineSettings]);

  const progress = Math.round(e.todayProgress * 1000) / 10;
  const statusLabel =
    (e.status === "holiday" && settings.excludeHolidays && holidayName(now)) ||
    STATUS_LABEL[e.status];

  const { width, height } = useWindowSize();
  const tier = layoutTier(width, height);
  const amountText = formatWon2(e.todayEarned);
  const amountStyle = { fontSize: amountFontSize(amountText, width, height) };
  const nextText =
    e.secondsToNextStatus === null
      ? "근무일 없음"
      : `${nextStatusLabel(e)} ${formatDuration(e.secondsToNextStatus)}`;

  if (tier === "small") {
    // 가장 작은 크기: 금액만. 버튼 없이 카드 전체가 드래그 영역, 설정은 트레이 메뉴로
    return (
      <main
        className={`card small status-${e.status}`}
        style={{ opacity: settings.widget.opacity }}
        data-tauri-drag-region="deep"
        title={`오늘 번 돈(${payLabel}) · ${statusLabel} · ${nextText}`}
      >
        <div className="amount" style={amountStyle}>
          {amountText}
          <span className="unit">원</span>
        </div>
        <ResizeGrip />
      </main>
    );
  }

  return (
    <main
      className={`card ${tier} status-${e.status}`}
      style={{ opacity: settings.widget.opacity }}
    >
      {/* 상단 줄을 잡고 끌어서 이동. 드래그 속성은 클릭된 요소 자신에 있어야 해서 글자에도 붙임 */}
      <header className="card-header" data-tauri-drag-region>
        <span className="status-pill" data-tauri-drag-region>
          <span className="status-dot" aria-hidden data-tauri-drag-region />
          {statusLabel}
          <span className="pay-basis" title={`${payLabel} 기준`} data-tauri-drag-region>
            {payLabel}
          </span>
        </span>
        <span className="header-right" data-tauri-drag-region>
          <span className="clock" data-tauri-drag-region>{clockFormat.format(now)}</span>
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
          <button
            type="button"
            className="icon-button"
            onClick={() => invoke("hide_widget")}
            title="숨기기 (트레이 아이콘으로 다시 열기)"
            aria-label="위젯 숨기기"
          >
            <CloseIcon />
          </button>
        </span>
      </header>

      <section className="today">
        {showTodayLabel(tier, height) && <div className="label">오늘 번 돈</div>}
        <div className="amount" style={amountStyle}>
          {amountText}
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
        <span>{nextText}</span>
        <span>{progress.toFixed(1)}%</span>
      </div>

      {tier === "full" && (
        <dl className="stats">
          <div>
            <dt>{settings.periodStartDay === 1 ? "이번 달 누적" : "이번 기간 누적"}</dt>
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
      )}

      <ResizeGrip />

      {import.meta.env.DEV && devOpen && (
        <DevClock
          settings={settings}
          now={now}
          isFake={offsetMs !== 0}
          onSet={(target) => setOffsetMs(target ? target.getTime() - Date.now() : 0)}
          onClose={() => setDevOpen(false)}
        />
      )}
    </main>
  );
}

/** 오른쪽 아래 모서리: 끌어서 위젯 크기 조절 (창 테두리가 없어서 직접 시작) */
function ResizeGrip() {
  return (
    <div
      className="resize-grip"
      data-tauri-drag-region="false"
      title="끌어서 크기 조절"
      aria-hidden
      onMouseDown={(ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        getCurrentWindow().startResizeDragging("SouthEast");
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
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

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
