import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterDropdown } from "./FilterDropdown";
import type { ArtifactCategory } from "../../../lib/types";

describe("FilterDropdown", () => {
  const allCategories: ArtifactCategory[] = [
    "image",
    "video",
    "audio",
    "document",
    "slide",
  ];
  const onToggle = vi.fn();
  const onToggleAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "All types" label when all filters are selected', () => {
    render(
      <FilterDropdown
        activeFilters={new Set(allCategories)}
        allSelected={true}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />,
    );
    expect(screen.getByText("All types")).toBeInTheDocument();
  });

  it("shows count when not all filters are selected", () => {
    render(
      <FilterDropdown
        activeFilters={new Set(["image", "video"] as ArtifactCategory[])}
        allSelected={false}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />,
    );
    expect(screen.getByText("2 types")).toBeInTheDocument();
  });

  it("shows singular form for one filter", () => {
    render(
      <FilterDropdown
        activeFilters={new Set(["image"] as ArtifactCategory[])}
        allSelected={false}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />,
    );
    expect(screen.getByText("1 type")).toBeInTheDocument();
  });

  it("clicking the button opens the dropdown", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        activeFilters={new Set(allCategories)}
        allSelected={true}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />,
    );

    await user.click(screen.getByText("All types"));

    // Dropdown should now show category labels
    expect(screen.getByText("Images")).toBeInTheDocument();
    expect(screen.getByText("Videos")).toBeInTheDocument();
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Slides")).toBeInTheDocument();
  });

  it("clicking a category calls onToggle with that category", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        activeFilters={new Set(allCategories)}
        allSelected={true}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />,
    );

    // Open dropdown
    await user.click(screen.getByText("All types"));
    // Click a specific category
    await user.click(screen.getByText("Videos"));

    expect(onToggle).toHaveBeenCalledWith("video");
  });

  it("clicking 'All types' in dropdown calls onToggleAll", async () => {
    const user = userEvent.setup();
    render(
      <FilterDropdown
        activeFilters={new Set(["image"] as ArtifactCategory[])}
        allSelected={false}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />,
    );

    // Open dropdown
    await user.click(screen.getByText("1 type"));
    // The first button inside the dropdown is the "All types" toggle
    // There are now two "All types" texts, click the one inside the dropdown
    const allTypesButtons = screen.getAllByText("All types");
    await user.click(allTypesButtons[0]);

    expect(onToggleAll).toHaveBeenCalledOnce();
  });
});
