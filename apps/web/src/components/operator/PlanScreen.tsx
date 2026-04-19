import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../../lib/tauri";
import { toastError } from "../../lib/toast";
import type { AudioSettings, EmailSettings, ProjectItem, ServiceProject, TranslationInfo, VerseResult } from "../../lib/types";
import { searchScriptures, listTranslations, getActiveTranslation, switchLiveTranslation } from "../../lib/commands/content";
import { addItemToActiveProject } from "../../lib/commands/projects";
import { getAudioSettings, setAudioSettings, getEmailSettings, setEmailSettings } from "../../lib/commands/settings";
import { Toggle } from "../ui/toggle";

export function PlanScreen() {
  const [project, setProject] = useState<ServiceProject | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const dragItemId = useRef<string | null>(null);

  // Translation settings
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [activeTranslation, setActiveTranslation] = useState("ESV");

  // Audio settings (rolling context window)
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings | null>(null);

  // Email settings
  const [emailSettings, setEmailSettingsState] = useState<EmailSettings | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const active = await invoke<ServiceProject | null>("get_active_project");
      setProject(active);
    } catch (e) {
      toastError("Failed to load project")(e);
    }
  }, []);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ServiceProject>("service://project-updated", (e) => {
      setProject(e.payload.closed_at_ms === null ? e.payload : null);
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  // Load settings on mount
  useEffect(() => {
    Promise.all([listTranslations(), getActiveTranslation()])
      .then(([list, active]) => { setTranslations(list); setActiveTranslation(active); })
      .catch(() => {});

    getAudioSettings().then(setAudioSettingsState).catch(() => {});
    getEmailSettings().then(setEmailSettingsState).catch(() => {});
  }, []);

  const handlePush = async (item: ProjectItem) => {
    try {
      await invoke("push_to_display", { reference: item.reference, text: item.text, translation: item.translation });
    } catch (e) {
      toastError("Failed to push")(e);
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      const updated = await invoke<ServiceProject>("remove_item_from_active_project", { itemId });
      setProject(updated);
    } catch (e) {
      toastError("Failed to remove")(e);
    }
  };

  const handleDrop = async (targetId: string) => {
    const sourceId = dragItemId.current;
    dragItemId.current = null;
    if (!sourceId || sourceId === targetId || !project) return;
    const ids = project.items.slice().sort((a, b) => a.position - b.position).map((i) => i.id);
    const fromIdx = ids.indexOf(sourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, sourceId);
    try {
      const updated = await invoke<ServiceProject>("reorder_active_project_items", { itemIds: ids });
      setProject(updated);
    } catch (e) {
      toastError("Failed to reorder")(e);
    }
  };

  const handleCreate = async (name: string) => {
    try {
      const p = await invoke<ServiceProject>("create_service_project", { name });
      setProject(p);
      setShowNewForm(false);
    } catch (e) {
      toastError("Failed to create service")(e);
    }
  };

  const items = project?.items.slice().sort((a, b) => a.position - b.position) ?? [];
  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = today.toLocaleDateString("en-US", { day: "numeric", month: "long" });

  return (
    <div className="flex-1 overflow-y-auto px-14 py-10 bg-bg">
      <h1 className="font-serif text-[44px] font-normal tracking-[-0.025em] mb-2">
        {dayName}, {dateStr}{" "}
        <em className="text-accent italic">{"\u00B7"} plan</em>
      </h1>
      <p className="text-ink-3 text-sm mb-8 max-w-[56ch]">
        Drag items to reorder. AI auto-detects additions during the service{" "}
        {"\u2014"} everything you pre-load here arrives exactly on cue.
      </p>

      {/* Order of service */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em]">
          Order of service
        </h2>
        {!project && !showNewForm && (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00]"
            onClick={() => setShowNewForm(true)}
          >
            + New service
          </button>
        )}
        {project && (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00]"
            onClick={() => setShowAddSearch((v) => !v)}
          >
            + Add item
          </button>
        )}
      </div>

      {showNewForm && !project && (
        <NewServiceForm
          onCreate={handleCreate}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {project && showAddSearch && (
        <AddItemSearch
          onAdd={async (v) => {
            await addItemToActiveProject(v.reference, v.text, v.translation);
            await loadProject();
          }}
        />
      )}

      {items.length > 0 ? (
        <div className="border border-line rounded-lg overflow-hidden max-w-[900px]">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[52px_24px_1fr_auto] gap-3 px-3.5 py-3 items-center border-b border-line cursor-pointer transition-colors hover:bg-bg-2"
              draggable
              onDragStart={() => {
                dragItemId.current = item.id;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(item.id);
              }}
              onClick={() => handlePush(item)}
            >
              <span className="font-mono text-[10px] text-ink-3 tracking-[0.05em]">
                {new Date(item.added_at_ms).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className="font-serif italic text-sm text-accent text-center">
                {"\u00A7"}
              </span>
              <div className="text-[12.5px] text-ink">
                {item.reference}
                <span className="block font-mono text-[9.5px] text-ink-3 tracking-[0.08em] mt-0.5 uppercase">
                  {item.translation}
                </span>
              </div>
              <button
                className="text-ink-3 hover:text-danger text-sm transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item.id);
                }}
                title="Remove"
              >
                {"\u00D7"}
              </button>
            </div>
          ))}
        </div>
      ) : project ? (
        <div className="border border-line rounded-lg px-6 py-8 text-center text-sm text-muted max-w-[900px]">
          Push scripture to display {"\u2014"} items appear here automatically.
        </div>
      ) : !showNewForm ? (
        <div className="border border-line rounded-lg px-6 py-8 text-center text-sm text-muted max-w-[900px]">
          No active service. Create one to start planning.
        </div>
      ) : null}

      {/* Settings for this service */}
      {project && (
        <div className="mt-12 max-w-[900px]">
          <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] mb-4 pb-3 border-b border-line">
            Settings for this service
          </h2>
          <SettingRow
            label="Default translation"
            description="Used when the AI detects scripture without an explicit translation cue."
            control={
              <select
                className="px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs min-w-[180px]"
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
            }
          />
          <SettingRow
            label="Rolling context window"
            description="Longer window helps slow or story-heavy preachers. 10s is default."
            control={
              <select
                className="px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs min-w-[180px]"
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
                <option value={8}>8 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
              </select>
            }
          />
          <SettingRow
            label="Email service summary"
            description="AI-generated recap sent to subscribers 6 hours after service ends."
            control={
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
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function AddItemSearch({ onAdd }: { onAdd: (v: VerseResult) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VerseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
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
    <div className="mb-4 max-w-[900px]">
      <input
        ref={inputRef}
        className="w-full px-3 py-2 bg-bg-2 border border-line rounded-[3px] text-ink text-sm mb-2"
        placeholder="Search scripture\u2026"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {loading && <div className="text-xs text-ink-3 py-2">Searching...</div>}
      {results.length > 0 && (
        <div className="border border-line rounded-lg overflow-hidden">
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
              <span className="ml-2 font-mono text-[9.5px] text-ink-3 tracking-[0.08em] uppercase">{v.translation}</span>
              <span className="block text-xs text-ink-3 mt-0.5 line-clamp-1">{v.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewServiceForm({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <form
      className="flex gap-2 mb-4 max-w-[400px]"
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim()); }}
    >
      <input
        ref={inputRef}
        className="flex-1 px-3 py-2 bg-bg-2 border border-line rounded-[3px] text-ink text-sm"
        placeholder="Service name\u2026"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="px-3 py-2 bg-accent text-[#1A0D00] text-xs font-semibold rounded-[3px]" disabled={!name.trim()}>
        Create
      </button>
      <button type="button" className="px-3 py-2 text-ink-3 text-xs rounded-[3px] border border-line hover:text-ink" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function SettingRow({ label, description, control }: { label: string; description: string; control: React.ReactNode }) {
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
