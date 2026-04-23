import { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "../../ui/modal";
import { FolderIcon, ChevronDownIcon } from "lucide-react";
import { invoke } from "../../../lib/tauri";
import type { ArtifactEntry } from "../../../lib/types";
import { iconCls } from "./helpers";

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
      .catch(() => {});
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
    <Modal open={true} onClose={onCancel} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>Move to Folder</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3 px-6 py-4">
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
        <div className="max-h-[200px] min-h-[120px] overflow-y-auto rounded border border-line bg-bg-2">
          {folders.length === 0 ? (
            <p className="m-0 px-3 py-2 text-[11px] text-line">
              No sub-folders here.
            </p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className={`flex cursor-pointer items-center justify-between px-3 py-[6px] text-[12px] transition-colors hover:bg-bg-2 ${selected === f.path ? "bg-accent-soft text-accent" : "text-ink"}`}
                onClick={() => setSelected(f.path)}
                onDoubleClick={() => handleOpen(f)}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className={`${iconCls} text-ink-3`} />
                  {f.name}
                </span>
                <button
                  className="ml-2 cursor-pointer border-none bg-transparent text-[10px] text-line transition-colors hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(f);
                  }}
                  title="Open folder"
                >
                  <ChevronDownIcon className="h-3 w-3 -rotate-90" />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="m-0 text-[10px] text-ink-3">
          Moving <span className="text-ink">{entry.name}</span> to:{" "}
          <span className="font-mono text-accent">{destinationPath}</span>
        </p>
      </ModalBody>
      <ModalFooter>
        <button
          className="cursor-pointer rounded border border-line bg-transparent px-3.5 py-1.5 font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="cursor-pointer rounded border-none bg-accent px-3.5 py-1.5 font-sans text-xs font-semibold text-accent-foreground"
          onClick={() => onConfirm(destinationPath)}
        >
          Move Here
        </button>
      </ModalFooter>
    </Modal>
  );
}
