mod autostart;
mod position;
mod settings;
mod tray;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const WIDGET: &str = "widget";
const SETTINGS: &str = "settings";

/// 위젯은 크기가 고정이라 사실상 위치만 기억한다.
/// (SIZE도 저장해야 "저장된 적 있음"을 width > 0으로 구분할 수 있음)
const WINDOW_STATE_FLAGS: StateFlags = StateFlags::POSITION.union(StateFlags::SIZE);
/// 드래그가 끝나고 이 시간 동안 움직임이 없으면 위치를 파일에 저장
const SAVE_POSITION_DELAY: Duration = Duration::from_millis(500);

/// 위젯 보이기/숨기기. 트레이 메뉴 글자와 위젯의 갱신 on/off도 함께 맞춘다.
pub fn set_widget_visible(app: &AppHandle, visible: bool) {
    // 설정 전에는 보여 줄 위젯이 없으므로 설정 창을 연다
    if visible && !settings::is_configured(app) {
        show_settings(app);
        return;
    }
    let Some(widget) = app.get_webview_window(WIDGET) else {
        return;
    };
    let _ = if visible {
        widget.show()
    } else {
        widget.hide()
    };
    tray::set_toggle_label(app, visible);
    let _ = app.emit_to(WIDGET, "widget-visibility", visible);
}

pub fn toggle_widget(app: &AppHandle) {
    let visible = app
        .get_webview_window(WIDGET)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    set_widget_visible(app, !visible);
}

/// 설정 창 열기. 폼은 저장값으로 다시 채운다.
pub fn show_settings(app: &AppHandle) {
    let _ = app.emit_to(SETTINGS, "settings-opened", ());
    if let Some(window) = app.get_webview_window(SETTINGS) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    show_settings(&app);
}

/// 설정 창 취소
#[tauri::command]
fn hide_settings(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window(SETTINGS) {
        Some(settings) => settings.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// 설정 저장 후: 자동 실행 반영, 설정 창 숨기고 위젯 표시
#[tauri::command]
fn finish_settings(app: AppHandle) -> Result<(), String> {
    autostart::sync(&app);
    if let Some(settings) = app.get_webview_window(SETTINGS) {
        settings.hide().map_err(|e| e.to_string())?;
    }
    set_widget_visible(&app, true);
    Ok(())
}

/// 위젯 닫기 버튼: 종료가 아니라 숨김
#[tauri::command]
fn hide_widget(app: AppHandle) {
    set_widget_visible(&app, false);
}

/// 트레이 툴팁 (오늘 번 돈)
#[tauri::command]
fn set_tray_tooltip(app: AppHandle, text: String) {
    tray::set_tooltip(&app, &text);
}

/// 위젯이 움직일 때마다 저장하지 않고, 멈춘 뒤 한 번만 저장
fn schedule_position_save(app: &AppHandle) {
    static GENERATION: AtomicU64 = AtomicU64::new(0);
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(SAVE_POSITION_DELAY);
        if GENERATION.load(Ordering::SeqCst) == generation {
            let _ = app.save_window_state(WINDOW_STATE_FLAGS);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(WINDOW_STATE_FLAGS)
                .with_denylist(&[SETTINGS])
                // 복원은 화면 밖 검사를 위해 position::place_widget에서 직접
                .skip_initial_state(WIDGET)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            open_settings,
            hide_settings,
            finish_settings,
            hide_widget,
            set_tray_tooltip
        ])
        .setup(|app| {
            let handle = app.handle();
            tray::build(handle)?;
            if let Some(widget) = app.get_webview_window(WIDGET) {
                position::place_widget(&widget)?;
            }
            if settings::is_configured(handle) {
                autostart::sync(handle);
                set_widget_visible(handle, true);
            } else {
                tray::set_toggle_label(handle, false);
                if let Some(settings) = app.get_webview_window(SETTINGS) {
                    settings.center()?;
                }
                show_settings(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();
            match (window.label(), event) {
                // 설정 창은 닫지 않고 숨김. 첫 실행에서 저장 없이 닫으면 종료.
                (SETTINGS, WindowEvent::CloseRequested { api, .. }) => {
                    api.prevent_close();
                    let _ = window.hide();
                    if !settings::is_configured(app) {
                        app.exit(0);
                    }
                }
                // 위젯은 Alt+F4 등으로 닫혀도 숨김 (종료는 트레이 메뉴)
                (WIDGET, WindowEvent::CloseRequested { api, .. }) => {
                    api.prevent_close();
                    set_widget_visible(app, false);
                }
                (WIDGET, WindowEvent::Moved(_)) => schedule_position_save(app),
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
