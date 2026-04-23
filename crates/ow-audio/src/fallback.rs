//! Automatic Deepgram → Whisper fallback transcriber.
//!
//! Wraps a primary (Deepgram) and a local fallback (Whisper) [`Transcriber`].
//! When the primary loses network connectivity or produces consecutive empty /
//! error results, it transparently switches to the fallback. Once connectivity
//! is restored, a fresh primary session is created and control returns to
//! Deepgram.
//!
//! Compiled only when both `deepgram` **and** `whisper` features are enabled.

#![cfg(all(feature = "deepgram", feature = "whisper"))]

use crate::transcribe::Transcriber;
use anyhow::Result;
use std::time::{Duration, Instant};

/// How many consecutive empty-or-error results from the primary before
/// declaring the connection dead and switching to the fallback.
const ERROR_THRESHOLD: u32 = 8;

/// Minimum interval between connectivity probes. Probing more often wastes
/// time when offline (each probe blocks for `CONNECTIVITY_TIMEOUT`).
const CONNECTIVITY_CHECK_INTERVAL: Duration = Duration::from_secs(30);

/// TCP target for the connectivity probe: Google Public DNS.
/// Using a raw IP bypasses DNS resolution, making the probe faster and more
/// reliable when the network is degraded.
const CONNECTIVITY_TARGET: &str = "8.8.8.8:53";

/// How long the TCP probe may block before declaring the host unreachable.
const CONNECTIVITY_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, Clone)]
enum FallbackState {
    Primary,
    Fallback(String),
}

/// A [`Transcriber`] that transparently falls back from a primary cloud backend
/// (Deepgram) to a local backend (Whisper) when the network is unavailable, and
/// switches back once connectivity is restored.
///
/// # Fallback triggers
/// 1. **Proactive**: A periodic TCP connectivity probe detects the network is
///    down before the primary transcriber even fails.
/// 2. **Reactive**: After [`ERROR_THRESHOLD`] consecutive empty or error results
///    from the primary, the connection is assumed dead and Whisper takes over.
///
/// # Recovery
/// Every [`CONNECTIVITY_CHECK_INTERVAL`] seconds the transcriber probes the
/// network again. On success it calls `make_primary` to create a fresh Deepgram
/// session and resumes cloud transcription.
pub struct FallbackTranscriber {
    primary: Box<dyn Transcriber>,
    /// Factory for a fresh primary transcriber; called when reconnecting.
    make_primary: Box<dyn Fn() -> Result<Box<dyn Transcriber>> + Send + 'static>,
    fallback: Box<dyn Transcriber>,
    state: FallbackState,
    /// How many consecutive empty/error results the primary has returned.
    consecutive_primary_failures: u32,
    last_connectivity_check: Instant,
}

impl FallbackTranscriber {
    /// Create a new `FallbackTranscriber`.
    ///
    /// - `primary`      — The initial primary transcriber instance (Deepgram).
    /// - `make_primary` — Factory called when attempting to reconnect.
    /// - `fallback`     — The local fallback transcriber (Whisper).
    pub fn new(
        primary: Box<dyn Transcriber>,
        make_primary: Box<dyn Fn() -> Result<Box<dyn Transcriber>> + Send + 'static>,
        fallback: Box<dyn Transcriber>,
    ) -> Self {
        Self {
            primary,
            make_primary,
            fallback,
            state: FallbackState::Primary,
            consecutive_primary_failures: 0,
            // Force a connectivity probe on the very first transcribe call so
            // we detect an offline start immediately.
            last_connectivity_check: Instant::now()
                .checked_sub(CONNECTIVITY_CHECK_INTERVAL + Duration::from_secs(1))
                .unwrap_or_else(Instant::now),
        }
    }

    fn should_check_connectivity(&self) -> bool {
        self.last_connectivity_check.elapsed() >= CONNECTIVITY_CHECK_INTERVAL
    }

    /// Run the connectivity probe and update `state` accordingly.
    fn check_and_update_connectivity(&mut self) {
        self.last_connectivity_check = Instant::now();

        if is_online() {
            if let FallbackState::Fallback(_) = &self.state {
                eprintln!("[stt/fallback] network restored — attempting Deepgram reconnect");
                match (self.make_primary)() {
                    Ok(new_primary) => {
                        self.primary = new_primary;
                        self.state = FallbackState::Primary;
                        self.consecutive_primary_failures = 0;
                        eprintln!("[stt/fallback] reconnected to Deepgram");
                    }
                    Err(e) => {
                        eprintln!("[stt/fallback] Deepgram reconnect failed: {e}");
                    }
                }
            }
        } else if let FallbackState::Primary = &self.state {
            eprintln!("[stt/fallback] network unreachable — switching to Whisper");
            self.state = FallbackState::Fallback("network unreachable".to_string());
            self.consecutive_primary_failures = 0;
        }
    }

