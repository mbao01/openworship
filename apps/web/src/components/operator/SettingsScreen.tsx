import { useState } from "react";
import type { ChurchIdentity } from "../../lib/types";

interface SettingsScreenProps {
  identity: ChurchIdentity;
}

export function SettingsScreen({ identity }: SettingsScreenProps) {
  return (
    <div className="flex-1 overflow-y-auto px-14 py-10 bg-bg">
      <h1 className="font-serif text-[44px] font-normal tracking-[-0.025em] mb-2">Settings</h1>
      <p className="text-ink-3 text-sm mb-8 max-w-[56ch]">
        Configure the engine, pick translations, and set preferences that persist across services.
      </p>

      {/* Speech & detection */}
      <div className="mb-12 max-w-[900px]">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] mb-4 pb-3 border-b border-line">
          Speech &amp; detection
        </h2>
        <SettingRow
          label="STT engine"
          description="Offline runs Whisper.cpp on CPU. Online uses Deepgram for ~100ms latency."
          control={
            <select className="px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs min-w-[180px]">
              <option>Offline {"\u00B7"} Whisper.cpp</option>
              <option>Online {"\u00B7"} Deepgram</option>
            </select>
          }
        />
        <SettingRow
          label="Microphone"
          description="The room mic, if you have one. Any input device works."
          control={
            <select className="px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs min-w-[180px]">
              <option>Default input</option>
            </select>
          }
        />
        <SettingRow
          label="Paraphrase matching"
          description="Use semantic embeddings to match loose paraphrases."
          control={<Toggle defaultOn />}
        />
      </div>

      {/* Translations */}
      <div className="mb-12 max-w-[900px]">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] mb-4 pb-3 border-b border-line">
          Translations
        </h2>
        <SettingRow label="ESV · English Standard Version" description="Licensed · Crossway" control={<Toggle defaultOn />} />
        <SettingRow label="NIV · New International Version" description="Licensed · Biblica" control={<Toggle defaultOn />} />
        <SettingRow label="KJV · King James Version" description="Public domain" control={<Toggle defaultOn />} />
        <SettingRow label="WEB · World English Bible" description="Public domain" control={<Toggle />} />
      </div>

      {/* Church */}
      <div className="mb-12 max-w-[900px]">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] mb-4 pb-3 border-b border-line">
          Church
        </h2>
        <SettingRow
          label="Church name"
          description="Displayed on the output screen and in service summaries."
          control={
            <span className="text-xs text-ink-2">{identity.church_name}</span>
          }
        />
        <SettingRow
          label="Branch"
          description="The campus or location this device is assigned to."
          control={
            <span className="text-xs text-ink-2">{identity.branch_name}</span>
          }
        />
      </div>
    </div>
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

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      className={`relative w-[38px] h-[22px] rounded-[11px] transition-colors cursor-pointer ${on ? "bg-accent" : "bg-bg-3"}`}
      onClick={() => setOn((v) => !v)}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-[3px] w-4 h-4 rounded-full transition-[left] ${on ? "left-[19px] bg-[#1A0D00]" : "left-[3px] bg-ink"}`} />
    </button>
  );
}
