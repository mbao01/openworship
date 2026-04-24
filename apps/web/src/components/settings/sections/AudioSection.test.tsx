import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { AudioSettings } from "@/lib/types";

// Hoisted mocks so we can control their return values per test
const mockUseAudioSettings = vi.hoisted(() =>
  vi.fn(() => ({ settings: null as AudioSettings | null, update: vi.fn(), loading: false })),
);

vi.mock("@/hooks/use-audio-settings", () => ({
  useAudioSettings: mockUseAudioSettings,
}));

vi.mock("@/hooks/use-audio-level", () => ({
  useAudioLevel: () => 0,
}));

const mockListAudioInputDevices = vi.fn();
const mockListSttProviders = vi.fn();
const mockStartAudioMonitor = vi.fn();
const mockStopAudioMonitor = vi.fn();

vi.mock("@/lib/commands/audio", () => ({
  listAudioInputDevices: (...args: unknown[]) => mockListAudioInputDevices(...args),
  listSttProviders: (...args: unknown[]) => mockListSttProviders(...args),
  startAudioMonitor: (...args: unknown[]) => mockStartAudioMonitor(...args),
  stopAudioMonitor: (...args: unknown[]) => mockStopAudioMonitor(...args),
}));

const mockSetAnthropicApiKey = vi.fn();
vi.mock("@/lib/commands/settings", () => ({
  setAnthropicApiKey: (...args: unknown[]) => mockSetAnthropicApiKey(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@/components/ui/section", () => ({
  Section: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div><h3>{title}</h3>{children}</div>
  ),
  SettingRow: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label>{label}</label>{children}</div>
  ),
}));

vi.mock("@/components/ui/toggle", () => ({
  Toggle: ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <input type="checkbox" data-testid="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} readOnly />
  ),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: () => <input type="range" data-testid="slider" />,
}));

vi.mock("@/components/ui/vu-meter", () => ({
  VuMeter: () => <div data-testid="vu-meter">VuMeter</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("@/components/settings/ProviderConfigPanel", () => ({
  ProviderConfigPanel: ({ provider }: { provider: { name: string } }) => (
    <div data-testid="provider-config-panel">{provider.name}</div>
  ),
}));

// Mock Select components
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <div data-testid="select" onClick={() => onValueChange?.("whisper")}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => <span>Value</span>,
}));

const baseSettings: AudioSettings = {
  backend: "whisper",
  semantic_enabled: false,
  semantic_threshold_auto: 0.7,
  semantic_threshold_copilot: 0.5,
  lyrics_threshold_auto: 0.6,
  lyrics_threshold_copilot: 0.4,
  audio_input_device: null,
  theme: "system",
  whisper_model: "small",
  provider_config: {},
  send_crash_reports: false,
};

describe("AudioSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAudioInputDevices.mockResolvedValue([]);
    mockListSttProviders.mockResolvedValue([]);
    mockStartAudioMonitor.mockResolvedValue(undefined);
    mockStopAudioMonitor.mockResolvedValue(undefined);
    mockSetAnthropicApiKey.mockResolvedValue(undefined);
  });

  it("shows loading state when settings are null", async () => {
    mockUseAudioSettings.mockReturnValue({ settings: null, update: vi.fn(), loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("renders Audio heading when settings are available", async () => {
    const mockUpdate = vi.fn();
    mockUseAudioSettings.mockReturnValue({ settings: baseSettings, update: mockUpdate, loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    await waitFor(() => {
      expect(screen.getByText("Audio")).toBeInTheDocument();
    });
  });

  it("renders Speech-to-text backend section", async () => {
    const mockUpdate = vi.fn();
    mockUseAudioSettings.mockReturnValue({ settings: baseSettings, update: mockUpdate, loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    await waitFor(() => {
      expect(screen.getByText("Speech-to-text backend")).toBeInTheDocument();
    });
  });

  it("starts audio monitor on mount", async () => {
    mockUseAudioSettings.mockReturnValue({ settings: baseSettings, update: vi.fn(), loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    await waitFor(() => {
      expect(mockStartAudioMonitor).toHaveBeenCalled();
    });
  });

  it("loads devices on mount", async () => {
    mockListAudioInputDevices.mockResolvedValue([{ id: "mic-1", name: "Built-in Mic" }]);
    mockUseAudioSettings.mockReturnValue({ settings: baseSettings, update: vi.fn(), loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    await waitFor(() => {
      expect(mockListAudioInputDevices).toHaveBeenCalled();
    });
  });

  it("loads STT providers on mount", async () => {
    mockListSttProviders.mockResolvedValue([{ id: "deepgram", name: "Deepgram", fields: [] }]);
    mockUseAudioSettings.mockReturnValue({ settings: baseSettings, update: vi.fn(), loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    await waitFor(() => {
      expect(mockListSttProviders).toHaveBeenCalled();
    });
  });

  it("shows VU meter", async () => {
    mockUseAudioSettings.mockReturnValue({ settings: baseSettings, update: vi.fn(), loading: false });
    const { AudioSection } = await import("./AudioSection");
    render(<AudioSection />);
    await waitFor(() => {
      expect(screen.getByTestId("vu-meter")).toBeInTheDocument();
    });
  });
});
