import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { TranslationInfo } from "@/lib/types";

const mockListTranslations = vi.fn<() => Promise<TranslationInfo[]>>();
const mockGetActiveTranslation = vi.fn<() => Promise<string>>();
const mockSwitchLiveTranslation = vi.fn<(abbr: string) => Promise<void>>();

vi.mock("@/lib/commands/content", () => ({
  listTranslations: (...args: unknown[]) => mockListTranslations(...args as []),
  getActiveTranslation: (...args: unknown[]) => mockGetActiveTranslation(...args as []),
  switchLiveTranslation: (...args: unknown[]) => mockSwitchLiveTranslation(...args as [string]),
}));

import { useTranslations } from "./use-translations";

const fakeTranslations: TranslationInfo[] = [
  { id: "1", name: "English Standard Version", abbreviation: "ESV" },
  { id: "2", name: "King James Version", abbreviation: "KJV" },
];

describe("useTranslations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTranslations.mockResolvedValue(fakeTranslations);
    mockGetActiveTranslation.mockResolvedValue("KJV");
    mockSwitchLiveTranslation.mockResolvedValue(undefined);
  });

  it("loads translations and active translation on mount", async () => {
    const { result } = renderHook(() => useTranslations());

    // Starts in loading state
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.translations).toEqual(fakeTranslations);
    expect(result.current.active).toBe("KJV");
  });

  it("setActive calls switchLiveTranslation", async () => {
    const { result } = renderHook(() => useTranslations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setActive("ESV");
    });

    expect(mockSwitchLiveTranslation).toHaveBeenCalledWith("ESV");
    expect(result.current.active).toBe("ESV");
  });

  it("defaults active to ESV before load completes", () => {
    const { result } = renderHook(() => useTranslations());
    expect(result.current.active).toBe("ESV");
  });
});
