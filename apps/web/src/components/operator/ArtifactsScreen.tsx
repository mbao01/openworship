import { useEffect, useState } from "react";
import { invoke } from "../../lib/tauri";
import { toastError } from "../../lib/toast";
import type { ServiceProject } from "../../lib/types";

export function ArtifactsScreen() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    invoke<ServiceProject[]>("list_service_projects")
      .then((all) => {
        const closed = all.filter((p) => p.closed_at_ms !== null);
        setProjects(closed);
      })
      .catch(toastError("Failed to load projects"));
  }, []);

  const current = projects[selected];

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="flex-1 grid grid-cols-[1fr_2fr] h-full overflow-hidden">
      {/* Left: past services */}
      <div className="flex flex-col border-r border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Artifacts {"\u00B7"} <strong className="text-ink-2 font-medium">past services</strong>
          </span>
          <span className="font-mono text-[10px] text-ink-3">{projects.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-bg-3)_transparent]">
          {projects.map((p, i) => (
            <div
              key={p.id}
              className={`grid grid-cols-[1fr_auto] gap-2.5 px-3.5 py-3 items-center cursor-pointer transition-colors ${
                selected === i ? "bg-accent-soft text-ink border-b border-accent" : "text-ink-2 hover:bg-bg-2 border-b border-transparent"
              }`}
              onClick={() => setSelected(i)}
            >
              <div>
                <div className="font-serif italic text-[15px]">{p.name}</div>
                <div className="font-mono text-[9.5px] text-ink-3">
                  {p.created_at_ms ? formatDate(p.created_at_ms) : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9.5px] text-ink-3">{p.items.length} items</div>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="px-3.5 py-8 text-center text-xs text-muted">
              No past services yet. Close an active service to archive it here.
            </div>
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="overflow-y-auto px-14 py-10">
        {current ? (
          <>
            <div className="flex items-baseline gap-4 mb-1.5">
              <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
                {"\u25CF"} {current.created_at_ms ? formatDate(current.created_at_ms) : ""}
              </div>
              <div className="font-mono text-[10px] text-accent tracking-[0.14em] uppercase">FINAL</div>
            </div>
            <h1 className="font-serif text-[38px] font-normal tracking-[-0.02em] mb-2">{current.name}</h1>
            <p className="text-ink-3 text-[13px] mb-8 max-w-[56ch]">
              {current.items.length} content items pushed {"\u00B7"} auto-generated artifacts ready to publish.
            </p>

            {/* Artifact cards */}
            <div className="grid grid-cols-2 gap-3 mb-8 max-w-[780px]">
              {[
                { label: "Full transcript", sub: "VTT + TXT", icon: "\u00A7", badge: "ready" },
                { label: "Scripture list", sub: `${current.items.length} items`, icon: "\u00A7", badge: "ready" },
                { label: "Service recap", sub: "AI-drafted", icon: "\u00B6", badge: "draft" },
                { label: "Email to members", sub: "Subject line auto-written", icon: "\u2709", badge: "draft" },
              ].map((a, i) => (
                <div key={i} className="p-[18px] bg-bg-1 border border-line rounded cursor-pointer hover:border-line-strong">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-serif italic text-[22px] text-accent">{a.icon}</span>
                    <span
                      className={`font-mono text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 border rounded-sm ${
                        a.badge === "ready"
                          ? "text-success border-success"
                          : "text-accent border-accent"
                      }`}
                    >
                      {a.badge}
                    </span>
                  </div>
                  <div className="font-serif text-[17px] text-ink tracking-[-0.01em] mb-1">{a.label}</div>
                  <div className="text-[11.5px] text-ink-3">{a.sub}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="max-w-[780px]">
              <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-3">
                {"\u25CF"} TIMELINE {"\u00B7"} ACTUAL
              </div>
              <div className="border border-line rounded overflow-hidden">
                {current.items
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[60px_28px_1fr_auto] gap-3.5 px-4 py-2.5 items-center border-b border-line last:border-b-0"
                    >
                      <span className="font-mono text-[10px] text-ink-3">
                        {new Date(item.added_at_ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                      <span className="font-serif italic text-sm text-accent">{"\u00A7"}</span>
                      <span className="text-[13px] text-ink">{item.reference}</span>
                      <span className="font-mono text-[10px] text-ink-3">{item.translation}</span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted">Select a service to view artifacts</div>
        )}
      </div>
    </div>
  );
}
