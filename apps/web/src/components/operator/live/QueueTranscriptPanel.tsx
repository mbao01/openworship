import { useCallback, useEffect, useState } from "react";
import { MicIcon, MicOffIcon, SearchIcon } from "lucide-react";
import {
  startStt,
  stopStt,
  getSttStatus,
  isSttActive,
  sttFallbackReason,
} from "../../../lib/commands/audio";
import { useQueue } from "../../../hooks/use-queue";
import { toastError } from "../../../lib/toast";
import type { QueueItem } from "../../../lib/types";
import { QueueItemCard } from "./QueueItemCard";
import { ContextPanel } from "./ContextPanel";
import { TranscriptBody } from "./TranscriptBody";

// ── Demo queue item injected at tour step 4 ──────────────────────────────────

const DEMO_QUEUE_ITEM: QueueItem = {
  id: "demo-psalm-23-1",
  reference: "Psalm 23:1",
  text: "The Lord is my shepherd\u2026",
  translation: "ESV",
  status: "pending",
  confidence: 0.91,
  kind: "scripture",
  is_semantic: true,
  detected_at_ms: 0,
};

const DEMO_ITEM_IDS = new Set([DEMO_QUEUE_ITEM.id]);

// ─────────────────────────────────────────────────────────────────────────────

export function QueueTranscriptPanel({ visible: isVisible = true }: { visible?: boolean }) {
  const { queue, live, approve, skip } = useQueue();
  const [micActive, setMicActive] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [demoItems, setDemoItems] = useState<QueueItem[]>([]);

  // ── Demo queue injection from tour ────────────────────────────────────────

  useEffect(() => {
    const onInject = () => {
      setDemoItems([{ ...DEMO_QUEUE_ITEM, detected_at_ms: Date.now() }]);
    };
    const onClear = () => setDemoItems([]);
    window.addEventListener("tour:demo-queue-inject", onInject);
    window.addEventListener("tour:demo-queue-clear", onClear);
    return () => {
      window.removeEventListener("tour:demo-queue-inject", onInject);
      window.removeEventListener("tour:demo-queue-clear", onClear);
    };
  }, []);

  const handleDemoApprove = useCallback((id: string) => {
    setDemoItems((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleDemoReject = useCallback((id: string) => {
    setDemoItems((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // ── Merged list: live first, then demo, then pending queue ────────────────

  const visibleItems = [
    ...(live ? [live] : []),
    ...demoItems,
    ...queue,
  ].slice(0, 10);

  // ── STT status polling ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isVisible) return;
    const update = () =>
      getSttStatus()
        .then((s) => {
          setMicActive(isSttActive(s));
          setFallbackReason(sttFallbackReason(s));
        })
        .catch((err) => console.error(err));
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [isVisible]);

  const handleMicToggle = async () => {
    if (micActive) {
      await stopStt().catch((err) => console.error(err));
      setMicActive(false);
    } else {
      try {
        await startStt();
        setMicActive(true);
      } catch (e) {
        toastError("Failed to start microphone")(e);
      }
    }
  };

  return (
    <section className="flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-line">
      {/* Queue */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
          Queue ·{" "}
          <strong className="font-medium text-ink-2">AI-detected</strong>
        </span>
        <span className="font-mono text-[10px] text-ink-3">
          {visibleItems.length} items
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Queue items - equal third */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isDemo = DEMO_ITEM_IDS.has(item.id);
            return (
              <QueueItemCard
                key={item.id}
                item={item}
                isDemo={isDemo}
                onApprove={() => {
                  if (isDemo) {
                    handleDemoApprove(item.id);
                  } else {
                    approve(item.id).catch(toastError("Failed to approve"));
                  }
                }}
                onReject={() => {
                  if (isDemo) {
                    handleDemoReject(item.id);
                  } else {
                    skip(item.id).catch(toastError("Failed to reject"));
                  }
                }}
              />
            );
          })}
          {visibleItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-3.5 py-6 text-xs text-muted">
              <SearchIcon className="h-5 w-5" />
              No detections yet
            </div>
          )}
        </div>

        {/* Context panel - equal third */}
        <div className="flex min-h-0 flex-1 flex-col">
          <ContextPanel live={live} />
        </div>

        {/* Transcript header */}
        <div className="flex h-9 shrink-0 items-center justify-between border-t border-b border-line bg-bg-1 px-3.5">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            Transcript ·{" "}
            <strong className="font-medium text-ink-2">live</strong>
            {fallbackReason && (
              <span
                className="ml-1.5 rounded bg-yellow-500/15 px-1 py-0.5 font-mono text-[8px] font-bold tracking-[0.1em] text-yellow-600 uppercase"
                title={`Fallback to Whisper: ${fallbackReason}`}
              >
                whisper ↓
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              className={`cursor-pointer rounded border px-2 py-1 font-mono text-[9px] font-bold tracking-[0.1em] uppercase transition-colors ${
                micActive
                  ? "border-live/40 text-live hover:bg-live/10"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
              }`}
              onClick={handleMicToggle}
            >
              {micActive ? (
                <MicIcon className="mr-1 inline h-3 w-3 shrink-0" />
              ) : (
                <MicOffIcon className="mr-1 inline h-3 w-3 shrink-0" />
              )}
              {micActive ? "Stop" : "Start"}
            </button>
          </div>
        </div>

        {/* Transcript body - equal third */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TranscriptBody micActive={micActive} />
        </div>
      </div>
    </section>
  );
}
