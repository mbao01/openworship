import { useEffect, useState } from "react";
import { MicIcon, MicOffIcon, SearchIcon } from "lucide-react";
import { startStt, stopStt, getSttStatus } from "../../../lib/commands/audio";
import { useQueue } from "../../../hooks/use-queue";
import { toastError } from "../../../lib/toast";
import { QueueItemCard } from "./QueueItemCard";
import { ContextPanel } from "./ContextPanel";
import { TranscriptBody } from "./TranscriptBody";

export function QueueTranscriptPanel() {
  const { queue, live, approve, skip } = useQueue();
  const visible = [...(live ? [live] : []), ...queue].slice(0, 10);
  const [micActive, setMicActive] = useState(false);

  useEffect(() => {
    getSttStatus()
      .then((s) => setMicActive(s === "running"))
      .catch(() => {});
  }, []);

  const handleMicToggle = async () => {
    if (micActive) {
      await stopStt().catch(() => {});
      setMicActive(false);
    } else {
      await startStt().catch(() => {});
      setMicActive(true);
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
          {visible.length} items
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Queue items - equal third */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              onApprove={() =>
                approve(item.id).catch(toastError("Failed to approve"))
              }
              onReject={() =>
                skip(item.id).catch(toastError("Failed to reject"))
              }
            />
          ))}
          {visible.length === 0 && (
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
          </span>
          <div className="flex items-center gap-2">
            <button
              className={`cursor-pointer rounded border px-2 py-1 font-mono text-[9px] font-bold tracking-[0.1em] uppercase transition-colors ${
                micActive
                  ? "border-live/40 text-live hover:bg-live/10"
                  : "bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
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
          <TranscriptBody />
        </div>
      </div>
    </section>
  );
}
