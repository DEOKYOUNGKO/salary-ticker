import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** 위젯 창이 보이는지. 트레이/닫기 버튼으로 숨기면 Rust가 "widget-visibility" 이벤트를 보낸다. */
export function useWidgetVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let received = false;
    getCurrentWindow()
      .isVisible()
      .then((v) => {
        if (!received) setVisible(v);
      });
    const unlisten = listen<boolean>("widget-visibility", (event) => {
      received = true;
      setVisible(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return visible;
}
