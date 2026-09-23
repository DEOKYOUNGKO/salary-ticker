//! 저장된 settings.widget 값(미니 모드, 바탕화면 고정, 클릭 통과)을 위젯 창에 반영한다.

use serde_json::Value;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, Runtime, WebviewWindow};

/// tauri.conf.json의 위젯 크기와 같아야 한다.
const NORMAL_SIZE: (f64, f64) = (340.0, 230.0);
const COMPACT_SIZE: (f64, f64) = (240.0, 64.0);

#[derive(Debug, Default, Clone, Copy)]
pub struct WidgetOptions {
    pub compact: bool,
    /// placement == "bottom": 항상 위 대신 다른 창들 아래(바탕화면 고정)
    pub on_bottom: bool,
    /// 마우스 입력을 뒤의 창으로 통과시킴 (위젯은 클릭·드래그 불가, 트레이에서 끔)
    pub click_through: bool,
}

pub fn read<R: Runtime>(app: &AppHandle<R>) -> WidgetOptions {
    let widget = crate::settings::saved(app).and_then(|s| s.get("widget").cloned());
    let flag = |key: &str| {
        widget
            .as_ref()
            .and_then(|w| w.get(key).and_then(Value::as_bool))
            .unwrap_or(false)
    };
    WidgetOptions {
        compact: flag("compact"),
        click_through: flag("clickThrough"),
        on_bottom: widget
            .as_ref()
            .and_then(|w| w.get("placement").and_then(Value::as_str))
            == Some("bottom"),
    }
}

/// 크기를 바꾼다. anchor면 위젯이 가까운 화면 모서리 쪽 가장자리를 고정해서
/// (예: 오른쪽 아래에 있으면 오른쪽 아래 모서리 유지) 크기가 바뀌어도 자리가 튀지 않게 한다.
fn apply_size<R: Runtime>(
    window: &WebviewWindow<R>,
    compact: bool,
    anchor: bool,
) -> tauri::Result<()> {
    let (w, h) = if compact { COMPACT_SIZE } else { NORMAL_SIZE };
    let scale = window.scale_factor()?;
    let old_size = window.outer_size()?;
    let new_w = (w * scale).round() as i32;
    let new_h = (h * scale).round() as i32;
    if old_size.width as i32 == new_w && old_size.height as i32 == new_h {
        return Ok(());
    }

    let old_pos = window.outer_position()?;
    window.set_size(LogicalSize::new(w, h))?;
    if !anchor {
        return Ok(());
    }

    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let area = monitor.work_area();
    let (old_w, old_h) = (old_size.width as i32, old_size.height as i32);
    let center_x = old_pos.x + old_w / 2;
    let center_y = old_pos.y + old_h / 2;
    let right_half = center_x > area.position.x + area.size.width as i32 / 2;
    let bottom_half = center_y > area.position.y + area.size.height as i32 / 2;

    let x = if right_half {
        old_pos.x + old_w - new_w
    } else {
        old_pos.x
    };
    let y = if bottom_half {
        old_pos.y + old_h - new_h
    } else {
        old_pos.y
    };
    window.set_position(PhysicalPosition::new(x, y))
}

/// 저장된 옵션을 위젯 창에 반영. 앱 시작 시에는 저장 위치를 복원하기 전이라 anchor=false.
pub fn apply<R: Runtime>(window: &WebviewWindow<R>, anchor: bool) -> tauri::Result<WidgetOptions> {
    let options = read(window.app_handle());
    // 둘 다 켜지지 않도록 끄는 쪽을 먼저
    if options.on_bottom {
        window.set_always_on_top(false)?;
        window.set_always_on_bottom(true)?;
    } else {
        window.set_always_on_bottom(false)?;
        window.set_always_on_top(true)?;
    }
    window.set_ignore_cursor_events(options.click_through)?;
    apply_size(window, options.compact, anchor)?;
    Ok(options)
}
