import { Eyebrow } from "../ui/eyebrow";

const PROBLEMS = [
  {
    num: "01",
    text: (
      <>
        A <em style={{ color: "var(--accent)", fontStyle: "italic" }}>5–30 second</em> delay
        between a spoken reference and it appearing on screen.
      </>
    ),
  },
  {
    num: "02",
    text: (
      <>
        Lyrics require pre-loading the entire setlist. Any deviation{" "}
        <em style={{ color: "var(--accent)", fontStyle: "italic" }}>breaks the flow.</em>
      </>
    ),
  },
  {
    num: "03",
    text: (
      <>
        Many churches run three operators for a role that{" "}
        <em style={{ color: "var(--accent)", fontStyle: "italic" }}>should need one.</em>
      </>
    ),
  },
  {
    num: "04",
    text: (
      <>
        Competing tools cost{" "}
        <em style={{ color: "var(--accent)", fontStyle: "italic" }}>$500–$1,500/year.</em>{" "}
        Small churches have no option.
      </>
    ),
  },
] as const;

export function ProblemSection() {
  return (
    <section>
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "80px",
            alignItems: "start",
          }}
          className="problem-grid"
        >
          <div>
            <Eyebrow>The problem</Eyebrow>
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
              Running media during a service is{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>a full-time job.</em>
            </h2>
            <p
              style={{
                marginTop: "28px",
                fontSize: "clamp(17px, 1.6vw, 20px)",
                lineHeight: 1.45,
                color: "var(--ink-2)",
                maxWidth: "48ch",
                fontFamily: "var(--serif)",
              }}
            >
              A volunteer tracks the speaker, looks up scripture, cues lyrics, and pushes
              announcements — all at once, all in real time, for a speaker who may deviate
              from any plan. Existing tools cost hundreds a year and still require a skilled
              operator every single service.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {PROBLEMS.map(({ num, text }) => (
              <div
                key={num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr",
                  gap: "16px",
                  padding: "20px 0",
                  borderTop: "1px solid var(--rule-soft)",
                  alignItems: "baseline",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {num}
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "20px",
                    lineHeight: 1.3,
                    letterSpacing: "-0.01em",
                    color: "var(--ink)",
                  }}
                >
                  {text}
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--rule-soft)" }} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .problem-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}
