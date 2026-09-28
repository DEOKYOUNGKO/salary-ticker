mod autostart;
mod notify;
mod position;
mod settings;
mod tray;
mod widget_options;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const WIDGET: &str = "widget";
const SETTINGS: &str = "settings";

/// 위젯 위치와 (사용자가 조절한) 크기를 기억한다.
const WINDOW_STATE_FLAGS: StateFlags = StateFlags::POSITION.union(StateFlags::SIZE);
/// 이동·크기 조절이 끝나고 이 시간 동안 변화가 없으면 파일에 저장
const SAVE_STATE_DELAY: Duration = Duration::from_millis(500);

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

/// 저장된 위젯 옵션을 창과 트레이 메뉴(클릭 통과 체크)에 반영
fn apply_widget_options(app: &AppHandle) -> tauri::Result<()> {
    if let Some(widget) = app.get_webview_window(WIDGET) {
        let options = widget_options::apply(&widget)?;
        tray::set_click_through_checked(app, options.click_through);
    }
    Ok(())
}

/// 트레이 "클릭 통과": 저장값을 뒤집고 바로 반영. 켜져 있으면 위젯을 클릭할 수 없으므로 여기서만 끌 수 있다.
pub fn toggle_click_through(app: &AppHandle) {
    if !settings::is_configured(app) {
        tray::set_click_through_checked(app, false);
        return;
    }
    let enabled = !widget_options::read(app).click_through;
    if let Some(saved) = settings::set_widget_option(app, "clickThrough", enabled.into()) {
        let _ = app.emit("settings-changed", saved);
    }
    if let Err(e) = apply_widget_options(app) {
        eprintln!("[widget] 클릭 통과 반영 실패: {e}");
    }
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

/// 설정 저장 후: 자동 실행·위젯 옵션 반영, 설정 창 숨기고 위젯 표시
#[tauri::command]
fn finish_settings(app: AppHandle) -> Result<(), String> {
    autostart::sync(&app);
    apply_widget_options(&app).map_err(|e| e.to_string())?;
    if let Some(settings) = app.get_webview_window(SETTINGS) {
        settings.hide().map_err(|e| e.to_string())?;
    }
    set_widget_visible(&app, true);
    notify::tray_hint_once(&app);
    Ok(())
}

/// 설정 창 "가장 작게/가장 크게": 가까운 화면 모서리를 기준으로 크기를 바꾼다
#[tauri::command]
fn set_widget_size(app: AppHandle, preset: String) -> Result<(), String> {
    let size = match preset.as_str() {
        "min" => widget_options::MIN_SIZE,
        "max" => widget_options::MAX_SIZE,
        other => return Err(format!("unknown preset: {other}")),
    };
    if let Some(widget) = app.get_webview_window(WIDGET) {
        widget_options::resize_logical(&widget, size, true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 위젯 닫기 버튼: 종료가 아니라 숨김
#[tauri::command]
fn hide_widget(app: AppHandle) {
    set_widget_visible(&app, false);
}

/// 위젯에서 보내는 알림 (퇴근 시각)
#[tauri::command]
fn show_notification(app: AppHandle, title: String, body: String) {
    notify::show(&app, &title, &body);
}

/// 트레이 툴팁 (오늘 번 돈)
#[tauri::command]
fn set_tray_tooltip(app: AppHandle, text: String) {
    tray::set_tooltip(&app, &text);
}

/// 위젯이 움직이거나 크기가 바뀔 때마다 저장하지 않고, 멈춘 뒤 한 번만 저장
fn schedule_state_save(app: &AppHandle) {
    static GENERATION: AtomicU64 = AtomicU64::new(0);
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(SAVE_STATE_DELAY);
        if GENERATION.load(Ordering::SeqCst) == generation {
            let _ = app.save_window_state(WINDOW_STATE_FLAGS);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 가장 먼저 등록해야 한다. 이미 실행 중이면 새 프로세스는 바로 끝나고,
        // 기존 앱이 위젯을 보여 준다 (설정 전이면 set_widget_visible이 설정 창을 연다).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            set_widget_visible(app, true);
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
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
            set_widget_size,
            set_tray_tooltip,
            show_notification
        ])
        .setup(|app| {
            let handle = app.handle();
            tray::build(handle)?;
            if let Some(widget) = app.get_webview_window(WIDGET) {
                apply_widget_options(handle)?;
                // 예전 미니 모드가 켜져 있었으면 가장 작은 크기로 옮겨 온다
                let legacy_compact = widget_options::take_legacy_compact(handle);
                // 크기를 먼저 복원해야 화면 밖 검사·기본 위치가 새 크기 기준으로 계산된다
                position::place_widget(&widget, legacy_compact)?;
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
                (WIDGET, WindowEvent::Moved(_) | WindowEvent::Resized(_)) => {
                    schedule_state_save(app)
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
