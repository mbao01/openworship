import { useRef, useState } from "react";
import { toastError } from "@/lib/toast";
import type { ProjectItem } from "@/lib/types";
import { linkAssetToItem, uploadAndLinkAsset } from "@/lib/commands/projects";
import { PaperclipIcon } from "lucide-react";
import { ITEM_TYPES, TYPE_LABELS } from "./constants";

export function ExpandedItemDetail({
  item,
  isReadOnly,
  onUpdate,
  onProjectsChanged,
}: {
  item: ProjectItem;
  isReadOnly: boolean;
  onUpdate: (updates: {
    duration_secs?: number | null;
    notes?: string | null;
    item_type?: string;
  }) => void;
  onProjectsChanged: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [durationMins, setDurationMins] = useState(
    item.duration_secs ? String(Math.round(item.duration_secs / 60)) : "",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNotesBlur = () => {
    const trimmed = notes.trim();
    const current = item.notes ?? "";
    if (trimmed !== current) {
      onUpdate({ notes: trimmed || null });
    }
  };

  const handleDurationBlur = () => {
    const mins = parseInt(durationMins, 10);
    const newSecs = !isNaN(mins) && mins > 0 ? mins * 60 : null;
    if (newSecs !== item.duration_secs) {
      onUpdate({ duration_secs: newSecs });
    }
  };

  const handleTypeChange = (newType: string) => {
    if (newType !== item.item_type) {
      onUpdate({ item_type: newType });
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      await uploadAndLinkAsset(item.id, file.name, data);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to upload asset")(e);
    }
  };

  return (
    <div
      className="border-t border-line bg-bg-1 px-6 py-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 grid grid-cols-2 gap-4">
        {/* Duration input */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink-3">
            Duration (minutes)
          </label>
          <input
            className="w-full rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink"
            value={durationMins}
            onChange={(e) => setDurationMins(e.target.value)}
            onBlur={handleDurationBlur}
            placeholder="e.g. 5"
            disabled={isReadOnly}
          />
        </div>

        {/* Type selector */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink-3">
            Type
          </label>
          <select
            className="w-full rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink"
            value={item.item_type}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={isReadOnly}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="mb-1 block text-[11px] font-medium text-ink-3">
          Notes
        </label>
        <textarea
          className="min-h-[60px] w-full resize-y rounded border border-line bg-bg-2 px-2.5 py-2 text-xs text-ink"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes for this item..."
          disabled={isReadOnly}
        />
      </div>

      {/* Assets */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
            <PaperclipIcon className="h-3.5 w-3.5 shrink-0" />{" "}
            {item.asset_ids.length} asset
            {item.asset_ids.length !== 1 ? "s" : ""}
          </span>
          {!isReadOnly && (
            <div className="flex gap-2">
              <button
                className="cursor-pointer rounded border border-accent px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent-soft"
                onClick={() => {
                  // Attach by linking an existing artifact ID via prompt
                  const artifactId = window.prompt(
                    "Enter artifact ID to attach:",
                  );
                  if (artifactId?.trim()) {
                    linkAssetToItem(item.id, artifactId.trim())
                      .then(() => onProjectsChanged())
                      .catch(toastError("Failed to attach asset"));
                  }
                }}
              >
                Attach
              </button>
              <button
                className="cursor-pointer rounded border border-accent px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent-soft"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>
        {item.asset_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.asset_ids.map((id) => (
              <span
                key={id}
                className="inline-flex items-center rounded border border-line bg-bg-2 px-2 py-0.5 font-mono text-[10px] text-ink-3"
              >
                {id.slice(0, 8)}...
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
