use serde::Serialize;
use tauri::{AppHandle, Emitter, command};
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: usize,
    pub total: Option<u64>,
}

/// Check for available updates. Returns update info if a newer version exists,
/// or `null` if the app is already up to date.
#[command]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            date: update.date.map(|d| d.to_string()),
            body: update.body.clone(),
        })),
        Ok(None) => Ok(None),
        Err(e) => {
            eprintln!("[updater] update check failed: {e}");
            // Treat network/server errors as "no update" so users are not
            // blocked if the update server is temporarily unreachable.
            Ok(None)
        }
    }
}

/// Download and install the available update, emitting progress events to the
/// frontend. After installation the app must be restarted via `restart_app`.
#[command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None) => return Err("No update available".to_string()),
        Err(e) => return Err(e.to_string()),
    };

    let app_progress = app.clone();
    let app_done = app.clone();

    update
        .download_and_install(
            move |downloaded, total| {
                let _ = app_progress.emit(
                    "updater://download-progress",
                    DownloadProgress { downloaded, total },
                );
            },
            move || {
                let _ = app_done.emit("updater://install-complete", ());
            },
        )
        .await
        .map_err(|e| e.to_string())
}

/// Restart the application to apply an installed update.
#[command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

/// Background task: silently check for updates on startup and emit
/// `updater://update-available` if a newer version exists. This must not
/// block the UI or show any dialog if the app is already up to date.
pub fn spawn_background_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Small delay so the UI is fully ready before we potentially emit.
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                eprintln!("[updater] failed to create updater: {e}");
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => {
                eprintln!("[updater] new version available: {}", update.version);
                let _ = app.emit(
                    "updater://update-available",
                    UpdateInfo {
                        version: update.version.clone(),
                        date: update.date.map(|d| d.to_string()),
                        body: update.body.clone(),
                    },
                );
            }
            Ok(None) => eprintln!("[updater] app is up to date"),
            Err(e) => eprintln!("[updater] background check failed: {e}"),
        }
    });
}
