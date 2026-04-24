import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import { getBranchSyncStatus } from "./share";

describe("commands/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("getBranchSyncStatus invokes get_branch_sync_status", async () => {
    const status = {
      last_pushed_ms: 0,
      last_pulled_ms: 0,
      hq_branch_name: null,
      error: null,
    };
    mockInvoke.mockResolvedValue(status);
    const result = await getBranchSyncStatus();
    expect(mockInvoke).toHaveBeenCalledWith("get_branch_sync_status");
    expect(result).toEqual(status);
  });
});
