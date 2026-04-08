import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetectionQueue } from "./DetectionQueue";
import type { QueuedVerse } from "../lib/types";

const pendingVerse: QueuedVerse = {
  id: 1,
  reference: { book: "John", chapter: 3, verse: 16 },
  text: "For God so loved the world…",
  translation: "KJV",
  status: "pending",
};

const approvedVerse: QueuedVerse = {
  id: 2,
  reference: { book: "Romans", chapter: 8, verse: 28 },
  text: "And we know that all things work together…",
  translation: "KJV",
  status: "approved",
};

vi.mock("../lib/tauri", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === "get_queue") return Promise.resolve([pendingVerse, approvedVerse]);
    return Promise.resolve(undefined);
  }),
}));

describe("DetectionQueue", () => {
  it("shows 'No detections yet.' when queue is empty", async () => {
    const { invoke } = await import("../lib/tauri");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    render(<DetectionQueue mode="copilot" />);
    expect(await screen.findByText("No detections yet.")).toBeInTheDocument();
  });

  it("renders a pending verse with SHOW and DISMISS buttons in Copilot mode", async () => {
    const { invoke } = await import("../lib/tauri");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce([pendingVerse]);

    render(<DetectionQueue mode="copilot" />);
    expect(await screen.findByText("John 3:16")).toBeInTheDocument();
    expect(screen.getByText("SHOW")).toBeInTheDocument();
    expect(screen.getByText("DISMISS")).toBeInTheDocument();
  });

  it("does not show action buttons in Auto mode", async () => {
    const { invoke } = await import("../lib/tauri");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce([pendingVerse]);

    render(<DetectionQueue mode="auto" />);
    await screen.findByText("John 3:16");
    expect(screen.queryByText("SHOW")).not.toBeInTheDocument();
  });

  it("shows SHOWN badge for approved verses", async () => {
    const { invoke } = await import("../lib/tauri");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce([approvedVerse]);

    render(<DetectionQueue mode="auto" />);
    expect(await screen.findByText("SHOWN")).toBeInTheDocument();
  });

  it("shows airplane message when mode is airplane", () => {
    render(<DetectionQueue mode="airplane" />);
    expect(screen.getByText("Manual mode — detection paused.")).toBeInTheDocument();
  });

  it("shows offline message when mode is offline", () => {
    render(<DetectionQueue mode="offline" />);
    expect(screen.getByText("STT inactive.")).toBeInTheDocument();
  });
});
