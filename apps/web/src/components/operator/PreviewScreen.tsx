import { useEffect, useRef, useState } from "react";
import { CheckIcon, CircleIcon } from "lucide-react";
import { getAudioLevel, listAudioInputDevices, getSttStatus } from "@/lib/commands/audio";
import { getDisplayWindowOpen, listMonitors } from "@/lib/commands/display-window";
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
  { k: "mic", label: "Microphone level checked", sub: "Check input device and gain" },
  { k: "display", label: "Display output connected", sub: "Projector or OBS browser source" },
  { k: "translation", label: "Default translation loaded", sub: "Offline cache ready" },
  { k: "internet", label: "Internet reachable (optional)", sub: "Online paraphrase match available" },
  { k: "song", label: "Closing song cued", sub: "Locally cached" },
  { k: "team", label: "Team notified", sub: "Shared link sent to volunteers" },
];

interface PreviewScreenProps {
  onGoLive?: () => void;
}

export function PreviewScreen({ onGoLive }: PreviewScreenProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    mic: false, display: false, translation: false,
    internet: false, song: false, team: false,
  });
  const [checklistSubs, setChecklistSubs] = useState<Record<string, string>>({});
  const [project, setProject] = useState<ServiceProject | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [micLevelDb, setMicLevelDb] = useState<string>("checking\u2026");
  const [projectorStatus, setProjectorStatus] = useState<{ text: string; color: string }>({
    text: "checking\u2026", color: "text-ink-2",
  });
  const [simulateText, setSimulateText] = useState("");
  const [detections, setDetections] = useState<QueueItem[]>([]);
  const [countdown, setCountdown] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = (k: string) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  const autoToggle = (k: string) => setChecks((c) => ({ ...c, [k]: true }));
  const updateSub = (k: string, sub: string) => setChecklistSubs((s) => ({ ...s, [k]: sub }));

  const passed = Object.values(checks).filter(Boolean).length;
  const items: ProjectItem[] = project?.items ?? [];
  const currentItem = items[previewIndex] ?? null;

  // ── Auto-detect checklist on mount ──────────────────────────────────────────
  useEffect(() => {
    getAudioLevel()
      .then((l) => { if (l > 0.01) autoToggle("mic"); })
      .catch(() => {});

    listAudioInputDevices()
      .then((d) => {
        if (d.length > 0) {
          updateSub("mic", d[0].name);
        }
      })
      .catch(() => {});

    getDisplayWindowOpen()
      .then((open) => { if (open) autoToggle("display"); })
      .catch(() => {});

    listMonitors()
      .then((m) => {
        if (m.length > 0) {
          const info = m.map((mon) => `${mon.name} ${mon.width}×${mon.height}`).join(", ");
          updateSub("display", info);
        }
      })
      .catch(() => {});

    listTranslations()
      .then((t) => {
        if (t.length > 0) {
          autoToggle("translation");
          updateSub("translation", t.map((tr) => tr.abbreviation).join(", "));
        }
      })
      .catch(() => {});

    getSttStatus()
      .then((s) => { if (s === "running") autoToggle("internet"); })
      .catch(() => {});
  }, []);

  // ── Load active project on mount ────────────────────────────────────────────
  useEffect(() => {
    getActiveProject().then(setProject).catch(() => {});
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
      pushToDisplay(item.reference, item.text, item.translation).catch(() => {});
    }
  };

  // ── Simulate speech ─────────────────────────────────────────────────────────
  const handleSimulate = () => {
    if (!simulateText.trim()) return;
    detectInTranscript(simulateText)
      .then(setDetections)
      .catch(() => {});
  };

  // ── Resolve checklist sub-text ──────────────────────────────────────────────
  const resolveSub = (c: CheckItem) => checklistSubs[c.k] ?? c.sub;

  return (
    <>
      {/* Checklist panel */}
      <section className="flex flex-col w-[340px] shrink-0 border-r border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Dry run · <strong className="text-ink-2 font-medium">checklist</strong>
          </span>
          <span className="font-mono text-[10px] text-accent">{passed} / {CHECKLIST_INIT.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {CHECKLIST_INIT.map((c) => (
            <div
              key={c.k}
              className="grid grid-cols-[22px_1fr] gap-3 items-start px-4 py-3.5 border-b border-line cursor-pointer hover:bg-bg-2"
              onClick={() => toggle(c.k)}
            >
              <div
                className={`w-[18px] h-[18px] rounded-[3px] mt-0.5 border flex items-center justify-center text-[11px] font-bold ${
                  checks[c.k]
                    ? "bg-accent border-accent text-[#1A0D00]"
                    : "bg-transparent border-line-strong"
                }`}
              >
                {checks[c.k] ? <CheckIcon className="w-3.5 h-3.5 shrink-0" /> : ""}
              </div>
              <div>
                <div className="text-[13px] text-ink mb-0.5">{c.label}</div>
                <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3 uppercase">{resolveSub(c)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview stage */}
      <section className="flex-1 flex flex-col bg-bg overflow-hidden">
        <div className="flex justify-between items-center px-3.5 py-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-ink-3 bg-bg-1 border-b border-line">
          <span>
            <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent mr-1.5" />
            PREVIEW · NOT ON AIR · dry-run mode
          </span>
          <span>{countdown ? `STARTS IN · ${countdown}` : "NOT SCHEDULED"}</span>
        </div>

        <div className="flex-1 p-5 flex items-center justify-center" style={{
          background: "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
        }}>
          <div
            className="w-full max-w-[960px] aspect-video bg-[#050403] text-[#F5EFDF] px-[72px] py-14 flex flex-col justify-center relative border border-line-strong opacity-[0.88]"
            style={{ boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)" }}
          >
            <div className="absolute top-0 left-0 right-0 px-5 py-2.5 flex justify-between font-mono text-[9.5px] tracking-[0.18em] uppercase text-[rgba(245,239,223,0.5)]">
              <span className="inline-flex items-center gap-1"><CircleIcon className="w-3 h-3 shrink-0" /> PREVIEW · NOT LIVE</span>
              <span>openworship</span>
            </div>
            {currentItem ? (
              <>
                <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-accent mb-5">
                  {currentItem.reference} · {currentItem.translation}
                </div>
                <div className="text-left">
                  <h1 className="font-serif text-[52px] tracking-[-0.02em] mb-5 leading-tight">
                    {currentItem.text}
                  </h1>
                  <p className="text-[22px] text-[rgba(245,239,223,0.75)]">
                    Item {previewIndex + 1} of {items.length}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-3 mb-5">
                  No active project
                </div>
                <div className="text-left">
                  <h1 className="font-serif text-[52px] tracking-[-0.02em] mb-5 text-[rgba(245,239,223,0.45)]">
                    No content cued
                  </h1>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-line bg-bg-1 h-[52px] shrink-0">
          <div className="flex gap-1">
            <span className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-accent bg-accent-soft border border-accent rounded-[3px]">
              <CircleIcon className="w-3 h-3 shrink-0" /> PREVIEW
            </span>
          </div>
          <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
            <button
              className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3 disabled:opacity-40"
              disabled={previewIndex <= 0}
              onClick={stepBack}
            >
              Step back
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase bg-accent text-[#1A0D00] border border-accent rounded-[3px] font-semibold disabled:opacity-40"
              disabled={items.length === 0 || previewIndex >= items.length - 1}
              onClick={stepForward}
            >
              Step forward <kbd className="font-mono text-[8.5px] px-1 py-px bg-black/20 rounded-sm text-black/60">→</kbd>
            </button>
          </div>
          <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
            <button
              className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3"
              onClick={handleSimulate}
            >
              Simulate speech
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3"
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
            className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase bg-accent text-[#1A0D00] border border-accent rounded-[3px] font-semibold"
            onClick={() => onGoLive?.()}
          >
            Go live →
          </button>
        </div>
      </section>

      {/* Rehearsal signal panel */}
      <section className="flex flex-col w-[320px] shrink-0 border-l border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Rehearsal <strong className="text-ink-2 font-medium">· signal</strong>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-[18px] py-4">
          <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-2.5 inline-flex items-center gap-1">
            <CircleIcon className="w-3 h-3 shrink-0" fill="currentColor" /> SIMULATED TRANSCRIPT
          </div>
          <div className="mb-4">
            <textarea
              className="w-full h-24 bg-bg-1 border border-line rounded-[3px] p-2.5 font-serif text-sm leading-[1.6] text-ink-2 resize-none placeholder:text-muted placeholder:italic focus:outline-none focus:border-accent"
              placeholder="Paste sermon notes here to preview matches..."
              value={simulateText}
              onChange={(e) => setSimulateText(e.target.value)}
            />
            <button
              className="mt-1.5 w-full px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3 disabled:opacity-40"
              disabled={!simulateText.trim()}
              onClick={handleSimulate}
            >
              Run detection
            </button>
          </div>

          {detections.length > 0 && (
            <div className="mb-6">
              <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-2 inline-flex items-center gap-1">
                <CircleIcon className="w-3 h-3 shrink-0" fill="currentColor" /> PREDICTED DETECTIONS ({detections.length})
              </div>
              <div className="grid gap-1.5">
                {detections.map((d) => (
                  <div key={d.id} className="p-2.5 bg-bg-1 border border-line rounded-[3px]">
                    <div className="font-mono text-[10px] text-accent tracking-[0.06em] uppercase mb-1">
                      {d.reference} · {d.translation}
                      {d.confidence != null && (
                        <span className="ml-1.5 text-ink-3">{Math.round(d.confidence * 100)}%</span>
                      )}
                    </div>
                    <div className="text-[12px] text-ink-2 leading-[1.5] line-clamp-2">{d.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-2.5 inline-flex items-center gap-1">
            <CircleIcon className="w-3 h-3 shrink-0" fill="currentColor" /> ROOM
          </div>
          <div className="p-3.5 bg-bg-1 border border-line rounded-[3px] grid gap-2.5">
            <RoomRow label="Mic level" value={micLevelDb} valueColor="text-ink-2" />
            <RoomRow label="Projector" value={projectorStatus.text} valueColor={projectorStatus.color} />
            <RoomRow label="Volunteers online" value="—" valueColor="text-ink-3" />
          </div>
        </div>
      </section>
    </>
  );
}

function RoomRow({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-ink-3">{label}</span>
      <span className={`font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
