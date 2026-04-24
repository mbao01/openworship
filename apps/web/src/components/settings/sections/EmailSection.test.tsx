import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ChurchIdentity, EmailSettings } from "@/lib/types";

const mockGetEmailSettings = vi.fn();
const mockSetEmailSettings = vi.fn();
const mockListEmailSubscribers = vi.fn();
const mockAddEmailSubscriber = vi.fn();
const mockRemoveEmailSubscriber = vi.fn();
const mockSendTestEmail = vi.fn();

vi.mock("@/lib/commands/settings", () => ({
  getEmailSettings: (...args: unknown[]) => mockGetEmailSettings(...args),
  setEmailSettings: (...args: unknown[]) => mockSetEmailSettings(...args),
}));

vi.mock("@/lib/commands/summaries", () => ({
  listEmailSubscribers: (...args: unknown[]) => mockListEmailSubscribers(...args),
  addEmailSubscriber: (...args: unknown[]) => mockAddEmailSubscriber(...args),
  removeEmailSubscriber: (...args: unknown[]) => mockRemoveEmailSubscriber(...args),
  sendTestEmail: (...args: unknown[]) => mockSendTestEmail(...args),
}));

vi.mock("@/components/ui/section", () => ({
  Section: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  ),
  SettingRow: ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/toggle", () => ({
  Toggle: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid="toggle"
    />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    onKeyDown,
  }: {
    value: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      onKeyDown={onKeyDown}
    />
  ),
}));

const baseSettings: EmailSettings = {
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  smtp_username: "church@example.com",
  smtp_password: "",
  from_name: "First Church",
  send_delay_hours: 0,
  auto_send: false,
};

const identity: ChurchIdentity = {
  church_id: "church-1",
  church_name: "First Church",
  branch_id: "branch-1",
  branch_name: "Main",
  role: "hq",
  invite_code: null,
};

describe("EmailSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmailSettings.mockResolvedValue(baseSettings);
    mockSetEmailSettings.mockResolvedValue(undefined);
    mockListEmailSubscribers.mockResolvedValue([]);
    mockAddEmailSubscriber.mockResolvedValue(undefined);
    mockRemoveEmailSubscriber.mockResolvedValue(undefined);
    mockSendTestEmail.mockResolvedValue(undefined);
  });

  it("shows loading state initially", async () => {
    mockGetEmailSettings.mockImplementation(() => new Promise(() => {})); // never resolves
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders SMTP configuration after loading", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByText("SMTP configuration")).toBeInTheDocument();
    });
  });

  it("shows the smtp_host value", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.gmail.com")).toBeInTheDocument();
    });
  });

  it("shows smtp port field", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("587")).toBeInTheDocument();
    });
  });

  it("shows smtp username", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("church@example.com")).toBeInTheDocument();
    });
  });

  it("shows Save button", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });
  });

  it("calls setEmailSettings when Save is clicked", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByText("Save"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => {
      expect(mockSetEmailSettings).toHaveBeenCalled();
    });
  });

  it("shows Send test email button", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByText("Send test email")).toBeInTheDocument();
    });
  });

  it("calls sendTestEmail when test email button clicked", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByText("Send test email"));
    fireEvent.click(screen.getByText("Send test email"));
    await waitFor(() => {
      expect(mockSendTestEmail).toHaveBeenCalledWith("church@example.com");
    });
  });

  it("shows 'Sent!' after test email is sent", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByText("Send test email"));
    fireEvent.click(screen.getByText("Send test email"));
    await waitFor(() => {
      expect(screen.getByText("Sent!")).toBeInTheDocument();
    });
  });

  it("shows No subscribers yet when list is empty", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByText("No subscribers yet.")).toBeInTheDocument();
    });
  });

  it("shows subscriber emails from list", async () => {
    mockListEmailSubscribers.mockResolvedValue([
      { email: "pastor@church.org" },
    ]);
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByText("pastor@church.org")).toBeInTheDocument();
    });
  });

  it("enables Add button only for valid email", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByPlaceholderText("email@example.com"));
    const addBtn = screen.getByText("Add");
    expect(addBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@email.com" },
    });
    expect(addBtn).not.toBeDisabled();
  });

  it("calls addEmailSubscriber and refreshes list", async () => {
    mockListEmailSubscribers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: "newuser@example.com" }]);
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByPlaceholderText("email@example.com"));

    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(mockAddEmailSubscriber).toHaveBeenCalledWith("newuser@example.com");
    });
  });

  it("removes subscriber when Remove is clicked", async () => {
    mockListEmailSubscribers.mockResolvedValue([{ email: "remove@me.com" }]);
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByText("remove@me.com"));

    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => {
      expect(mockRemoveEmailSubscriber).toHaveBeenCalledWith("remove@me.com");
    });
  });

  it("shows Auto-send section", async () => {
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => {
      expect(screen.getByText("Auto-send")).toBeInTheDocument();
    });
  });

  it("adds subscriber via Enter key", async () => {
    mockListEmailSubscribers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ email: "enter@key.com" }]);
    const { EmailSection } = await import("./EmailSection");
    render(<EmailSection identity={identity} />);
    await waitFor(() => screen.getByPlaceholderText("email@example.com"));

    const input = screen.getByPlaceholderText("email@example.com");
    fireEvent.change(input, { target: { value: "enter@key.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockAddEmailSubscriber).toHaveBeenCalledWith("enter@key.com");
    });
  });
});
