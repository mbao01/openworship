import { useState } from "react";
import { invoke } from "../lib/tauri";
import type { ChurchIdentity } from "../lib/types";
import "../styles/onboarding.css";

type Flow = "pick" | "create" | "join";

interface OnboardingPageProps {
  onComplete: (identity: ChurchIdentity) => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [flow, setFlow] = useState<Flow>("pick");

  return (
    <div className="onboarding-root">
      <div className="onboarding-card">
        <div className="onboarding-logo">
          <img src="/logo.svg" alt="OpenWorship" className="onboarding-logo__img" />
          <span className="onboarding-logo__name">openworship</span>
        </div>

        {flow === "pick" && <PickFlow onSelect={setFlow} />}
        {flow === "create" && (
          <CreateFlow onComplete={onComplete} onBack={() => setFlow("pick")} />
        )}
        {flow === "join" && (
          <JoinFlow onComplete={onComplete} onBack={() => setFlow("pick")} />
        )}
      </div>
    </div>
  );
}

// ─── Pick flow ────────────────────────────────────────────────────────────────

function PickFlow({ onSelect }: { onSelect: (f: Flow) => void }) {
  return (
    <>
      <h1 className="onboarding-heading">Set up your church</h1>
      <p className="onboarding-subheading">
        Choose how you want to get started.
      </p>
      <div className="onboarding-options">
        <button
          className="onboarding-option"
          onClick={() => onSelect("create")}
        >
          <span className="onboarding-option__title">Create a new church</span>
          <span className="onboarding-option__desc">
            Start fresh — you'll be the headquarters branch.
          </span>
        </button>
        <button
          className="onboarding-option"
          onClick={() => onSelect("join")}
        >
          <span className="onboarding-option__title">
            Join an existing church
          </span>
          <span className="onboarding-option__desc">
            Enter an invite code from your HQ branch.
          </span>
        </button>
      </div>
    </>
  );
}

// ─── Create flow ──────────────────────────────────────────────────────────────

function CreateFlow({
  onComplete,
  onBack,
}: {
  onComplete: (id: ChurchIdentity) => void;
  onBack: () => void;
}) {
  const [churchName, setChurchName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchName.trim() || !branchName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const identity = await invoke<ChurchIdentity>("create_church", {
        churchName: churchName.trim(),
        branchName: branchName.trim(),
      });
      onComplete(identity);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="onboarding-heading">Create a new church</h1>
      <form className="onboarding-form" onSubmit={handleSubmit}>
        <div className="onboarding-field">
          <label className="onboarding-label" htmlFor="church-name">
            Church name
          </label>
          <input
            id="church-name"
            className="onboarding-input"
            type="text"
            placeholder="Grace Community Church"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="onboarding-field">
          <label className="onboarding-label" htmlFor="branch-name">
            Branch name
          </label>
          <input
            id="branch-name"
            className="onboarding-input"
            type="text"
            placeholder="Main Campus"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
          <p className="onboarding-hint">This will be your HQ branch.</p>
        </div>

        {error && <p className="onboarding-error">{error}</p>}

        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-btn--secondary"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="submit"
            className="onboarding-btn--primary"
            disabled={!churchName.trim() || !branchName.trim() || loading}
          >
            {loading ? "Setting up…" : "Get Started"}
          </button>
        </div>
      </form>
    </>
  );
}

// ─── Join flow ────────────────────────────────────────────────────────────────

function JoinFlow({
  onComplete,
  onBack,
}: {
  onComplete: (id: ChurchIdentity) => void;
  onBack: () => void;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !branchName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const identity = await invoke<ChurchIdentity>("join_church", {
        inviteCode: inviteCode.trim().toUpperCase(),
        branchName: branchName.trim(),
      });
      onComplete(identity);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="onboarding-heading">Join an existing church</h1>
      <form className="onboarding-form" onSubmit={handleSubmit}>
        <div className="onboarding-field">
          <label className="onboarding-label" htmlFor="invite-code">
            Invite code
          </label>
          <input
            id="invite-code"
            className="onboarding-input onboarding-input--mono"
            type="text"
            placeholder="ABC12345"
            maxLength={8}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            autoFocus
          />
          <p className="onboarding-hint">8-character code from your HQ branch.</p>
        </div>
        <div className="onboarding-field">
          <label className="onboarding-label" htmlFor="branch-name-join">
            Branch name
          </label>
          <input
            id="branch-name-join"
            className="onboarding-input"
            type="text"
            placeholder="North Campus"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
        </div>

        {error && <p className="onboarding-error">{error}</p>}

        <div className="onboarding-actions">
          <button
            type="button"
            className="onboarding-btn--secondary"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="submit"
            className="onboarding-btn--primary"
            disabled={
              inviteCode.trim().length !== 8 ||
              !branchName.trim() ||
              loading
            }
          >
            {loading ? "Joining…" : "Join Church"}
          </button>
        </div>
      </form>
    </>
  );
}
