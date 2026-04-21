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
          className="bg-bg-2 border border-line rounded text-ink text-sm px-[10px] py-[6px] w-full outline-none transition-colors focus:border-accent focus:outline-none"
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
          className="bg-transparent text-ink-3 border border-line rounded font-sans text-xs px-3.5 py-1.5 cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="bg-accent text-accent-foreground border-none rounded font-sans text-xs font-semibold px-3.5 py-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onConfirm(name.trim())}
          disabled={!name.trim()}
        >
          Create
        </button>
      </ModalFooter>
    </Modal>
  );
}
