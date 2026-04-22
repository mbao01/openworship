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
      <div data-qa="operator-col-left" className="flex">
        <LibraryPanel />
      </div>
      <div data-qa="operator-col-center" className="flex flex-1">
        <StagePanel mode={mode} />
      </div>
      <div data-qa="operator-col-right" className="flex">
        <QueueTranscriptPanel />
      </div>
    </>
  );
}
