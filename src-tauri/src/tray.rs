use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

const TRAY_ID: &str = "main";

/// 상태에 따라 바뀌는 메뉴 항목: "위젯 보이기/숨기기" 글자, "클릭 통과" 체크
pub struct TrayMenu {
    toggle: MenuItem<Wry>,
    click_through: CheckMenuItem<Wry>,
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "위젯 숨기기", true, None::<&str>)?;
    let click_through =
        CheckMenuItem::with_id(app, "click_through", "클릭 통과", true, false, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "설정", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[&toggle, &click_through, &settings, &separator, &quit],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("월급 티커")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => crate::toggle_widget(app),
            "click_through" => crate::toggle_click_through(app),
            "settings" => crate::show_settings(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::set_widget_visible(tray.app_handle(), true);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    app.manage(TrayMenu {
        toggle,
        click_through,
    });
    Ok(())
}

pub fn set_toggle_label(app: &AppHandle, widget_visible: bool) {
    if let Some(menu) = app.try_state::<TrayMenu>() {
        let text = if widget_visible {
            "위젯 숨기기"
        } else {
            "위젯 보이기"
        };
        let _ = menu.toggle.set_text(text);
    }
}

pub fn set_click_through_checked(app: &AppHandle, checked: bool) {
    if let Some(menu) = app.try_state::<TrayMenu>() {
        let _ = menu.click_through.set_checked(checked);
    }
}

pub fn set_tooltip(app: &AppHandle, text: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(text));
    }
}
