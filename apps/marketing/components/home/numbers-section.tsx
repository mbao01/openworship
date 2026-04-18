import { Eyebrow } from "../ui/eyebrow";

const NUMBERS = [
  { big: "<100", unit: "ms", label: "first-word latency\n(online, Deepgram)" },
  { big: "50", unit: "+", label: "Bible translations\nbundled offline" },
  { big: "0", unit: "", label: "dollars per year\nforever" },
  { big: "4", unit: "MB", label: "in-memory Bible index\nloaded at startup" },
] as const;

export function NumbersSection() {
  return (
    <section>
      <div className="container">
        <Eyebrow>By the numbers</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 400,
            fontSize: "clamp(36px, 5.5vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            marginTop: "24px",
            marginBottom: "56px",
            maxWidth: "20ch",
          }}
        >
          Fast, quiet,{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>and free.</em>
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
          }}
          className="numbers-grid"
        >
          {NUMBERS.map(({ big, unit, label }, i) => (
            <div
              key={big}
              style={{
                padding: "40px 24px",
                borderRight: i < NUMBERS.length - 1 ? "1px solid var(--rule-soft)" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "64px",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: "var(--ink)",
                }}
              >
                <em style={{ color: "var(--accent)", fontStyle: "italic" }}>{big}</em>
                {unit}
              </div>
              <div
                style={{
                  marginTop: "16px",
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--muted)",
                  lineHeight: 1.4,
                  whiteSpace: "pre-line",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .numbers-grid { grid-template-columns: 1fr 1fr !important; }
          .numbers-grid > div { border-bottom: 1px solid var(--rule-soft); }
        }
      `}</style>
    </section>
  );
}
