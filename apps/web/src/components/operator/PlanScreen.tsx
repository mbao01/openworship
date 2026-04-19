import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toastError } from "@/lib/toast";
import type {
  AudioSettings,
  EmailSettings,
  ProjectItem,
  ServiceProject,
  ServiceTask,
  TaskStatus,
  TranslationInfo,
  VerseResult,
} from "@/lib/types";
import {
  searchScriptures,
  listTranslations,
  getActiveTranslation,
  switchLiveTranslation,
} from "@/lib/commands/content";
import {
  addItemToActiveProject,
  createServiceProject,
  createServiceTask,
  deleteServiceProject,
  deleteServiceTask,
  linkAssetToItem,
  listServiceProjects,
  removeItemFromActiveProject,
  reorderActiveProjectItems,
  updateProjectItem,
  updateServiceProject,
  updateServiceTask,
  uploadAndLinkAsset,
} from "@/lib/commands/projects";
import {
  getAudioSettings,
  setAudioSettings,
  getEmailSettings,
  setEmailSettings,
} from "@/lib/commands/settings";
import { Toggle } from "../ui/toggle";
import { ConfirmDialog } from "../ui/confirm-dialog";
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
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2Icon } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────────

const TYPE_GLYPHS: Record<string, string> = {
  song: "\u266A",
  scripture: "\u00A7",
  prayer: "\u2307",
  announcement: "\u2761",
  sermon: "\u270E",
  other: "\u25C6",
};

const ITEM_TYPES = ["song", "scripture", "prayer", "announcement", "sermon", "other"] as const;

