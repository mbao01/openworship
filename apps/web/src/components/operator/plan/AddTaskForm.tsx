import { useState } from "react";

export function AddTaskForm({
  onAdd,
}: {
  onAdd: (title: string) => Promise<void>;
}) {
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
    <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
      <input
        className="flex-1 rounded border border-line bg-bg-2 px-3 py-2 text-sm text-ink"
        placeholder="Add a task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        type="submit"
        className="cursor-pointer rounded bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!title.trim() || submitting}
      >
        Add
      </button>
    </form>
  );
}
