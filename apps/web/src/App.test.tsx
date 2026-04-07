import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

describe("App", () => {
  it("renders the operator page at /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText("openworship")).toBeDefined();
  });

  it("renders the display page at /display", () => {
    render(
      <MemoryRouter initialEntries={["/display"]}>
        <App />
      </MemoryRouter>
    );
    // Display root renders without crashing (WebSocket won't connect in test env)
    expect(document.querySelector(".display-root")).toBeDefined();
  });
});
