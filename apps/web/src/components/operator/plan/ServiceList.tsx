import type { ServiceProject } from "@/lib/types";
import { Trash2Icon } from "lucide-react";
import { formatDate } from "./constants";
import { NewServiceForm } from "./NewServiceForm";

export function ServiceList({
  projects,
  sortedProjects,
  selectedId,
  showNewForm,
  onSelectProject,
  onDeleteTarget,
  onShowNewForm,
  onCreate,
  onCancelNewForm,
}: {
  projects: ServiceProject[];
  sortedProjects: ServiceProject[];
  selectedId: string | null;
  showNewForm: boolean;
  onSelectProject: (id: string) => void;
  onDeleteTarget: (p: ServiceProject) => void;
  onShowNewForm: () => void;
  onCreate: (name: string) => void;
  onCancelNewForm: () => void;
}) {
  return (
    <div className="flex w-[280px] shrink-0 flex-col border-r border-line bg-bg-1">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-base font-normal tracking-[-0.01em] text-ink">
            Services
          </h2>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bg-3 px-1.5 text-[10px] font-semibold text-ink-3">
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
              className={`w-full cursor-pointer border-b border-line px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-l-2 border-l-accent bg-accent-soft"
                  : "border-l-2 border-l-transparent hover:bg-bg-2"
              }`}
              onClick={() => onSelectProject(p.id)}
            >
              <div className="group/row mb-1 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    isOpen ? "bg-success" : "bg-bg-4"
                  }`}
                />
                <span
                  className={`flex-1 truncate text-[13px] font-medium ${
                    isOpen ? "text-ink" : "text-muted"
                  }`}
                >
                  {p.name || "Untitled service"}
                </span>
                <span
                  className="shrink-0 cursor-pointer text-sm text-ink-3 opacity-0 transition-all group-hover/row:opacity-100 hover:text-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTarget(p);
                  }}
                  title="Delete service"
                >
                  <Trash2Icon className="h-3 w-3 shrink-0" />
                </span>
              </div>
              <div
                className={`pl-4 text-[11px] ${isOpen ? "text-ink-3" : "text-muted"}`}
              >
                {formatDate(p.created_at_ms)}
                <span className="mx-1.5">&middot;</span>
                {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                <span className="mx-1.5">&middot;</span>
                {p.tasks.length} task{p.tasks.length !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-line p-3">
        {showNewForm ? (
          <NewServiceForm onCreate={onCreate} onCancel={onCancelNewForm} />
        ) : (
          <button
            className="w-full cursor-pointer rounded border border-accent bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
            onClick={onShowNewForm}
          >
            + New service
          </button>
        )}
      </div>
    </div>
  );
}
