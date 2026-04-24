import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockGetTutorialState = vi.fn<() => Promise<string>>();
const mockSetTutorialState = vi.fn<(s: string) => Promise<void>>();

vi.mock("@/lib/commands/tutorial", () => ({
  getTutorialState: (...args: unknown[]) => mockGetTutorialState(...(args as [])),
  setTutorialState: (...args: unknown[]) => mockSetTutorialState(...(args as [string])),
}));

import { useTutorial } from "./use-tutorial";
import type { TutorialState } from "@/lib/types";

describe("useTutorial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTutorialState.mockResolvedValue("not_started");
    mockSetTutorialState.mockResolvedValue(undefined);
  });

  it("starts loading=true then resolves with persisted state", async () => {
    mockGetTutorialState.mockResolvedValue("in_progress_step_2");
    const { result } = renderHook(() => useTutorial());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tutorialState).toBe("in_progress_step_2");
    expect(result.current.activeStep).toBe(2);
  });

  it("activeStep is null for non-progress states", async () => {
    mockGetTutorialState.mockResolvedValue("completed");
    const { result } = renderHook(() => useTutorial());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeStep).toBeNull();
  });

  it("activeStep maps all five in_progress steps correctly", async () => {
    for (let i = 1; i <= 5; i++) {
      mockGetTutorialState.mockResolvedValue(`in_progress_step_${i}` as TutorialState);
      const { result } = renderHook(() => useTutorial());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.activeStep).toBe(i);
    }
  });

  it("getTutorialState failure leaves state as not_started", async () => {
    mockGetTutorialState.mockRejectedValue(new Error("backend error"));
    const { result } = renderHook(() => useTutorial());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tutorialState).toBe("not_started");
  });

  it("startTour sets state to in_progress_step_1", async () => {
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startTour();
    });

    expect(mockSetTutorialState).toHaveBeenCalledWith("in_progress_step_1");
    expect(result.current.tutorialState).toBe("in_progress_step_1");
    expect(result.current.activeStep).toBe(1);
  });

  it("goToStep sets the correct state", async () => {
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.goToStep(3);
    });

    expect(mockSetTutorialState).toHaveBeenCalledWith("in_progress_step_3");
    expect(result.current.activeStep).toBe(3);
  });

  it("nextStep advances from step 1 to 2", async () => {
    mockGetTutorialState.mockResolvedValue("in_progress_step_1");
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.nextStep();
    });

    expect(mockSetTutorialState).toHaveBeenCalledWith("in_progress_step_2");
    expect(result.current.activeStep).toBe(2);
  });

  it("nextStep from step 5 completes the tour", async () => {
    mockGetTutorialState.mockResolvedValue("in_progress_step_5");
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.nextStep();
    });

    expect(mockSetTutorialState).toHaveBeenCalledWith("completed");
    expect(result.current.tutorialState).toBe("completed");
    expect(result.current.activeStep).toBeNull();
  });

  it("nextStep is a no-op when state is not in_progress", async () => {
    mockGetTutorialState.mockResolvedValue("dismissed");
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.nextStep();
    });

    expect(mockSetTutorialState).not.toHaveBeenCalled();
  });

  it("dismissTour sets state to dismissed", async () => {
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.dismissTour();
    });

    expect(mockSetTutorialState).toHaveBeenCalledWith("dismissed");
    expect(result.current.tutorialState).toBe("dismissed");
  });

  it("completeTour sets state to completed", async () => {
    const { result } = renderHook(() => useTutorial());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.completeTour();
    });

    expect(mockSetTutorialState).toHaveBeenCalledWith("completed");
    expect(result.current.tutorialState).toBe("completed");
  });
});
