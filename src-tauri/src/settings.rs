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

/// settings.widget[key] 값을 바꿔 파일에 저장하고, 바뀐 전체 설정을 돌려준다.
/// (트레이 메뉴처럼 설정 창을 거치지 않는 변경용)
pub fn set_widget_option<R: Runtime>(app: &AppHandle<R>, key: &str, value: Value) -> Option<Value> {
    let store = app.store(STORE_PATH).ok()?;
    let mut settings = store.get(SETTINGS_KEY)?;
    let root = settings.as_object_mut()?;
    let widget = root
        .entry("widget")
        .or_insert_with(|| Value::Object(Default::default()));
    widget.as_object_mut()?.insert(key.to_string(), value);
    store.set(SETTINGS_KEY, settings.clone());
    if let Err(e) = store.save() {
        eprintln!("[settings] 저장 실패: {e}");
    }
    Some(settings)
}

/// settings.widget[key] 값을 지운다 (없어진 옵션 정리용).
pub fn remove_widget_option<R: Runtime>(app: &AppHandle<R>, key: &str) {
    let Ok(store) = app.store(STORE_PATH) else {
        return;
    };
    let Some(mut settings) = store.get(SETTINGS_KEY) else {
        return;
    };
    let removed = settings
        .get_mut("widget")
        .and_then(Value::as_object_mut)
        .and_then(|w| w.remove(key));
    if removed.is_some() {
        store.set(SETTINGS_KEY, settings);
        let _ = store.save();
    }
}
