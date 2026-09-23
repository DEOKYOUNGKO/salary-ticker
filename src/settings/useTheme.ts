import { useEffect } from "react";
import type { Theme } from "./schema";

/** <html data-theme>에 반영. system이면 OS 설정을 따른다. */
export function useTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}
