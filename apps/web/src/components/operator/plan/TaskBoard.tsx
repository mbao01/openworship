import type { ServiceTask, TaskStatus } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CheckIcon, XIcon } from "lucide-react";
import { TASK_STATUSES, STATUS_LABELS, STATUS_STYLES } from "./constants";

export function TaskBoard({
  tasks,
  isReadOnly,
  onUpdateTask,
  onToggleTaskDone,
  onDeleteTask,
}: {
  tasks: ServiceTask[];
  isReadOnly: boolean;
  onUpdateTask: (
    taskId: string,
    updates: { title?: string; status?: TaskStatus },
  ) => Promise<void>;
  onToggleTaskDone: (task: ServiceTask) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tasksByStatus: Record<TaskStatus, ServiceTask[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    done: [],
    cancelled: [],
  };
  for (const task of tasks) {
    tasksByStatus[task.status].push(task);
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column (status string)
    if (TASK_STATUSES.includes(overId as TaskStatus)) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== overId) {
        await onUpdateTask(taskId, { status: overId as TaskStatus });
      }
      return;
    }

    // Dropped on another task -- move to that task's column
    const targetTask = tasks.find((t) => t.id === overId);
    const sourceTask = tasks.find((t) => t.id === taskId);
    if (targetTask && sourceTask && sourceTask.status !== targetTask.status) {
      await onUpdateTask(taskId, { status: targetTask.status });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => (
          <TaskBoardColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            isReadOnly={isReadOnly}
            onToggleTaskDone={onToggleTaskDone}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
    </DndContext>
  );
}

function TaskBoardColumn({
  status,
  tasks,
  isReadOnly,
  onToggleTaskDone,
  onDeleteTask,
}: {
  status: TaskStatus;
  tasks: ServiceTask[];
  isReadOnly: boolean;
  onToggleTaskDone: (task: ServiceTask) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] min-w-[170px] flex-1 flex-col rounded-lg border border-line bg-bg-1 ${
        isOver ? "inset-ring-1 ring-accent/40" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${STATUS_STYLES[status].split(" ")[1]}`}
        />
        <span className="text-[11px] font-medium text-ink">
          {STATUS_LABELS[status]}
        </span>
        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bg-3 px-1 text-[9px] font-semibold text-ink-3">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            isReadOnly={isReadOnly}
            onToggle={() => onToggleTaskDone(task)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableTaskCard({
  task,
  isReadOnly,
  onToggle,
  onDelete,
}: {
  task: ServiceTask;
  isReadOnly: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: isReadOnly,
    });
  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isReadOnly ? {} : listeners)}
      className={`group rounded border border-line bg-bg px-2.5 py-2 text-xs text-ink transition-shadow ${
        isDragging ? "shadow-lg" : "hover:shadow-sm"
      } ${!isReadOnly ? "cursor-grab" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          className={`mt-0.5 flex h-3 w-3 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
            task.status === "done"
              ? "border-success bg-success text-white"
              : "border-line hover:border-accent"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          disabled={isReadOnly}
        >
          {task.status === "done" && <CheckIcon className="h-2 w-2 shrink-0" />}
        </button>
        <span
          className={`line-clamp-2 flex-1 ${task.status === "cancelled" ? "text-muted line-through" : ""}`}
        >
          {task.title}
        </span>
        {!isReadOnly && (
          <button
            className="flex shrink-0 cursor-pointer items-center text-ink-3 opacity-0 transition-all group-hover:opacity-100 hover:text-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete task"
          >
            <XIcon className="h-3.5 w-3.5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
