import { Eyebrow } from "../ui/eyebrow";

const SHOWCASE_ITEMS = [
  "Confidence scores on every suggestion — 0–100%.",
  '"Not this one" re-ranks without interrupting the service.',
  "Multi-reference detection — one utterance, many queued items.",
  "Live translation swap. The verse changes, the timing doesn't.",
] as const;

export function ConsoleSection() {
  return (
    <section>
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: "clamp(40px, 6vw, 80px)",
            alignItems: "center",
          }}
          className="console-showcase-grid"
        >
          {/* Console mockup */}
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
                Operator · Copilot mode
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr 280px",
                height: "420px",
              }}
              className="console-inner"
            >
              {/* Library col */}
              <div
                style={{ padding: "16px", overflow: "hidden", borderRight: "1px solid var(--rule-soft)" }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    paddingBottom: "10px",
                    borderBottom: "1px solid var(--rule-soft)",
                    marginBottom: "12px",
                  }}
                >
                  Library
                </div>
                {[
                  { label: "Scripture", count: "31k" },
                  { label: "Lyrics", count: "248" },
                  { label: "Announcements", count: "12" },
                  { label: "Custom slides", count: "5", selected: true },
                  { label: "Sermon notes", count: "1" },
                ].map(({ label, count, selected }) => (
                  <div
                    key={label}
                    style={{
                      padding: "10px 8px",
                      fontSize: "12px",
                      borderRadius: "2px",
                      marginBottom: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      color: selected ? "var(--bg)" : "var(--ink-2)",
                      background: selected ? "var(--ink)" : "transparent",
                    }}
                  >
                    {label}
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "10px",
                        color: selected ? "var(--bg-2)" : "var(--muted)",
                      }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
                <div style={{ height: "16px" }} />
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    paddingBottom: "10px",
                    borderBottom: "1px solid var(--rule-soft)",
                    marginBottom: "12px",
                  }}
                >
                  Translations
                </div>
                {["ESV", "NIV", "KJV", "NLT"].map((t) => (
                  <div
                    key={t}
                    style={{
                      padding: "10px 8px",
                      fontSize: "12px",
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>

              {/* Center display */}
              <div
                style={{
                  background: "#0A0907",
                  color: "#F5EFDF",
                  padding: "28px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  position: "relative",
                  borderRight: "1px solid var(--rule-soft)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "#C9A76A",
                    marginBottom: "14px",
                  }}
                >
                  Romans 8 · 38–39 · ESV
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: "18px",
                    lineHeight: 1.4,
                  }}
                >
                  For I am sure that neither death nor life, nor angels nor rulers, nor things
                  present nor things to come… will be able to separate us from the love of
                  God in Christ Jesus our Lord.
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: "28px",
                    right: "28px",
                    bottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--mono)",
                    fontSize: "9px",
                    color: "rgba(245,239,223,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                  }}
                >
                  <span>● Live</span>
                  <span>push · space</span>
                </div>
              </div>

              {/* Queue col */}
              <div style={{ padding: "16px", overflow: "hidden" }}>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    paddingBottom: "10px",
                    borderBottom: "1px solid var(--rule-soft)",
                    marginBottom: "12px",
                  }}
                >
                  Queue · auto-detected
                </div>
                {[
                  { ref: "On screen now · 98%", text: "Romans 8 : 38–39", live: true },
                  { ref: "Next · 91%", text: "Psalm 46 : 10", live: false },
                  { ref: 'Detected · 74%', text: '"It Is Well With My Soul" · v.2', live: false },
                ].map(({ ref, text, live }) => (
                  <div
                    key={text}
                    style={{
                      padding: "10px",
                      marginBottom: "6px",
                      borderLeft: `2px solid var(--accent)`,
                      background: live ? "var(--ink)" : "var(--bg-2)",
                      color: live ? "#F5EFDF" : "var(--ink)",
                      fontSize: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "10px",
                        color: live ? "#C9A76A" : "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: "3px",
                      }}
                    >
                      {ref}
                    </div>
                    {text}
                  </div>
                ))}
                <div style={{ height: "12px" }} />
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    paddingBottom: "10px",
                    borderBottom: "1px solid var(--rule-soft)",
                    marginBottom: "12px",
                  }}
                >
                  Transcript
                </div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: "12px",
                    lineHeight: 1.4,
                    color: "var(--ink-2)",
                  }}
                >
                  …and Paul tells us, in Romans chapter 8, that nothing —{" "}
                  <em
                    style={{
                      background: "color-mix(in srgb, var(--accent) 22%, transparent)",
                      padding: "0 3px",
                      fontStyle: "normal",
                    }}
                  >
                    nothing in all creation
                  </em>{" "}
                  — can separate us from the love of God…
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <Eyebrow>Operator console</Eyebrow>
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
              The queue that{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>fills itself.</em>
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
              Three panes. One job. On the left, every library at your fingertips. In the
              middle, what&apos;s on screen now. On the right, a live queue the AI has already
              sorted by confidence — approve with a tap, reject with a keystroke, re-rank
              with a phrase.
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
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .console-showcase-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .console-inner { grid-template-columns: 1fr !important; height: auto !important; }
          .console-inner > div + div { border-left: 0 !important; border-top: 1px solid var(--rule-soft); }
        }
      `}</style>
    </section>
  );
}
