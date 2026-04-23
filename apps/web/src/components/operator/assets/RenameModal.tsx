import { useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "../../ui/modal";
import type { ArtifactEntry } from "../../../lib/types";

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
    <Modal open={true} onClose={onCancel} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>Rename</ModalTitle>
      </ModalHeader>
      <ModalBody className="px-6 py-4">
        <input
          className="w-full rounded border border-line bg-bg-2 px-[10px] py-[6px] text-sm text-ink transition-colors outline-none focus:border-accent focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
      </ModalBody>
      <ModalFooter>
        <button
          className="cursor-pointer rounded border border-line bg-transparent px-3.5 py-1.5 font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="cursor-pointer rounded border-none bg-accent px-3.5 py-1.5 font-sans text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onConfirm(name.trim())}
          disabled={!name.trim() || name.trim() === entry.name}
        >
          Rename
        </button>
      </ModalFooter>
    </Modal>
  );
}
