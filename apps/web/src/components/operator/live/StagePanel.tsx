import { useEffect, useRef, useState } from "react";
import { useQueue } from "../../../hooks/use-queue";
import { useTranslations } from "../../../hooks/use-translations";
import { useDisplayBackground } from "../../../hooks/use-display-background";
import {
  DisplayContent,
  REF_WIDTH,
  REF_HEIGHT,
  type DisplayContentEvent,
} from "../../display/DisplayContent";
import type { DetectionMode, QueueItem } from "../../../lib/types";
import { toastError } from "../../../lib/toast";
import { BackgroundPicker } from "./BackgroundPicker";
import {
  CircleIcon,
  PlayIcon,
  SkipForwardIcon,
  XIcon,
  EraserIcon,
} from "lucide-react";

function StageBtn({
  label,
  kbd,
  icon: Icon,
  primary,
  onClick,
  disabled,
}: {
  label: string;
  kbd?: string;
  icon?: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  let cls =
    "inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase border rounded transition-colors cursor-pointer";
  if (primary) {
    cls +=
      " bg-accent text-accent-foreground border-accent font-semibold hover:bg-accent-hover";
  } else {
    cls +=
      " text-ink-2 border-line bg-bg-2 hover:bg-bg-3 hover:text-ink hover:border-line-strong";
  }
  if (disabled) cls += " opacity-40 pointer-events-none cursor-not-allowed";

  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={label}>
      {Icon && <Icon className="block h-3 w-3 xl:hidden" />}
      <span className={Icon ? "hidden xl:inline" : ""}>{label}</span>
      {kbd && (
        <kbd className="rounded-sm bg-bg-4 px-1 py-px font-mono text-[8.5px] text-ink-3">
          {kbd}
        </kbd>
      )}
    </button>
  );
}

function toDisplayEvent(item: QueueItem | null): DisplayContentEvent | null {
  if (!item) return null;
  return {
    kind: item.kind ?? "scripture",
    reference: item.reference,
    text: item.text,
    translation: item.translation,
    image_url: item.image_url ?? undefined,
  };
}

/**
 * Scaled display preview — renders DisplayContent at 1920×1080 then
 * CSS-scales it down to fit the preview container. Pixel-perfect miniature.
 */
