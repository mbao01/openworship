import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

describe("Modal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders children when open is true", () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Hello modal</p>
      </Modal>,
    );
    expect(screen.getByText("Hello modal")).toBeInTheDocument();
  });

  it("has the dialog role with aria-modal", () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal open={true} onClose={handleClose}>
        <p>Content</p>
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal open={true} onClose={handleClose}>
        <p>Content</p>
      </Modal>,
    );

    await user.keyboard("{Escape}");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal open={true} onClose={handleClose}>
        <p>Content</p>
      </Modal>,
    );

    // The backdrop is the first child div inside the modal root
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.firstElementChild as HTMLElement;
    await user.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
