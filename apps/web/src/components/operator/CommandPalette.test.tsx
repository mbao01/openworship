import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./CommandPalette";

vi.mock("../../lib/tauri", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/commands/detection", () => ({
  clearLive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/toast", () => ({
  toastError: () => () => {},
}));

describe("CommandPalette", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the search input with placeholder", () => {
    render(<CommandPalette onClose={onClose} />);
    const input = screen.getByPlaceholderText(
      /Search scripture, lyrics, slides, or commands/,
    );
    expect(input).toBeInTheDocument();
  });

  it("shows result count", () => {
    render(<CommandPalette onClose={onClose} />);
    expect(screen.getByText("0 results")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking the backdrop overlay", async () => {
    const user = userEvent.setup();
    const { container } = render(<CommandPalette onClose={onClose} />);

    // Click the backdrop (outermost fixed overlay)
    const backdrop = container.firstElementChild as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders keyboard shortcut hints in the footer", () => {
    render(<CommandPalette onClose={onClose} />);
    expect(screen.getByText("navigate")).toBeInTheDocument();
    expect(screen.getByText("push")).toBeInTheDocument();
    expect(screen.getByText("close")).toBeInTheDocument();
  });

  it("shows 'Actions' group when user types a query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette onClose={onClose} />);

    const input = screen.getByPlaceholderText(
      /Search scripture, lyrics, slides, or commands/,
    );
    await user.type(input, "test");

    // The Actions group should appear with "Black display"
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Black display")).toBeInTheDocument();
  });
});
