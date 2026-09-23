use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

/// settings.json 안에서 설정과 별도로 두는 "트레이 안내를 이미 보여 줌" 표시
const STORE_PATH: &str = "settings.json";
const TRAY_HINT_KEY: &str = "trayHintShown";

pub fn show<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str) {
    println!("[notify] {title} / {body}");
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        eprintln!("[notify] 알림 실패: {e}");
    }
}

/// 첫 실행 "시작하기" 후 트레이 위치 안내 (한 번만)
pub fn tray_hint_once<R: Runtime>(app: &AppHandle<R>) {
    let Ok(store) = app.store(STORE_PATH) else {
        return;
    };
    if store
        .get(TRAY_HINT_KEY)
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return;
    }
    show(
        app,
        "월급 티커가 트레이에서 실행 중이에요",
        "작업표시줄 오른쪽 알림 영역(^)의 아이콘에서 위젯 보이기·설정·종료를 할 수 있어요.",
    );
    store.set(TRAY_HINT_KEY, true);
    let _ = store.save();
}
