//! Tauri commands for display output device selection and window management.
//!
//! The "display window" is a second `WebviewWindow` that opens on the selected
//! monitor and loads the `/display` route in fullscreen. The operator window
//! remains on the primary monitor as usual.
//!
//! Hot-plug detection: Tauri doesn't provide a native monitor-change event, so
//! we re-enumerate monitors on demand (Settings open, before launching the
//! display window). If the previously-selected monitor is no longer present we
//! fall back to the primary monitor and emit a `display://monitor-disconnected`
//! event so the frontend can show a notification.

use crate::settings::DisplaySettings;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

/// Information about a single connected monitor, returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub position_x: i32,
    pub position_y: i32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

/// Label used for the managed display `WebviewWindow`.
const DISPLAY_WINDOW_LABEL: &str = "display";

/// Enumerate all connected monitors and return their metadata.
///
/// The index in the returned vec corresponds to the `selected_monitor_index`
/// stored in `DisplaySettings` — callers should treat it as stable only for
/// the current session (monitors may be added/removed).
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().ok().flatten();

    let infos = monitors
        .iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let is_primary = primary
                .as_ref()
                .map(|p| p.name() == m.name())
                .unwrap_or(false);
            MonitorInfo {
                name: m.name().map_or("Unknown", |v| v).to_string(),
                width: size.width,
                height: size.height,
                position_x: pos.x,
                position_y: pos.y,
                scale_factor: m.scale_factor(),
                is_primary,
            }
        })
        .collect();

    Ok(infos)
}

/// Open (or move) the display window to the monitor at `monitor_index`.
///
/// - If no display window exists it is created and navigated to `/display`.
/// - If a display window already exists it is repositioned to the target
///   monitor and made fullscreen.
/// - If `monitor_index` is `None` or out of range, the primary monitor is used.
///   A `display://monitor-disconnected` event is emitted when the requested
///   monitor could not be found.
#[tauri::command]
pub fn open_display_window(
    monitor_index: Option<usize>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().ok().flatten();

    // Resolve target monitor.
    let target = match monitor_index {
        Some(idx) if idx < monitors.len() => monitors[idx].clone(),
        Some(_) => {
            // Requested index out of range — notify UI and fall back.
            let _ = app.emit("display://monitor-disconnected", ());
            primary.clone().ok_or("No monitors available")?
        }
        None => primary.clone().ok_or("No monitors available")?,
    };

    let pos = target.position();
    let size = target.size();

    // Check if the display window already exists.
    if let Some(win) = app.get_webview_window(DISPLAY_WINDOW_LABEL) {
        // Move and resize onto the target monitor, then go fullscreen.
        win.set_position(tauri::PhysicalPosition::new(pos.x, pos.y))
            .map_err(|e| e.to_string())?;
        win.set_size(tauri::PhysicalSize::new(size.width, size.height))
            .map_err(|e| e.to_string())?;
        win.set_fullscreen(true).map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        // Create a new display window on the target monitor.
        let url = get_display_url(&app);
        tauri::WebviewWindowBuilder::new(&app, DISPLAY_WINDOW_LABEL, tauri::WebviewUrl::App(url.into()))
            .title("OpenWorship Display")
            .position(pos.x as f64, pos.y as f64)
            .inner_size(size.width as f64, size.height as f64)
            .fullscreen(true)
            .decorations(false)
            .always_on_top(true)
            .build()
            .map_err(|e| e.to_string())?;
    }

    // Persist the selection.
    {
        let mut settings = state
            .display_settings
            .write()
            .map_err(|e| e.to_string())?;
        settings.selected_monitor_index = monitor_index;
        if let Err(e) = settings.save() {
            eprintln!("[display_window] failed to persist settings: {e}");
        }
    }

    Ok(())
}

/// Close the display window if it is open.
#[tauri::command]
pub fn close_display_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(DISPLAY_WINDOW_LABEL) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Return whether the display window is currently open.
#[tauri::command]
pub fn get_display_window_open(app: AppHandle) -> bool {
    app.get_webview_window(DISPLAY_WINDOW_LABEL).is_some()
}

/// Return persisted display settings.
#[tauri::command]
pub fn get_display_settings(state: State<'_, AppState>) -> Result<DisplaySettings, String> {
    state
        .display_settings
        .read()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())
}

/// Persist display settings (multi_output flag etc.).
#[tauri::command]
pub fn set_display_settings(
    settings: DisplaySettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    {
        let mut guard = state
            .display_settings
            .write()
            .map_err(|e| e.to_string())?;
        *guard = settings;
        guard.save().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// The OBS browser-source URL (always accessible regardless of display window state).
#[tauri::command]
pub fn get_obs_display_url(app: AppHandle) -> String {
    get_display_url(&app)
}

/// Resolve the URL for the /display route.
///
/// In dev mode Tauri serves from the Vite dev server; in production it serves
/// from the embedded frontend dist.
fn get_display_url(app: &AppHandle) -> String {
    // Use the configured dev URL or fall back to production embedded URL.
    // Tauri exposes the app URL via the WebviewUrl for the main window.
    let main_win = app.get_webview_window("main");
    let base = match main_win {
        Some(w) => {
            // Extract base from the current URL of the main window.
            let url = w.url().map(|u| u.to_string()).unwrap_or_default();
            // Strip path component to get the origin.
            if let Some(idx) = url.find("://") {
                let after = &url[idx + 3..];
                let host_end = after.find('/').map(|i| i + idx + 3).unwrap_or(url.len());
                url[..host_end].to_string()
            } else {
                url
            }
        }
        None => "http://localhost:1420".to_string(),
    };
    format!("{}/display", base)
}
