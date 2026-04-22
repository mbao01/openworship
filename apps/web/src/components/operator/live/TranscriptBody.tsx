import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { MicOffIcon } from "lucide-react";
import { getSttStatus } from "../../../lib/commands/audio";
import type { TranscriptEvent } from "../../../lib/types";

export function TranscriptBody() {
  const [sentences, setSentences] = useState<string[]>([""]);
  const [micActive, setMicActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sentences]);

  // Poll STT status so we show "listening" even before the first transcript arrives
  useEffect(() => {
    getSttStatus()
      .then((s) => setMicActive(s === "running"))
      .catch(() => {});
    const id = setInterval(() => {
      getSttStatus()
        .then((s) => setMicActive(s === "running"))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<TranscriptEvent>("stt://transcript", (event) => {
      const evt = event.payload;
      setMicActive(evt.mic_active);
      setSentences((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = (updated[lastIdx] + " " + evt.text).trim();
        // If the text ends with sentence-ending punctuation, start a new sentence
        if (/[.?!]$/.test(evt.text.trim())) {
          updated.push("");
        }
        // Cap at 200 sentences to prevent unbounded memory growth
        if (updated.length > 200) {
          return updated.slice(updated.length - 200);
        }
        return updated;
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const nonEmpty = sentences.filter((s) => s.trim());

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5 font-serif text-[15px] leading-[1.65] tracking-[-0.003em]">
      {nonEmpty.map((sentence, i) => {
        const isActive =
          i === nonEmpty.length - 1 &&
          sentences[sentences.length - 1].trim() !== "";
        return (
          <p
            key={i}
            className={
              isActive
                ? "text-ink font-medium"
                : "text-ink-3"
            }
          >
            {sentence}
          </p>
        );
      })}
      {nonEmpty.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-muted italic">
          {micActive ? null : <MicOffIcon className="h-4 w-4" />}
          {"\u00B7"} {micActive ? "listening" : "mic off"} {"\u00B7"}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
