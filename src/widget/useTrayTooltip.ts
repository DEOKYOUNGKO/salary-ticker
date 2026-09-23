import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { calculate, type EngineSettings } from "../engine";
import { formatWon0 } from "../format";

const TOOLTIP_MS = 1000;

/** 트레이 툴팁에 오늘 번 돈. 위젯이 숨겨져 있어도 계속 갱신한다. */
export function useTrayTooltip(settings: EngineSettings, getNow: () => Date) {
  useEffect(() => {
    let last = "";
    const update = () => {
      const text = `월급 티커\n오늘 번 돈 ${formatWon0(calculate(getNow(), settings).todayEarned)}원`;
      if (text === last) return;
      last = text;
      invoke("set_tray_tooltip", { text }).catch(() => {});
    };
    update();
    const id = window.setInterval(update, TOOLTIP_MS);
    return () => window.clearInterval(id);
  }, [settings, getNow]);
}
