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
    <div data-qa="onboarding-root" className="fixed inset-0 bg-void flex items-center justify-center font-sans">
      <div className="w-[480px] bg-slate border border-iron rounded-none px-8 py-10 flex flex-col gap-6">
        <div className="text-center mb-2 flex flex-col items-center gap-2">
          <img src="/logo.svg" alt="OpenWorship" className="w-12 h-12" />
          <span className="font-sans text-[11px] font-medium tracking-[0.2em] text-ash uppercase">
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
      <h1 className="text-[20px] font-semibold text-chalk m-0 text-center">
        Set up your church
      </h1>
      <p className="text-[13px] text-ash m-0 text-center leading-[1.5]">
        Choose how you want to get started.
      </p>
      <div className="flex flex-col gap-2 mt-2">
        <button
          className="flex flex-col gap-1 bg-obsidian border border-iron rounded-sm px-6 py-4 text-left cursor-pointer transition-[border-color,background] duration-150 ease-out hover:border-ash hover:bg-white/[0.03]"
          onClick={() => onSelect("create")}
        >
          <span className="font-sans text-[13px] font-medium text-chalk">
            Create a new church
          </span>
          <span className="text-[12px] text-ash leading-[1.4]">
            Start fresh — you'll be the headquarters branch.
          </span>
        </button>
        <button
          className="flex flex-col gap-1 bg-obsidian border border-iron rounded-sm px-6 py-4 text-left cursor-pointer transition-[border-color,background] duration-150 ease-out hover:border-ash hover:bg-white/[0.03]"
          onClick={() => onSelect("join")}
        >
          <span className="font-sans text-[13px] font-medium text-chalk">
            Join an existing church
          </span>
          <span className="text-[12px] text-ash leading-[1.4]">
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
      <h1 className="text-[20px] font-semibold text-chalk m-0 text-center">
        Create a new church
      </h1>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ash uppercase"
            htmlFor="church-name"
          >
            Church name
          </label>
          <input
            id="church-name"
            className="bg-transparent border-0 border-b border-b-[rgba(42,42,42,0.7)] outline-none py-2 font-sans text-[14px] text-chalk transition-[border-color] duration-150 ease-linear placeholder:text-smoke focus:border-b-gold focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="Grace Community Church"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ash uppercase"
            htmlFor="branch-name"
          >
            Branch name
          </label>
          <input
            id="branch-name"
            className="bg-transparent border-0 border-b border-b-[rgba(42,42,42,0.7)] outline-none py-2 font-sans text-[14px] text-chalk transition-[border-color] duration-150 ease-linear placeholder:text-smoke focus:border-b-gold focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="Main Campus"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
          <p className="text-[11px] text-smoke m-0 leading-[1.4]">
            This will be your HQ branch.
          </p>
        </div>

        {error && (
          <p className="text-[12px] text-ember m-0 leading-[1.4]">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-chalk bg-transparent border border-iron rounded-sm px-4 py-[7px] cursor-pointer transition-[border-color] duration-150 ease-out uppercase hover:border-ash"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="submit"
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-0 rounded-sm px-5 py-[7px] cursor-pointer transition-[filter] duration-150 ease-out uppercase hover:not-disabled:brightness-115 disabled:opacity-40 disabled:cursor-not-allowed"
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
      <h1 className="text-[20px] font-semibold text-chalk m-0 text-center">
        Join an existing church
      </h1>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ash uppercase"
            htmlFor="invite-code"
          >
            Invite code
          </label>
          <input
            id="invite-code"
            className="bg-transparent border-0 border-b border-b-[rgba(42,42,42,0.7)] outline-none py-2 font-mono tracking-[0.15em] text-[16px] text-chalk transition-[border-color] duration-150 ease-linear placeholder:text-smoke focus:border-b-gold focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="ABC12345"
            maxLength={8}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            autoFocus
          />
          <p className="text-[11px] text-smoke m-0 leading-[1.4]">
            8-character code from your HQ branch.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-medium tracking-[0.12em] text-ash uppercase"
            htmlFor="branch-name-join"
          >
            Branch name
          </label>
          <input
            id="branch-name-join"
            className="bg-transparent border-0 border-b border-b-[rgba(42,42,42,0.7)] outline-none py-2 font-sans text-[14px] text-chalk transition-[border-color] duration-150 ease-linear placeholder:text-smoke focus:border-b-gold focus:shadow-[0_2px_0_-1px_rgba(201,168,76,0.12)]"
            type="text"
            placeholder="North Campus"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-[12px] text-ember m-0 leading-[1.4]">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-chalk bg-transparent border border-iron rounded-sm px-4 py-[7px] cursor-pointer transition-[border-color] duration-150 ease-out uppercase hover:border-ash"
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="submit"
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-0 rounded-sm px-5 py-[7px] cursor-pointer transition-[filter] duration-150 ease-out uppercase hover:not-disabled:brightness-115 disabled:opacity-40 disabled:cursor-not-allowed"
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