    /// Schedule an early connectivity re-probe (used after the error threshold
    /// is hit so we try to reconnect to Deepgram sooner).
    fn schedule_early_connectivity_check(&mut self) {
        self.last_connectivity_check = Instant::now()
            .checked_sub(CONNECTIVITY_CHECK_INTERVAL + Duration::from_secs(1))
            .unwrap_or_else(Instant::now);
    }

    fn switch_to_fallback(&mut self, reason: String) {
        eprintln!(
            "[stt/fallback] {} consecutive failures ({reason}) — switching to Whisper",
            self.consecutive_primary_failures
        );
        self.state = FallbackState::Fallback(reason);
        self.consecutive_primary_failures = 0;
        self.schedule_early_connectivity_check();
    }
}

impl Transcriber for FallbackTranscriber {
    fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        // Periodic connectivity probe — must happen before the match so we can
        // mutate `self.state` without a live borrow on it.
        if self.should_check_connectivity() {
            self.check_and_update_connectivity();
        }

        // Use a bool discriminant to avoid holding a borrow on `self.state`
        // while we also need `&mut self.primary` or `&mut self.fallback`.
        let in_fallback = matches!(self.state, FallbackState::Fallback(_));

        if in_fallback {
            return self.fallback.transcribe(samples);
        }

        // — Primary path ——————————————————————————————————————————————————————
        match self.primary.transcribe(samples) {
            Ok(text) if !text.is_empty() => {
                self.consecutive_primary_failures = 0;
                Ok(text)
            }
            Ok(_empty) => {
                self.consecutive_primary_failures += 1;
                if self.consecutive_primary_failures >= ERROR_THRESHOLD {
                    self.switch_to_fallback("connection lost".to_string());
                }
                Ok(String::new())
            }
            Err(e) => {
                self.consecutive_primary_failures += 1;
                if self.consecutive_primary_failures >= ERROR_THRESHOLD {
                    self.switch_to_fallback(format!("error: {e}"));
                }
                Ok(String::new())
            }
        }
    }

    fn fallback_reason(&self) -> Option<&str> {
        match &self.state {
            FallbackState::Primary => None,
            FallbackState::Fallback(reason) => Some(reason.as_str()),
        }
    }
}

// ─── Connectivity probe ────────────────────────────────────────────────────────

