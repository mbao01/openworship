import { Eyebrow } from "../ui/eyebrow";

const STEPS = [
  {
    num: "01 · LISTEN",
    title: "Speaker speaks.",
    body: "A microphone feeds continuous speech-to-text with a rolling 10-second context window. Tunable per speaker.",
    viz: ["audio", "tokens"],
  },
  {
    num: "02 · MATCH",
    title: "AI detects the cue.",
    body: "Exact reference, paraphrase, song title, mid-lyric phrase, or story — matched across every content type at once.",
    viz: ["tokens", "match"],
  },
  {
    num: "03 · QUEUE",
    title: "Content queues.",
    body: "Scripture, lyrics, and slides stack together in detected order. In Copilot, the operator approves. In Auto, it ships.",
    viz: ["match", "queue"],
  },
  {
    num: "04 · DISPLAY",
    title: "On screen. On cue.",
    body: "A local WebSocket pushes to a fullscreen browser page — usable directly or as an OBS browser source. Zero setup.",
    viz: ["queue", "screen"],
  },
] as const;

export function HowItWorksSection() {
  return (
    <section>
      <div className="container">
        <Eyebrow>How it works</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 400,
            fontSize: "clamp(36px, 5.5vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            marginTop: "24px",
            maxWidth: "22ch",
          }}
        >
          Speech in.{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
            The right content
          </em>{" "}
          on screen.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            marginTop: "64px",
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
          }}
          className="flow-grid"
        >
          {STEPS.map(({ num, title, body, viz }, i) => (
            <div
              key={num}
              style={{
                padding: "32px 24px",
                borderRight: i < STEPS.length - 1 ? "1px solid var(--rule-soft)" : "none",
                minHeight: "220px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--accent)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {num}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "28px",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    margin: "24px 0 12px",
                    fontWeight: 400,
                  }}
                >
                  {title}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>
                  {body}
                </p>
              </div>
              <div
                style={{
                  marginTop: "24px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--rule-soft)",
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {viz[0]}{" "}
                <span style={{ color: "var(--accent)", margin: "0 6px" }}>→</span>{" "}
                {viz[1]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .flow-grid { grid-template-columns: 1fr 1fr !important; }
          .flow-grid > div { border-bottom: 1px solid var(--rule-soft); }
        }
      `}</style>
    </section>
  );
}
