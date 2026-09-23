import { useEffect, useState } from "react";

/**
 * intervalMs마다 getNow()로 현재 시각을 갱신한다.
 * paused이거나 문서가 숨겨져 있으면 멈추고, 다시 보이면 즉시 새로 읽는다.
 */
export function useNow(intervalMs: number, getNow: () => Date, paused = false): Date {
  const [now, setNow] = useState(getNow);

  useEffect(() => {
    if (paused) return;
    let id: number | undefined;
    const start = () => {
      if (id !== undefined) return;
      setNow(getNow());
      id = window.setInterval(() => setNow(getNow()), intervalMs);
    };
    const stop = () => {
      window.clearInterval(id);
      id = undefined;
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, getNow, paused]);

  return now;
}
