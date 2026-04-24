import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  startStt,
  stopStt,
  getSttStatus,
  getAudioLevel,
  listAudioInputDevices,
  startAudioMonitor,
  stopAudioMonitor,
  checkWhisperModel,
  downloadWhisperModel,
  listSttProviders,
  getProviderStatus,
  checkProviderModel,
  getProviderModels,
  downloadProviderModel,
  setProviderSecret,
} from "./audio";

describe("commands/audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("startStt invokes start_stt", async () => {
    await startStt();
    expect(mockInvoke).toHaveBeenCalledWith("start_stt");
  });

  it("stopStt invokes stop_stt", async () => {
    await stopStt();
    expect(mockInvoke).toHaveBeenCalledWith("stop_stt");
  });

  it("getSttStatus returns current status", async () => {
    mockInvoke.mockResolvedValue("running");
    const result = await getSttStatus();
    expect(mockInvoke).toHaveBeenCalledWith("get_stt_status");
    expect(result).toBe("running");
  });

  it("getSttStatus returns stopped", async () => {
    mockInvoke.mockResolvedValue("stopped");
    const result = await getSttStatus();
    expect(result).toBe("stopped");
  });

  it("getAudioLevel returns normalized value", async () => {
    mockInvoke.mockResolvedValue(0.75);
    const result = await getAudioLevel();
    expect(mockInvoke).toHaveBeenCalledWith("get_audio_level");
    expect(result).toBe(0.75);
  });

  it("listAudioInputDevices returns device list", async () => {
    const devices = [
      { name: "Built-in Microphone", is_default: true },
      { name: "USB Mic", is_default: false },
    ];
    mockInvoke.mockResolvedValue(devices);
    const result = await listAudioInputDevices();
    expect(mockInvoke).toHaveBeenCalledWith("list_audio_input_devices");
    expect(result).toEqual(devices);
  });

  it("startAudioMonitor invokes start_audio_monitor", async () => {
    await startAudioMonitor();
    expect(mockInvoke).toHaveBeenCalledWith("start_audio_monitor");
  });

  it("stopAudioMonitor invokes stop_audio_monitor", async () => {
    await stopAudioMonitor();
    expect(mockInvoke).toHaveBeenCalledWith("stop_audio_monitor");
  });

  it("checkWhisperModel passes model", async () => {
    mockInvoke.mockResolvedValue(true);
    const result = await checkWhisperModel("base");
    expect(mockInvoke).toHaveBeenCalledWith("check_whisper_model", { model: "base" });
    expect(result).toBe(true);
  });

  it("checkWhisperModel defaults to null when no model", async () => {
    mockInvoke.mockResolvedValue(false);
    await checkWhisperModel();
    expect(mockInvoke).toHaveBeenCalledWith("check_whisper_model", { model: null });
  });

  it("downloadWhisperModel passes model", async () => {
    await downloadWhisperModel("small");
    expect(mockInvoke).toHaveBeenCalledWith("download_whisper_model", { model: "small" });
  });

  it("downloadWhisperModel defaults to null when no model", async () => {
    await downloadWhisperModel();
    expect(mockInvoke).toHaveBeenCalledWith("download_whisper_model", { model: null });
  });

  it("listSttProviders invokes list_stt_providers", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listSttProviders();
    expect(mockInvoke).toHaveBeenCalledWith("list_stt_providers");
    expect(result).toEqual([]);
  });

  it("getProviderStatus passes providerId", async () => {
    mockInvoke.mockResolvedValue({ ready: true });
    const result = await getProviderStatus("whisper");
    expect(mockInvoke).toHaveBeenCalledWith("get_provider_status", { providerId: "whisper" });
    expect(result).toEqual({ ready: true });
  });

  it("checkProviderModel passes providerId and modelId", async () => {
    mockInvoke.mockResolvedValue(true);
    const result = await checkProviderModel("whisper", "base");
    expect(mockInvoke).toHaveBeenCalledWith("check_provider_model", {
      providerId: "whisper",
      modelId: "base",
    });
    expect(result).toBe(true);
  });

  it("getProviderModels passes providerId", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await getProviderModels("whisper");
    expect(mockInvoke).toHaveBeenCalledWith("get_provider_models", { providerId: "whisper" });
    expect(result).toEqual([]);
  });

  it("downloadProviderModel passes providerId and modelId", async () => {
    await downloadProviderModel("whisper", "small");
    expect(mockInvoke).toHaveBeenCalledWith("download_provider_model", {
      providerId: "whisper",
      modelId: "small",
    });
  });

  it("setProviderSecret passes providerId, key, value", async () => {
    await setProviderSecret("deepgram", "api_key", "dg-secret");
    expect(mockInvoke).toHaveBeenCalledWith("set_provider_secret", {
      providerId: "deepgram",
      key: "api_key",
      value: "dg-secret",
    });
  });
});
