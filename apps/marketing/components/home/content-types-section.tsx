import { Eyebrow } from "../ui/eyebrow";

const CONTENT_TYPES = [
  {
    glyph: "§",
    name: "Scripture",
    desc: "Exact reference, paraphrase, or story-based. 50+ translations bundled offline.",
  },
  {
    glyph: "♪",
    name: "Lyrics",
    desc: "Detect by title, opening line, or mid-song phrase. Imports CCLI, OpenLP, manual.",
  },
  {
    glyph: "❡",
    name: "Announcements",
    desc: "Keyword-cued or operator-triggered. Pre-loaded slides pushed on a cue word.",
  },
  {
    glyph: "⊡",
    name: "Custom slides",
    desc: "Free-form text, images, countdowns. Manually or keyword-cued.",
  },
  {
    glyph: "⌇",
    name: "Sermon notes",
    desc: "Outline-driven, operator-advanced. Speaker-facing monitor option.",
  },
] as const;

export function ContentTypesSection() {
  return (
    <section>
      <div className="container">
        <Eyebrow>Content types</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 400,
            fontSize: "clamp(36px, 5.5vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            marginTop: "24px",
            maxWidth: "26ch",
          }}
        >
          Scripture, songs, slides —{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
            all detected together.
          </em>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "12px",
            marginTop: "56px",
          }}
          className="content-types-grid"
        >
          {CONTENT_TYPES.map(({ glyph, name, desc }) => (
            <div
              key={name}
              style={{
                padding: "28px 20px",
                background: "var(--surface)",
                border: "1px solid var(--rule-soft)",
                borderRadius: "4px",
                minHeight: "220px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "1px solid var(--rule)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--serif)",
                  fontSize: "22px",
                  fontStyle: "italic",
                }}
              >
                {glyph}
              </div>
              <div>
                <h4
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "22px",
                    lineHeight: 1.1,
                    letterSpacing: "-0.01em",
                    margin: "20px 0 8px",
                    fontWeight: 400,
                  }}
                >
                  {name}
                </h4>
                <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.45 }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .content-types-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}
