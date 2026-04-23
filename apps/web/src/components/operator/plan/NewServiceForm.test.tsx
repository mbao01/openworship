import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewServiceForm } from "./NewServiceForm";

describe("NewServiceForm", () => {
  const onCreate = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the input with placeholder", () => {
    render(<NewServiceForm onCreate={onCreate} onCancel={onCancel} />);
    expect(screen.getByPlaceholderText("Untitled service")).toBeInTheDocument();
  });

  it("renders Create and Cancel buttons", () => {
    render(<NewServiceForm onCreate={onCreate} onCancel={onCancel} />);
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onCreate with the trimmed name on form submit", async () => {
    const user = userEvent.setup();
    render(<NewServiceForm onCreate={onCreate} onCancel={onCancel} />);

    const input = screen.getByPlaceholderText("Untitled service");
    await user.type(input, "  Easter Sunday  ");
    await user.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith("Easter Sunday");
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<NewServiceForm onCreate={onCreate} onCancel={onCancel} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCreate with empty string when input is empty", async () => {
    const user = userEvent.setup();
    render(<NewServiceForm onCreate={onCreate} onCancel={onCancel} />);

    await user.click(screen.getByText("Create"));
    expect(onCreate).toHaveBeenCalledWith("");
  });
});
