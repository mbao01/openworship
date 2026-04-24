import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutSection } from "./AboutSection";

describe("AboutSection", () => {
  it("renders without crashing", () => {
    const { container } = render(<AboutSection />);
    expect(container).toBeTruthy();
  });

  it("shows the About heading", () => {
    render(<AboutSection />);
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("shows the app name", () => {
    render(<AboutSection />);
    expect(screen.getByText("openworship")).toBeInTheDocument();
  });

  it("shows the app description", () => {
    render(<AboutSection />);
    expect(screen.getByText("AI-powered worship presentation")).toBeInTheDocument();
  });

  it("shows version number", () => {
    render(<AboutSection />);
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("shows build label", () => {
    render(<AboutSection />);
    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
  });
});
