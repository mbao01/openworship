import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { StagePanel } from "./StagePanel";

vi.mock("../../../hooks/use-queue", () => ({
  useQueue: () => ({
    queue: [],
    live: null,
    approve: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(undefined),
    clearLive: vi.fn().mockResolvedValue(undefined),
    rejectLive: vi.fn().mockResolvedValue(undefined),
    blackout: false,
    toggleBlackout: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../../hooks/use-translations", () => ({
  useTranslations: () => ({
    translations: [{ id: "KJV", abbreviation: "KJV" }],
    active: "KJV",
    setActive: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../../hooks/use-display-background", () => ({
  useDisplayBackground: () => ({
    activeId: null,
    previewId: null,
    presets: [],
    uploaded: [],
    setActive: vi.fn(),
    setPreview: vi.fn(),
  }),
}));

vi.mock("../../../hooks/use-display-info", () => ({
  useDisplayInfo: () => ({
    obsUrl: "http://localhost:7411/display",
    windowOpen: false,
    monitor: null,
  }),
}));

vi.mock("../../../lib/toast", () => ({
  toastError: () => () => {},
}));

describe("StagePanel", () => {
  it("has no axe violations", async () => {
    const { container } = render(<StagePanel mode="copilot" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
