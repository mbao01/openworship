import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { WelcomeModal } from "./WelcomeModal";

describe("WelcomeModal", () => {
  const onStartTour = vi.fn();
  const onSetUpLater = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the church name in the headline", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    expect(screen.getByText(/Welcome to Grace Chapel!/i)).toBeInTheDocument();
  });

  it("renders the dialog role", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders 'Start the tour' button", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    expect(
      screen.getByRole("button", { name: /start the tour/i }),
    ).toBeInTheDocument();
  });

  it("renders 'Set up later' button", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    expect(
      screen.getByRole("button", { name: /set up later/i }),
    ).toBeInTheDocument();
  });

  it("calls onStartTour when 'Start the tour' is clicked", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start the tour/i }));
    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(onSetUpLater).not.toHaveBeenCalled();
  });

  it("calls onSetUpLater when 'Set up later' is clicked", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /set up later/i }));
    expect(onSetUpLater).toHaveBeenCalledTimes(1);
    expect(onStartTour).not.toHaveBeenCalled();
  });

  it("stores reminder session count in localStorage when 'Set up later' is clicked", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /set up later/i }));
    expect(localStorage.getItem("ow_tutorial_reminder_sessions")).toBe("2");
  });

  it("does not set localStorage when 'Start the tour' is clicked", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start the tour/i }));
    expect(localStorage.getItem("ow_tutorial_reminder_sessions")).toBeNull();
  });

  it("renders 'openworship' branding text", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    expect(screen.getByText("openworship")).toBeInTheDocument();
  });

  it("renders demo content callout", () => {
    render(
      <WelcomeModal
        churchName="Grace Chapel"
        onStartTour={onStartTour}
        onSetUpLater={onSetUpLater}
      />,
    );
    expect(screen.getByText(/demo content included/i)).toBeInTheDocument();
  });
});