const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "done", "cancelled"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: "text-muted bg-bg-3",
  todo: "text-ink-3 bg-bg-2",
  in_progress: "text-accent bg-accent-soft",
  done: "text-success bg-success/10",
  cancelled: "text-danger bg-danger/10",
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatComputedTime(baseMs: number, cumulativeSecs: number): string {
  const d = new Date(baseMs + cumulativeSecs * 1000);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDuration(secs: number): string {
  return `${Math.round(secs / 60)}m`;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function PlanScreen() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceProject | null>(null);

  // Settings state
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [activeTranslation, setActiveTranslation] = useState("ESV");
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings | null>(
    null,
  );
  const [emailSettings, setEmailSettingsState] = useState<EmailSettings | null>(
    null,
  );

  const loadProjects = useCallback(async () => {
    try {
      const all = await listServiceProjects();
      setProjects(all);
      // Auto-select the first open project if nothing is selected
      if (!selectedId && all.length > 0) {
        const firstOpen = all.find((p) => p.closed_at_ms === null);
        setSelectedId(firstOpen?.id ?? all[0].id);
      }
    } catch (e) {
      toastError("Failed to load projects")(e);
    }
  }, [selectedId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ServiceProject>("service://project-updated", () => {
      loadProjects();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [loadProjects]);

  // Load settings on mount
  useEffect(() => {
    Promise.all([listTranslations(), getActiveTranslation()])
      .then(([list, active]) => {
        setTranslations(list);
        setActiveTranslation(active);
      })
      .catch(() => {});
    getAudioSettings()
      .then(setAudioSettingsState)
      .catch(() => {});
    getEmailSettings()
      .then(setEmailSettingsState)
      .catch(() => {});
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;
  const isReadOnly = selectedProject?.closed_at_ms !== null;

  // Sort: open projects first (desc by created_at_ms), then closed (desc)
  const sortedProjects = [...projects].sort((a, b) => {
    const aOpen = a.closed_at_ms === null;
    const bOpen = b.closed_at_ms === null;
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return b.created_at_ms - a.created_at_ms;
  });

  const handleCreate = async (name: string) => {
    try {
      const p = await createServiceProject(name || "Untitled service");
      setShowNewForm(false);
      setSelectedId(p.id);
      await loadProjects();
    } catch (e) {
      toastError("Failed to create service")(e);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteServiceProject(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      await loadProjects();
    } catch (e) {
      toastError("Failed to delete service")(e);
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Left Panel: Service List */}
      <div className="flex flex-col w-[280px] bg-bg-1 border-r border-line shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-base font-normal tracking-[-0.01em] text-ink">
              Services
            </h2>
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-bg-3 text-[10px] font-semibold text-ink-3">
              {projects.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedProjects.map((p) => {
            const isOpen = p.closed_at_ms === null;
            const isSelected = p.id === selectedId;
            return (
              <button
                key={p.id}
                className={`w-full text-left px-4 py-3 border-b border-line transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-accent-soft border-l-2 border-l-accent"
                    : "hover:bg-bg-2 border-l-2 border-l-transparent"
                }`}
                onClick={() => setSelectedId(p.id)}
              >
                <div className="flex items-center gap-2 mb-1 group/row">
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                      isOpen ? "bg-success" : "bg-bg-4"
                    }`}
                  />
                  <span
                    className={`text-[13px] font-medium truncate flex-1 ${
                      isOpen ? "text-ink" : "text-muted"
                    }`}
                  >
                    {p.name || "Untitled service"}
                  </span>
                  <span
                    className="opacity-0 group-hover/row:opacity-100 text-ink-3 hover:text-danger text-sm transition-all cursor-pointer shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    title="Delete service"
                  >
                    <Trash2Icon className="w-3 h-3 shrink-0" />
                  </span>
                </div>
                <div
                  className={`text-[11px] pl-4 ${isOpen ? "text-ink-3" : "text-muted"}`}
                >
                  {formatDate(p.created_at_ms)}
                  <span className="mx-1.5">{"\u00B7"}</span>
                  {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                  <span className="mx-1.5">{"\u00B7"}</span>
                  {p.tasks.length} task{p.tasks.length !== 1 ? "s" : ""}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-line">
          {showNewForm ? (
            <NewServiceForm
              onCreate={handleCreate}
              onCancel={() => setShowNewForm(false)}
            />
          ) : (
            <button
              className="w-full px-3 py-2 text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00] cursor-pointer"
              onClick={() => setShowNewForm(true)}
            >
              + New service
            </button>
          )}
        </div>
      </div>

      {/* Right Panel: Service Detail */}
      <div className="flex-1 overflow-y-auto bg-bg">
        {selectedProject ? (
          <ServiceDetail
            project={selectedProject}
            isReadOnly={isReadOnly}
            onProjectsChanged={loadProjects}
            translations={translations}
            activeTranslation={activeTranslation}
            setActiveTranslation={setActiveTranslation}
            audioSettings={audioSettings}
            setAudioSettingsState={setAudioSettingsState}
            emailSettings={emailSettings}
            setEmailSettingsState={setEmailSettingsState}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            {projects.length === 0
              ? "No services yet. Create one to get started."
              : "Select a service from the list."}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete service?"
        description={`This will permanently delete "${deleteTarget?.name || "Untitled service"}" and all its items and tasks. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Service Detail ─────────────────────────────────────────────────────────────

function ServiceDetail({
  project,
  isReadOnly,
  onProjectsChanged,
  translations,
  activeTranslation,
  setActiveTranslation,
  audioSettings,
  setAudioSettingsState,
  emailSettings,
  setEmailSettingsState,
}: {
  project: ServiceProject;
  isReadOnly: boolean;
  onProjectsChanged: () => Promise<void>;
  translations: TranslationInfo[];
  activeTranslation: string;
  setActiveTranslation: (v: string) => void;
  audioSettings: AudioSettings | null;
  setAudioSettingsState: (v: AudioSettings) => void;
  emailSettings: EmailSettings | null;
  setEmailSettingsState: (v: EmailSettings) => void;
}) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskStatus | "all">("all");
  const [taskView, setTaskView] = useState<"list" | "board">("list");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const items = [...project.items].sort((a, b) => a.position - b.position);

  // ── Order of Service handlers ──

  const handleRemove = async (itemId: string) => {
    try {
      await removeItemFromActiveProject(itemId);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to remove item")(e);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(
      items.map((i) => i.id),
      oldIndex,
      newIndex,
    );
    try {
      await reorderActiveProjectItems(newOrder);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to reorder")(e);
    }
  };

  const handleUpdateItem = async (
    itemId: string,
    updates: {
      duration_secs?: number | null;
      notes?: string | null;
      item_type?: string;
    },
  ) => {
    try {
      await updateProjectItem(itemId, updates);
      await onProjectsChanged();
    } catch (e) {
      toastError("Failed to update item")(e);
    }
  };

  // ── Task handlers ──

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

  // Filtered tasks
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
    <div className="px-10 py-8 w-full max-w-[960px]">
      {/* Project header */}
      <div className="mb-6 border border-line rounded-lg px-5 py-4 bg-bg-1">
        {/* Row 1: Name + date + created */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <EditableName
              name={project.name}
              isReadOnly={isReadOnly}
              onSave={async (newName) => {
                try {
                  await updateServiceProject(project.id, { name: newName });
                  await onProjectsChanged();
                } catch (e) {
                  toastError("Failed to rename service")(e);
                }
              }}
            />
          </div>
          <div className="shrink-0 flex items-center gap-3 pt-1">
            <input
              type="datetime-local"
              className="px-2 py-1 bg-bg-2 border border-line rounded-[3px] text-ink text-xs disabled:text-muted"
              value={(() => {
                const ms = project.scheduled_at_ms ?? project.created_at_ms;
                const d = new Date(ms);
                const pad = (n: number) => String(n).padStart(2, "0");
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
              })()}
              disabled={isReadOnly}
              onChange={(e) => {
                const ms = new Date(e.target.value).getTime();
                if (!isNaN(ms)) {
                  updateServiceProject(project.id, { scheduled_at_ms: ms })
                    .then(() => onProjectsChanged())
                    .catch(toastError("Failed to update date"));
                }
              }}
            />
            {isReadOnly && (
              <span className="text-muted text-[10px] italic">read-only</span>
            )}
          </div>
        </div>

        {/* Row 2: Description (compact) */}
        <EditableDescription
          value={project.description ?? ""}
          isReadOnly={isReadOnly}
          onSave={async (desc) => {
            try {
              await updateServiceProject(project.id, { description: desc });
              await onProjectsChanged();
            } catch (e) {
              toastError("Failed to update description")(e);
            }
          }}
        />

        {/* Row 3: Inline settings */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-ink-3 uppercase tracking-[0.06em]">
              Translation
            </span>
            <select
              className="px-1.5 py-0.5 bg-bg-2 border border-line rounded-[3px] text-ink text-[11px]"
              value={activeTranslation}
              onChange={(e) => {
                const value = e.target.value;
                switchLiveTranslation(value)
                  .then(() => setActiveTranslation(value))
                  .catch(() => {});
              }}
            >
              {translations.map((t) => (
                <option key={t.id} value={t.abbreviation}>
                  {t.abbreviation}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-ink-3 uppercase tracking-[0.06em]">
              Context
            </span>
            <select
              className="px-1.5 py-0.5 bg-bg-2 border border-line rounded-[3px] text-ink text-[11px]"
              value={audioSettings?.semantic_threshold_auto ?? 10}
              onChange={(e) => {
                if (!audioSettings) return;
                const value = Number(e.target.value);
                const updated = {
                  ...audioSettings,
                  semantic_threshold_auto: value,
                };
                setAudioSettings(updated)
                  .then(() => setAudioSettingsState(updated))
                  .catch(() => {});
              }}
            >
              <option value={8}>8s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Toggle
              checked={emailSettings?.auto_send ?? false}
              onCheckedChange={() => {
                if (!emailSettings) return;
                const updated = {
                  ...emailSettings,
                  auto_send: !emailSettings.auto_send,
                };
                setEmailSettings(updated)
                  .then(() => setEmailSettingsState(updated))
                  .catch(() => {});
              }}
            />
            <span className="text-[10px] text-ink-3">Email summary</span>
          </div>
        </div>
      </div>

      {/* Section 1: Order of Service */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] text-ink">
            Order of service
          </h2>
          {!isReadOnly && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00] cursor-pointer"
              onClick={() => setShowAddItem((v) => !v)}
            >
              + Add item
            </button>
          )}
        </div>

        {!isReadOnly && showAddItem && (
          <div className="mb-4">
            <AddItemSearch
              onAdd={async (v) => {
                await addItemToActiveProject(
                  v.reference,
                  v.text,
                  v.translation,
                );
                await onProjectsChanged();
              }}
            />
            <ManualEventForm
              onAdd={async (itemType, title, durationMins) => {
                await addItemToActiveProject(title, "", "");
                // After adding, update the last item's type and duration
                const refreshed = await listServiceProjects();
                const proj = refreshed.find((p) => p.id === project.id);
                if (proj) {
                  const sorted = [...proj.items].sort(
                    (a, b) => a.position - b.position,
                  );
                  const lastItem = sorted[sorted.length - 1];
                  if (lastItem) {
                    await updateProjectItem(lastItem.id, {
                      item_type: itemType,
                      duration_secs: durationMins ? durationMins * 60 : null,
                    });
                  }
                }
                await onProjectsChanged();
              }}
            />
          </div>
        )}

        {items.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="border border-line rounded-lg overflow-hidden">
                {items.map((item, idx) => {
                  // Compute cumulative start time
                  let cumulativeSecs = 0;
                  for (let i = 0; i < idx; i++) {
                    cumulativeSecs += items[i].duration_secs ?? 0;
                  }
                  const hasComputedTime = idx === 0 || cumulativeSecs > 0;
                  const isExpanded = expandedItemId === item.id;
                  const glyph =
                    TYPE_GLYPHS[item.item_type] ?? TYPE_GLYPHS.other;

                  return (
                    <SortableItemRow
                      key={item.id}
                      id={item.id}
                      disabled={isReadOnly}
                    >
                      {(handleProps) => (
                        <div className="border-b border-line last:border-b-0">
                          <div
                            className="grid grid-cols-[56px_24px_1fr_48px_24px_24px] gap-3 px-3.5 py-3 items-center cursor-pointer transition-colors hover:bg-bg-2"
                            onClick={() =>
                              setExpandedItemId(isExpanded ? null : item.id)
                            }
                          >
                            {/* Computed start time */}
                            <span className="font-mono text-[10px] text-ink-3 tracking-[0.05em]">
                              {hasComputedTime
                                ? formatComputedTime(
                                    project.created_at_ms,
                                    cumulativeSecs,
                                  )
                                : "\u2014"}
                            </span>

                            {/* Type glyph */}
                            <span className="font-serif italic text-sm text-accent text-center">
                              {glyph}
                            </span>

                            {/* Name / reference */}
                            <div className="text-[12.5px] text-ink truncate">
                              {item.reference || item.text || "Untitled"}
                              {item.translation && (
                                <span className="ml-2 font-mono text-[9.5px] text-ink-3 tracking-[0.08em] uppercase">
                                  {item.translation}
                                </span>
                              )}
                            </div>

                            {/* Duration */}
                            <InlineDurationCell
                              durationSecs={item.duration_secs}
                              isReadOnly={isReadOnly}
                              onUpdate={(secs) =>
                                handleUpdateItem(item.id, {
                                  duration_secs: secs,
                                })
                              }
                            />

                            {/* Drag handle */}
                            <span
                              className={`text-center text-ink-3 text-xs select-none ${
                                isReadOnly ? "opacity-30" : "cursor-grab"
                              }`}
                              {...(isReadOnly ? {} : handleProps)}
                            >
                              {"\u2261"}
                            </span>

                            {/* Remove button */}
                            {!isReadOnly ? (
                              <button
                                className="text-ink-3 hover:text-danger text-sm transition-colors text-center cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemove(item.id);
                                }}
                                title="Remove"
                              >
                                {"\u00D7"}
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <ExpandedItemDetail
                              item={item}
                              isReadOnly={isReadOnly}
                              onUpdate={(updates) =>
                                handleUpdateItem(item.id, updates)
                              }
                              onProjectsChanged={onProjectsChanged}
                            />
                          )}
                        </div>
                      )}
                    </SortableItemRow>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="border border-line rounded-lg px-6 py-8 text-center text-sm text-muted">
            No items yet. Add scripture or events to build the service order.
          </div>
        )}
      </section>

      {/* Section 2: Tasks */}
      <section className="mb-10">
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
                  ? "bg-accent text-[#1A0D00] border-accent"
                  : "bg-bg-2 text-ink-3 border-line hover:bg-bg-3"
              }`}
              onClick={() => setTaskView("list")}
              title="List view"
            >
              {"\u2630"}
            </button>
            <button
              className={`p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                taskView === "board"
                  ? "bg-accent text-[#1A0D00] border-accent"
                  : "bg-bg-2 text-ink-3 border-line hover:bg-bg-3"
              }`}
              onClick={() => setTaskView("board")}
              title="Board view"
            >
              {"\u2637"}
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
                        ? "bg-accent text-[#1A0D00] border-accent font-semibold"
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
                <div className="px-4 py-6 text-center text-sm text-muted">
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

      {/* Settings section removed -- controls moved inline to header */}
    </div>
  );
}

// ─── Editable Name ─────────────────────────────────────────────────────────────

function EditableName({
  name,
  isReadOnly,
  onSave,
}: {
  name: string;
  isReadOnly: boolean;
  onSave: (newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      setValue(name);
    }
  };

  if (editing && !isReadOnly) {
    return (
      <input
        ref={inputRef}
        className="font-serif text-xl font-normal tracking-[-0.015em] text-ink w-full bg-transparent border-b-2 border-accent outline-none py-0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        placeholder="Untitled service"
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <h1
      className={`font-serif text-xl font-normal tracking-[-0.015em] mb-0 ${
        name ? "text-ink" : "text-muted"
      } ${!isReadOnly ? "cursor-pointer hover:text-accent transition-colors" : ""}
      }`}
      onClick={() => {
        if (!isReadOnly) setEditing(true);
      }}
    >
      {name || "Untitled service"}
    </h1>
  );
}

// ─── Editable Description ─────────────────────────────────────────────────────

function EditableDescription({
  value: initialValue,
  isReadOnly,
  onSave,
}: {
  value: string;
  isReadOnly: boolean;
  onSave: (desc: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed !== (initialValue ?? "")) {
      onSave(trimmed);
    }
  };

  if (isReadOnly) {
    return initialValue ? (
      <p className="text-xs text-ink-3 mt-1.5 m-0">{initialValue}</p>
    ) : null;
  }

  return (
    <input
      className="w-full mt-1.5 px-0 py-0.5 bg-transparent border-0 border-b border-transparent text-ink text-sm placeholder:text-muted focus:border-b-line-strong focus:outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      placeholder="Add a description…"
    />
  );
}

// ─── Sortable Item Row ─────────────────────────────────────────────────────────

function SortableItemRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      disabled,
    });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners ?? {})}
    </div>
  );
}

// ─── Task Board ────────────────────────────────────────────────────────────────

function TaskBoard({
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
      className={`flex-1 min-w-[170px] bg-bg-1 border border-line rounded-lg min-h-[200px] flex flex-col ${
        isOver ? "inset-ring-1 ring-accent/40" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line">
        <span
          className={`inline-block w-2 h-2 rounded-full ${STATUS_STYLES[status].split(" ")[1]}`}
        />
        <span className="text-[11px] font-medium text-ink">
          {STATUS_LABELS[status]}
        </span>
        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-bg-3 text-[9px] font-semibold text-ink-3">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 flex flex-col gap-1.5">
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
      className={`group bg-bg border border-line rounded px-2.5 py-2 text-xs text-ink transition-shadow ${
        isDragging ? "shadow-lg" : "hover:shadow-sm"
      } ${!isReadOnly ? "cursor-grab" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          className={`w-3 h-3 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer ${
            task.status === "done"
              ? "bg-success border-success text-white"
              : "border-line hover:border-accent"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          disabled={isReadOnly}
        >
          {task.status === "done" && (
            <span className="text-[8px]">{"\u2713"}</span>
          )}
        </button>
        <span
          className={`flex-1 line-clamp-2 ${task.status === "cancelled" ? "line-through text-muted" : ""}`}
        >
          {task.title}
        </span>
        {!isReadOnly && (
          <button
            className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger text-sm transition-all cursor-pointer shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete task"
          >
            {"\u00D7"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inline Duration Cell ───────────────────────────────────────────────────────

function InlineDurationCell({
  durationSecs,
  isReadOnly,
  onUpdate,
}: {
  durationSecs: number | null;
  isReadOnly: boolean;
  onUpdate: (secs: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing && !isReadOnly) {
    return (
      <input
        ref={inputRef}
        className="w-full px-1 py-0.5 bg-bg-2 border border-line rounded text-[10px] text-ink text-center font-mono"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const mins = parseInt(value, 10);
          if (!isNaN(mins) && mins > 0) {
            onUpdate(mins * 60);
          } else if (value.trim() === "") {
            onUpdate(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="min"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={`font-mono text-[10px] text-ink-3 text-center ${
        !isReadOnly ? "cursor-pointer hover:text-accent" : ""
      }`}
      onClick={(e) => {
        if (isReadOnly) return;
        e.stopPropagation();
        setValue(durationSecs ? String(Math.round(durationSecs / 60)) : "");
        setEditing(true);
      }}
    >
      {durationSecs ? formatDuration(durationSecs) : "\u2014"}
    </span>
  );
}

// ─── Expanded Item Detail ───────────────────────────────────────────────────────

function ExpandedItemDetail({
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
      className="px-6 py-4 bg-bg-1 border-t border-line"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Duration input */}
        <div>
          <label className="block text-[11px] text-ink-3 mb-1 font-medium">
            Duration (minutes)
          </label>
          <input
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs"
            value={durationMins}
            onChange={(e) => setDurationMins(e.target.value)}
            onBlur={handleDurationBlur}
            placeholder="e.g. 5"
            disabled={isReadOnly}
          />
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-[11px] text-ink-3 mb-1 font-medium">
            Type
          </label>
          <select
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs"
            value={item.item_type}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={isReadOnly}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_GLYPHS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[11px] text-ink-3 mb-1 font-medium">
          Notes
        </label>
        <textarea
          className="w-full px-2.5 py-2 bg-bg-2 border border-line rounded-[3px] text-ink text-xs resize-y min-h-[60px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes for this item..."
          disabled={isReadOnly}
        />
      </div>

      {/* Assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-ink-3 font-medium">
            {"\uD83D\uDCCE"} {item.asset_ids.length} asset
            {item.asset_ids.length !== 1 ? "s" : ""}
          </span>
          {!isReadOnly && (
            <div className="flex gap-2">
              <button
                className="px-2 py-1 text-[10px] font-semibold text-accent border border-accent rounded cursor-pointer hover:bg-accent-soft"
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
                className="px-2 py-1 text-[10px] font-semibold text-accent border border-accent rounded cursor-pointer hover:bg-accent-soft"
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
                className="inline-flex items-center px-2 py-0.5 bg-bg-2 border border-line rounded text-[10px] text-ink-3 font-mono"
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

// ─── Task Row ───────────────────────────────────────────────────────────────────

function TaskRow({
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
          <span className="text-[10px]">{"\u2713"}</span>
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
          className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger text-sm transition-all cursor-pointer"
          onClick={onDelete}
          title="Delete task"
        >
          {"\u00D7"}
        </button>
      )}
    </div>
  );
}

// ─── Add Task Form ──────────────────────────────────────────────────────────────

function AddTaskForm({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
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
        className="flex-1 px-3 py-2 bg-bg-2 border border-line rounded-[3px] text-ink text-sm"
        placeholder="Add a task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        type="submit"
        className="px-3 py-2 bg-accent text-[#1A0D00] text-xs font-semibold rounded-[3px] cursor-pointer disabled:opacity-50"
        disabled={!title.trim() || submitting}
      >
        Add
      </button>
    </form>
  );
}

// ─── Manual Event Form ──────────────────────────────────────────────────────────

function ManualEventForm({
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
          className="px-2 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs"
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_GLYPHS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input
          className="flex-1 px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs"
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-16 px-2 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs"
          placeholder="min"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <button
          type="submit"
          className="px-3 py-[7px] bg-accent text-[#1A0D00] text-xs font-semibold rounded-[3px] cursor-pointer disabled:opacity-50"
          disabled={!title.trim() || submitting}
        >
          Add
        </button>
      </div>
    </form>
  );
}

// ─── Add Item Search ────────────────────────────────────────────────────────────

function AddItemSearch({
  onAdd,
}: {
  onAdd: (v: VerseResult) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VerseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchScriptures(q);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div>
      <input
        ref={inputRef}
        className="w-full px-3 py-2 bg-bg-2 border border-line rounded-[3px] text-ink text-sm mb-2"
        placeholder="Search scripture\u2026"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {loading && <div className="text-xs text-ink-3 py-2">Searching...</div>}
      {results.length > 0 && (
        <div className="border border-line rounded-lg overflow-hidden mb-2">
          {results.map((v, i) => (
            <button
              key={`${v.reference}-${v.translation}-${i}`}
              className="w-full text-left px-3.5 py-2.5 border-b border-line last:border-b-0 transition-colors hover:bg-bg-2 cursor-pointer"
              onClick={async () => {
                try {
                  await onAdd(v);
                } catch (e) {
                  toastError("Failed to add item")(e);
                }
              }}
            >
              <span className="text-[12.5px] text-ink">{v.reference}</span>
              <span className="ml-2 font-mono text-[9.5px] text-ink-3 tracking-[0.08em] uppercase">
                {v.translation}
              </span>
              <span className="block text-xs text-ink-3 mt-0.5 line-clamp-1">
                {v.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Service Form ───────────────────────────────────────────────────────────

function NewServiceForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(name.trim());
      }}
    >
      <input
        ref={inputRef}
        className="w-full px-3 py-2 bg-bg-2 border border-line rounded-[3px] text-ink text-sm"
        placeholder="Untitled service"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-3 py-2 bg-accent text-[#1A0D00] text-xs font-semibold rounded-[3px] cursor-pointer"
        >
          Create
        </button>
        <button
          type="button"
          className="px-3 py-2 text-ink-3 text-xs rounded-[3px] border border-line hover:text-ink cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Setting Row ────────────────────────────────────────────────────────────────

// Kept for potential reuse.
export function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_240px] gap-6 py-4 border-b border-line items-center last:border-b-0">
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        <div className="text-xs text-ink-3 mt-1">{description}</div>
      </div>
      <div className="flex justify-end">{control}</div>
    </div>
  );
}
