import { useState } from "react";

export function AddTaskForm({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed);
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex gap-2 mt-3" onSubmit={handleSubmit}>
      <input
        className="flex-1 px-3 py-2 bg-bg-2 border border-line rounded text-ink text-sm"
        placeholder="Add a task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        type="submit"
        className="px-3 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!title.trim() || submitting}
      >
        Add
      </button>
    </form>
  );
}
