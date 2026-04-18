import { Eyebrow } from "../ui/eyebrow";

const SERVICE_ITEMS: readonly {
  time: string;
  type: string;
  name: string;
  sub?: string;
  dur: string;
  live: boolean;
}[] = [
  { time: "10:00", type: "♪", name: "Come Thou Fount", dur: "4m", live: false },
  { time: "10:04", type: "♪", name: "Great Is Thy Faithfulness", dur: "5m", live: false },
  { time: "10:09", type: "❡", name: "Welcome & announcements", sub: "3 slides", dur: "3m", live: false },
  { time: "10:12", type: "§", name: "Sermon ·", sub: "Romans 8", dur: "35m", live: true },
  { time: "10:47", type: "⌇", name: "Prayer points", sub: "outline", dur: "6m", live: false },
  { time: "10:53", type: "♪", name: "Doxology", dur: "2m", live: false },
];

const SHOWCASE_ITEMS = [
  "Named, saved projects with order of service and settings.",
  "Past services saved in a locked, read-only state — reviewable but safe.",
  "Every artifact auto-indexed into the content bank for next time.",
  "AI-generated service summaries emailed to subscribers, hours or days after.",
] as const;

export function ServicePlanSection() {
  return (
    <section>
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.85fr 1.15fr",
            gap: "clamp(40px, 6vw, 80px)",
            alignItems: "center",
          }}
          className="showcase-grid"
        >
          {/* Copy */}
          <div>
            <Eyebrow>Service projects</Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: "24px",
                marginBottom: "24px",
              }}
            >
              The Sunday plan,{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                ready by Wednesday.
              </em>
            </h2>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: "20px",
                lineHeight: 1.45,
                color: "var(--ink-2)",
                letterSpacing: "-0.005em",
                marginBottom: "24px",
              }}
            >
              Every service is a project. Load scriptures, lyrics, announcements, and notes
              in advance. On Sunday morning, the operator opens the file — and everything is
              already there.
            </p>
            <ul style={{ listStyle: "none", borderTop: "1px solid var(--rule-soft)", marginTop: "32px" }}>
              {SHOWCASE_ITEMS.map((item, i) => (
                <li
                  key={i}
                  style={{
                    padding: "14px 0",
                    borderBottom: "1px solid var(--rule-soft)",
                    display: "grid",
                    gridTemplateColumns: "32px 1fr",
                    gap: "16px",
                    fontSize: "14px",
                    color: "var(--ink-2)",
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      color: "var(--muted)",
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--rule-soft)",
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "var(--shadow)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: "var(--bg-2)",
                borderBottom: "1px solid var(--rule-soft)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "var(--rule-soft)",
                    display: "inline-block",
                  }}
                />
              ))}
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginLeft: "8px",
                }}
              >
                Service plan · Sunday, 19 Apr
              </span>
            </div>
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  paddingBottom: "14px",
                  borderBottom: "1px solid var(--rule-soft)",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "22px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Sunday morning, 10am
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Apr 19 · 2026
                </div>
              </div>
              {SERVICE_ITEMS.map(({ time, type, name, sub, dur, live }) => (
                <div
                  key={time}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 24px 1fr auto",
                    gap: "14px",
                    padding: live ? "12px 14px" : "12px 0",
                    borderBottom: "1px solid var(--rule-soft)",
                    alignItems: "center",
                    fontSize: "13px",
                    ...(live
                      ? {
                          background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                          margin: "0 -14px",
                          borderRadius: "2px",
                        }
                      : {}),
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--muted)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {time}
                  </div>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: "13px",
                      color: live ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {type}
                  </div>
                  <div style={{ color: "var(--ink)" }}>
                    {name}
                    {sub && (
                      <em
                        style={{
                          fontFamily: "var(--serif)",
                          fontStyle: "italic",
                          color: "var(--ink-2)",
                        }}
                      >
                        {" "}
                        — {sub}
                      </em>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--muted)",
                    }}
                  >
                    {dur}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .showcase-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}
