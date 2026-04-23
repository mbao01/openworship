import { Modal, ModalBody } from "../ui/modal";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { ChurchIdentity } from "../../lib/types";

interface SettingsScreenProps {
  identity: ChurchIdentity;
  open: boolean;
  onClose: () => void;
}

export function SettingsScreen({
  identity,
  open,
  onClose,
}: SettingsScreenProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="h-[600px] max-w-4xl"
      aria-label="Settings"
    >
      <ModalBody>
        <SettingsPanel identity={identity} />
      </ModalBody>
    </Modal>
  );
}
