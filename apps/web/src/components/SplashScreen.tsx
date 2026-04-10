import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

const INIT_STAGES: { label: string; progress: number }[] = [
  { label: "Opening bible database", progress: 22 },
  { label: "Building search index", progress: 48 },
  { label: "Loading song library", progress: 70 },
  { label: "Preparing workspace", progress: 88 },
  { label: "Ready", progress: 100 },
];

// ms to linger on each stage before advancing
const STAGE_DELAYS = [280, 480, 460, 380];

interface SplashScreenProps {
  /** Set true when the backend has fully initialised and the app is ready. */
  isReady: boolean;
  /** Called after the exit animation completes so the parent can unmount. */
  onDone: () => void;
}

export function SplashScreen({ isReady, onDone }: SplashScreenProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [version, setVersion] = useState("0.3.0");
  const exitScheduled = useRef(false);

  // Load real version from Tauri (gracefully degrades in browser/test envs)
  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => {/* keep default */});
  }, []);

  // Advance through stages automatically
  useEffect(() => {
    if (stageIndex >= INIT_STAGES.length - 1) return;
    const delay = STAGE_DELAYS[stageIndex] ?? 400;
    const timer = setTimeout(
      () => setStageIndex((prev) => prev + 1),
      delay,
    );
    return () => clearTimeout(timer);
  }, [stageIndex]);

  // If isReady fires before we finish the animation, jump to the last stage
  useEffect(() => {
    if (isReady && stageIndex < INIT_STAGES.length - 1) {
      setStageIndex(INIT_STAGES.length - 1);
    }
  }, [isReady, stageIndex]);

  // Once we are at 100% AND the backend is ready, schedule the fade-out
  useEffect(() => {
    const atEnd = stageIndex >= INIT_STAGES.length - 1;
    if (!atEnd || !isReady || exitScheduled.current) return;
    exitScheduled.current = true;
    const hold = setTimeout(() => {
      setFading(true);
      const fade = setTimeout(onDone, 500);
      return () => clearTimeout(fade);
    }, 350);
    return () => clearTimeout(hold);
  }, [stageIndex, isReady, onDone]);

  const { label, progress } = INIT_STAGES[stageIndex];
  const isDone = progress >= 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
      style={{
        background: "#0a0a0a",
        transition: "opacity 500ms ease",
        opacity: fading ? 0 : 1,
      }}
    >
      {/* ── Centre: logo + name + progress ── */}
      <div className="flex flex-col items-center gap-5">
        <img
          src="/logo.svg"
          alt="OpenWorship"
          width={52}
          height={52}
          draggable={false}
        />

        <h1
          className="text-chalk text-lg tracking-[0.3em] font-light"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          openworship
        </h1>

        {/* Progress bar */}
        <div className="w-56">
          <div className="flex items-center justify-between mb-[6px]">
            <span
              className="text-ash text-[11px] tracking-widest uppercase truncate max-w-[9rem]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {label}
            </span>
            <span
              className="text-gold text-[11px] ml-2 tabular-nums"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {progress}%
            </span>
          </div>

          {/* Track */}
          <div className="h-px w-full overflow-hidden" style={{ background: "#2a2a2a" }}>
            <div
              className="h-px"
              style={{
                background: "#c9a84c",
                width: `${progress}%`,
                transition: "width 650ms ease-in-out",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom corners ── */}
      <div
        className="absolute bottom-7 left-8 right-8 flex items-end justify-between"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] tracking-wider uppercase" style={{ color: "#4a4a4a" }}>
            {isDone ? "Initialization complete" : "Initializing…"}
          </p>
          <p className="text-[10px]" style={{ color: "#4a4a4a" }}>
            © 2026 OpenWorship
          </p>
        </div>
        <p className="text-[10px]" style={{ color: "#4a4a4a" }}>
          Version {version}
        </p>
      </div>
    </div>
  );
}
