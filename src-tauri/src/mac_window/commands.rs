use tauri::{command, Manager, Runtime, Window};

use crate::mac_window::AppHandleMacWindowExt;

#[command]
pub(crate) fn set_title<R: Runtime>(window: Window<R>, title: &str) {
    #[cfg(target_os = "macos")]
    {
        crate::mac_window::mac::update_window_title(window, title.to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_title(title);
    }
}

#[command]
#[allow(unused)]
pub(crate) fn set_theme<R: Runtime>(window: Window<R>, bg_color: &str) {
    #[cfg(target_os = "macos")]
    {
        use log::warn;
        match csscolorparser::parse(bg_color.trim()) {
            Ok(color) => {
                crate::mac_window::mac::update_window_theme(window, color);
            }
            Err(err) => {
                warn!("Failed to parse background color '{}': {}", bg_color, err)
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Nothing yet for non-Mac platforms
    }
}

#[command]
pub(crate) fn set_native_titlebar<R: Runtime>(window: Window<R>, enable: bool) {
    window.app_handle().set_native_titlebar(enable);
}
