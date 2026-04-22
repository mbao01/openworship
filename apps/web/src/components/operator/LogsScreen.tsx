import { useEffect, useState } from "react";
import { invoke } from "../../lib/tauri";
import { toastError, toast } from "../../lib/toast";
import {
  listServiceSummaries,
  generateServiceSummary,
  sendSummaryEmail,
} from "../../lib/commands/summaries";
import type { ServiceProject, ServiceSummary } from "../../lib/types";
import { BookOpenIcon, CircleIcon, FileTextIcon, MailIcon } from "lucide-react";

export function LogsScreen() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [selected, setSelected] = useState(0);
  const [summaries, setSummaries] = useState<ServiceSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    invoke<ServiceProject[]>("list_service_projects")
      .then((all) => {
        const closed = all.filter((p) => p.closed_at_ms !== null);
        setProjects(closed);
      })
      .catch(toastError("Failed to load projects"));

    listServiceSummaries()
      .then(setSummaries)
      .catch(() => {});
  }, []);

  const current = projects[selected];

  /** Find the summary matching the current project (by project_id). */
  const currentSummary = current
    ? (summaries.find((s) => s.project_id === current.id) ?? null)
    : null;

  const handleGenerate = async (projectId: string) => {
    setGenerating(true);
    try {
      await generateServiceSummary(projectId);
      // Refresh summaries after generation
      const updated = await listServiceSummaries();
      setSummaries(updated);
      toast.success("Recap generated");
    } catch (e) {
      toastError("Failed to generate recap")(e);
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (summaryId: string) => {
    setPublishing(true);
    try {
      await sendSummaryEmail(summaryId);
      // Refresh summaries to update email_sent status
      const updated = await listServiceSummaries();
      setSummaries(updated);
      toast.success("Summary email sent");
    } catch (e) {
      toastError("Failed to send email")(e);
    } finally {
      setPublishing(false);
    }
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /** Badge status for the recap card. */
  const recapBadge = currentSummary
    ? currentSummary.email_sent
      ? "ready"
      : "draft"
    : "none";

  /** Badge status for the email card. */
  const emailBadge = currentSummary?.email_sent ? "ready" : "draft";

  return (
    <div className="grid h-full flex-1 grid-cols-[1fr_2fr] overflow-hidden">
      {/* Left: past services */}
      <div className="flex flex-col overflow-hidden border-r border-line">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            Artifacts ·{" "}
            <strong className="font-medium text-ink-2">past services</strong>
          </span>
          <span className="font-mono text-[10px] text-ink-3">
            {projects.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {projects.map((p, i) => {
            const pSummary = summaries.find((s) => s.project_id === p.id);
            return (
              <div
                key={p.id}
                className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2.5 px-3.5 py-3 transition-colors ${
                  selected === i
                    ? "border-b border-accent bg-accent-soft text-ink"
                    : "border-b border-transparent text-ink-2 hover:bg-bg-2"
                }`}
                onClick={() => setSelected(i)}
              >
                <div>
                  <div className="font-serif text-[15px] italic">{p.name}</div>
                  <div className="font-mono text-[9.5px] text-ink-3">
                    {p.created_at_ms ? formatDate(p.created_at_ms) : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <div className="font-mono text-[9.5px] text-ink-3">
                    {p.items.length} items
                  </div>
                  {pSummary && (
                    <span
                      className={`rounded-sm border px-1 py-px font-mono text-[8px] tracking-[0.14em] uppercase ${
                        pSummary.email_sent
                          ? "border-success text-success"
                          : "border-accent text-accent"
                      }`}
                    >
                      {pSummary.email_sent ? "sent" : "draft"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3.5 py-8 text-center text-xs text-muted">
              <FileTextIcon className="h-5 w-5 text-muted/60" />
              No past services yet. Close an active service to archive it here.
            </div>
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="overflow-y-auto px-14 py-10">
        {current ? (
          <>
            <div className="mb-1.5 flex items-baseline gap-4">
              <div className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
                <CircleIcon className="inline h-2 w-2 shrink-0 fill-current" />{" "}
                {current.created_at_ms ? formatDate(current.created_at_ms) : ""}
              </div>
              <div className="font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
                FINAL
              </div>
            </div>
            <h1 className="mb-2 font-serif text-[38px] font-normal tracking-[-0.02em]">
              {current.name}
            </h1>
            <p className="mb-8 max-w-[56ch] text-[13px] text-ink-3">
              {current.items.length} content items pushed · auto-generated
              artifacts ready to publish.
            </p>

            {/* Artifact cards */}
            <div className="mb-8 grid max-w-[780px] grid-cols-2 gap-3">
              {[
                {
                  label: "Full transcript",
                  sub: "VTT + TXT",
                  icon: <FileTextIcon className="h-5 w-5 shrink-0" />,
                  badge: "ready" as const,
                },
                {
                  label: "Scripture list",
                  sub: `${current.items.length} items`,
                  icon: <BookOpenIcon className="h-5 w-5 shrink-0" />,
                  badge: "ready" as const,
                },
                {
                  label: "Service recap",
                  sub: currentSummary ? "AI-generated" : "AI-drafted",
                  icon: <FileTextIcon className="h-5 w-5 shrink-0" />,
                  badge: recapBadge,
                },
                {
                  label: "Email to members",
                  sub: currentSummary?.email_sent
                    ? "Sent"
                    : "Subject line auto-written",
                  icon: <MailIcon className="h-5 w-5 shrink-0" />,
                  badge: emailBadge,
                },
              ].map((a, i) => (
                <div
                  key={i}
                  className="cursor-pointer rounded border border-line bg-bg-1 p-[18px] hover:border-line-strong"
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-accent">{a.icon}</span>
                    {a.badge !== "none" && (
                      <span
                        className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] uppercase ${
                          a.badge === "ready"
                            ? "border-success text-success"
                            : "border-accent text-accent"
                        }`}
                      >
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <div className="mb-1 font-serif text-[17px] tracking-[-0.01em] text-ink">
                    {a.label}
                  </div>
                  <div className="text-[11.5px] text-ink-3">{a.sub}</div>
                </div>
              ))}
            </div>

            {/* Service recap section */}
            <div className="mb-8 max-w-[780px]">
              <div className="mb-3 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
                <CircleIcon className="inline h-2 w-2 shrink-0 fill-current" />{" "}
                SERVICE RECAP
              </div>
              {currentSummary ? (
                <div className="rounded border border-line bg-bg-1 p-6">
                  <div className="mb-5 font-serif text-[15px] leading-[1.6] whitespace-pre-wrap text-ink italic">
                    {currentSummary.summary_text}
                  </div>
                  <div className="mb-4 font-mono text-[9.5px] text-ink-3">
                    Generated {formatDate(currentSummary.generated_at_ms)}
                    {currentSummary.email_sent &&
                    currentSummary.email_sent_at_ms
                      ? ` · Email sent ${formatDate(currentSummary.email_sent_at_ms)}`
                      : ""}
                  </div>
                  <div className="flex gap-2.5 border-t border-line pt-4">
                    {!currentSummary.email_sent && (
                      <button
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-3 py-[7px] text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handlePublish(currentSummary.id)}
                        disabled={publishing}
                      >
                        {publishing ? "Sending ..." : "Publish"}
                      </button>
                    )}
                    <button
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-3 py-[7px] text-xs text-ink-2 hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleGenerate(current.id)}
                      disabled={generating}
                    >
                      {generating ? "Generating ..." : "Regenerate"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded border border-line bg-bg-1 p-6 text-center">
                  <div className="mb-4 text-sm text-ink-3">
                    No recap has been generated for this service yet.
                  </div>
                  <button
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-4 py-[9px] text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => handleGenerate(current.id)}
                    disabled={generating}
                  >
                    {generating ? "Generating ..." : "Generate recap"}
                  </button>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="max-w-[780px]">
              <div className="mb-3 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
                <CircleIcon className="inline h-2 w-2 shrink-0 fill-current" />{" "}
                TIMELINE · ACTUAL
              </div>
              <div className="overflow-hidden rounded border border-line">
                {current.items
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[60px_28px_1fr_auto] items-center gap-3.5 border-b border-line px-4 py-2.5 last:border-b-0"
                    >
                      <span className="font-mono text-[10px] text-ink-3">
                        {new Date(item.added_at_ms).toLocaleTimeString(
                          "en-US",
                          { hour: "2-digit", minute: "2-digit", hour12: false },
                        )}
                      </span>
                      <span className="font-serif text-sm text-accent italic">
                        <BookOpenIcon className="inline h-3.5 w-3.5 shrink-0" />
                      </span>
                      <span className="text-[13px] text-ink">
                        {item.reference}
                      </span>
                      <span className="font-mono text-[10px] text-ink-3">
                        {item.translation}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
            <BookOpenIcon className="h-6 w-6 text-muted/60" />
            Select a service to view artifacts
          </div>
        )}
      </div>
    </div>
  );
}
