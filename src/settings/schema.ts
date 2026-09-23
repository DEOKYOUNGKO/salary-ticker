import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "../engine";

export type Theme = "system" | "light" | "dark";

export interface WidgetOptions {
  /** 0~1 */
  opacity: number;
  compact: boolean;
  /** 항상 위 / 바탕화면 고정 */
  placement: "top" | "bottom";
  clickThrough: boolean;
}

export interface Settings extends EngineSettings {
  autoStart: boolean;
  /** 퇴근 시각 알림 */
  notifyWorkEnd: boolean;
  theme: Theme;
  widget: WidgetOptions;
}

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_ENGINE_SETTINGS,
  excludeHolidays: true,
  autoStart: true,
  notifyWorkEnd: true,
  theme: "system",
  widget: {
    opacity: 1,
    compact: false,
    placement: "top",
    clickThrough: false,
  },
};

/** 저장값에 빠진 필드를 기본값으로 채운다 (스키마가 늘어나도 기존 저장값 유지). */
export function withDefaults(saved: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    widget: { ...DEFAULT_SETTINGS.widget, ...saved?.widget },
  };
}

export const isConfigured = (settings: Settings | null): settings is Settings =>
  !!settings && settings.monthlySalary > 0;
