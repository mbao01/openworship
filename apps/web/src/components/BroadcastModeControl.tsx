import { motion } from "framer-motion";
import { cn } from "../lib/cn";
import { DetectionMode } from "@/lib/types";

interface ModeTabProps {
  label: string;
  value: DetectionMode;
  selected: boolean;
  setSelected: (mode: DetectionMode) => void;
}

const ModeTab = ({ label, value, selected, setSelected }: ModeTabProps) => {
  return (
    <button
      onClick={() => setSelected(value)}
      className={cn(
        "relative px-4 py-1 text-[12px] font-medium tracking-wide transition-colors cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-yellow-500/20",
        selected ? "text-gold" : "text-ash",
      )}
      style={{
        fontFamily: "Geist, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <span className="relative z-10">{label}</span>
      {selected && (
        <motion.span
          layoutId="mode-indicator"
          transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
          className="absolute inset-0 z-0 rounded-md bg-yellow-500/10 border border-yellow-500/30"
        />
      )}
    </button>
  );
};

interface BroadcastModeControlProps {
  modes: { value: DetectionMode; label: string }[];
  selected: DetectionMode;
  onModeChange?: (mode: DetectionMode) => void;
}

export const BroadcastModeControl = ({
  modes,
  selected,
  onModeChange,
}: BroadcastModeControlProps) => {
  const handleModeChange = (mode: DetectionMode) => {
    onModeChange?.(mode);
  };

  return modes.map((mode) => (
    <div
      className="flex items-stretch h-full gap-0"
      role="group"
      aria-label="Mode"
    >
      <ModeTab
        key={mode.value}
        label={mode.label}
        value={mode.value}
        selected={selected === mode.value}
        setSelected={handleModeChange}
      />
    </div>
  ));
};
