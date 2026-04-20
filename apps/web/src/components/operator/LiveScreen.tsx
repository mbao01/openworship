import type { DetectionMode } from "../../lib/types";
import { LibraryPanel } from "./live/LibraryPanel";
import { StagePanel } from "./live/StagePanel";
import { QueueTranscriptPanel } from "./live/QueueTranscriptPanel";

interface LiveScreenProps {
  mode: DetectionMode;
}

export function LiveScreen({ mode }: LiveScreenProps) {
  return (
    <>
      <LibraryPanel />
      <StagePanel mode={mode} />
      <QueueTranscriptPanel />
    </>
  );
}
