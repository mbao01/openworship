import { Modal, ModalBody } from "../ui/modal";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { ChurchIdentity } from "../../lib/types";

interface SettingsScreenProps {
  identity: ChurchIdentity;
  open: boolean;
  onClose: () => void;
}

export function SettingsScreen({ identity, open, onClose }: SettingsScreenProps) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-4xl h-[600px]" aria-label="Settings">
      <ModalBody>
        <SettingsPanel identity={identity} />
      </ModalBody>
    </Modal>
  );
}
