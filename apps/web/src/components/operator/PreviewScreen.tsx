import { useState } from "react";

const CHECKLIST = [
  { k: "mic", label: "Microphone level checked", sub: "Check input device and gain" },
  { k: "display", label: "Display output connected", sub: "Projector or OBS browser source" },
  { k: "translation", label: "Default translation loaded", sub: "Offline cache ready" },
  { k: "internet", label: "Internet reachable (optional)", sub: "Online paraphrase match available" },
  { k: "song", label: "Closing song cued", sub: "Locally cached" },
  { k: "team", label: "Team notified", sub: "Shared link sent to volunteers" },
];

export function PreviewScreen() {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    mic: false, display: false, translation: false,
    internet: false, song: false, team: false,
  });
  const toggle = (k: string) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  const passed = Object.values(checks).filter(Boolean).length;

  return (
    <>
      {/* Checklist panel */}
      <section className="flex flex-col w-[340px] shrink-0 border-r border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Dry run {"\u00B7"} <strong className="text-ink-2 font-medium">checklist</strong>
          </span>
          <span className="font-mono text-[10px] text-accent">{passed} / {CHECKLIST.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {CHECKLIST.map((c) => (
            <div
              key={c.k}
              className="grid grid-cols-[22px_1fr] gap-3 items-start px-4 py-3.5 border-b border-line cursor-pointer hover:bg-bg-2"
              onClick={() => toggle(c.k)}
            >
              <div
                className={`w-[18px] h-[18px] rounded-[3px] mt-0.5 border flex items-center justify-center text-[11px] font-bold ${
                  checks[c.k]
                    ? "bg-accent border-accent text-[#1A0D00]"
                    : "bg-transparent border-line-strong"
                }`}
              >
                {checks[c.k] ? "\u2713" : ""}
              </div>
              <div>
                <div className="text-[13px] text-ink mb-0.5">{c.label}</div>
                <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3 uppercase">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview stage */}
      <section className="flex-1 flex flex-col bg-bg overflow-hidden">
        <div className="flex justify-between items-center px-3.5 py-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-ink-3 bg-bg-1 border-b border-line">
          <span>
            <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent mr-1.5" />
            PREVIEW {"\u00B7"} NOT ON AIR {"\u00B7"} dry-run mode
          </span>
          <span>STARTS IN {"\u00B7"} 00:14:22</span>
        </div>

        <div className="flex-1 p-5 flex items-center justify-center" style={{
          background: "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
        }}>
          <div
            className="w-full max-w-[960px] aspect-video bg-[#050403] text-[#F5EFDF] px-[72px] py-14 flex flex-col justify-center relative border border-line-strong opacity-[0.88]"
            style={{ boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)" }}
          >
            <div className="absolute top-0 left-0 right-0 px-5 py-2.5 flex justify-between font-mono text-[9.5px] tracking-[0.18em] uppercase text-[rgba(245,239,223,0.5)]">
              <span>{"\u25CB"} PREVIEW {"\u00B7"} NOT LIVE</span>
              <span>openworship</span>
            </div>
            <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-accent mb-5">
              Opening {"\u00B7"} title slide
            </div>
            <div className="text-left">
              <h1 className="font-serif text-[52px] tracking-[-0.02em] mb-5">Welcome home.</h1>
              <p className="text-[22px] text-[rgba(245,239,223,0.75)]">
                Your church {"\u00B7"} Sunday service
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-line bg-bg-1 h-[52px] shrink-0">
          <div className="flex gap-1">
            <span className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-accent bg-accent-soft border border-accent rounded-[3px]">
              {"\u25CB"} PREVIEW
            </span>
          </div>
          <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
            <button className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3">
              Step back
            </button>
            <button className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase bg-accent text-[#1A0D00] border border-accent rounded-[3px] font-semibold">
              Step forward <kbd className="font-mono text-[8.5px] px-1 py-px bg-black/20 rounded-sm text-black/60">{"\u2192"}</kbd>
            </button>
          </div>
          <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
            <button className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3">
              Simulate speech
            </button>
            <button className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-2 border border-line bg-bg-2 rounded-[3px] hover:bg-bg-3">
              Dry-run timer
            </button>
          </div>
          <div className="flex-1" />
          <button className="inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase bg-accent text-[#1A0D00] border border-accent rounded-[3px] font-semibold">
            Go live {"\u2192"}
          </button>
        </div>
      </section>

      {/* Rehearsal signal panel */}
      <section className="flex flex-col w-[320px] shrink-0 border-l border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Rehearsal <strong className="text-ink-2 font-medium">{"\u00B7"} signal</strong>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-[18px] py-4">
          <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-2.5">
            {"\u25CF"} SIMULATED TRANSCRIPT
          </div>
          <div className="font-serif text-sm leading-[1.6] text-ink-2 mb-6">
            <p className="mb-2">&ldquo;Good morning church, if you could find a seat we&apos;re going to begin&hellip;&rdquo;</p>
            <p className="text-muted italic">{"\u00B7"} paste sermon notes here to preview matches {"\u00B7"}</p>
          </div>

          <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-2.5">
            {"\u25CF"} ROOM
          </div>
          <div className="p-3.5 bg-bg-1 border border-line rounded-[3px] grid gap-2.5">
            <RoomRow label="Mic level" value="checking\u2026" valueColor="text-ink-2" />
            <RoomRow label="Room noise" value="checking\u2026" valueColor="text-ink-2" />
            <RoomRow label="Projector" value="not connected" valueColor="text-ink-3" />
            <RoomRow label="Volunteers online" value="\u2014" valueColor="text-ink-3" />
          </div>
        </div>
      </section>
    </>
  );
}

function RoomRow({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-ink-3">{label}</span>
      <span className={`font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
