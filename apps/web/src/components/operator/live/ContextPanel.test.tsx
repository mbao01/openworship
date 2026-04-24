import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { QueueItem, VerseResult } from "../../../lib/types";

const mockSearchScriptures = vi.fn();
const mockPushToDisplay = vi.fn();
const mockAddItemToActiveProject = vi.fn();

vi.mock("../../../lib/commands/content", () => ({
  searchScriptures: (...args: unknown[]) => mockSearchScriptures(...args),
  pushToDisplay: (...args: unknown[]) => mockPushToDisplay(...args),
}));

vi.mock("../../../lib/commands/projects", () => ({
  addItemToActiveProject: (...args: unknown[]) =>
    mockAddItemToActiveProject(...args),
}));

vi.mock("../../../lib/toast", () => ({
  toastError: vi.fn(() => vi.fn()),
}));

import { ContextPanel } from "./ContextPanel";

const makeVerse = (overrides: Partial<VerseResult> = {}): VerseResult => ({
  reference: "John 3:16",
  text: "For God so loved the world",
  translation: "KJV",
  book: "John",
  chapter: 3,
  verse: 16,
  score: 1.0,
  ...overrides,
});

const makeQueueItem = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  kind: "scripture",
  reference: "John 3:16",
  text: "For God so loved the world",
  translation: "KJV",
  ...overrides,
} as QueueItem);

describe("ContextPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchScriptures.mockResolvedValue([]);
    mockPushToDisplay.mockResolvedValue(undefined);
    mockAddItemToActiveProject.mockResolvedValue(undefined);
  });

  it("renders without crashing with null live", () => {
    const { container } = render(<ContextPanel live={null} />);
    expect(container).toBeTruthy();
  });

  it("shows 'No content on screen' when live is null", () => {
    render(<ContextPanel live={null} />);
    expect(screen.getByText("No content on screen")).toBeInTheDocument();
  });

  it("shows context header with 'none' when live is null", () => {
    render(<ContextPanel live={null} />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("shows context label for active scripture", async () => {
    const live = makeQueueItem({ reference: "Romans 8:28" });
    render(<ContextPanel live={live} />);
    await waitFor(() => {
      expect(screen.getByText("Romans 8:28")).toBeInTheDocument();
    });
  });

  it("calls searchScriptures when live scripture changes", async () => {
    const live = makeQueueItem({ reference: "Romans 8:28" });
    render(<ContextPanel live={live} />);
    await waitFor(() => {
      expect(mockSearchScriptures).toHaveBeenCalledWith("Romans 8");
    });
  });

  it("displays context verses for scripture", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:14", text: "And as Moses lifted up the serpent", verse: 14 }),
      makeVerse({ reference: "John 3:15", text: "That whosoever believeth in him", verse: 15 }),
      makeVerse({ reference: "John 3:16", text: "For God so loved the world", verse: 16 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => {
      expect(screen.getByText("For God so loved the world")).toBeInTheDocument();
      expect(screen.getByText("That whosoever believeth in him")).toBeInTheDocument();
    });
  });

  it("shows verse numbers in the context list", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:16", verse: 16 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => {
      expect(screen.getByText("16")).toBeInTheDocument();
    });
  });

  it("calls addItemToActiveProject on normal verse click", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:16", text: "For God so loved the world", verse: 16 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => screen.getByText("For God so loved the world"));

    fireEvent.click(screen.getByText("For God so loved the world"));
    expect(mockAddItemToActiveProject).toHaveBeenCalledWith(
      "John 3:16",
      "For God so loved the world",
      "KJV",
    );
  });

  it("shows push-to-live button per verse", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:16", verse: 16 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => {
      expect(screen.getByTitle("Push to live")).toBeInTheDocument();
    });
  });

  it("calls pushToDisplay when push-to-live button is clicked", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:16", text: "For God so loved the world", verse: 16 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => screen.getByTitle("Push to live"));
    fireEvent.click(screen.getByTitle("Push to live"));
    expect(mockPushToDisplay).toHaveBeenCalledWith("John 3:16", "For God so loved the world", "KJV");
  });

  it("shows multi-select action bar when 2+ verses selected with Cmd+click", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:16", text: "Verse 16", verse: 16 }),
      makeVerse({ reference: "John 3:17", text: "Verse 17", verse: 17 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => screen.getByText("Verse 16"));

    fireEvent.click(screen.getByText("Verse 16"), { metaKey: true });
    fireEvent.click(screen.getByText("Verse 17"), { metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("2 verses selected")).toBeInTheDocument();
      expect(screen.getByText("Push to live")).toBeInTheDocument();
      expect(screen.getByText("Queue")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
  });

  it("clears selection when Clear is clicked", async () => {
    mockSearchScriptures.mockResolvedValue([
      makeVerse({ reference: "John 3:16", text: "Verse 16", verse: 16 }),
      makeVerse({ reference: "John 3:17", text: "Verse 17", verse: 17 }),
    ]);

    const live = makeQueueItem({ reference: "John 3:16" });
    render(<ContextPanel live={live} />);
    await waitFor(() => screen.getByText("Verse 16"));

    fireEvent.click(screen.getByText("Verse 16"), { metaKey: true });
    fireEvent.click(screen.getByText("Verse 17"), { metaKey: true });
    await waitFor(() => screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Clear"));

    await waitFor(() => {
      expect(screen.queryByText("2 verses selected")).not.toBeInTheDocument();
    });
  });

  it("renders song sections when live is a song", () => {
    const live = makeQueueItem({
      kind: "song",
      reference: "Amazing Grace",
      text: "Amazing grace how sweet the sound\n\nThat saved a wretch like me",
    });

    render(<ContextPanel live={live} />);
    expect(screen.getByText("Amazing grace how sweet the sound")).toBeInTheDocument();
    expect(screen.getByText("That saved a wretch like me")).toBeInTheDocument();
  });

  it("shows 'No content on screen' for non-scripture, non-song live", () => {
    const live = { kind: "announcement", reference: "Welcome", text: "Welcome!" } as unknown as QueueItem;
    render(<ContextPanel live={live} />);
    expect(screen.getByText("No content on screen")).toBeInTheDocument();
  });
});
