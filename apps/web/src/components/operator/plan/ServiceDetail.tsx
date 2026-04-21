import { useState } from "react";
import { toastError } from "@/lib/toast";
import type {
  AudioSettings,
  EmailSettings,
  ServiceProject,
  TranslationInfo,
} from "@/lib/types";
import {
  switchLiveTranslation,
} from "@/lib/commands/content";
import {
  closeActiveProject,
  updateServiceProject,
} from "@/lib/commands/projects";
import {
  setAudioSettings,
  setEmailSettings,
} from "@/lib/commands/settings";
import { Toggle } from "../../ui/toggle";
import { ConfirmDialog } from "../../ui/confirm-dialog";
import { EditableName } from "./EditableName";
import { EditableDescription } from "./EditableDescription";
import { OrderOfService } from "./OrderOfService";
import { TasksSection } from "./TasksSection";

export function ServiceDetail({
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
  const [endConfirm, setEndConfirm] = useState(false);

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
              className="px-2 py-1 bg-bg-2 border border-line rounded text-ink text-xs disabled:text-muted disabled:cursor-not-allowed"
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
            {!isReadOnly && (
              <button
                className="px-3 py-1.5 text-xs font-medium rounded border border-danger/40 text-danger bg-transparent cursor-pointer transition-colors hover:bg-danger/10"
                onClick={() => setEndConfirm(true)}
              >
                End service
              </button>
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
              className="px-1.5 py-0.5 bg-bg-2 border border-line rounded text-ink text-[11px]"
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
              className="px-1.5 py-0.5 bg-bg-2 border border-line rounded text-ink text-[11px]"
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
      <OrderOfService
        project={project}
        isReadOnly={isReadOnly}
        onProjectsChanged={onProjectsChanged}
      />

      {/* Section 2: Tasks */}
      <TasksSection
        project={project}
        isReadOnly={isReadOnly}
        onProjectsChanged={onProjectsChanged}
      />

      {/* Settings section removed -- controls moved inline to header */}

      <ConfirmDialog
        open={endConfirm}
        onOpenChange={setEndConfirm}
        title="End this service?"
        description="This will close the service. Items will be preserved but no new content will be added. You can optionally generate an AI summary."
        confirmLabel="End service"
        variant="danger"
        onConfirm={async () => {
          try {
            await closeActiveProject();
            await onProjectsChanged();
          } catch (e) {
            toastError("Failed to end service")(e);
          }
        }}
      />
    </div>
  );
}
