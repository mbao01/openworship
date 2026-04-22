import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableName } from "./EditableName";

describe("EditableName", () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the name as an h1 heading", () => {
    render(
      <EditableName name="Sunday Service" isReadOnly={false} onSave={onSave} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sunday Service",
    );
  });

  it('shows "Untitled service" when name is empty', () => {
    render(<EditableName name="" isReadOnly={false} onSave={onSave} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Untitled service",
    );
  });

  it("clicking the name enables edit mode", async () => {
    const user = userEvent.setup();
    render(
      <EditableName name="Sunday Service" isReadOnly={false} onSave={onSave} />,
    );

    await user.click(screen.getByRole("heading", { level: 1 }));

    // Now an input should appear with the current name
    const input = screen.getByDisplayValue("Sunday Service");
    expect(input).toBeInTheDocument();
  });

  it("does not enter edit mode when isReadOnly", async () => {
    const user = userEvent.setup();
    render(
      <EditableName name="Sunday Service" isReadOnly={true} onSave={onSave} />,
    );

    await user.click(screen.getByRole("heading", { level: 1 }));

    // Should still be an h1, not an input
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("blur saves the new name", async () => {
    const user = userEvent.setup();
    render(
      <EditableName name="Sunday Service" isReadOnly={false} onSave={onSave} />,
    );

    await user.click(screen.getByRole("heading", { level: 1 }));
    const input = screen.getByDisplayValue("Sunday Service");
    await user.clear(input);
    await user.type(input, "Wednesday Service");
    await user.tab(); // triggers blur

    expect(onSave).toHaveBeenCalledWith("Wednesday Service");
  });

  it("pressing Enter saves the name", async () => {
    const user = userEvent.setup();
    render(
      <EditableName name="Sunday Service" isReadOnly={false} onSave={onSave} />,
    );

    await user.click(screen.getByRole("heading", { level: 1 }));
    const input = screen.getByDisplayValue("Sunday Service");
    await user.clear(input);
    await user.type(input, "New Name{Enter}");

    expect(onSave).toHaveBeenCalledWith("New Name");
  });

  it("pressing Escape cancels editing without saving", async () => {
    const user = userEvent.setup();
    render(
      <EditableName name="Sunday Service" isReadOnly={false} onSave={onSave} />,
    );

    await user.click(screen.getByRole("heading", { level: 1 }));
    const input = screen.getByDisplayValue("Sunday Service");
    await user.clear(input);
    await user.type(input, "Changed");
    await user.keyboard("{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sunday Service",
    );
  });
});
