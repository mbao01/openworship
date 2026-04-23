import { useEffect, useRef, useState } from "react";
import { CheckIcon, CircleIcon } from "lucide-react";
import {
  getAudioLevel,
  listAudioInputDevices,
  getSttStatus,
  isSttActive,
} from "@/lib/commands/audio";
import {
  getDisplayWindowOpen,
  listMonitors,
} from "@/lib/commands/display-window";
import { listTranslations, pushToDisplay } from "@/lib/commands/content";
import { getActiveProject } from "@/lib/commands/projects";
import { detectInTranscript } from "@/lib/commands/detection";
import type { ServiceProject, ProjectItem, QueueItem } from "@/lib/types";

interface CheckItem {
  k: string;
  label: string;
  sub: string;
}

const CHECKLIST_INIT: CheckItem[] = [
  {
    k: "mic",
    label: "Microphone level checked",
    sub: "Check input device and gain",
  },
  {
    k: "display",
    label: "Display output connected",
    sub: "Projector or OBS browser source",
  },
  {
    k: "translation",
    label: "Default translation loaded",
    sub: "Offline cache ready",
  },
  {
    k: "internet",
    label: "Internet reachable (optional)",
    sub: "Online paraphrase match available",
  },
  { k: "song", label: "Closing song cued", sub: "Locally cached" },
  { k: "team", label: "Team notified", sub: "Shared link sent to volunteers" },
];

interface PreviewScreenProps {
  onGoLive?: () => void;
}

