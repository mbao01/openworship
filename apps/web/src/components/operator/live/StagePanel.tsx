import { CircleIcon } from "lucide-react";
import { useQueue } from "../../../hooks/use-queue";
import { useTranslations } from "../../../hooks/use-translations";
import { useDisplayBackground } from "../../../hooks/use-display-background";
import type { DetectionMode, QueueItem } from "../../../lib/types";
import { toastError } from "../../../lib/toast";
import { AssetRenderer } from "./AssetRenderer";
import { BackgroundPicker } from "./BackgroundPicker";

function StageBtn({ label, kbd, primary, onClick, disabled, danger }: {
  label: string;
  kbd?: string;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  let cls = "inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase border rounded transition-colors cursor-pointer";
  if (primary) {
    cls += " bg-accent text-accent-foreground border-accent font-semibold hover:bg-accent-hover";
  } else if (danger) {
    cls += " text-danger border-danger bg-bg-2 hover:bg-bg-3";
  } else {
    cls += " text-ink-2 border-line bg-bg-2 hover:bg-bg-3 hover:text-ink hover:border-line-strong";
  }
  if (disabled) cls += " opacity-40 pointer-events-none cursor-not-allowed";

  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {label}
      {kbd && (
        <kbd className={`font-mono text-[8.5px] px-1 py-px rounded-sm ${
          primary ? "bg-black/20 text-black/60" : "bg-bg-4 text-ink-3"
        }`}>
          {kbd}
        </kbd>
      )}
    </button>
  );
}

function DisplayScreen({
  label,
  labelColor,
  item,
  dimmed,
  backgroundValue,
}: {
  label: string;
  labelColor: string;
  item: QueueItem | null;
  dimmed?: boolean;
  backgroundValue?: string | null;
}) {
  const isSong = item?.kind === "song";
  const isLive = label === "LIVE";
  const marker = isLive ? (
    <CircleIcon className="w-3 h-3 shrink-0 inline" fill="currentColor" />
  ) : (
    <CircleIcon className="w-3 h-3 shrink-0 inline" />
  );
  const sublabel = isLive ? "ON SCREEN" : "CUED NEXT";

  return (
    <div
      className={`relative w-full aspect-video bg-[#050403] text-[#F5EFDF] px-11 py-8 flex flex-col justify-center border border-line-strong overflow-hidden ${
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
      {/* Background layer */}
      {backgroundValue && (
        <div className="absolute inset-0 z-0">
          {backgroundValue.startsWith("data:video/") ? (
            <video
              src={backgroundValue}
              autoPlay
              loop
              muted
              className="w-full h-full object-cover"
            />
          ) : backgroundValue.startsWith("data:image/") ||
            backgroundValue.startsWith("blob:") ? (
            <img
              src={backgroundValue}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: backgroundValue }}
            />
          )}
        </div>
      )}
      {/* Label bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 px-4 py-2 flex justify-between font-mono text-[9.5px] tracking-[0.18em] uppercase"
        style={{ color: dimmed ? labelColor : "rgba(245,239,223,0.5)" }}
      >
        <span className="inline-flex items-center gap-1">
          {marker} {label} · {sublabel}
        </span>
        <span>openworship</span>
      </div>

      {item ? (
        <div className="relative z-10">
          {item.image_url?.startsWith("artifact:") ? (
            <div className="w-full h-full flex items-center justify-center">
              <AssetRenderer
                artifactRef={item.image_url}
                filename={item.reference}
              />
            </div>
          ) : !isSong ? (
            <>
              <div
                className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-accent mb-3"
                style={dimmed ? { color: "rgba(201,167,106,0.6)" } : undefined}
              >
                {item.reference} · {item.translation}
              </div>
              <div
                className="font-serif italic leading-[1.35] tracking-[-0.01em] max-w-[48ch]"
                style={{
                  fontSize: "clamp(15px, 1.7vw, 22px)",
                  color: dimmed ? "rgba(245,239,223,0.72)" : "#F5EFDF",
                }}
              >
                &ldquo;{item.text}&rdquo;
              </div>
            </>
          ) : (
            <div
              className="font-serif text-center w-full"
              style={{ fontSize: "clamp(15px, 1.7vw, 22px)" }}
            >
              <div>{item.reference}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 font-mono text-[10px] tracking-[0.2em] uppercase text-center w-full text-[#3A332C]">
          — {isLive ? "no content" : "nothing cued"} —
        </div>
      )}
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

  // Resolve a background ID to its display value (CSS gradient or data URL).
  // For presets, use the value from the presets list. For artifacts, it will
  // be resolved when applied to live (backend sends resolved value to display).
  const allBgs = [...presets, ...uploaded];
  const resolveValue = (id: string | null) => {
    if (!id) return null;
    const found = allBgs.find((bg) => bg.id === id);
    return found?.value ?? null;
  };

  const liveBgValue = resolveValue(activeId);
  const previewBgValue = previewId ? resolveValue(previewId) : liveBgValue;

  return (
    <section className="flex-1 flex flex-col bg-bg overflow-hidden">
      {/* Note strip */}
      <div className="flex justify-between items-center px-3.5 py-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-ink-3 bg-bg-1 border-b border-line">
        <span>
          <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent mr-1.5" />
          {mode.toUpperCase()} MODE · listening · rolling 10s context
        </span>
        <span>DISPLAY OUTPUT</span>
      </div>

      {/* Dual display preview */}
      <div
        className="flex-1 p-4 flex items-center justify-center overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
        }}
      >
        <div className="w-full max-w-[760px] h-full flex flex-col gap-3.5 justify-center">
          {/* LIVE screen */}
          <DisplayScreen
            label="LIVE"
            labelColor="inherit"
            item={live}
            backgroundValue={liveBgValue}
          />
          {/* PREVIEW screen */}
          <DisplayScreen
            label="PREVIEW"
            labelColor="rgba(201,167,106,0.75)"
            item={pending}
            dimmed={Boolean(pending)}
            backgroundValue={previewBgValue}
          />
        </div>
      </div>

      {/* Stage toolbar */}
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
