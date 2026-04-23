import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { invoke } from "../lib/tauri";
import type { ChurchIdentity } from "../lib/types";

type Flow = "pick" | "create" | "join";

interface OnboardingPageProps {
  onComplete: (identity: ChurchIdentity) => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [flow, setFlow] = useState<Flow>("pick");

  return (
    <div
      data-qa="onboarding-root"
      className="fixed inset-0 flex items-center justify-center bg-bg font-sans"
    >
      <div className="flex w-[480px] flex-col gap-6 rounded-lg border border-line bg-bg-2 px-8 py-10 shadow-lg">
        <div className="mb-2 flex flex-col items-center gap-2 text-center">
          <img src="/logo.svg" alt="OpenWorship" className="h-12 w-12" />
          <span className="font-sans text-[11px] font-medium tracking-[0.2em] text-ink-3 uppercase">
            openworship
          </span>
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
      <h1 className="m-0 text-center text-[20px] font-semibold text-ink">
        Set up your church
      </h1>
      <p className="m-0 text-center text-[13px] leading-[1.5] text-ink-3">
        Choose how you want to get started.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <button
          className="flex cursor-pointer items-center gap-4 rounded border border-line bg-bg-1 px-6 py-4 text-left transition-[border-color,background] duration-150 ease-out hover:border-line-strong hover:bg-bg-2"
          onClick={() => onSelect("create")}
        >
          <span className="flex flex-1 flex-col gap-1">
            <span className="font-sans text-[13px] font-medium text-ink">
              Create a new church
            </span>
            <span className="text-[12px] leading-[1.4] text-ink-3">
              Start fresh — you'll be the headquarters branch.
            </span>
          </span>
          <ChevronRightIcon className="size-4 shrink-0 text-ink-3" />
        </button>
        <button
          className="flex cursor-pointer items-center gap-4 rounded border border-line bg-bg-1 px-6 py-4 text-left transition-[border-color,background] duration-150 ease-out hover:border-line-strong hover:bg-bg-2"
          onClick={() => onSelect("join")}
        >
          <span className="flex flex-1 flex-col gap-1">
            <span className="font-sans text-[13px] font-medium text-ink">
              Join an existing church
            </span>
            <span className="text-[12px] leading-[1.4] text-ink-3">
              Enter an invite code from your HQ branch.
            </span>
          </span>
          <ChevronRightIcon className="size-4 shrink-0 text-ink-3" />
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
      <h1 className="m-0 text-center text-[20px] font-semibold text-ink">
        Create a new church
      </h1>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase"
            htmlFor="church-name"
          >
            Church name
          </label>
          <input
            id="church-name"
            className="border-0 border-b border-b-line bg-transparent py-2 font-sans text-[14px] text-ink transition-[border-color] duration-150 ease-linear outline-none placeholder:text-muted focus:border-b-accent focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="Grace Community Church"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase"
            htmlFor="branch-name"
          >
            Branch name
          </label>
          <input
            id="branch-name"
            className="border-0 border-b border-b-line bg-transparent py-2 font-sans text-[14px] text-ink transition-[border-color] duration-150 ease-linear outline-none placeholder:text-muted focus:border-b-accent focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="Main Campus"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
          <p className="m-0 text-[11px] leading-[1.4] text-muted">
            This will be your HQ branch.
          </p>
        </div>

        {error && (
          <p className="m-0 text-[12px] leading-[1.4] text-danger">{error}</p>
        )}

        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            className="cursor-pointer rounded border border-line bg-transparent px-4 py-[7px] font-sans text-[11px] font-medium tracking-[0.08em] text-ink uppercase transition-[border-color] duration-150 ease-out hover:border-line-strong"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded border-0 bg-accent px-5 py-[7px] font-sans text-[11px] font-medium tracking-[0.08em] text-accent-foreground uppercase transition-[filter] duration-150 ease-out hover:not-disabled:brightness-115 disabled:cursor-not-allowed disabled:opacity-40"
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
      <h1 className="m-0 text-center text-[20px] font-semibold text-ink">
        Join an existing church
      </h1>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase"
            htmlFor="invite-code"
          >
            Invite code
          </label>
          <input
            id="invite-code"
            className="border-0 border-b border-b-line bg-transparent py-2 font-mono text-[16px] tracking-[0.15em] text-ink transition-[border-color] duration-150 ease-linear outline-none placeholder:text-muted focus:border-b-accent focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="ABCDEF1234567890"
            maxLength={16}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            autoFocus
          />
          <p className="m-0 text-[11px] leading-[1.4] text-muted">
            16-character code from your HQ branch.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase"
            htmlFor="branch-name-join"
          >
            Branch name
          </label>
          <input
            id="branch-name-join"
            className="border-0 border-b border-b-line bg-transparent py-2 font-sans text-[14px] text-ink transition-[border-color] duration-150 ease-linear outline-none placeholder:text-muted focus:border-b-accent focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="North Campus"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
        </div>

        {error && (
          <p className="m-0 text-[12px] leading-[1.4] text-danger">{error}</p>
        )}

        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            className="cursor-pointer rounded border border-line bg-transparent px-4 py-[7px] font-sans text-[11px] font-medium tracking-[0.08em] text-ink uppercase transition-[border-color] duration-150 ease-out hover:border-line-strong"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded border-0 bg-accent px-5 py-[7px] font-sans text-[11px] font-medium tracking-[0.08em] text-accent-foreground uppercase transition-[filter] duration-150 ease-out hover:not-disabled:brightness-115 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={
              inviteCode.trim().length !== 16 || !branchName.trim() || loading
            }
          >
            {loading ? "Joining…" : "Join Church"}
          </button>
        </div>
      </form>
    </>
  );
}
