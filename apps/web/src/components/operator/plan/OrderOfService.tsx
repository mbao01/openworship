import { useEffect, useRef, useState } from "react";
import type { ServiceProject } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { GripVerticalIcon, ListIcon, XIcon } from "lucide-react";
import { toastError } from "@/lib/toast";
import {
  addItemToActiveProject,
  listServiceProjects,
  removeItemFromActiveProject,
  reorderActiveProjectItems,
  updateProjectItem,
} from "@/lib/commands/projects";
import { TYPE_ICONS, formatComputedTime, formatDuration } from "./constants";
import { SortableItemRow } from "./SortableItemRow";
import { ExpandedItemDetail } from "./ExpandedItemDetail";
import { AddItemSearch } from "./AddItemSearch";
import { ManualEventForm } from "./ManualEventForm";

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
      {durationSecs ? formatDuration(durationSecs) : "—"}
    </span>
  );
}

export function OrderOfService({
  project,
  isReadOnly,
  onProjectsChanged,
}: {
  project: ServiceProject;
  isReadOnly: boolean;
  onProjectsChanged: () => Promise<void>;
}) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const items = [...project.items].sort((a, b) => a.position - b.position);

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

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] text-ink">
          Order of service
        </h2>
        {!isReadOnly && (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-accent-foreground cursor-pointer"
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
                const icon =
                  TYPE_ICONS[item.item_type] ?? TYPE_ICONS.other;

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
                              : "—"}
                          </span>

                          {/* Type icon */}
                          <span className="text-accent flex items-center justify-center">
                            {icon}
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
                            className={`flex items-center justify-center text-ink-3 select-none ${
                              isReadOnly ? "opacity-30" : "cursor-grab"
                            }`}
                            {...(isReadOnly ? {} : handleProps)}
                          >
                            <GripVerticalIcon className="w-3.5 h-3.5 shrink-0" />
                          </span>

                          {/* Remove button */}
                          {!isReadOnly ? (
                            <button
                              className="text-ink-3 hover:text-danger transition-colors flex items-center justify-center cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(item.id);
                              }}
                              title="Remove"
                            >
                              <XIcon className="w-3.5 h-3.5 shrink-0" />
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
        <div className="border border-line rounded-lg px-6 py-8 text-center text-sm text-muted flex flex-col items-center gap-2">
          <ListIcon className="w-5 h-5 text-muted/60" />
          No items yet. Add scripture or events to build the service order.
        </div>
      )}
    </section>
  );
}
