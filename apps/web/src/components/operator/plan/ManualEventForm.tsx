import { useState } from "react";
import { ITEM_TYPES, TYPE_LABELS } from "./constants";

export function ManualEventForm({
  onAdd,
}: {
  onAdd: (
    itemType: string,
    title: string,
    durationMins: number | null,
  ) => Promise<void>;
}) {
  const [itemType, setItemType] = useState<string>("other");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const mins = parseInt(duration, 10);
      await onAdd(itemType, trimmed, !isNaN(mins) && mins > 0 ? mins : null);
      setTitle("");
      setDuration("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="mt-3 rounded-lg border border-line bg-bg-1 px-3.5 py-3"
      onSubmit={handleSubmit}
    >
      <div className="mb-2 text-[11px] font-medium text-ink-3">
        Manual event
      </div>
      <div className="flex items-end gap-2">
        <select
          className="rounded border border-line bg-bg-2 px-2 py-[7px] text-xs text-ink"
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          className="flex-1 rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink"
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-16 rounded border border-line bg-bg-2 px-2 py-[7px] text-xs text-ink"
          placeholder="min"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <button
          type="submit"
          className="cursor-pointer rounded bg-accent px-3 py-[7px] text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!title.trim() || submitting}
        >
          Add
        </button>
      </div>
    </form>
  );
}
