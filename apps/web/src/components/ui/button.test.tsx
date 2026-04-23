import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders with default variant and size", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
  });

  it.each(["default", "outline", "ghost", "danger", "secondary"] as const)(
    "renders variant=%s",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole("button", { name: variant });
      expect(button).toHaveAttribute("data-variant", variant);
    },
  );

  it.each(["default", "sm", "icon-sm"] as const)("renders size=%s", (size) => {
    render(<Button size={size}>btn</Button>);
    const button = screen.getByRole("button", { name: "btn" });
    expect(button).toHaveAttribute("data-size", size);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Press</Button>);
    await user.click(screen.getByRole("button", { name: "Press" }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Button disabled onClick={handleClick}>
        No click
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "No click" }));

    expect(handleClick).not.toHaveBeenCalled();
  });
});
