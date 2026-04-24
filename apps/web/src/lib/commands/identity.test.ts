import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import { getIdentity, setIdentity } from "./identity";
import type { ChurchIdentity } from "../types";

const mockIdentity: ChurchIdentity = {
  church_id: "church-1",
  church_name: "Grace Church",
  branch_id: "branch-1",
  branch_name: "Main Campus",
  role: "hq",
  invite_code: null,
};

describe("commands/identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("getIdentity invokes get_identity and returns identity", async () => {
    mockInvoke.mockResolvedValue(mockIdentity);
    const result = await getIdentity();
    expect(mockInvoke).toHaveBeenCalledWith("get_identity");
    expect(result).toEqual(mockIdentity);
  });

  it("getIdentity returns null on first launch", async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await getIdentity();
    expect(result).toBeNull();
  });

  it("setIdentity passes identity object", async () => {
    await setIdentity(mockIdentity);
    expect(mockInvoke).toHaveBeenCalledWith("set_identity", {
      identity: mockIdentity,
    });
  });
});
