import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "./engine";

// TODO(3단계): 로컬 저장값으로 교체
export const HARDCODED_SETTINGS: EngineSettings = {
  ...DEFAULT_ENGINE_SETTINGS,
  monthlySalary: 3_000_000,
  mode: "work",
  workStart: "09:00",
  workEnd: "18:00",
  lunch: { start: "12:00", end: "13:00" },
};
