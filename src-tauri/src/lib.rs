use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_store::StoreExt;

/// 프론트엔드 src/settings/store.ts와 같은 파일/키
const STORE_PATH: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

const WIDGET: &str = "widget";
const SETTINGS: &str = "settings";

/// 저장된 월급이 있으면 설정 완료로 본다.
fn is_configured(app: &AppHandle) -> bool {
    app.store(STORE_PATH)
        .ok()
        .and_then(|store| store.get(SETTINGS_KEY))
        .and_then(|settings| settings.get("monthlySalary").and_then(|v| v.as_f64()))
        .is_some_and(|salary| salary > 0.0)
}

fn show_window(app: &AppHandle, label: &str) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(label) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

/// 위젯 톱니바퀴(이후 트레이 메뉴)에서 설정 창 열기. 폼은 저장값으로 다시 채운다.
#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    app.emit_to(SETTINGS, "settings-opened", ())
        .map_err(|e| e.to_string())?;
    show_window(&app, SETTINGS).map_err(|e| e.to_string())
}

/// 설정 창 취소
#[tauri::command]
fn hide_settings(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window(SETTINGS) {
        Some(settings) => settings.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// 설정 저장 후: 설정 창 숨기고 위젯 표시
#[tauri::command]
fn finish_settings(app: AppHandle) -> Result<(), String> {
    if let Some(settings) = app.get_webview_window(SETTINGS) {
        settings.hide().map_err(|e| e.to_string())?;
    }
    show_window(&app, WIDGET).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_settings,
            hide_settings,
            finish_settings
        ])
        .setup(|app| {
            let handle = app.handle();
            if is_configured(handle) {
                show_window(handle, WIDGET)?;
            } else if let Some(settings) = app.get_webview_window(SETTINGS) {
                settings.center()?;
                settings.show()?;
                settings.set_focus()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            let WindowEvent::CloseRequested { api, .. } = event else {
                return;
            };
            let app = window.app_handle();
            match window.label() {
                // 설정 창은 닫지 않고 숨김. 첫 실행에서 저장 없이 닫으면 종료.
                SETTINGS => {
                    api.prevent_close();
                    let _ = window.hide();
                    if !is_configured(app) {
                        app.exit(0);
                    }
                }
                // TODO(4단계): 트레이가 생기면 종료 대신 숨김
                WIDGET => app.exit(0),
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
