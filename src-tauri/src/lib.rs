#![cfg_attr(target_os = "macos", allow(unexpected_cfgs))]

use tauri::{Manager, RunEvent, WebviewWindow};

mod qmd;
mod window;

#[cfg(target_os = "macos")]
mod mac_window;

use window::{create_child_window, create_main_window};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_settings_window(parent_window: WebviewWindow) -> Result<(), String> {
    let app_handle = parent_window.app_handle();
    let label = "settings";

    // If window already exists, focus it
    if let Some(window) = app_handle.get_webview_window(format!("other_{}", label).as_str()) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    create_child_window(
        &parent_window,
        "/?window=settings",
        label,
        "Settings",
        (750.0, 500.0),
    )?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_settings_window,
            qmd::qmd_search,
            qmd::qmd_status,
            qmd::qmd_ensure_collection,
            qmd::qmd_model_status,
            qmd::qmd_vector_status,
            qmd::qmd_embed,
            qmd::qmd_download_models,
        ]);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .setup(|app| {
                use crate::mac_window::AppHandleMacWindowExt;
                app.app_handle().set_native_titlebar(false);
                Ok(())
            })
            .plugin(mac_window::init());
    }

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Ready = event {
                let _ = create_main_window(app_handle, "/");
            }
        });
}
