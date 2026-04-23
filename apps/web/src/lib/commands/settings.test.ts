import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  getAudioSettings,
  setAudioSettings,
  getDisplaySettings,
  setDisplaySettings,
  getEmailSettings,
  setEmailSettings,
  setAnthropicApiKey,
  getAnthropicApiKeyStatus,
  getCloudConfig,
  setCloudConfig,
  getArtifactsSettings,
  setArtifactsBasePath,
} from "./settings";
import type { AudioSettings, DisplaySettings, EmailSettings, S3Config, ArtifactsSettings } from "../types";

const mockAudio: AudioSettings = {
  backend: "whisper",
  deepgram_api_key: "",
  semantic_enabled: false,
  semantic_threshold_auto: 0.7,
  semantic_threshold_copilot: 0.6,
  lyrics_threshold_auto: 0.8,
  lyrics_threshold_copilot: 0.7,
  audio_input_device: null,
  theme: "system",
  whisper_model: "base",
  provider_config: {},
};

const mockDisplay: DisplaySettings = {
  selected_monitor_index: 0,
  multi_output: false,
};

const mockEmail: EmailSettings = {
  smtp_host: "smtp.example.com",
  smtp_port: 587,
  smtp_username: "user@example.com",
  smtp_password: "",
  from_name: "Church",
  send_delay_hours: 0,
  auto_send: false,
};

const mockS3: S3Config = {
  endpoint_url: "https://s3.example.com",
  bucket: "my-bucket",
  region: "us-east-1",
  access_key_id: "AKID",
  secret_access_key: "",
};

const mockArtifacts: ArtifactsSettings = {
  base_path: "/home/church/artifacts",
};

describe("commands/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("audio settings", () => {
    it("getAudioSettings invokes get_audio_settings", async () => {
      mockInvoke.mockResolvedValue(mockAudio);
      const result = await getAudioSettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_audio_settings");
      expect(result).toEqual(mockAudio);
    });

    it("setAudioSettings passes settings object", async () => {
      await setAudioSettings(mockAudio);
      expect(mockInvoke).toHaveBeenCalledWith("set_audio_settings", {
        settings: mockAudio,
      });
    });
  });

  describe("display settings", () => {
    it("getDisplaySettings invokes get_display_settings", async () => {
      mockInvoke.mockResolvedValue(mockDisplay);
      const result = await getDisplaySettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_display_settings");
      expect(result).toEqual(mockDisplay);
    });

    it("setDisplaySettings passes settings object", async () => {
      await setDisplaySettings(mockDisplay);
      expect(mockInvoke).toHaveBeenCalledWith("set_display_settings", {
        settings: mockDisplay,
      });
    });
  });

  describe("email settings", () => {
    it("getEmailSettings invokes get_email_settings", async () => {
      mockInvoke.mockResolvedValue(mockEmail);
      const result = await getEmailSettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_email_settings");
      expect(result).toEqual(mockEmail);
    });

    it("setEmailSettings passes settings object", async () => {
      await setEmailSettings(mockEmail);
      expect(mockInvoke).toHaveBeenCalledWith("set_email_settings", {
        settings: mockEmail,
      });
    });
  });

  describe("anthropic API key", () => {
    it("setAnthropicApiKey passes key", async () => {
      await setAnthropicApiKey("sk-ant-key");
      expect(mockInvoke).toHaveBeenCalledWith("set_anthropic_api_key", {
        key: "sk-ant-key",
      });
    });

    it("getAnthropicApiKeyStatus invokes get_anthropic_api_key_status", async () => {
      mockInvoke.mockResolvedValue(true);
      const result = await getAnthropicApiKeyStatus();
      expect(mockInvoke).toHaveBeenCalledWith("get_anthropic_api_key_status");
      expect(result).toBe(true);
    });

    it("getAnthropicApiKeyStatus returns false when no key", async () => {
      mockInvoke.mockResolvedValue(false);
      const result = await getAnthropicApiKeyStatus();
      expect(result).toBe(false);
    });
  });

  describe("cloud config", () => {
    it("getCloudConfig invokes get_cloud_config", async () => {
      mockInvoke.mockResolvedValue(mockS3);
      const result = await getCloudConfig();
      expect(mockInvoke).toHaveBeenCalledWith("get_cloud_config");
      expect(result).toEqual(mockS3);
    });

    it("setCloudConfig passes config object", async () => {
      await setCloudConfig(mockS3);
      expect(mockInvoke).toHaveBeenCalledWith("set_cloud_config", {
        config: mockS3,
      });
    });
  });

  describe("artifacts settings", () => {
    it("getArtifactsSettings invokes get_artifacts_settings", async () => {
      mockInvoke.mockResolvedValue(mockArtifacts);
      const result = await getArtifactsSettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_artifacts_settings");
      expect(result).toEqual(mockArtifacts);
    });

    it("setArtifactsBasePath passes path", async () => {
      await setArtifactsBasePath("/custom/path");
      expect(mockInvoke).toHaveBeenCalledWith("set_artifacts_base_path", {
        path: "/custom/path",
      });
    });
  });
});
