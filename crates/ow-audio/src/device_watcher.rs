//! Audio device hot-plug watcher.
//!
//! On macOS the watcher registers a CoreAudio property listener so the OS
//! calls back immediately when the device list changes — zero polling.
//! On all other platforms it falls back to a 2-second cpal poll that only
//! fires when the set of input device names actually differs.
//!
//! Usage:
//! ```no_run
//! ow_audio::start_device_watcher(|| println!("devices changed"));
//! ```

use std::sync::Arc;

type ChangedFn = Arc<dyn Fn() + Send + Sync + 'static>;

/// Start the audio device hot-plug watcher.
///
/// `on_changed` is invoked on the tokio runtime whenever input devices are
/// added or removed.  It is wrapped in an `Arc` internally so the same
/// closure can be shared across the notification path and the poll fallback.
///
/// This function spawns async tasks and returns immediately.
pub fn start_device_watcher<F>(on_changed: F)
where
    F: Fn() + Send + Sync + 'static,
{
    let on_changed: ChangedFn = Arc::new(on_changed);

    #[cfg(target_os = "macos")]
    {
        if start_coreaudio(Arc::clone(&on_changed)) {
            return;
        }
        // CoreAudio registration failed — fall through to the poll loop below.
    }

    start_poll_fallback(on_changed);
}

// ─── macOS CoreAudio implementation ──────────────────────────────────────────

#[cfg(target_os = "macos")]
mod macos_impl {
    use std::os::raw::c_void;
    use std::sync::{Arc, OnceLock};

    use coreaudio_sys::{
        AudioObjectAddPropertyListener, AudioObjectID, AudioObjectPropertyAddress,
        OSStatus,
        kAudioHardwarePropertyDevices, kAudioObjectPropertyElementMain,
        kAudioObjectPropertyScopeGlobal, kAudioObjectSystemObject,
    };
    use tokio::sync::Notify;

    /// Global bridge between the CoreAudio C callback and tokio.
    static DEVICES_NOTIFY: OnceLock<Arc<Notify>> = OnceLock::new();

    /// CoreAudio property listener callback (runs on a CoreAudio dispatch thread).
    unsafe extern "C" fn on_devices_changed(
        _obj: AudioObjectID,
        _num_addrs: u32,
        _addrs: *const AudioObjectPropertyAddress,
        _client: *mut c_void,
    ) -> OSStatus {
        if let Some(n) = DEVICES_NOTIFY.get() {
            n.notify_one();
        }
        0 // noErr
    }

    /// Register the CoreAudio listener.  Returns `true` on success.
    pub(super) fn register(on_changed: super::ChangedFn) -> bool {
        let notify = Arc::new(Notify::new());

        // If the global is already set (e.g. hot-reload in dev), just return
        // true; the existing listener is still active.
        if DEVICES_NOTIFY.set(notify.clone()).is_err() {
            return true;
        }

        // Spawn the relay task.
        tokio::spawn(async move {
            loop {
                notify.notified().await;
                on_changed();
            }
        });

        // Register the CoreAudio property listener.
        let addr = AudioObjectPropertyAddress {
            mSelector: kAudioHardwarePropertyDevices,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain,
        };
        let status = unsafe {
            AudioObjectAddPropertyListener(
                kAudioObjectSystemObject,
                &addr,
                Some(on_devices_changed),
                std::ptr::null_mut(),
            )
        };

        if status == 0 {
            eprintln!("[device-watcher] CoreAudio kAudioHardwarePropertyDevices listener registered");
            true
        } else {
            eprintln!(
                "[device-watcher] AudioObjectAddPropertyListener failed (status={status}), falling back to poll"
            );
            false
        }
    }
}

#[cfg(target_os = "macos")]
fn start_coreaudio(on_changed: ChangedFn) -> bool {
    macos_impl::register(on_changed)
}

// ─── Polling fallback (non-macOS / CoreAudio failure) ─────────────────────────

fn start_poll_fallback(on_changed: Arc<dyn Fn() + Send + Sync + 'static>) {
    use crate::list_input_devices;

    tokio::spawn(async move {
        let mut prev: Vec<String> = list_input_devices()
            .unwrap_or_default()
            .into_iter()
            .map(|d| d.name)
            .collect();

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            let current: Vec<String> = list_input_devices()
                .unwrap_or_default()
                .into_iter()
                .map(|d| d.name)
                .collect();
            if current != prev {
                on_changed();
                prev = current;
            }
        }
    });
}
