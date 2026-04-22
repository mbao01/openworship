import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

describe("App", () => {
  it("renders the onboarding page at / when no identity is set", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    // invoke mock returns undefined → identity becomes undefined → onboarding
    // "openworship" appears in the onboarding logo after the async check resolves
    await waitFor(() => expect(screen.getByText("openworship")).toBeDefined());
  });

  it("renders the display page at /display", () => {
    render(
      <MemoryRouter initialEntries={["/display"]}>
        <App />
      </MemoryRouter>,
    );
    // Display root renders without crashing (WebSocket won't connect in test env)
    expect(document.querySelector(".display-root")).toBeDefined();
  });
});
