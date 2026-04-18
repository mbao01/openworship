import { Eyebrow } from "../ui/eyebrow";

const MODES = [
  {
    tag: "Nobody at the desk",
    name: "Auto.",
    body: "The AI listens, detects cues across all content types, and pushes to screen instantly. For experienced, consistent speakers.",
    meta: "Midweek · small services",
  },
  {
    tag: "One operator",
    name: "Copilot.",
    body: "The AI queues suggestions with confidence scores. The operator reviews and approves before display. Full control, zero lookup time.",
    meta: "Most Sundays",
  },
  {
    tag: "One operator · no mic",
    name: "Airplane.",
    body: "No microphone. The operator searches and triggers content manually. AI still powers free-text search across every library.",
    meta: "Noisy rooms · low trust",
  },
  {
    tag: "One operator · no AI",
    name: "Offline.",
    body: "Conventional manual operation. Functions as a standard worship display app for churches that want simplicity or do not trust AI in a live service.",
    meta: "Traditional services",
  },
] as const;

export function ModesSection() {
  return (
    <section id="modes">
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "80px",
            alignItems: "end",
            marginBottom: "72px",
          }}
          className="modes-header"
        >
          <div>
            <Eyebrow>Four modes</Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: "24px",
              }}
            >
              Trust the AI{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>as much</em> as you
              want.
            </h2>
          </div>
          <p
            style={{
              margin: 0,
              maxWidth: "44ch",
              fontSize: "clamp(17px, 1.6vw, 20px)",
              lineHeight: 1.45,
              color: "var(--ink-2)",
              fontFamily: "var(--serif)",
            }}
          >
            From fully automatic for experienced speakers, to classical manual operation for
            churches that prefer to drive by hand. Switch between modes at any time, even
            mid-service.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1px",
            background: "var(--rule-soft)",
            border: "1px solid var(--rule-soft)",
          }}
          className="modes-grid"
        >
          {MODES.map(({ tag, name, body, meta }) => (
            <div
              key={name}
              style={{
                padding: "36px 32px",
                background: "var(--bg)",
                display: "flex",
                flexDirection: "column",
                minHeight: "260px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    flexShrink: 0,
                  }}
                />
                {tag}
              </div>
              <h3
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "40px",
                  lineHeight: 1,
                  letterSpacing: "-0.025em",
                  margin: "20px 0 14px",
                  fontWeight: 400,
                }}
              >
                {name}
              </h3>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "18px",
                  lineHeight: 1.4,
                  color: "var(--ink-2)",
                  letterSpacing: "-0.01em",
                }}
              >
                {body}
              </p>
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "24px",
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Best for ·{" "}
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{meta}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .modes-header { grid-template-columns: 1fr !important; gap: 48px !important; }
          .modes-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
