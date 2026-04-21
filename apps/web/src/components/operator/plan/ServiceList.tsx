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
              onClick={() => onSelectProject(p.id)}
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
                    onDeleteTarget(p);
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
                <span className="mx-1.5">&middot;</span>
                {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                <span className="mx-1.5">&middot;</span>
                {p.tasks.length} task{p.tasks.length !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-line">
        {showNewForm ? (
          <NewServiceForm
            onCreate={onCreate}
            onCancel={onCancelNewForm}
          />
        ) : (
          <button
            className="w-full px-3 py-2 text-xs font-semibold rounded border border-accent bg-accent text-accent-foreground cursor-pointer"
            onClick={onShowNewForm}
          >
            + New service
          </button>
        )}
      </div>
    </div>
  );
}
