import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  generateServiceSummary,
  listServiceSummaries,
  deleteServiceSummary,
  sendSummaryEmail,
  listEmailSubscribers,
  addEmailSubscriber,
  removeEmailSubscriber,
  sendTestEmail,
} from "./summaries";

const mockSubscriber = {
  id: "sub-1",
  church_id: "church-1",
  email: "pastor@church.org",
  name: "Pastor",
  subscribed_at_ms: 0,
};

describe("commands/summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("generateServiceSummary passes projectId", async () => {
    await generateServiceSummary("proj-1");
    expect(mockInvoke).toHaveBeenCalledWith("generate_service_summary", {
      projectId: "proj-1",
    });
  });

  it("listServiceSummaries invokes list_service_summaries", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listServiceSummaries();
    expect(mockInvoke).toHaveBeenCalledWith("list_service_summaries");
    expect(result).toEqual([]);
  });

  it("deleteServiceSummary passes summaryId", async () => {
    await deleteServiceSummary("summary-1");
    expect(mockInvoke).toHaveBeenCalledWith("delete_service_summary", {
      summaryId: "summary-1",
    });
  });

  it("sendSummaryEmail passes summaryId", async () => {
    await sendSummaryEmail("summary-1");
    expect(mockInvoke).toHaveBeenCalledWith("send_summary_email", {
      summaryId: "summary-1",
    });
  });

  it("listEmailSubscribers invokes list_email_subscribers", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listEmailSubscribers();
    expect(mockInvoke).toHaveBeenCalledWith("list_email_subscribers");
    expect(result).toEqual([]);
  });

  it("addEmailSubscriber passes email and name", async () => {
    mockInvoke.mockResolvedValue(mockSubscriber);
    const result = await addEmailSubscriber("pastor@church.org", "Pastor");
    expect(mockInvoke).toHaveBeenCalledWith("add_email_subscriber", {
      email: "pastor@church.org",
      name: "Pastor",
    });
    expect(result).toEqual(mockSubscriber);
  });

  it("addEmailSubscriber works without name", async () => {
    const sub = { ...mockSubscriber, id: "sub-2", email: "member@church.org", name: null };
    mockInvoke.mockResolvedValue(sub);
    await addEmailSubscriber("member@church.org");
    expect(mockInvoke).toHaveBeenCalledWith("add_email_subscriber", {
      email: "member@church.org",
      name: undefined,
    });
  });

  it("removeEmailSubscriber passes subscriberId", async () => {
    await removeEmailSubscriber("sub-1");
    expect(mockInvoke).toHaveBeenCalledWith("remove_email_subscriber", {
      subscriberId: "sub-1",
    });
  });

  it("sendTestEmail passes toEmail", async () => {
    await sendTestEmail("test@church.org");
    expect(mockInvoke).toHaveBeenCalledWith("send_test_email", {
      toEmail: "test@church.org",
    });
  });
});
