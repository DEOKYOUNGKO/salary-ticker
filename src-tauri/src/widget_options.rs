//! 저장된 settings.widget 값(바탕화면 고정, 클릭 통과)과 위젯 크기 조절.

use serde_json::Value;
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow,
};

/// tauri.conf.json 위젯의 maxWidth/maxHeight, minWidth/minHeight와 같아야 한다.
/// 최소 크기는 오늘 번 돈 금액 한 줄이 들어가는 크기 (src/widget/layout.ts와 같은 값).
pub const MAX_SIZE: (f64, f64) = (340.0, 230.0);
pub const MIN_SIZE: (f64, f64) = (180.0, 44.0);

#[derive(Debug, Default, Clone, Copy)]
pub struct WidgetOptions {
    /// placement == "bottom": 항상 위 대신 다른 창들 아래(바탕화면 고정)
    pub on_bottom: bool,
    /// 마우스 입력을 뒤의 창으로 통과시킴 (위젯은 클릭·드래그 불가, 트레이에서 끔)
    pub click_through: bool,
}

pub fn read<R: Runtime>(app: &AppHandle<R>) -> WidgetOptions {
    let widget = crate::settings::saved(app).and_then(|s| s.get("widget").cloned());
    WidgetOptions {
        on_bottom: widget
            .as_ref()
            .and_then(|w| w.get("placement").and_then(Value::as_str))
            == Some("bottom"),
        click_through: widget
            .as_ref()
            .and_then(|w| w.get("clickThrough").and_then(Value::as_bool))
            .unwrap_or(false),
    }
}

/// 크기를 (최소~최대 범위로 잘라서) 바꾼다. anchor면 위젯이 가까운 화면 모서리 쪽 가장자리를
/// 고정해서 (예: 오른쪽 아래에 있으면 오른쪽 아래 모서리 유지) 크기가 바뀌어도 자리가 튀지 않게 한다.
pub fn resize<R: Runtime>(
    window: &WebviewWindow<R>,
    size: PhysicalSize<u32>,
    anchor: bool,
) -> tauri::Result<()> {
    let scale = window.scale_factor()?;
    let clamp = |v: u32, (min, max): (f64, f64)| {
        (v as f64).clamp((min * scale).round(), (max * scale).round()) as i32
    };
    let new_w = clamp(size.width, (MIN_SIZE.0, MAX_SIZE.0));
    let new_h = clamp(size.height, (MIN_SIZE.1, MAX_SIZE.1));

    let old_size = window.outer_size()?;
    if old_size.width as i32 == new_w && old_size.height as i32 == new_h {
        return Ok(());
    }
    let old_pos = window.outer_position()?;
    window.set_size(PhysicalSize::new(new_w as u32, new_h as u32))?;
    if !anchor {
        return Ok(());
    }

    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let area = monitor.work_area();
    let (old_w, old_h) = (old_size.width as i32, old_size.height as i32);
    let right_half = old_pos.x + old_w / 2 > area.position.x + area.size.width as i32 / 2;
    let bottom_half = old_pos.y + old_h / 2 > area.position.y + area.size.height as i32 / 2;
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

/// 논리 크기 프리셋(가장 작게/가장 크게)으로 바꾼다.
pub fn resize_logical<R: Runtime>(
    window: &WebviewWindow<R>,
    (w, h): (f64, f64),
    anchor: bool,
) -> tauri::Result<()> {
    let physical = LogicalSize::new(w, h).to_physical::<u32>(window.scale_factor()?);
    resize(window, physical, anchor)
}

/// 예전 "미니 모드"(widget.compact) 저장값을 없애고, 켜져 있었으면 true를 돌려준다.
/// 이제 미니 모드는 "가장 작은 크기"로 바꾸는 동작이라 따로 저장하지 않는다.
pub fn take_legacy_compact<R: Runtime>(app: &AppHandle<R>) -> bool {
    let compact =
        crate::settings::saved(app).and_then(|s| s.get("widget")?.get("compact")?.as_bool());
    if compact.is_some() {
        crate::settings::remove_widget_option(app, "compact");
    }
    compact.unwrap_or(false)
}

/// 저장된 옵션(바탕화면 고정, 클릭 통과)을 위젯 창에 반영
pub fn apply<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<WidgetOptions> {
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
    Ok(options)
}
