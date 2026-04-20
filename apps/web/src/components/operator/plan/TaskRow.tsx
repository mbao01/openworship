import { useEffect, useRef, useState } from "react";
import type { ServiceTask, TaskStatus } from "@/lib/types";
import { CheckIcon, XIcon } from "lucide-react";
import { TASK_STATUSES, STATUS_LABELS, STATUS_STYLES } from "./constants";

export function TaskRow({
  task,
  isReadOnly,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: ServiceTask;
  isReadOnly: boolean;
  onToggle: () => void;
  onUpdate: (updates: { title?: string; status?: TaskStatus }) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) inputRef.current?.focus();
  }, [editingTitle]);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    } else {
      setTitleValue(task.title);
    }
  };

  const isCancelled = task.status === "cancelled";

  return (
    <div className="group flex items-center gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0 transition-colors hover:bg-bg-2">
      {/* Checkbox */}
      <button
        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
          task.status === "done"
            ? "bg-success border-success text-white"
            : "border-line hover:border-accent"
        }`}
        onClick={onToggle}
        disabled={isReadOnly}
      >
        {task.status === "done" && (
          <CheckIcon className="w-2.5 h-2.5 shrink-0" />
        )}
      </button>

      {/* Title */}
      {editingTitle && !isReadOnly ? (
        <input
          ref={inputRef}
          className="flex-1 px-1.5 py-0.5 bg-bg-2 border border-line rounded text-[12.5px] text-ink"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTitle();
            if (e.key === "Escape") {
              setTitleValue(task.title);
              setEditingTitle(false);
            }
          }}
        />
      ) : (
        <span
          className={`flex-1 text-[12.5px] truncate ${
            isCancelled ? "line-through text-muted" : "text-ink"
          } ${!isReadOnly ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (!isReadOnly) {
              setTitleValue(task.title);
              setEditingTitle(true);
            }
          }}
        >
          {task.title}
        </span>
      )}

      {/* Status badge */}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${STATUS_STYLES[task.status]}`}
      >
        {STATUS_LABELS[task.status]}
      </span>

      {/* Status dropdown */}
      {!isReadOnly && (
        <select
          className="px-1.5 py-0.5 bg-bg-2 border border-line rounded text-[10px] text-ink-3 cursor-pointer"
          value={task.status}
          onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}

      {/* Delete button */}
      {!isReadOnly && (
        <button
          className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger transition-all cursor-pointer flex items-center"
          onClick={onDelete}
          title="Delete task"
        >
          <XIcon className="w-3.5 h-3.5 shrink-0" />
        </button>
      )}
    </div>
  );
}
