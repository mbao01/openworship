import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ServiceProject, StorageUsage } from "../../../lib/types";

vi.mock("@radix-ui/react-collapsible", () => ({
  Collapsible: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-open={open}>{children}</div>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="collapsible-trigger">{children}</div>
  ),
}));

vi.mock("./helpers", () => ({
  formatStorageBytes: (bytes: number) => `${bytes}B`,
  iconCls: "h-4 w-4",
}));

import { AssetsNav } from "./AssetsNav";
import type { Nav } from "./types";

const makeProject = (overrides: Partial<ServiceProject> = {}): ServiceProject => ({
  id: "proj-1",
  name: "Sunday Service",
  closed_at_ms: null,
  scheduled_at_ms: null,
  description: null,
  items: [],
  tasks: [],
  created_at_ms: 1700000000000,
  ...overrides,
} as ServiceProject);

describe("AssetsNav", () => {
  const onNav = vi.fn();
  const onToggleCloud = vi.fn();
  const defaultNav: Nav = { kind: "all" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderNav = (
    props: Partial<{
      projects: ServiceProject[];
      nav: Nav;
      usage: StorageUsage | null;
      cloudExpanded: boolean;
    }> = {},
  ) =>
    render(
      <AssetsNav
        projects={props.projects ?? []}
        nav={props.nav ?? defaultNav}
        onNav={onNav}
        usage={props.usage ?? null}
        cloudExpanded={props.cloudExpanded ?? false}
        onToggleCloud={onToggleCloud}
      />,
    );

  it("renders without crashing", () => {
    const { container } = renderNav();
    expect(container).toBeTruthy();
  });

  it("renders All Assets nav button", () => {
    renderNav();
    expect(screen.getByText("All Assets")).toBeInTheDocument();
  });

  it("renders Recent nav button", () => {
    renderNav();
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("renders Starred nav button", () => {
    renderNav();
    expect(screen.getByText("Starred")).toBeInTheDocument();
  });

  it("renders My Branch cloud button", () => {
    renderNav();
    expect(screen.getByText("My Branch")).toBeInTheDocument();
  });

  it("renders Church Shared button", () => {
    renderNav();
    expect(screen.getByText("Church Shared")).toBeInTheDocument();
  });

  it("calls onNav with {kind:'all'} when All Assets is clicked", () => {
    renderNav();
    fireEvent.click(screen.getByText("All Assets"));
    expect(onNav).toHaveBeenCalledWith({ kind: "all" });
  });

  it("calls onNav with {kind:'recent'} when Recent is clicked", () => {
    renderNav();
    fireEvent.click(screen.getByText("Recent"));
    expect(onNav).toHaveBeenCalledWith({ kind: "recent" });
  });

  it("calls onNav with {kind:'starred'} when Starred is clicked", () => {
    renderNav();
    fireEvent.click(screen.getByText("Starred"));
    expect(onNav).toHaveBeenCalledWith({ kind: "starred" });
  });

  it("shows service projects when provided", () => {
    renderNav({ projects: [makeProject({ name: "Easter Service" })] });
    expect(screen.getByText("Easter Service")).toBeInTheDocument();
  });

  it("calls onNav with service nav when project is clicked", () => {
    renderNav({ projects: [makeProject({ id: "proj-1", name: "Easter Service" })] });
    fireEvent.click(screen.getByText("Easter Service"));
    expect(onNav).toHaveBeenCalledWith({ kind: "service", id: "proj-1", name: "Easter Service" });
  });

  it("does not render Services section when no projects", () => {
    renderNav({ projects: [] });
    expect(screen.queryByText("Services")).not.toBeInTheDocument();
  });

  it("shows Storage section when usage is provided", () => {
    renderNav({ usage: { used_bytes: 1024, quota_bytes: 10240 } as StorageUsage });
    expect(screen.getByText(/1024B/)).toBeInTheDocument();
  });

  it("does not show storage footer when usage is null", () => {
    renderNav({ usage: null });
    // No storage label should appear
    expect(screen.queryByText(/used/)).not.toBeInTheDocument();
  });

  it("highlights active nav item", () => {
    renderNav({ nav: { kind: "recent" } });
    // The Recent button should have active class
    const recentBtn = screen.getByText("Recent").closest("button");
    expect(recentBtn?.className).toContain("font-medium");
  });
});
