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
  const [crumbs, setCrumbs] = useState<Array<{ label: string; path: string | null }>>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    invoke<ArtifactEntry[]>("list_artifacts", {
      serviceId: entry.service_id ?? null,
      parentPath: browsePath,
    })
      .then((list) => setFolders(list.filter((e) => e.is_dir && e.id !== entry.id)))
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

  const destinationPath = selected ?? browsePath ?? `${entry.service_id ?? "_local"}`;

  return (
    <Modal open={true} onClose={onCancel} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>Move to Folder</ModalTitle>
      </ModalHeader>
      <ModalBody className="px-6 py-4 flex flex-col gap-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[11px] text-ink-3 flex-wrap">
          <button
            className="text-ink-3 hover:text-ink transition-colors"
            onClick={handleRoot}
          >
            Root
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-line">/</span>
              <button
                className="text-ink-3 hover:text-ink transition-colors"
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
        <div className="bg-bg-2 border border-line rounded min-h-[120px] max-h-[200px] overflow-y-auto">
          {folders.length === 0 ? (
            <p className="text-[11px] text-line px-3 py-2 m-0">
              No sub-folders here.
            </p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className={`flex items-center justify-between px-3 py-[6px] cursor-pointer text-[12px] transition-colors hover:bg-bg-2 ${selected === f.path ? "text-accent bg-accent-soft" : "text-ink"}`}
                onClick={() => setSelected(f.path)}
                onDoubleClick={() => handleOpen(f)}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className={`${iconCls} text-ink-3`} />
                  {f.name}
                </span>
                <button
                  className="text-[10px] text-line hover:text-ink transition-colors ml-2 bg-transparent border-none cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(f);
                  }}
                  title="Open folder"
                >
                  <ChevronDownIcon className="w-3 h-3 -rotate-90" />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-[10px] text-ink-3 m-0">
          Moving <span className="text-ink">{entry.name}</span> to:{" "}
          <span className="text-accent font-mono">{destinationPath}</span>
        </p>
      </ModalBody>
      <ModalFooter>
        <button
          className="bg-transparent text-ink-3 border border-line rounded font-sans text-xs px-3.5 py-1.5 cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="bg-accent text-accent-foreground border-none rounded font-sans text-xs font-semibold px-3.5 py-1.5 cursor-pointer"
          onClick={() => onConfirm(destinationPath)}
        >
          Move Here
        </button>
      </ModalFooter>
    </Modal>
  );
}
