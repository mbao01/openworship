import { useState } from "react";
import { SettingsNav, type SettingsCategory } from "./SettingsNav";
import { AppearanceSection } from "./sections/AppearanceSection";
import { AudioSection } from "./sections/AudioSection";
import { ChurchSection } from "./sections/ChurchSection";
import { CloudSection } from "./sections/CloudSection";
import { DetectionSection } from "./sections/DetectionSection";
import { DisplaySection } from "./sections/DisplaySection";
import { EmailSection } from "./sections/EmailSection";
import { ShortcutsSection } from "./sections/ShortcutsSection";
import { AboutSection } from "./sections/AboutSection";
import { BackupSection } from "./sections/BackupSection";
import { PrivacySection } from "./sections/PrivacySection";
import type { ChurchIdentity } from "@/lib/types";

interface SettingsPanelProps {
  identity: ChurchIdentity;
  initialCategory?: SettingsCategory;
}

/**
 * Full settings panel: two-column layout with SettingsNav on the left
 * and the active section on the right.
 *
 * Rendered inside a Dialog by SettingsModal.
 */
export function SettingsPanel({
  identity,
  initialCategory = "church",
}: SettingsPanelProps) {
  const [active, setActive] = useState<SettingsCategory>(initialCategory);

  return (
    <div className="flex h-full w-full overflow-hidden rounded-lg">
      <SettingsNav active={active} onSelect={setActive} />

      <div className="flex flex-1 flex-col overflow-hidden bg-bg">
        {active === "church" && <ChurchSection identity={identity} />}
        {active === "appearance" && <AppearanceSection />}
        {active === "audio" && <AudioSection />}
        {active === "display" && <DisplaySection />}
        {active === "detection" && <DetectionSection />}
        {active === "email" && <EmailSection identity={identity} />}
        {active === "cloud" && <CloudSection />}
        {active === "backup" && <BackupSection />}
        {active === "shortcuts" && <ShortcutsSection />}
        {active === "privacy" && <PrivacySection />}
        {active === "about" && <AboutSection />}
      </div>
    </div>
  );
}
