import { useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "../../ui/modal";

export function NewFolderModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (n: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <Modal open={true} onClose={onCancel} className="max-w-sm">
      <ModalHeader>
        <ModalTitle>New Folder</ModalTitle>
      </ModalHeader>
      <ModalBody className="px-6 py-4">
        <input
          className="w-full rounded border border-line bg-bg-2 px-[10px] py-[6px] text-sm text-ink transition-colors outline-none focus:border-accent focus:outline-none"
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
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
          disabled={!name.trim()}
        >
          Create
        </button>
      </ModalFooter>
    </Modal>
  );
}
