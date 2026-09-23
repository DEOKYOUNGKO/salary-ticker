use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

/// 프론트엔드 src/settings/store.ts와 같은 파일/키
const STORE_PATH: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

/// 저장된 설정 JSON. 없으면 None.
pub fn saved<R: Runtime>(app: &AppHandle<R>) -> Option<Value> {
    app.store(STORE_PATH).ok()?.get(SETTINGS_KEY)
}

/// 저장된 월급이 있으면 설정 완료로 본다.
pub fn is_configured<R: Runtime>(app: &AppHandle<R>) -> bool {
    saved(app)
        .and_then(|s| s.get("monthlySalary").and_then(Value::as_f64))
        .is_some_and(|salary| salary > 0.0)
}

/// 저장된 autoStart 값 (없으면 기본값 true)
pub fn auto_start<R: Runtime>(app: &AppHandle<R>) -> bool {
    saved(app)
        .and_then(|s| s.get("autoStart").and_then(Value::as_bool))
        .unwrap_or(true)
}
