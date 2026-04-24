import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { NewMenu } from "./NewMenu";

describe("NewMenu", () => {
  const onNewFolder = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'New Folder' button", () => {
    render(<NewMenu onNewFolder={onNewFolder} onClose={onClose} />);
    expect(screen.getByRole("button", { name: /new folder/i })).toBeInTheDocument();
  });

  it("calls onNewFolder and onClose when 'New Folder' is clicked", () => {
    render(<NewMenu onNewFolder={onNewFolder} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    expect(onNewFolder).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside the menu", () => {
    render(
      <div>
        <NewMenu onNewFolder={onNewFolder} onClose={onClose} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the menu", () => {
    render(<NewMenu onNewFolder={onNewFolder} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole("button", { name: /new folder/i }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
