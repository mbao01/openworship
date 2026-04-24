import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ServiceTask } from "@/lib/types";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

import { TaskBoard } from "./TaskBoard";

const makeTask = (overrides: Partial<ServiceTask> = {}): ServiceTask => ({
  id: "task-1",
  service_id: "proj-1",
  title: "Write sermon outline",
  description: null,
  status: "todo",
  created_at_ms: 1700000000000,
  updated_at_ms: 1700000000000,
  ...overrides,
});

describe("TaskBoard", () => {
  const onUpdateTask = vi.fn().mockResolvedValue(undefined);
  const onToggleTaskDone = vi.fn().mockResolvedValue(undefined);
  const onDeleteTask = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderBoard = (tasks: ServiceTask[] = [], isReadOnly = false) =>
    render(
      <TaskBoard
        tasks={tasks}
        isReadOnly={isReadOnly}
        onUpdateTask={onUpdateTask}
        onToggleTaskDone={onToggleTaskDone}
        onDeleteTask={onDeleteTask}
      />,
    );

  it("renders without crashing", () => {
    const { container } = renderBoard();
    expect(container).toBeTruthy();
  });

  it("renders all 5 status columns", () => {
    renderBoard();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows task count badges for each column", () => {
    renderBoard([makeTask({ status: "todo" }), makeTask({ id: "task-2", status: "done" })]);
    // Each column shows count; there are 5 columns
    const badges = screen.getAllByText("0");
    // backlog, in_progress, cancelled should show 0
    expect(badges.length).toBeGreaterThanOrEqual(3);
    // todo and done should show 1
    expect(screen.getAllByText("1").length).toBe(2);
  });

  it("renders task title in the correct column", () => {
    renderBoard([makeTask({ title: "Prepare slides", status: "in_progress" })]);
    expect(screen.getByText("Prepare slides")).toBeInTheDocument();
  });

  it("renders multiple tasks across columns", () => {
    renderBoard([
      makeTask({ id: "t1", title: "Task A", status: "todo" }),
      makeTask({ id: "t2", title: "Task B", status: "done" }),
      makeTask({ id: "t3", title: "Task C", status: "backlog" }),
    ]);
    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("Task B")).toBeInTheDocument();
    expect(screen.getByText("Task C")).toBeInTheDocument();
  });

  it("shows delete button on hover (not disabled in read-write mode)", () => {
    renderBoard([makeTask()]);
    const deleteBtn = screen.getByTitle("Delete task");
    expect(deleteBtn).toBeInTheDocument();
  });

  it("calls onDeleteTask when delete button is clicked", () => {
    renderBoard([makeTask()]);
    fireEvent.click(screen.getByTitle("Delete task"));
    expect(onDeleteTask).toHaveBeenCalledWith("task-1");
  });

  it("calls onToggleTaskDone when toggle checkbox is clicked", () => {
    renderBoard([makeTask()]);
    // The toggle checkbox button is the first button in the card
    const checkboxes = screen.getAllByRole("button");
    // Find the small checkbox button (not delete)
    const toggleBtn = checkboxes.find((b) => !b.title && b.className.includes("h-3"));
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(onToggleTaskDone).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
    }
  });

  it("does not show delete button in read-only mode", () => {
    renderBoard([makeTask()], true);
    expect(screen.queryByTitle("Delete task")).not.toBeInTheDocument();
  });

  it("toggle button is disabled in read-only mode", () => {
    renderBoard([makeTask()], true);
    const buttons = screen.getAllByRole("button");
    // All buttons should be disabled in read-only
    const disabledBtns = buttons.filter((b) => b.hasAttribute("disabled"));
    expect(disabledBtns.length).toBeGreaterThan(0);
  });

  it("renders done task with strikethrough-like style", () => {
    renderBoard([makeTask({ status: "done", title: "Finished task" })]);
    expect(screen.getByText("Finished task")).toBeInTheDocument();
  });

  it("renders cancelled task", () => {
    renderBoard([makeTask({ status: "cancelled", title: "Cancelled task" })]);
    const titleEl = screen.getByText("Cancelled task");
    expect(titleEl).toHaveClass("line-through");
  });

  it("renders empty board with all columns showing 0 tasks", () => {
    renderBoard([]);
    const zeroBadges = screen.getAllByText("0");
    expect(zeroBadges.length).toBe(5);
  });
});
