import { useEffect, useState } from "react";
import type { ArtifactEntry } from "../../lib/types";
import { invoke } from "../../lib/tauri";

export function RenameModal({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: ArtifactEntry;
  onConfirm: (n: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry.name);
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/65"
      onClick={onCancel}
    >
      <div
        className="flex w-[320px] flex-col gap-3 rounded-[6px] border border-line bg-bg-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 text-[13px] font-semibold text-ink">Rename</p>
        <input
          className="rounded-[3px] border border-line bg-bg-1 px-[10px] py-[6px] font-sans text-[13px] text-ink transition-colors outline-none focus:border-accent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border border-line bg-transparent px-[14px] py-[6px] font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded border-none bg-accent px-[14px] py-[6px] font-sans text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.12] disabled:cursor-default disabled:opacity-40"
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim() || name.trim() === entry.name}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewFolderModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (n: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/65"
      onClick={onCancel}
    >
      <div
        className="flex w-[320px] flex-col gap-3 rounded-[6px] border border-line bg-bg-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 text-[13px] font-semibold text-ink">New Folder</p>
        <input
          className="rounded-[3px] border border-line bg-bg-1 px-[10px] py-[6px] font-sans text-[13px] text-ink transition-colors outline-none focus:border-accent"
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border border-line bg-transparent px-[14px] py-[6px] font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded border-none bg-accent px-[14px] py-[6px] font-sans text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.12] disabled:cursor-default disabled:opacity-40"
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export function MoveFolderModal({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: ArtifactEntry;
  onConfirm: (newParentPath: string) => void;
  onCancel: () => void;
}) {
  const [folders, setFolders] = useState<ArtifactEntry[]>([]);
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<
    Array<{ label: string; path: string | null }>
  >([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    invoke<ArtifactEntry[]>("list_artifacts", {
      serviceId: entry.service_id ?? null,
      parentPath: browsePath,
    })
      .then((list) =>
        setFolders(list.filter((e) => e.is_dir && e.id !== entry.id)),
      )
      .catch((err) => console.error(err));
  }, [browsePath, entry.service_id, entry.id]);

  const handleOpen = (folder: ArtifactEntry) => {
    setCrumbs((prev) => [...prev, { label: folder.name, path: browsePath }]);
    setBrowsePath(folder.path);
    setSelected(folder.path);
  };

  const handleCrumb = (idx: number) => {
    const target = crumbs[idx];
    setCrumbs(crumbs.slice(0, idx));
    setBrowsePath(target.path);
    setSelected(target.path);
  };

  const handleRoot = () => {
    setCrumbs([]);
    setBrowsePath(null);
    setSelected(null);
  };

  const destinationPath =
    selected ?? browsePath ?? `${entry.service_id ?? "_local"}`;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/65"
      onClick={onCancel}
    >
      <div
        className="flex w-[360px] flex-col gap-3 rounded-[6px] border border-line bg-bg-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 text-[13px] font-semibold text-ink">Move to Folder</p>

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-3">
          <button
            className="text-ink-3 transition-colors hover:text-ink"
            onClick={handleRoot}
          >
            Root
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-line">/</span>
              <button
                className="text-ink-3 transition-colors hover:text-ink"
                onClick={() => handleCrumb(i)}
              >
                {c.label}
              </button>
            </span>
          ))}
          {browsePath && (
            <span className="flex items-center gap-1">
              <span className="text-line">/</span>
              <span className="text-ink">
                {crumbs.length > 0 ? browsePath.split("/").pop() : browsePath}
              </span>
            </span>
          )}
        </div>

        {/* Folder list */}
        <div className="max-h-[200px] min-h-[120px] overflow-y-auto rounded-[3px] border border-line bg-bg-1">
          {folders.length === 0 ? (
            <p className="m-0 px-3 py-2 text-[11px] text-line">
              No sub-folders here.
            </p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className={`flex cursor-pointer items-center justify-between px-3 py-[6px] text-[12px] transition-colors hover:bg-white/5 ${selected === f.path ? "bg-white/5 text-accent" : "text-ink"}`}
                onClick={() => setSelected(f.path)}
                onDoubleClick={() => handleOpen(f)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-ink-3">📁</span>
                  {f.name}
                </span>
                <button
                  className="ml-2 text-[10px] text-line transition-colors hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(f);
                  }}
                  title="Open folder"
                >
                  ▸
                </button>
              </div>
            ))
          )}
        </div>

        <p className="m-0 text-[10px] text-ink-3">
          Moving <span className="text-ink">{entry.name}</span> to:{" "}
          <span className="font-mono text-accent">{destinationPath}</span>
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border border-line bg-transparent px-[14px] py-[6px] font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded border-none bg-accent px-[14px] py-[6px] font-sans text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.12]"
            onClick={() => onConfirm(destinationPath)}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
