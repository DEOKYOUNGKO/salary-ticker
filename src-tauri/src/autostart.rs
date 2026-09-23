use tauri::{AppHandle, Runtime};

/// 저장된 autoStart 설정을 Windows 시작 프로그램에 반영한다.
/// 개발 빌드는 dev 실행 파일이 등록되지 않도록 로그만 남긴다.
pub fn sync<R: Runtime>(app: &AppHandle<R>) {
    let enabled = crate::settings::auto_start(app);

    if cfg!(debug_assertions) {
        println!("[autostart] 개발 모드라 Windows 등록을 건너뜀 (설정값: {enabled})");
        return;
    }

    use tauri_plugin_autostart::ManagerExt;
    let launcher = app.autolaunch();
    let result = match launcher.is_enabled() {
        Ok(current) if current == enabled => Ok(()),
        _ if enabled => launcher.enable(),
        _ => launcher.disable(),
    };
    if let Err(e) = result {
        eprintln!("[autostart] 반영 실패 (설정값: {enabled}): {e}");
    }
}
