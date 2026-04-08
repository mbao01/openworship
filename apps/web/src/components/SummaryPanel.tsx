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
    <li className="summary-row">
      <div className="summary-row__meta">
        <span className="summary-row__name">{summary.service_name}</span>
        <span className="summary-row__date">{date}</span>
        {summary.email_sent && (
          <span className="summary-row__badge summary-row__badge--sent" title="Email sent">
            ✓ Sent
          </span>
        )}
      </div>
      <div className="summary-row__actions">
        <button
          className="summary-action-btn summary-action-btn--view"
          onClick={() => onView(summary)}
          title="View summary"
        >
          View
        </button>
        {!summary.email_sent && (
          <button
            className="summary-action-btn summary-action-btn--send"
            onClick={() => onSendEmail(summary.id)}
            title="Send to email subscribers"
          >
            Email
          </button>
        )}
        <button
          className="summary-action-btn summary-action-btn--delete"
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
      className="summary-detail-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Service summary"
    >
      <div
        className="summary-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="summary-detail__header">
          <span className="summary-detail__title">{summary.service_name}</span>
          <button
            className="summary-detail__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="summary-detail__body">
          {lines.map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return <br key={i} />;
            if (trimmed.startsWith("## "))
              return <h3 key={i} className="summary-md__h2">{trimmed.slice(3)}</h3>;
            if (trimmed.startsWith("# "))
              return <h2 key={i} className="summary-md__h1">{trimmed.slice(2)}</h2>;
            if (trimmed.startsWith("- "))
              return <li key={i} className="summary-md__li">{trimmed.slice(2)}</li>;
            return <p key={i} className="summary-md__p">{trimmed}</p>;
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

      <div className="summary-panel">
        <div className="summary-panel__header" onClick={() => setCollapsed((v) => !v)}>
          <span className="summary-panel__label">SUMMARIES</span>
          <span className="summary-panel__toggle" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
        </div>

        {!collapsed && (
          <>
            {error && (
              <p className="summary-panel__error">{error}</p>
            )}
            <ul className="summary-list">
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
