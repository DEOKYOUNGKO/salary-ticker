import { getCurrentWindow } from "@tauri-apps/api/window";
import Widget from "./widget/Widget";
import SettingsPage from "./settings/SettingsPage";

const label = getCurrentWindow().label;
document.documentElement.dataset.window = label;

export default function App() {
  return label === "settings" ? <SettingsPage /> : <Widget />;
}
