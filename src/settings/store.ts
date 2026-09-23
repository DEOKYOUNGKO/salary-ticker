import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { load, type Store } from "@tauri-apps/plugin-store";
import { withDefaults, type Settings } from "./schema";

// src-tauri/src/lib.rs와 같은 파일/키 (앱 데이터 폴더의 settings.json)
const STORE_PATH = "settings.json";
const SETTINGS_KEY = "settings";
const SETTINGS_CHANGED = "settings-changed";

let storePromise: Promise<Store> | null = null;
const getStore = () => (storePromise ??= load(STORE_PATH, { autoSave: false }));

/** 저장된 설정. 한 번도 저장한 적 없으면 null. */
export async function loadSettings(): Promise<Settings | null> {
  const saved = await (await getStore()).get<Partial<Settings>>(SETTINGS_KEY);
  return saved ? withDefaults(saved) : null;
}

/** 파일에 저장하고 모든 창에 알린다. */
export async function saveSettings(settings: Settings): Promise<void> {
  const store = await getStore();
  await store.set(SETTINGS_KEY, settings);
  await store.save();
  await emit(SETTINGS_CHANGED, settings);
}

export function onSettingsChanged(handler: (settings: Settings) => void): Promise<UnlistenFn> {
  return listen<Settings>(SETTINGS_CHANGED, (event) => handler(withDefaults(event.payload)));
}
