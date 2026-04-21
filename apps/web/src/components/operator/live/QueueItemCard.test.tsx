import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueueItemCard } from "./QueueItemCard";
import type { QueueItem } from "../../../lib/types";

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: "q1",
    reference: "John 3:16",
    text: "For God so loved the world...",
    translation: "ESV",
    status: "pending",
    detected_at_ms: Date.now(),
    confidence: 0.85,
    ...overrides,
  };
}

describe("QueueItemCard", () => {
  const onApprove = vi.fn();
  const onReject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reference text", () => {
    render(
      <QueueItemCard
        item={makeItem()}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(screen.getByText("John 3:16")).toBeInTheDocument();
  });

  it("renders the verse text", () => {
    render(
      <QueueItemCard
        item={makeItem()}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(
      screen.getByText("For God so loved the world..."),
    ).toBeInTheDocument();
  });

  it("renders confidence percentage", () => {
    render(
      <QueueItemCard
        item={makeItem({ confidence: 0.85 })}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("renders Push and Reject buttons for pending items", () => {
    render(
      <QueueItemCard
        item={makeItem({ status: "pending" })}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(screen.getByText("Push")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("does NOT render Push/Reject buttons for live items", () => {
    render(
      <QueueItemCard
        item={makeItem({ status: "live" })}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    expect(screen.queryByText("Push")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });

  it("calls onApprove when Push is clicked", async () => {
    const user = userEvent.setup();
    render(
      <QueueItemCard
        item={makeItem()}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByText("Push"));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("calls onReject when Reject is clicked", async () => {
    const user = userEvent.setup();
    render(
      <QueueItemCard
        item={makeItem()}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByText("Reject"));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("renders confidence bar when confidence is present", () => {
    const { container } = render(
      <QueueItemCard
        item={makeItem({ confidence: 0.75 })}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    // Confidence bar inner div has width style
    const barInner = container.querySelector('[style*="width: 75%"]');
    expect(barInner).toBeTruthy();
  });
});
