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

use crate::artifacts::ArtifactsDb;
use crate::settings::DisplaySettings;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
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

/// Cached display names from the OS, populated once at first use.
/// `system_profiler` is slow (~3s) so we run it once and cache.
/// Re-queried when monitor count changes (hot-plug).
static DISPLAY_NAMES_CACHE: std::sync::RwLock<Vec<(u32, u32, String)>> =
    std::sync::RwLock::new(Vec::new());
static DISPLAY_NAMES_READY: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Get cached display names. Returns empty vec if not yet populated.
fn get_real_display_names() -> Vec<(u32, u32, String)> {
    DISPLAY_NAMES_CACHE.read().unwrap_or_else(|e| e.into_inner()).clone()
}

/// Refresh the cache (called when monitor count changes).
fn refresh_display_names() {
    let names = query_display_names();
    if let Ok(mut cache) = DISPLAY_NAMES_CACHE.write() {
        *cache = names;
    }
    DISPLAY_NAMES_READY.store(true, std::sync::atomic::Ordering::Release);
}

/// Populate the cache eagerly from a background thread at startup.
pub fn prefetch_display_names() {
    std::thread::spawn(|| {
        refresh_display_names();
    });
}

/// Query the OS for real display product names (e.g. "Hisense", "Built-in Retina Display").
#[cfg(target_os = "macos")]
fn query_display_names() -> Vec<(u32, u32, String)> {
    use std::process::Command;
    let output = match Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
    {
        Ok(o) if o.status.success() => o.stdout,
        _ => return vec![],
    };
    let json: serde_json::Value = match serde_json::from_slice(&output) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    let mut result = Vec::new();
    if let Some(gpus) = json.get("SPDisplaysDataType").and_then(|v| v.as_array()) {
        for gpu in gpus {
            if let Some(displays) = gpu.get("spdisplays_ndrvs").and_then(|v| v.as_array()) {
                for display in displays {
                    let name = display
                        .get("_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    let res_str = display
                        .get("_spdisplays_pixels")
                        .or_else(|| display.get("_spdisplays_resolution"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let parts: Vec<&str> = res_str.split('x').collect();
                    if parts.len() >= 2 {
                        let w = parts[0].trim().parse::<u32>().unwrap_or(0);
                        let h_str = parts[1].trim();
                        let h = h_str.split(' ').next()
                            .and_then(|s| s.parse::<u32>().ok())
                            .unwrap_or(0);
                        if w > 0 && h > 0 {
                            result.push((w, h, name));
                        }
                    }
                }
            }
        }
    }
    result
}

#[cfg(not(target_os = "macos"))]
fn query_display_names() -> Vec<(u32, u32, String)> {
    vec![]
}

/// Match a Tauri monitor (by resolution) to a real display name from the OS.
fn resolve_display_name(width: u32, height: u32, is_primary: bool, real_names: &[(u32, u32, String)]) -> String {
    // Try exact resolution match
    for (w, h, name) in real_names {
        if *w == width && *h == height {
            return name.clone();
        }
    }
    // Try matching at common HiDPI scale factors (macOS reports logical size,
    // system_profiler reports physical pixels)
    for scale in [2, 3] {
        for (w, h, name) in real_names {
            if *w == width * scale && *h == height * scale {
                return name.clone();
            }
            if width == *w * scale && height == *h * scale {
                return name.clone();
            }
        }
    }
    // Fallback
    if is_primary {
        "Built-in Display".to_string()
    } else {
        format!("External Display ({width}×{height})")
    }
}

/// Enumerate all connected monitors and return their metadata.
///
/// The index in the returned vec corresponds to the `selected_monitor_index`
/// stored in `DisplaySettings` — callers should treat it as stable only for
/// the current session (monitors may be added/removed).
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().ok().flatten();

    // If monitor count doesn't match cache, refresh names in background.
    // The current call uses whatever we have; next call gets updated names.
    let real_names = get_real_display_names();
    if real_names.len() != monitors.len()
        && DISPLAY_NAMES_READY.load(std::sync::atomic::Ordering::Acquire)
    {
        std::thread::spawn(refresh_display_names);
    }

    let infos = monitors
        .iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let is_primary = primary
                .as_ref()
                .map(|p| p.name() == m.name())
                .unwrap_or(false);
            let friendly_name = resolve_display_name(size.width, size.height, is_primary, &real_names);
            MonitorInfo {
                name: friendly_name,
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

    eprintln!(
        "[display_window] target monitor: pos=({},{}) size={}x{} scale={}",
        pos.x, pos.y, size.width, size.height, target.scale_factor(),
    );

    // Check if the display window already exists.
    if let Some(win) = app.get_webview_window(DISPLAY_WINDOW_LABEL) {
        // Disable fullscreen first so position/size changes take effect.
        let _ = win.set_fullscreen(false);
        // Use PhysicalPosition/PhysicalSize — macOS uses a unified physical
        // coordinate space across all monitors.
        win.set_position(tauri::PhysicalPosition::new(pos.x, pos.y))
            .map_err(|e| e.to_string())?;
        win.set_size(tauri::PhysicalSize::new(size.width, size.height))
            .map_err(|e| e.to_string())?;
        win.set_fullscreen(true).map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        // Create a new display window on the target monitor.
        // Use WebviewUrl::App with a relative path — Tauri resolves it
        // against the app's frontend URL in both dev and production.
        tauri::WebviewWindowBuilder::new(
            &app,
            DISPLAY_WINDOW_LABEL,
            tauri::WebviewUrl::App("/display".into()),
        )
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

    // Send current live content + background to the new display window.
    // The display needs a moment to load and connect to the WebSocket,
    // so we send after a short delay.
    let display_tx = state.display_tx.clone();
    let queue = state.queue.clone();
    let display_settings = state.display_settings.clone();
    let artifacts_db = state.artifacts_db.clone();
    std::thread::spawn(move || {
        // Wait for the display window to load and connect to WebSocket
        std::thread::sleep(std::time::Duration::from_millis(1500));

        // Send current background
        if let Ok(settings) = display_settings.read() {
            if let Some(ref bg_id) = settings.background_id {
                let resolved = resolve_bg_for_display(bg_id, &artifacts_db);
                let _ = display_tx.send(ow_display::ContentEvent::set_background(resolved));
            }
        }

        // Send current live content
        if let Ok(q) = queue.lock() {
            for item in q.iter() {
                if item.status == ow_core::QueueStatus::Live {
                    let ev = crate::commands::content_event_for_item(item);
                    let _ = display_tx.send(ev);
                    break;
                }
            }
        }
    });

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

/// Resolve a background ID to a display-ready value (CSS gradient or base64 data URL).
/// Reuses the same logic as `commands::resolve_background_value` but takes an
/// `Arc<Mutex<ArtifactsDb>>` instead of `&AppState` so it can run from a thread.
fn resolve_bg_for_display(bg_id: &str, artifacts_db: &std::sync::Arc<Mutex<ArtifactsDb>>) -> String {
    // Preset → CSS gradient
    if let Some(preset_key) = bg_id.strip_prefix("preset:") {
        let presets = crate::backgrounds::list_presets();
        if let Some(preset) = presets.iter().find(|p| p.id == bg_id || p.id.ends_with(preset_key)) {
            return preset.value.clone();
        }
    }
    // Artifact → base64 data URL
    if let Some(artifact_id) = bg_id.strip_prefix("artifact:") {
        if let Ok(db) = artifacts_db.lock() {
            if let Ok(Some(entry)) = db.get_by_id(artifact_id) {
                let abs_path = db.abs_path(&entry.path);
                if let Ok(bytes) = std::fs::read(&abs_path) {
                    let mime = entry.mime_type.as_deref().unwrap_or("image/jpeg");
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    return format!("data:{mime};base64,{b64}");
                }
            }
        }
    }
    // Fallback: assume it's already a CSS value
    bg_id.to_string()
}
