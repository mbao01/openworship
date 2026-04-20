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
      className="border border-line rounded-lg px-3.5 py-3 bg-bg-1 mt-3"
      onSubmit={handleSubmit}
    >
      <div className="text-[11px] text-ink-3 font-medium mb-2">
        Manual event
      </div>
      <div className="flex gap-2 items-end">
        <select
          className="px-2 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs"
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
          className="flex-1 px-2.5 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs"
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-16 px-2 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs"
          placeholder="min"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <button
          type="submit"
          className="px-3 py-[7px] bg-accent text-accent-foreground text-xs font-semibold rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!title.trim() || submitting}
        >
          Add
        </button>
      </div>
    </form>
  );
}
