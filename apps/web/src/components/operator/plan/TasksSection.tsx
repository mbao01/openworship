import { useState } from "react";
import { toastError } from "@/lib/toast";
import type { ServiceProject, ServiceTask, TaskStatus } from "@/lib/types";
import {
  createServiceTask,
  deleteServiceTask,
  updateServiceTask,
} from "@/lib/commands/projects";
import { KanbanIcon, ListIcon } from "lucide-react";
import { TASK_STATUSES, STATUS_LABELS } from "./constants";
import { TaskRow } from "./TaskRow";
import { TaskBoard } from "./TaskBoard";
import { AddTaskForm } from "./AddTaskForm";

export function TasksSection({
  project,
  isReadOnly,
  onProjectsChanged,
}: {
  project: ServiceProject;
  isReadOnly: boolean;
  onProjectsChanged: () => Promise<void>;
}) {
  const [taskFilter, setTaskFilter] = useState<TaskStatus | "all">("all");
  const [taskView, setTaskView] = useState<"list" | "board">("list");

  const handleCreateTask = async (title: string) => {
    try {
      await createServiceTask(project.id, title);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to create task")(e);
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    updates: { title?: string; status?: TaskStatus },
  ) => {
    try {
      await updateServiceTask(taskId, updates);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to update task")(e);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteServiceTask(taskId);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to delete task")(e);
    }
  };

  const handleToggleTaskDone = async (task: ServiceTask) => {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    await handleUpdateTask(task.id, { status: newStatus });
  };

  const filteredTasks =
    taskFilter === "all"
      ? project.tasks
      : project.tasks.filter((t) => t.status === taskFilter);

  const taskCounts = {
    all: project.tasks.length,
    backlog: project.tasks.filter((t) => t.status === "backlog").length,
    todo: project.tasks.filter((t) => t.status === "todo").length,
    in_progress: project.tasks.filter((t) => t.status === "in_progress").length,
    done: project.tasks.filter((t) => t.status === "done").length,
    cancelled: project.tasks.filter((t) => t.status === "cancelled").length,
  };

  return (
    <section className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] text-ink">
          Tasks
        </h2>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-bg-3 text-[10px] font-semibold text-ink-3">
          {project.tasks.length}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            className={`p-1.5 rounded border text-xs cursor-pointer transition-colors ${
              taskView === "list"
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-bg-2 text-ink-3 border-line hover:bg-bg-3"
            }`}
            onClick={() => setTaskView("list")}
            title="List view"
          >
            <ListIcon className="w-3.5 h-3.5 shrink-0" />
          </button>
          <button
            className={`p-1.5 rounded border text-xs cursor-pointer transition-colors ${
              taskView === "board"
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-bg-2 text-ink-3 border-line hover:bg-bg-3"
            }`}
            onClick={() => setTaskView("board")}
            title="Board view"
          >
            <KanbanIcon className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {taskView === "list" ? (
        <>
          {/* Filter pills */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(["all", ...TASK_STATUSES] as const).map((status) => {
              const count = taskCounts[status];
              const isActive = taskFilter === status;
              return (
                <button
                  key={status}
                  className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-accent text-accent-foreground border-accent font-semibold"
                      : "bg-bg-2 text-ink-3 border-line hover:bg-bg-3"
                  }`}
                  onClick={() => setTaskFilter(status)}
                >
                  {status === "all" ? "All" : STATUS_LABELS[status]}
                  {count > 0 && (
                    <span className="ml-1 opacity-70">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Task list */}
          <div className="border border-line rounded-lg overflow-hidden">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isReadOnly={isReadOnly}
                  onToggle={() => handleToggleTaskDone(task)}
                  onUpdate={(updates) => handleUpdateTask(task.id, updates)}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted flex flex-col items-center gap-2">
                <KanbanIcon className="w-5 h-5 text-muted/60" />
                {taskFilter === "all"
                  ? "No tasks yet."
                  : `No ${STATUS_LABELS[taskFilter as TaskStatus].toLowerCase()} tasks.`}
              </div>
            )}
          </div>
        </>
      ) : (
        <TaskBoard
          tasks={project.tasks}
          isReadOnly={isReadOnly}
          onUpdateTask={handleUpdateTask}
          onToggleTaskDone={handleToggleTaskDone}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {/* Add task form */}
      {!isReadOnly && <AddTaskForm onAdd={handleCreateTask} />}
    </section>
  );
}
