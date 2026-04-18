import { Eyebrow } from "../ui/eyebrow";

const AUDIENCES = [
  {
    tag: "For the pastor",
    title: "Speak. The rest is taken care of.",
    body: "No one to pre-brief. No \"can you pull up Romans 8?\" over the in-ear. Paraphrase freely, reference loosely, deviate from the notes — the right verse appears because you said it.",
    items: [
      "Paraphrase & story detection",
      "Multi-translation live swap",
      "Speaker-facing sermon monitor",
    ],
  },
  {
    tag: "For the media team",
    title: "One person, one role, full control.",
    body: "Copilot does the lookup; you decide what hits the screen. Keyboard-first, confidence-ranked, with a correction loop that never breaks the flow of worship.",
    items: [
      "Copilot approvals, keyboard-first",
      '"Not this one" re-rank mid-service',
      "OBS browser source — zero setup",
    ],
  },
  {
    tag: "For the multi-branch admin",
    title: "One church, many rooms, shared memory.",
    body: "HQ manages a shared cloud space across every branch. Each branch keeps its own private artifacts. Granular sharing, ACL-enforced, per-branch visibility, never all-or-nothing.",
    items: [
      "Church → Branch → Service hierarchy",
      "View / Comment / Edit per branch",
      "Per-service summaries to subscribers",
    ],
  },
] as const;

export function AudiencesSection() {
  return (
    <section>
      <div className="container">
        <Eyebrow>Built for</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 400,
            fontSize: "clamp(36px, 5.5vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            marginTop: "24px",
            marginBottom: "56px",
            maxWidth: "26ch",
          }}
        >
          For the pastor,{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>the volunteer,</em> and
          the admin.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            background: "var(--rule-soft)",
            border: "1px solid var(--rule-soft)",
          }}
          className="audiences-grid"
        >
          {AUDIENCES.map(({ tag, title, body, items }) => (
            <div
              key={tag}
              style={{
                padding: "40px 32px",
                background: "var(--bg)",
                minHeight: "320px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                {tag}
              </div>
              <h3
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "32px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  margin: "16px 0 20px",
                  fontWeight: 400,
                }}
              >
                {title}
              </h3>
              <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.55, marginBottom: "20px" }}>
                {body}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  marginTop: "auto",
                  paddingTop: "20px",
                  borderTop: "1px solid var(--rule-soft)",
                }}
              >
                {items.map((item) => (
                  <li
                    key={item}
                    style={{ fontSize: "13px", color: "var(--ink-2)", padding: "4px 0" }}
                  >
                    <span style={{ color: "var(--accent)", marginRight: "8px" }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .audiences-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
