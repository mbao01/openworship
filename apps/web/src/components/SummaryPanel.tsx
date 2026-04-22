import { useCallback, useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import type { ServiceSummary } from "../lib/types";

// ─── Summary row ──────────────────────────────────────────────────────────────

function SummaryRow({
  summary,
  onView,
  onSendEmail,
  onDelete,
}: {
  summary: ServiceSummary;
  onView: (s: ServiceSummary) => void;
  onSendEmail: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const date = new Date(summary.generated_at_ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="flex items-center justify-between gap-2 rounded-sm bg-bg-1 px-2 py-[5px]">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="overflow-hidden text-[11px] font-medium text-ellipsis whitespace-nowrap text-ink">
          {summary.service_name}
        </span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-muted">{date}</span>
          {summary.email_sent && (
            <span
              className="inline-block rounded-[2px] bg-[rgba(100,200,120,0.15)] px-[5px] py-px text-[9px] font-semibold tracking-[0.06em] text-[#64c878] uppercase"
              title="Email sent"
            >
              ✓ Sent
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          data-qa={`summary-view-btn-${summary.id}`}
          className="cursor-pointer rounded-sm border border-line bg-transparent px-[7px] py-0.5 font-sans text-[10px] text-ink-3 transition-all hover:brightness-125"
          onClick={() => onView(summary)}
          title="View summary"
        >
          View
        </button>
        {!summary.email_sent && (
          <button
            data-qa={`summary-send-btn-${summary.id}`}
            className="cursor-pointer rounded-sm border border-accent bg-transparent px-[7px] py-0.5 font-sans text-[10px] text-accent transition-all hover:brightness-125"
            onClick={() => onSendEmail(summary.id)}
            title="Send to email subscribers"
          >
            Email
          </button>
        )}
        <button
          data-qa={`summary-delete-btn-${summary.id}`}
          className="cursor-pointer rounded-sm border border-transparent bg-transparent px-[7px] py-0.5 font-sans text-[10px] text-muted transition-all hover:brightness-125"
          onClick={() => onDelete(summary.id)}
          title="Delete summary"
        >
          ×
        </button>
      </div>
    </li>
  );
}

// ─── Summary detail modal ─────────────────────────────────────────────────────

function SummaryDetailModal({
  summary,
  onClose,
}: {
  summary: ServiceSummary;
  onClose: () => void;
}) {
  const lines = summary.summary_text.split("\n");

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Service summary"
    >
      <div
        className="flex max-h-[80vh] w-[min(640px,90vw)] flex-col overflow-hidden rounded-md border border-line bg-bg-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-sans text-[13px] font-semibold text-ink">
            {summary.service_name}
          </span>
          <button
            data-qa="summary-detail-close"
            className="cursor-pointer border-none bg-transparent px-1 py-0 text-base leading-none text-muted"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto p-4">
          {lines.map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <br key={i} />;
            if (trimmed.startsWith("## "))
              return (
                <h3
                  key={i}
                  className="mt-2 mb-0 font-sans text-[13px] font-bold tracking-[0.06em] text-ink uppercase"
                >
                  {trimmed.slice(3)}
                </h3>
              );
            if (trimmed.startsWith("# "))
              return (
                <h2
                  key={i}
                  className="mt-2 mb-0 font-serif text-base font-bold text-ink"
                >
                  {trimmed.slice(2)}
                </h2>
              );
            if (trimmed.startsWith("- "))
              return (
                <li key={i} className="ml-3 text-xs leading-[1.5] text-ink-3">
                  {trimmed.slice(2)}
                </li>
              );
            return (
              <p key={i} className="m-0 text-xs leading-relaxed text-ink-3">
                {trimmed}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SummaryPanel() {
  const [summaries, setSummaries] = useState<ServiceSummary[]>([]);
  const [viewing, setViewing] = useState<ServiceSummary | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await invoke<ServiceSummary[]>("list_service_summaries");
      setSummaries(list);
    } catch {
      // silently ignore — backend may not have summaries yet
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_service_summary", { summaryId: id });
      setSummaries((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSendEmail = async (id: string) => {
    setSendingId(id);
    setError(null);
    try {
      const sent: string[] = await invoke("send_summary_email", {
        summaryId: id,
      });
      // Refresh to get updated email_sent flag.
      await load();
      if (sent.length === 0) {
        setError("No subscribers found for this church.");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      {viewing && (
        <SummaryDetailModal
          summary={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      <div className="shrink-0">
        {/* Header */}
        <div
          className="flex cursor-pointer items-center justify-between px-3 py-2 select-none"
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className="font-sans text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
            SUMMARIES
          </span>
          <span className="text-[10px] text-muted" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
        </div>

        {!collapsed && (
          <>
            {error && (
              <p className="m-0 px-3 pb-2 text-[11px] text-danger">{error}</p>
            )}
            {summaries.length === 0 ? (
              <p className="m-0 px-3 pb-2 text-[11px] leading-[1.5] text-muted">
                No service summaries yet. Close a service to generate one.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2">
                {summaries.map((s) => (
                  <SummaryRow
                    key={s.id}
                    summary={s}
                    onView={setViewing}
                    onSendEmail={sendingId ? () => {} : handleSendEmail}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
