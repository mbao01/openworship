import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockGetIdentity = vi.fn();
const mockSaveIdentity = vi.fn();

vi.mock("@/lib/commands/identity", () => ({
  getIdentity: (...args: unknown[]) => mockGetIdentity(...args),
  setIdentity: (...args: unknown[]) => mockSaveIdentity(...args),
}));

import { useIdentity } from "./use-identity";
import type { ChurchIdentity } from "@/lib/types";

const mockChurch: ChurchIdentity = {
  church_id: "church-1",
  church_name: "Grace Chapel",
  branch_id: "branch-1",
  branch_name: "Main Branch",
  role: "hq",
  invite_code: null,
};

describe("useIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdentity.mockResolvedValue(null);
    mockSaveIdentity.mockResolvedValue(undefined);
  });

  it("starts with loading=true and identity=null", () => {
    const { result } = renderHook(() => useIdentity());
    expect(result.current.loading).toBe(true);
    expect(result.current.identity).toBeNull();
  });

  it("sets identity and loading=false after load", async () => {
    mockGetIdentity.mockResolvedValue(mockChurch);
    const { result } = renderHook(() => useIdentity());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.identity).toEqual(mockChurch);
  });

  it("sets identity=undefined when getIdentity returns null (not onboarded)", async () => {
    mockGetIdentity.mockResolvedValue(null);
    const { result } = renderHook(() => useIdentity());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.identity).toBeUndefined();
  });

  it("sets identity=undefined and loading=false on load error", async () => {
    mockGetIdentity.mockRejectedValue(new Error("backend down"));
    const { result } = renderHook(() => useIdentity());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.identity).toBeUndefined();
  });

  it("setIdentity saves and updates state", async () => {
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setIdentity(mockChurch);
    });

    expect(mockSaveIdentity).toHaveBeenCalledWith(mockChurch);
    expect(result.current.identity).toEqual(mockChurch);
  });

  it("setIdentity propagates save errors", async () => {
    mockSaveIdentity.mockRejectedValue(new Error("write failed"));
    const { result } = renderHook(() => useIdentity());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.setIdentity(mockChurch)).rejects.toThrow("write failed");
  });
});
