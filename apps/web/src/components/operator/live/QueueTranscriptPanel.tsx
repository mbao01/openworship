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
    getSttStatus().then(s => setMicActive(s === "running")).catch(() => {});
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
    <section className="flex flex-col w-[340px] shrink-0 border-l border-line overflow-hidden">
      {/* Queue */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Queue ·{" "}
          <strong className="text-ink-2 font-medium">AI-detected</strong>
        </span>
        <span className="font-mono text-[10px] text-ink-3">
          {visible.length} items
        </span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Queue items - equal third */}
        <div className="flex-1 min-h-0 overflow-y-auto">
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
            <div className="px-3.5 py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted">
              <SearchIcon className="w-5 h-5" />
              No detections yet
            </div>
          )}
        </div>

        {/* Context panel - equal third */}
        <div className="flex flex-col flex-1 min-h-0">
          <ContextPanel live={live} />
        </div>

        {/* Transcript header */}
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-t border-line border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Transcript ·{" "}
            <strong className="text-ink-2 font-medium">live</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              className={`px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase border rounded transition-colors cursor-pointer ${
                micActive
                  ? "text-live border-live/40 hover:bg-live/10"
                  : "text-ink-3 border-line hover:text-ink hover:border-line-strong"
              }`}
              onClick={handleMicToggle}
            >
              {micActive ? (
                <MicIcon className="w-3 h-3 shrink-0 inline mr-1" />
              ) : (
                <MicOffIcon className="w-3 h-3 shrink-0 inline mr-1" />
              )}
              {micActive ? "Stop" : "Start"}
            </button>
            <span className="font-mono text-[10px] text-ink-3">10s</span>
          </div>
        </div>

        {/* Transcript body - equal third */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TranscriptBody />
        </div>
      </div>
    </section>
  );
}
