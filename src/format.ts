import type { Earnings, Status } from "./engine";

const won2 = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const won0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** 1,234.56 */
export const formatWon2 = (value: number) => won2.format(value);
/** 1,235 */
export const formatWon0 = (value: number) => won0.format(value);

export const STATUS_LABEL: Record<Status, string> = {
  before: "출근 전",
  working: "근무 중",
  lunch: "점심시간",
  off: "퇴근",
  holiday: "휴일",
};

/** "퇴근까지", "점심까지" 같은 남은 시간 앞 문구 */
export function nextStatusLabel(e: Pick<Earnings, "status" | "nextStatus">): string {
  switch (e.status) {
    case "before":
      return "출근까지";
    case "working":
      return e.nextStatus === "lunch" ? "점심까지" : "퇴근까지";
    case "lunch":
      return "점심 끝까지";
    case "off":
    case "holiday":
      return "다음 출근까지";
  }
}

/** 초 → "HH:MM:SS", 하루 이상이면 "N일 HH:MM:SS" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const days = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return days > 0 ? `${days}일 ${hms}` : hms;
}