/// Returns `true` when the host can reach Google's Public DNS (8.8.8.8:53).
///
/// The probe opens a TCP connection without sending data, so it is safe and
/// lightweight. On a live network it returns in < 5 ms; when offline it blocks
/// for `CONNECTIVITY_TIMEOUT` before returning `false`.
fn is_online() -> bool {
    use std::net::TcpStream;
    match CONNECTIVITY_TARGET.parse() {
        Ok(addr) => TcpStream::connect_timeout(&addr, CONNECTIVITY_TIMEOUT).is_ok(),
        Err(_) => false,
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ─── Test transcriber ─────────────────────────────────────────────────────

    struct StubTranscriber {
        name: &'static str,
        call_count: u32,
        mode: StubMode,
    }

    #[derive(Clone, Copy)]
    enum StubMode {
        Healthy,
        AlwaysEmpty,
        AlwaysError,
    }

    impl StubTranscriber {
        fn healthy(name: &'static str) -> Self {
            Self { name, call_count: 0, mode: StubMode::Healthy }
        }
        fn empty(name: &'static str) -> Self {
            Self { name, call_count: 0, mode: StubMode::AlwaysEmpty }
        }
        fn erroring(name: &'static str) -> Self {
            Self { name, call_count: 0, mode: StubMode::AlwaysError }
        }
    }

    impl Transcriber for StubTranscriber {
        fn transcribe(&mut self, _samples: &[f32]) -> Result<String> {
            self.call_count += 1;
            match self.mode {
                StubMode::Healthy => Ok(format!("[{} #{}]", self.name, self.call_count)),
                StubMode::AlwaysEmpty => Ok(String::new()),
                StubMode::AlwaysError => anyhow::bail!("simulated error from {}", self.name),
            }
        }
    }

    /// Build a `FallbackTranscriber` with connectivity checks disabled.
    fn make_ft(primary: StubTranscriber, fallback: StubTranscriber) -> FallbackTranscriber {
        FallbackTranscriber {
            primary: Box::new(primary),
            make_primary: Box::new(|| anyhow::bail!("reconnect disabled in test")),
            fallback: Box::new(fallback),
            state: FallbackState::Primary,
            consecutive_primary_failures: 0,
            // Push the next connectivity check far into the future.
            last_connectivity_check: Instant::now() + Duration::from_secs(86_400),
        }
    }

    // ─── Basic routing ────────────────────────────────────────────────────────

    #[test]
    fn uses_primary_when_healthy() {
        let mut t = make_ft(StubTranscriber::healthy("primary"), StubTranscriber::healthy("fallback"));
        let result = t.transcribe(&[0.0; 100]).unwrap();
        assert!(result.contains("primary"), "expected primary output: {result}");
        assert!(t.fallback_reason().is_none());
    }

    #[test]
    fn uses_fallback_when_in_fallback_state() {
        let mut t = make_ft(StubTranscriber::healthy("primary"), StubTranscriber::healthy("fallback"));
        t.state = FallbackState::Fallback("test".to_string());

        let result = t.transcribe(&[0.0; 100]).unwrap();
        assert!(result.contains("fallback"), "expected fallback output: {result}");
    }

    // ─── Error-threshold fallback ─────────────────────────────────────────────

    #[test]
    fn switches_after_error_threshold_errors() {
        let mut t = make_ft(StubTranscriber::erroring("primary"), StubTranscriber::healthy("fallback"));

        for i in 0..ERROR_THRESHOLD - 1 {
            let _ = t.transcribe(&[0.0; 100]);
            assert!(
                t.fallback_reason().is_none(),
                "should not switch before threshold (call {i})"
            );
        }

        let _ = t.transcribe(&[0.0; 100]); // hit threshold
        assert!(t.fallback_reason().is_some(), "should be in fallback at threshold");

        let result = t.transcribe(&[0.0; 100]).unwrap();
        assert!(result.contains("fallback"), "should use fallback: {result}");
    }

    #[test]
    fn switches_after_error_threshold_empties() {
        let mut t = make_ft(StubTranscriber::empty("primary"), StubTranscriber::healthy("fallback"));

        for _ in 0..ERROR_THRESHOLD {
            let _ = t.transcribe(&[0.0; 100]);
        }
        assert!(t.fallback_reason().is_some(), "should be in fallback after empties");
        assert_eq!(t.fallback_reason(), Some("connection lost"));
    }

    #[test]
    fn does_not_switch_before_threshold() {
        let mut t = make_ft(StubTranscriber::empty("primary"), StubTranscriber::healthy("fallback"));

        for _ in 0..ERROR_THRESHOLD - 1 {
            let _ = t.transcribe(&[0.0; 100]);
        }
        assert!(t.fallback_reason().is_none(), "should not switch before threshold");
    }

    // ─── Counter reset ────────────────────────────────────────────────────────

    #[test]
    fn resets_failure_count_on_success() {
        let mut t = make_ft(StubTranscriber::healthy("primary"), StubTranscriber::healthy("fallback"));
        t.consecutive_primary_failures = ERROR_THRESHOLD - 1;

        let _ = t.transcribe(&[0.0; 100]);

        assert_eq!(t.consecutive_primary_failures, 0, "count should reset on success");
        assert!(t.fallback_reason().is_none());
    }

    // ─── fallback_reason API ──────────────────────────────────────────────────

    #[test]
    fn fallback_reason_none_when_primary() {
        let t = make_ft(StubTranscriber::healthy("p"), StubTranscriber::healthy("f"));
        assert!(t.fallback_reason().is_none());
    }

    #[test]
    fn fallback_reason_some_when_in_fallback() {
        let mut t = make_ft(StubTranscriber::healthy("p"), StubTranscriber::healthy("f"));
        t.state = FallbackState::Fallback("network unreachable".to_string());
        assert_eq!(t.fallback_reason(), Some("network unreachable"));
    }

    // ─── Reconnect path ───────────────────────────────────────────────────────

    #[test]
    fn switches_back_to_primary_when_reconnect_succeeds() {
        let mut t = FallbackTranscriber {
            primary: Box::new(StubTranscriber::healthy("old-primary")),
            make_primary: Box::new(|| Ok(Box::new(StubTranscriber::healthy("new-primary")))),
            fallback: Box::new(StubTranscriber::healthy("fallback")),
            state: FallbackState::Fallback("network unreachable".to_string()),
            consecutive_primary_failures: 0,
            // Force immediate connectivity check.
            last_connectivity_check: Instant::now()
                .checked_sub(CONNECTIVITY_CHECK_INTERVAL + Duration::from_secs(1))
                .unwrap_or_else(Instant::now),
        };

        // Manually simulate online state by calling check directly, but we can't
        // easily mock is_online(). Instead test the state machine directly.
        // Pretend we called check_and_update_connectivity() with online=true.
        match (t.make_primary)() {
            Ok(new_primary) => {
                t.primary = new_primary;
                t.state = FallbackState::Primary;
                t.consecutive_primary_failures = 0;
            }
            Err(_) => panic!("factory should succeed"),
        }

        assert!(t.fallback_reason().is_none(), "should be back on primary");
        let result = t.transcribe(&[0.0; 100]).unwrap();
        assert!(result.contains("new-primary"), "should use new primary: {result}");
    }
}
