import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { calculate, type Status } from "../engine";
import { formatWon0 } from "../format";
import type { Settings } from "../settings/schema";

const CHECK_MS = 1000;

/**
 * 근무 중 → 퇴근으로 바뀌는 순간 알림. 위젯이 숨겨져 있어도 확인한다.
 * 앱을 퇴근 후에 켠 경우처럼 전환을 보지 못했으면 알리지 않는다.
 */
export function useWorkEndNotification(settings: Settings, getNow: () => Date) {
  useEffect(() => {
    if (!settings.notifyWorkEnd) return;
    let prev: Status | null = null;
    const check = () => {
      const e = calculate(getNow(), settings);
      if (prev === "working" && e.status === "off") {
        invoke("show_notification", {
          title: "퇴근 시간이에요",
          body: `오늘 ${formatWon0(e.todayEarned)}원 벌었어요. 수고하셨어요!`,
        }).catch(() => {});
      }
      prev = e.status;
    };
    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, [settings, getNow]);
}
