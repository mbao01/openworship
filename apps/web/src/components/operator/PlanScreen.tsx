import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toastError } from "@/lib/toast";
import type {
  AudioSettings,
  EmailSettings,
  ServiceProject,
  TranslationInfo,
} from "@/lib/types";
import { listTranslations, getActiveTranslation } from "@/lib/commands/content";
import {
  createServiceProject,
  deleteServiceProject,
  listServiceProjects,
} from "@/lib/commands/projects";
import { getAudioSettings, getEmailSettings } from "@/lib/commands/settings";
import { ListIcon } from "lucide-react";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { ServiceList } from "./plan/ServiceList";
import { ServiceDetail } from "./plan/ServiceDetail";

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
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const aOpen = a.closed_at_ms === null;
        const bOpen = b.closed_at_ms === null;
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;
        return b.created_at_ms - a.created_at_ms;
      }),
    [projects],
  );

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
      <ServiceList
        projects={projects}
        sortedProjects={sortedProjects}
        selectedId={selectedId}
        showNewForm={showNewForm}
        onSelectProject={setSelectedId}
        onDeleteTarget={setDeleteTarget}
        onShowNewForm={() => setShowNewForm(true)}
        onCreate={handleCreate}
        onCancelNewForm={() => setShowNewForm(false)}
      />

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
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
            <ListIcon className="h-6 w-6 text-muted/60" />
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
    <div className="grid grid-cols-[1fr_240px] items-center gap-6 border-b border-line py-4 last:border-b-0">
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        <div className="mt-1 text-xs text-ink-3">{description}</div>
      </div>
      <div className="flex justify-end">{control}</div>
    </div>
  );
}
