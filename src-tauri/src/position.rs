//! 위젯 첫 위치(주 모니터 오른쪽 아래)와 저장 위치 복원.
//! 저장은 tauri-plugin-window-state가 하고, 복원은 화면 밖 검사를 위해 여기서 직접 한다.

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalRect, Runtime, WebviewWindow};
use tauri_plugin_window_state::DEFAULT_FILENAME;

/// 작업 영역 가장자리와의 간격 (논리 px)
const MARGIN: f64 = 16.0;
/// 창 면적의 이 비율 이상이 어떤 모니터 작업 영역 안에 있어야 "화면 안"으로 본다.
const MIN_VISIBLE_RATIO: f64 = 0.5;

/// window-state 파일에 저장된 위젯 위치
fn saved_position<R: Runtime>(app: &AppHandle<R>, label: &str) -> Option<PhysicalPosition<i32>> {
    let path = app.path().app_config_dir().ok()?.join(DEFAULT_FILENAME);
    let json: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let state = json.get(label)?;
    let x = state.get("x")?.as_i64()? as i32;
    let y = state.get("y")?.as_i64()? as i32;
    // 한 번도 위치가 기록되지 않은 기본값 (플러그인이 0,0,0x0으로 넣어 둠)
    if state.get("width")?.as_u64()? == 0 {
        return None;
    }
    Some(PhysicalPosition::new(x, y))
}

fn overlap(a: (i64, i64), b: (i64, i64)) -> i64 {
    (a.1.min(b.1) - a.0.max(b.0)).max(0)
}

/// 창 영역이 어떤 모니터 작업 영역 안에 충분히 들어가 있는지
fn is_on_screen<R: Runtime>(window: &WebviewWindow<R>, pos: PhysicalPosition<i32>) -> bool {
    let Ok(size) = window.outer_size() else {
        return false;
    };
    let Ok(monitors) = window.available_monitors() else {
        return false;
    };
    let (w, h) = (size.width as i64, size.height as i64);
    let area = (w * h).max(1) as f64;
    let (x, y) = (pos.x as i64, pos.y as i64);

    monitors.iter().any(|m| {
        let wa = m.work_area();
        let (mx, my) = (wa.position.x as i64, wa.position.y as i64);
        let (mw, mh) = (wa.size.width as i64, wa.size.height as i64);
        let visible = overlap((x, x + w), (mx, mx + mw)) * overlap((y, y + h), (my, my + mh));
        visible as f64 / area >= MIN_VISIBLE_RATIO
    })
}

/// 주 모니터 작업 영역(작업표시줄 제외) 오른쪽 아래
fn default_position<R: Runtime>(window: &WebviewWindow<R>) -> Option<PhysicalPosition<i32>> {
    let monitor = window.primary_monitor().ok().flatten()?;
    let size = window.outer_size().ok()?;
    let margin = (MARGIN * monitor.scale_factor()).round() as i32;
    let PhysicalRect {
        position,
        size: area,
    } = *monitor.work_area();
    Some(PhysicalPosition::new(
        position.x + area.width as i32 - size.width as i32 - margin,
        position.y + area.height as i32 - size.height as i32 - margin,
    ))
}

/// 저장 위치가 화면 안이면 그 위치, 아니면(또는 처음이면) 기본 위치로 옮긴다.
pub fn place_widget<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let position = saved_position(window.app_handle(), window.label())
        .filter(|&pos| is_on_screen(window, pos))
        .or_else(|| default_position(window));
    if let Some(position) = position {
        window.set_position(position)?;
    }
    Ok(())
}
