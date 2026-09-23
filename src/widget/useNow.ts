import { useEffect, useState } from "react";

/**
 * intervalMs마다 getNow()로 현재 시각을 갱신한다. 창(문서)이 숨겨져 있으면 멈춘다.
 * getNow가 바뀌면 즉시 다시 읽는다.
 */
export function useNow(intervalMs: number, getNow: () => Date): Date {
  const [now, setNow] = useState(getNow);

  useEffect(() => {
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
  }, [intervalMs, getNow]);

  return now;
}