function ScaledPreview({
  item,
  backgroundValue,
  dimmed,
  label,
  sublabel,
}: {
  item: QueueItem | null;
  backgroundValue?: string | null;
  dimmed?: boolean;
  label: string;
  sublabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / REF_WIDTH);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video w-full overflow-hidden border border-line-strong ${
        dimmed
          ? "border-[rgba(201,167,106,0.35)] opacity-[0.85] hover:opacity-[0.95]"
          : ""
      }`}
      style={{
        boxShadow: dimmed
          ? "0 8px 24px -12px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.7)"
          : "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          width: REF_WIDTH,
          height: REF_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <DisplayContent
          content={toDisplayEvent(item)}
          backgroundValue={backgroundValue}
          showEmptyState
        />
      </div>
      {/* Label overlay — rendered at preview scale, not inside the 1920×1080 content */}
      <div
        className="absolute top-0 right-0 left-0 z-20 flex justify-between px-4 py-2 font-mono text-[9.5px] tracking-[0.18em] uppercase"
        style={{
          color: dimmed ? "rgba(201,167,106,0.75)" : "rgba(245,239,223,0.5)",
        }}
      >
        <span className="inline-flex items-center gap-1">
          {label === "LIVE" && (
            <CircleIcon className="h-2 w-2 shrink-0 animate-pulse fill-live" />
          )}
          {label} · {sublabel}
        </span>
        <span>openworship</span>
      </div>
    </div>
  );
}

export function StagePanel({ mode }: { mode: DetectionMode }) {
  const {
    queue,
    live,
    approve,
    skip,
    clearLive,
    rejectLive,
    blackout,
    toggleBlackout,
  } = useQueue();
  const {
    translations,
    active: activeTranslation,
    setActive: setActiveTranslation,
  } = useTranslations();
  const bg = useDisplayBackground();
  const { activeId, presets, uploaded, previewId } = bg;
  const pending = queue[0] ?? null;

  const allBgs = [...presets, ...uploaded];
  const resolveValue = (id: string | null) => {
    if (!id) return null;
    return allBgs.find((b) => b.id === id)?.value ?? null;
  };

  const liveBgValue = resolveValue(activeId);
  const previewBgValue = previewId ? resolveValue(previewId) : liveBgValue;

  // Keyboard shortcuts: Space→approve, X→skip, N→reject, B→blackout
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (pending)
            approve(pending.id).catch(toastError("Failed to approve"));
          break;
        case "x":
        case "X":
          if (pending) skip(pending.id).catch(toastError("Failed to skip"));
          break;
        case "n":
        case "N":
          rejectLive().catch(toastError("Failed to reject"));
          break;
        case "b":
        case "B":
          toggleBlackout().catch(toastError("Failed to toggle live"));
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, approve, skip, rejectLive, toggleBlackout]);

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex h-[29px] items-center justify-between border-b border-line bg-bg-1 px-3.5 py-2 font-mono text-[9.5px] tracking-[0.12em] text-ink-3 uppercase">
        <span>
          <span className="mr-1.5 inline-block h-[5px] w-[5px] rounded-full bg-accent" />
          {mode.toUpperCase()} MODE · listening · rolling 10s context
        </span>
        <span>DISPLAY OUTPUT</span>
      </div>

      <div
        className="flex flex-1 items-center justify-center gap-2 overflow-hidden p-4"
        style={{
          background:
            "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
        }}
      >
        <div className="flex h-full w-full max-w-[760px] flex-col justify-center gap-3.5">
          <ScaledPreview
            item={live}
            backgroundValue={liveBgValue}
            dimmed={blackout}
            label={blackout ? "OFF AIR" : "LIVE"}
            sublabel={blackout ? "BLACKED OUT" : "ON SCREEN"}
          />
          <ScaledPreview
            item={pending}
            backgroundValue={previewBgValue}
            dimmed={Boolean(pending)}
            label="PREVIEW"
            sublabel="CUED NEXT"
          />
        </div>
      </div>

      <div className="flex h-[52px] shrink-0 items-center gap-2.5 overflow-x-auto border-t border-line bg-bg-1 px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 gap-1">
          <button
            className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded border px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase transition-colors ${
              blackout
                ? "border-line bg-bg-2 text-ink-3 hover:bg-bg-3"
                : "border-live bg-live text-white"
            }`}
            onClick={() =>
              toggleBlackout().catch(toastError("Failed to toggle live"))
            }
            title={blackout ? "Turn live on (B)" : "Turn live off (B)"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                blackout ? "bg-ink-3" : "animate-[blink_1.4s_infinite] bg-white"
              }`}
            />
            <span className="hidden xl:inline">
              {blackout ? "OFF AIR" : "LIVE"}
            </span>
          </button>
        </div>
        <div className="ml-1.5 flex shrink-0 gap-1 border-l border-line pl-2.5">
          <StageBtn
            primary
            label="Push next"
            kbd="Space"
            icon={PlayIcon}
            onClick={() =>
              pending &&
              approve(pending.id).catch(toastError("Failed to approve"))
            }
            disabled={!pending}
          />
          <StageBtn
            label="Skip"
            kbd="X"
            icon={SkipForwardIcon}
            onClick={() =>
              pending && skip(pending.id).catch(toastError("Failed to skip"))
            }
            disabled={!pending}
          />
          <StageBtn
            label="Not this one"
            kbd="N"
            icon={XIcon}
            onClick={() => rejectLive().catch(toastError("Failed to reject"))}
          />
        </div>
        <div className="ml-1.5 flex shrink-0 gap-1 border-l border-line pl-2.5">
          <StageBtn
            label="Clear"
            icon={EraserIcon}
            onClick={() => clearLive().catch(toastError("Failed to clear"))}
          />
        </div>
        <div className="ml-1.5 shrink-0 border-l border-line pl-2.5">
          <BackgroundPicker bg={bg} />
        </div>
        <div className="min-w-2 flex-1" />
        <div className="flex shrink-0 items-center gap-2 rounded border border-line bg-bg-2 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-2 uppercase">
          <span className="hidden xl:inline">Translation</span>
          <select
            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] tracking-[0.1em] text-accent uppercase outline-0"
            value={activeTranslation}
            onChange={(e) =>
              setActiveTranslation(e.target.value).catch(
                toastError("Failed to switch translation"),
              )
            }
          >
            {translations.map((t) => (
              <option key={t.id} value={t.id} className="bg-bg-2">
                {t.abbreviation}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
