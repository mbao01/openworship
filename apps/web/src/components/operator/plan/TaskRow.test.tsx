import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./TaskRow";
import type { ServiceTask } from "@/lib/types";

function makeTask(overrides: Partial<ServiceTask> = {}): ServiceTask {
  return {
    id: "t1",
    service_id: "s1",
    title: "Prepare slides",
    description: null,
    status: "todo",
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
    ...overrides,
  };
}

describe("TaskRow", () => {
  const onToggle = vi.fn();
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the task title", () => {
    render(
      <TaskRow
        task={makeTask()}
        isReadOnly={false}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("Prepare slides")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    const { container } = render(
      <TaskRow
        task={makeTask({ status: "in_progress" })}
        isReadOnly={false}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );
    // The badge is a span with rounded-full class; the select also has "In Progress"
    const badge = container.querySelector("span.rounded-full");
    expect(badge).toHaveTextContent("In Progress");
  });

  it("calls onToggle when checkbox button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TaskRow
        task={makeTask()}
        isReadOnly={false}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    // The checkbox is the first button (w-4 h-4 rounded border)
    const checkboxButton = container.querySelector(
      "button.w-4",
    ) as HTMLButtonElement;
    await user.click(checkboxButton);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("clicking the title text enables edit mode", async () => {
    const user = userEvent.setup();
    render(
      <TaskRow
        task={makeTask()}
        isReadOnly={false}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("Prepare slides"));
    const input = screen.getByDisplayValue("Prepare slides");
    expect(input).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskRow
        task={makeTask()}
        isReadOnly={false}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    const deleteButton = screen.getByTitle("Delete task");
    await user.click(deleteButton);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not show edit controls when isReadOnly", () => {
    render(
      <TaskRow
        task={makeTask()}
        isReadOnly={true}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByTitle("Delete task")).not.toBeInTheDocument();
  });

  it("editing title and blurring saves via onUpdate", async () => {
    const user = userEvent.setup();
    render(
      <TaskRow
        task={makeTask()}
        isReadOnly={false}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("Prepare slides"));
    const input = screen.getByDisplayValue("Prepare slides");
    await user.clear(input);
    await user.type(input, "Updated title");
    await user.tab(); // blur

    expect(onUpdate).toHaveBeenCalledWith({ title: "Updated title" });
  });
});
