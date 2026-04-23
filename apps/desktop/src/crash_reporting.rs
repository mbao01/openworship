//! Sentry crash and error reporting integration.
//!
//! Disabled by default; the operator must explicitly opt in via Settings →
//! "Send crash reports to help improve OpenWorship".
//!
//! Call [`enable()`] to initialise Sentry (reads DSN from the compile-time
//! `SENTRY_DSN` env var) and [`disable()`] to flush and shut down.
//! Both functions are idempotent and safe to call from any thread.

use std::sync::Mutex;

/// Holds the Sentry guard for the lifetime of the reporting session.
/// `None` means Sentry is not initialised.
static SENTRY_GUARD: Mutex<Option<sentry::ClientInitGuard>> = Mutex::new(None);

/// Enable Sentry crash reporting.
///
/// Reads the DSN from the compile-time `SENTRY_DSN` environment variable.
/// No-ops silently if the variable is absent (dev/CI), or if Sentry is
/// already initialised.
pub fn enable() {
    let dsn = match option_env!("SENTRY_DSN") {
        Some(d) if !d.is_empty() => d,
        _ => {
            eprintln!("[sentry] SENTRY_DSN not set at compile time — crash reporting unavailable");
            return;
        }
    };

    let mut guard = match SENTRY_GUARD.lock() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("[sentry] lock poisoned: {e}");
            return;
        }
    };

    if guard.is_some() {
        return; // Already initialised
    }

    let release = option_env!("CARGO_PKG_VERSION")
        .map(|v| format!("openworship@{v}").into());

    let client_guard = sentry::init((
        dsn,
        sentry::ClientOptions {
            release,
            // Never attach usernames or church names (privacy requirement).
            send_default_pii: false,
            ..sentry::ClientOptions::default()
        },
    ));

    // Panic capture is handled automatically by the `sentry-panic` integration
    // bundled via the `panic` feature flag on the `sentry` crate.

    *guard = Some(client_guard);
    eprintln!("[sentry] crash reporting enabled");
}

/// Disable Sentry crash reporting, flushing any queued events first.
pub fn disable() {
    let mut guard = match SENTRY_GUARD.lock() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("[sentry] lock poisoned on disable: {e}");
            return;
        }
    };
    if let Some(g) = guard.take() {
        sentry::end_session();
        drop(g);
        eprintln!("[sentry] crash reporting disabled");
    }
}

/// Returns `true` if Sentry is currently initialised.
pub fn is_enabled() -> bool {
    SENTRY_GUARD
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false)
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

/// Record a breadcrumb when STT transcription starts.
pub fn breadcrumb_stt_start() {
    if !is_enabled() {
        return;
    }
    sentry::add_breadcrumb(sentry::Breadcrumb {
        ty: "default".into(),
        category: Some("stt".into()),
        message: Some("STT started".into()),
        level: sentry::Level::Info,
        ..Default::default()
    });
}

/// Record a breadcrumb when STT transcription stops.
pub fn breadcrumb_stt_stop() {
    if !is_enabled() {
        return;
    }
    sentry::add_breadcrumb(sentry::Breadcrumb {
        ty: "default".into(),
        category: Some("stt".into()),
        message: Some("STT stopped".into()),
        level: sentry::Level::Info,
        ..Default::default()
    });
}

/// Record a breadcrumb when content is pushed to the display.
///
/// `kind` should be `"scripture"`, `"song"`, `"announcement"`, etc.
pub fn breadcrumb_display_push(kind: &str) {
    if !is_enabled() {
        return;
    }
    sentry::add_breadcrumb(sentry::Breadcrumb {
        ty: "default".into(),
        category: Some("display".into()),
        message: Some(format!("Pushed {kind} to display")),
        level: sentry::Level::Info,
        ..Default::default()
    });
}

/// Record a breadcrumb when songs are imported.
pub fn breadcrumb_song_import(count: usize) {
    if !is_enabled() {
        return;
    }
    sentry::add_breadcrumb(sentry::Breadcrumb {
        ty: "default".into(),
        category: Some("songs".into()),
        message: Some(format!("Imported {count} songs")),
        level: sentry::Level::Info,
        ..Default::default()
    });
}
