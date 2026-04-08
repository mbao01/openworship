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
    <li className="flex items-center justify-between gap-2 py-[5px] px-2 rounded-sm bg-obsidian">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[11px] font-medium text-chalk whitespace-nowrap overflow-hidden text-ellipsis">
          {summary.service_name}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-smoke font-mono">{date}</span>
          {summary.email_sent && (
            <span
              className="inline-block text-[9px] px-[5px] py-px rounded-[2px] font-semibold uppercase tracking-[0.06em] bg-[rgba(100,200,120,0.15)] text-[#64c878]"
              title="Email sent"
            >
              ✓ Sent
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          data-qa={`summary-view-btn-${summary.id}`}
          className="text-[10px] font-sans rounded-sm px-[7px] py-0.5 cursor-pointer border border-iron bg-transparent text-ash transition-all hover:brightness-125"
          onClick={() => onView(summary)}
          title="View summary"
        >
          View
        </button>
        {!summary.email_sent && (
          <button
            data-qa={`summary-send-btn-${summary.id}`}
            className="text-[10px] font-sans rounded-sm px-[7px] py-0.5 cursor-pointer border border-gold text-gold bg-transparent transition-all hover:brightness-125"
            onClick={() => onSendEmail(summary.id)}
            title="Send to email subscribers"
          >
            Email
          </button>
        )}
        <button
          data-qa={`summary-delete-btn-${summary.id}`}
          className="text-[10px] font-sans rounded-sm px-[7px] py-0.5 cursor-pointer border border-transparent text-smoke bg-transparent transition-all hover:brightness-125"
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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Service summary"
    >
      <div
        className="bg-surface border border-iron rounded-md w-[min(640px,90vw)] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-iron">
          <span className="font-sans text-[13px] font-semibold text-chalk">{summary.service_name}</span>
          <button
            data-qa="summary-detail-close"
            className="bg-transparent border-none text-base text-smoke cursor-pointer leading-none px-1 py-0"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-2">
          {lines.map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <br key={i} />;
            if (trimmed.startsWith("## "))
              return (
                <h3 key={i} className="font-sans text-[13px] font-bold text-chalk uppercase tracking-[0.06em] mt-2 mb-0">
                  {trimmed.slice(3)}
                </h3>
              );
            if (trimmed.startsWith("# "))
              return (
                <h2 key={i} className="font-serif text-base font-bold text-chalk mt-2 mb-0">
                  {trimmed.slice(2)}
                </h2>
              );
            if (trimmed.startsWith("- "))
              return (
                <li key={i} className="text-xs text-ash leading-[1.5] ml-3">
                  {trimmed.slice(2)}
                </li>
              );
            return (
              <p key={i} className="text-xs text-ash leading-relaxed m-0">
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
      const sent: string[] = await invoke("send_summary_email", { summaryId: id });
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

  if (summaries.length === 0) return null;

  return (
    <>
      {viewing && (
        <SummaryDetailModal summary={viewing} onClose={() => setViewing(null)} />
      )}

      <div className="shrink-0">
        {/* Header */}
        <div
          className="flex items-center justify-between py-2 px-3 cursor-pointer select-none"
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className="font-sans text-[9px] font-semibold tracking-[0.12em] text-smoke uppercase">
            SUMMARIES
          </span>
          <span className="text-[10px] text-smoke" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
        </div>

        {!collapsed && (
          <>
            {error && (
              <p className="text-[11px] text-ember px-3 pb-2 m-0">{error}</p>
            )}
            <ul className="list-none m-0 px-2 pb-2 flex flex-col gap-0.5">
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
          </>
        )}
      </div>
    </>
  );
}
