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

function StageBtn({
  label,
  kbd,
  primary,
  onClick,
  disabled,
}: {
  label: string;
  kbd?: string;
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
    <button className={cls} onClick={onClick} disabled={disabled}>
      {label}
      {kbd && (
        <kbd className="font-mono text-[8.5px] px-1 py-px rounded-sm bg-bg-4 text-ink-3">
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
}: {
  item: QueueItem | null;
  backgroundValue?: string | null;
  dimmed?: boolean;
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
      className={`relative w-full aspect-video overflow-hidden border border-line-strong ${
        dimmed
          ? "opacity-[0.85] hover:opacity-[0.95] border-[rgba(201,167,106,0.35)]"
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
        />
      </div>
    </div>
  );
}

export function StagePanel({ mode }: { mode: DetectionMode }) {
  const { queue, live, approve, skip, clearLive, rejectLive } = useQueue();
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

  return (
    <section className="flex-1 flex flex-col bg-bg overflow-hidden">
      <div className="flex justify-between items-center px-3.5 py-2 h-[29px] font-mono text-[9.5px] tracking-[0.12em] uppercase text-ink-3 bg-bg-1 border-b border-line">
        <span>
          <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent mr-1.5" />
          {mode.toUpperCase()} MODE · listening · rolling 10s context
        </span>
        <span>DISPLAY OUTPUT</span>
      </div>

      <div
        className="flex-1 p-4 flex items-center justify-center overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
        }}
      >
        <div className="w-full max-w-[760px] h-full flex flex-col gap-3.5 justify-center">
          <ScaledPreview item={live} backgroundValue={liveBgValue} />
          <ScaledPreview
            item={pending}
            backgroundValue={previewBgValue}
            dimmed={Boolean(pending)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-line bg-bg-1 h-[52px] shrink-0">
        <div className="flex gap-1">
          <span className="relative inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-white bg-live border border-live rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-[blink_1.4s_infinite]" />
            LIVE
          </span>
        </div>
        <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
          <StageBtn
            primary
            label="Push next"
            kbd="Space"
            onClick={() =>
              pending &&
              approve(pending.id).catch(toastError("Failed to approve"))
            }
            disabled={!pending}
          />
          <StageBtn
            label="Skip"
            kbd="X"
            onClick={() =>
              pending && skip(pending.id).catch(toastError("Failed to skip"))
            }
            disabled={!pending}
          />
          <StageBtn
            label="Not this one"
            kbd="N"
            onClick={() => rejectLive().catch(toastError("Failed to reject"))}
          />
        </div>
        <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
          <StageBtn
            label="Black"
            kbd="B"
            onClick={() => clearLive().catch(toastError("Failed to clear"))}
          />
          <StageBtn
            label="Clear"
            onClick={() => clearLive().catch(toastError("Failed to clear"))}
          />
        </div>
        <div className="pl-2.5 ml-1.5 border-l border-line">
          <BackgroundPicker bg={bg} />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-2 border border-line rounded font-mono text-[10px] tracking-[0.1em] uppercase text-ink-2">
          Translation
          <select
            className="bg-transparent border-0 text-accent font-mono text-[10px] tracking-[0.1em] uppercase p-0 outline-0 cursor-pointer"
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
