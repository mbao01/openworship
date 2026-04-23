import { describe, it, expect, beforeEach } from "vitest";
import {
  isTourActive,
  getCurrentStep,
  startTour,
  advanceStep,
  goToStep,
  dismissTour,
  completeTour,
  resetTour,
  showExitConfirm,
  hideExitConfirm,
} from "./tour-store";

// Reset store state before each test
beforeEach(async () => {
  await resetTour();
  hideExitConfirm();
});

describe("tour-store", () => {
  describe("initial state after reset", () => {
    it("is not active after reset", () => {
      expect(isTourActive()).toBe(false);
    });

    it("has null current step after reset", () => {
      expect(getCurrentStep()).toBeNull();
    });
  });

  describe("startTour", () => {
    it("marks tour as active", async () => {
      await startTour();
      expect(isTourActive()).toBe(true);
    });

    it("sets current step to 1", async () => {
      await startTour();
      expect(getCurrentStep()).toBe(1);
    });
  });

  describe("advanceStep", () => {
    it("advances from step 1 to step 2", async () => {
      await goToStep(1);
      await advanceStep();
      expect(getCurrentStep()).toBe(2);
    });

    it("advances from step 4 to step 5", async () => {
      await goToStep(4);
      await advanceStep();
      expect(getCurrentStep()).toBe(5);
    });

    it("completes tour after step 5", async () => {
      await goToStep(5);
      await advanceStep();
      expect(isTourActive()).toBe(false);
      expect(getCurrentStep()).toBeNull();
    });

    it("does nothing when not in progress", async () => {
      await resetTour();
      await advanceStep();
      expect(isTourActive()).toBe(false);
    });
  });

  describe("goToStep", () => {
    it("jumps directly to step 3", async () => {
      await goToStep(3);
      expect(getCurrentStep()).toBe(3);
    });

    it("keeps tour active after goToStep", async () => {
      await goToStep(2);
      expect(isTourActive()).toBe(true);
    });
  });

  describe("dismissTour", () => {
    it("marks tour as inactive after dismiss", async () => {
      await startTour();
      await dismissTour();
      expect(isTourActive()).toBe(false);
    });
  });

  describe("completeTour", () => {
    it("marks tour as inactive after complete", async () => {
      await startTour();
      await completeTour();
      expect(isTourActive()).toBe(false);
    });
  });

  describe("isTourActive", () => {
    it("is true for all in_progress steps", async () => {
      for (const step of [1, 2, 3, 4, 5] as const) {
        await goToStep(step);
        expect(isTourActive()).toBe(true);
      }
    });

    it("is false after reset", async () => {
      await resetTour();
      expect(isTourActive()).toBe(false);
    });

    it("is false after dismiss", async () => {
      await startTour();
      await dismissTour();
      expect(isTourActive()).toBe(false);
    });

    it("is false after complete", async () => {
      await startTour();
      await completeTour();
      expect(isTourActive()).toBe(false);
    });
  });

  describe("exit confirm", () => {
    it("showExitConfirm/hideExitConfirm do not throw", () => {
      showExitConfirm();
      hideExitConfirm();
      expect(true).toBe(true);
    });
  });
});
