import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingPage } from "./OnboardingPage";

const mockInvoke = vi.fn();

vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("OnboardingPage", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the pick flow with two options", () => {
    render(<OnboardingPage onComplete={onComplete} />);
    expect(screen.getByText("Set up your church")).toBeInTheDocument();
    expect(screen.getByText("Create a new church")).toBeInTheDocument();
    expect(screen.getByText("Join an existing church")).toBeInTheDocument();
  });

  it('clicking "Create a new church" shows the create form', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage onComplete={onComplete} />);

    await user.click(screen.getByText("Create a new church"));

    expect(screen.getByLabelText(/Church name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch name/i)).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it('clicking "Join an existing church" shows the join form', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage onComplete={onComplete} />);

    await user.click(screen.getByText("Join an existing church"));

    expect(screen.getByLabelText(/Invite code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch name/i)).toBeInTheDocument();
    expect(screen.getByText("Join Church")).toBeInTheDocument();
  });

  it("create form Back button returns to pick flow", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage onComplete={onComplete} />);

    await user.click(screen.getByText("Create a new church"));
    await user.click(screen.getByText("Back"));

    expect(screen.getByText("Set up your church")).toBeInTheDocument();
  });

  it("create form submission calls invoke and onComplete", async () => {
    const user = userEvent.setup();
    const identity = {
      church_id: "c1",
      church_name: "Grace Church",
      branch_id: "b1",
      branch_name: "Main",
      role: "hq",
      invite_code: "ABC12345",
    };
    mockInvoke.mockResolvedValue(identity);

    render(<OnboardingPage onComplete={onComplete} />);

    await user.click(screen.getByText("Create a new church"));
    await user.type(screen.getByLabelText(/Church name/i), "Grace Church");
    await user.type(screen.getByLabelText(/Branch name/i), "Main");
    await user.click(screen.getByText("Get Started"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_church", {
        churchName: "Grace Church",
        branchName: "Main",
      });
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(identity);
    });
  });

  it("join form submission calls invoke and onComplete", async () => {
    const user = userEvent.setup();
    const identity = {
      church_id: "c2",
      church_name: "Grace Church",
      branch_id: "b2",
      branch_name: "North",
      role: "member",
      invite_code: null,
    };
    mockInvoke.mockResolvedValue(identity);

    render(<OnboardingPage onComplete={onComplete} />);

    await user.click(screen.getByText("Join an existing church"));
    await user.type(screen.getByLabelText(/Invite code/i), "ABC12345");
    await user.type(screen.getByLabelText(/Branch name/i), "North");
    await user.click(screen.getByText("Join Church"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("join_church", {
        inviteCode: "ABC12345",
        branchName: "North",
      });
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(identity);
    });
  });
});
