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
    <div className="group flex items-center gap-3 border-b border-line px-3.5 py-2.5 transition-colors last:border-b-0 hover:bg-bg-2">
      {/* Checkbox */}
      <button
        className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
          task.status === "done"
            ? "border-success bg-success text-white"
            : "border-line hover:border-accent"
        }`}
        onClick={onToggle}
        disabled={isReadOnly}
      >
        {task.status === "done" && (
          <CheckIcon className="h-2.5 w-2.5 shrink-0" />
        )}
      </button>

      {/* Title */}
      {editingTitle && !isReadOnly ? (
        <input
          ref={inputRef}
          className="flex-1 rounded border border-line bg-bg-2 px-1.5 py-0.5 text-[12.5px] text-ink"
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
          className={`flex-1 truncate text-[12.5px] ${
            isCancelled ? "text-muted line-through" : "text-ink"
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
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[task.status]}`}
      >
        {STATUS_LABELS[task.status]}
      </span>

      {/* Status dropdown */}
      {!isReadOnly && (
        <select
          className="cursor-pointer rounded border border-line bg-bg-2 px-1.5 py-0.5 text-[10px] text-ink-3"
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
          className="flex cursor-pointer items-center text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:text-danger"
          onClick={onDelete}
          title="Delete task"
        >
          <XIcon className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}
    </div>
  );
}