export function PreviewScreen({ onGoLive }: PreviewScreenProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    mic: false,
    display: false,
    translation: false,
    internet: false,
    song: false,
    team: false,
  });
  const [checklistSubs, setChecklistSubs] = useState<Record<string, string>>(
    {},
  );
  const [project, setProject] = useState<ServiceProject | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [micLevelDb, setMicLevelDb] = useState<string>("checking ...");
  const [projectorStatus, setProjectorStatus] = useState<{
    text: string;
    color: string;
  }>({
    text: "checking ...",
    color: "text-ink-2",
  });
  const [simulateText, setSimulateText] = useState("");
  const [detections, setDetections] = useState<QueueItem[]>([]);
  const [countdown, setCountdown] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = (k: string) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  const autoToggle = (k: string) => setChecks((c) => ({ ...c, [k]: true }));
  const updateSub = (k: string, sub: string) =>
    setChecklistSubs((s) => ({ ...s, [k]: sub }));

  const passed = Object.values(checks).filter(Boolean).length;
  const items: ProjectItem[] = project?.items ?? [];
  const currentItem = items[previewIndex] ?? null;

  // ── Auto-detect checklist on mount ──────────────────────────────────────────
  useEffect(() => {
    getAudioLevel()
      .then((l) => {
        if (l > 0.01) autoToggle("mic");
      })
      .catch((err) => console.error(err));

    listAudioInputDevices()
      .then((d) => {
        if (d.length > 0) {
          updateSub("mic", d[0].name);
        }
      })
      .catch((err) => console.error(err));

    getDisplayWindowOpen()
      .then((open) => {
        if (open) autoToggle("display");
      })
      .catch((err) => console.error(err));

    listMonitors()
      .then((m) => {
        if (m.length > 0) {
          const info = m
            .map((mon) => `${mon.name} ${mon.width}×${mon.height}`)
            .join(", ");
          updateSub("display", info);
        }
      })
      .catch((err) => console.error(err));

    listTranslations()
      .then((t) => {
        if (t.length > 0) {
          autoToggle("translation");
          updateSub("translation", t.map((tr) => tr.abbreviation).join(", "));
        }
      })
      .catch((err) => console.error(err));

    getSttStatus()
      .then((s) => {
        if (isSttActive(s)) autoToggle("internet");
      })
      .catch((err) => console.error(err));
  }, []);

  // ── Load active project on mount ────────────────────────────────────────────
  useEffect(() => {
    getActiveProject()
      .then(setProject)
      .catch((err) => console.error(err));
  }, []);

  // ── Countdown to scheduled_at_ms ──────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    const scheduledMs = project?.scheduled_at_ms;
    if (!scheduledMs) {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const diff = scheduledMs - Date.now();
      if (diff <= 0) {
        setCountdown("NOW");
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };

    tick();
    countdownRef.current = setInterval(tick, 1_000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [project?.scheduled_at_ms]);

  // ── Poll mic level every 500ms ──────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      getAudioLevel()
        .then((level) => {
          const db = Math.round(20 * Math.log10(Math.max(level, 0.0001)));
          setMicLevelDb(`${db} dB`);
        })
        .catch(() => setMicLevelDb("unavailable"));
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ── Check projector on mount ────────────────────────────────────────────────
  useEffect(() => {
    getDisplayWindowOpen()
      .then((open) => {
        setProjectorStatus(
          open
            ? { text: "connected", color: "text-success" }
            : { text: "not connected", color: "text-ink-3" },
        );
      })
      .catch(() => setProjectorStatus({ text: "error", color: "text-ink-3" }));
  }, []);

  // ── Step handlers ───────────────────────────────────────────────────────────
  const stepBack = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const stepForward = () => {
    const nextIdx = Math.min(items.length - 1, previewIndex + 1);
    setPreviewIndex(nextIdx);
    const item = items[nextIdx];
    if (item) {
      pushToDisplay(item.reference, item.text, item.translation).catch(
        () => {},
      );
    }
  };

  // ── Simulate speech ─────────────────────────────────────────────────────────
  const handleSimulate = () => {
    if (!simulateText.trim()) return;
    detectInTranscript(simulateText)
      .then(setDetections)
      .catch((err) => console.error(err));
  };

  // ── Resolve checklist sub-text ──────────────────────────────────────────────
  const resolveSub = (c: CheckItem) => checklistSubs[c.k] ?? c.sub;

  return (
    <>
      {/* Checklist panel */}
      <section className="flex w-[340px] shrink-0 flex-col overflow-hidden border-r border-line">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            Dry run ·{" "}
            <strong className="font-medium text-ink-2">checklist</strong>
          </span>
          <span className="font-mono text-[10px] text-accent">
            {passed} / {CHECKLIST_INIT.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {CHECKLIST_INIT.map((c) => (
            <div
              key={c.k}
              className="grid cursor-pointer grid-cols-[22px_1fr] items-start gap-3 border-b border-line px-4 py-3.5 hover:bg-bg-2"
              onClick={() => toggle(c.k)}
            >
              <div
                className={`mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded border text-[11px] font-bold ${
                  checks[c.k]
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-line-strong bg-transparent"
                }`}
              >
                {checks[c.k] ? (
                  <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  ""
                )}
              </div>
              <div>
                <div className="mb-0.5 text-[13px] text-ink">{c.label}</div>
                <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3 uppercase">
                  {resolveSub(c)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview stage */}
      <section className="flex flex-1 flex-col overflow-hidden bg-bg">
        <div className="flex items-center justify-between border-b border-line bg-bg-1 px-3.5 py-1.5 font-mono text-[9.5px] tracking-[0.12em] text-ink-3 uppercase">
          <span>
            <span className="mr-1.5 inline-block h-[5px] w-[5px] rounded-full bg-accent" />
            PREVIEW · NOT ON AIR · dry-run mode
          </span>
          <span>
            {countdown ? `STARTS IN · ${countdown}` : "NOT SCHEDULED"}
          </span>
        </div>

        <div
          className="flex flex-1 items-center justify-center p-5"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
          }}
        >
          <div
            className="relative flex aspect-video w-full max-w-[960px] flex-col justify-center border border-line-strong bg-[#050403] px-[72px] py-14 text-[#F5EFDF] opacity-[0.88]"
            style={{
              boxShadow:
                "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)",
            }}
          >
            <div className="absolute top-0 right-0 left-0 flex justify-between px-5 py-2.5 font-mono text-[9.5px] tracking-[0.18em] text-[rgba(245,239,223,0.5)] uppercase">
              <span className="inline-flex items-center gap-1">
                <CircleIcon className="h-3 w-3 shrink-0" /> PREVIEW · NOT LIVE
              </span>
              <span>openworship</span>
            </div>
            {currentItem ? (
              <>
                <div className="mb-5 font-mono text-[10.5px] tracking-[0.22em] text-accent uppercase">
                  {currentItem.reference} · {currentItem.translation}
                </div>
                <div className="text-left">
                  <h1 className="mb-5 font-serif text-[52px] leading-tight tracking-[-0.02em]">
                    {currentItem.text}
                  </h1>
                  <p className="text-[22px] text-[rgba(245,239,223,0.75)]">
                    Item {previewIndex + 1} of {items.length}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-5 font-mono text-[10.5px] tracking-[0.22em] text-ink-3 uppercase">
                  No active project
                </div>
                <div className="text-left">
                  <h1 className="mb-5 font-serif text-[52px] tracking-[-0.02em] text-[rgba(245,239,223,0.45)]">
                    No content cued
                  </h1>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-t border-line bg-bg-1 px-4 py-2.5">
          <div className="flex gap-1">
            <span className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent-soft px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] text-accent uppercase">
              <CircleIcon className="h-3 w-3 shrink-0" /> PREVIEW
            </span>
          </div>
          <div className="ml-1.5 flex gap-1 border-l border-line pl-2.5">
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] text-ink-2 uppercase hover:bg-bg-3 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={previewIndex <= 0}
              onClick={stepBack}
            >
              Step back
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-[11px] py-[7px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-accent-foreground uppercase disabled:cursor-not-allowed disabled:opacity-40"
              disabled={items.length === 0 || previewIndex >= items.length - 1}
              onClick={stepForward}
            >
              Step forward{" "}
              <kbd className="rounded-sm bg-black/20 px-1 py-px font-mono text-[8.5px] text-black/60">
                →
              </kbd>
            </button>
          </div>
          <div className="ml-1.5 flex gap-1 border-l border-line pl-2.5">
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] text-ink-2 uppercase hover:bg-bg-3"
              onClick={handleSimulate}
            >
              Simulate speech
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] text-ink-2 uppercase hover:bg-bg-3"
              onClick={() => {
                const now = Date.now();
                const fiveMin = 5 * 60 * 1000;
                setProject((prev) =>
                  prev ? { ...prev, scheduled_at_ms: now + fiveMin } : prev,
                );
              }}
            >
              Dry-run timer
            </button>
          </div>
          <div className="flex-1" />
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-[11px] py-[7px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-accent-foreground uppercase"
            onClick={() => onGoLive?.()}
          >
            Go live →
          </button>
        </div>
      </section>

      {/* Rehearsal signal panel */}
      <section className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-line">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            Rehearsal{" "}
            <strong className="font-medium text-ink-2">· signal</strong>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-[18px] py-4">
          <div className="mb-2.5 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            <CircleIcon className="h-3 w-3 shrink-0" fill="currentColor" />{" "}
            SIMULATED TRANSCRIPT
          </div>
          <div className="mb-4">
            <textarea
              className="h-24 w-full resize-none rounded border border-line bg-bg-1 p-2.5 font-serif text-sm leading-[1.6] text-ink-2 placeholder:text-muted placeholder:italic focus:border-accent focus:outline-none"
              placeholder="Paste sermon notes here to preview matches..."
              value={simulateText}
              onChange={(e) => setSimulateText(e.target.value)}
            />
            <button
              className="mt-1.5 w-full cursor-pointer rounded border border-line bg-bg-2 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] text-ink-2 uppercase hover:bg-bg-3 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!simulateText.trim()}
              onClick={handleSimulate}
            >
              Run detection
            </button>
          </div>

          {detections.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
                <CircleIcon className="h-3 w-3 shrink-0" fill="currentColor" />{" "}
                PREDICTED DETECTIONS ({detections.length})
              </div>
              <div className="grid gap-1.5">
                {detections.map((d) => (
                  <div
                    key={d.id}
                    className="rounded border border-line bg-bg-1 p-2.5"
                  >
                    <div className="mb-1 font-mono text-[10px] tracking-[0.06em] text-accent uppercase">
                      {d.reference} · {d.translation}
                      {d.confidence != null && (
                        <span className="ml-1.5 text-ink-3">
                          {Math.round(d.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="line-clamp-2 text-[12px] leading-[1.5] text-ink-2">
                      {d.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2.5 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            <CircleIcon className="h-3 w-3 shrink-0" fill="currentColor" /> ROOM
          </div>
          <div className="grid gap-2.5 rounded border border-line bg-bg-1 p-3.5">
            <RoomRow
              label="Mic level"
              value={micLevelDb}
              valueColor="text-ink-2"
            />
            <RoomRow
              label="Projector"
              value={projectorStatus.text}
              valueColor={projectorStatus.color}
            />
            <RoomRow
              label="Volunteers online"
              value="—"
              valueColor="text-ink-3"
            />
          </div>
        </div>
      </section>
    </>
  );
}

function RoomRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-ink-3">{label}</span>
      <span className={`font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
