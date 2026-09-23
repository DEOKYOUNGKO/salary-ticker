import { useEffect, useState } from "react";
import { isConfigured, type Settings } from "../settings/schema";
import { loadSettings, onSettingsChanged } from "../settings/store";

/** 저장된 설정. 설정 창에서 저장하면 바로 갱신. 아직 없으면 null. */
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((s) => {
      if (!cancelled && isConfigured(s)) setSettings(s);
    });
    const unlisten = onSettingsChanged((s) => {
      cancelled = true; // 늦게 도착한 초기 로드가 새 값을 덮지 않게
      setSettings(s);
    });
    return () => {
      cancelled = true;
      unlisten.then((fn) => fn());
    };
  }, []);

  return settings;
}
