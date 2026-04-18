import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Download — openworship",
  description:
    "Download openworship for free. Available for macOS, Windows, and Linux. Free forever. No account required.",
};

const PLATFORMS = [
  {
    os: "macOS · 12+",
    name: "Mac",
    glyph: "⌘",
    file: "openworship-0.1.0.dmg",
    arches: "Apple Silicon · Intel · 72 MB",
    recommended: false,
  },
  {
    os: "Windows · 10 · 11",
    name: "Windows",
    glyph: "⊞",
    file: "openworship-0.1.0.exe",
    arches: "x64 · 68 MB · Signed",
    recommended: true,
  },
  {
    os: "Linux · any distro",
    name: "Linux",
    glyph: "§",
    file: "openworship-0.1.0.AppImage",
    arches: "x64 · arm64 · 74 MB",
    recommended: false,
  },
] as const;

const REQUIREMENTS = [
  { label: "CPU", value: "4-core", sub: "or better · any modern laptop" },
  { label: "Memory", value: "8 GB", sub: "minimum · 16 GB comfortable" },
  { label: "GPU", value: "None", sub: "required · CPU inference" },
  { label: "Disk", value: "200 MB", sub: "· plus content bank" },
] as const;

const CHANGELOG = [
  {
    version: "v0.1.0",
    date: "Apr 2026 · MVP",
    title: "Live scripture detection.",
    body: "The core loop, shipped. Speak a reference, get a verse, on screen, in under 200ms offline.",
    items: [
      "Continuous STT · rolling context window",
      "Exact reference regex · Tantivy full-text search",
      "Auto and Copilot modes",
      "Whisper.cpp offline · Deepgram online",
      "OBS browser source output",
    ],
  },
  {
    version: "v0.2",
    date: "Q3 2026 · planned",
    title: "AI matching and lyrics.",
    body: "Paraphrase and story detection land. Lyrics become a first-class content type with line-by-line display.",
    items: [
      "Semantic embeddings · local Ollama",
      "Multi-translation live swap",
      "CCLI, OpenLP, manual lyrics import",
      "Airplane mode with free-text AI search",
    ],
  },
  {
    version: "v1.0",
    date: "2027 · planned",
    title: "Full display platform.",
    body: "Announcements, custom slides, sermon notes, countdowns, per-church session memory, and multi-branch cloud.",
    items: [
      "Keyword-cued announcements",
      "Speaker-facing sermon monitor",
      'Correction loop ("not this one")',
      "Multi-branch artifact sharing",
    ],
  },
] as const;

export default function DownloadPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section
          style={{
            paddingTop: "72px",
            paddingBottom: "56px",
            textAlign: "center",
            borderBottom: "1px solid var(--rule-soft)",
          }}
        >
          <div className="container">
            <Eyebrow center>Download · v0.1.0 · Apr 2026</Eyebrow>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(56px, 9vw, 128px)",
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                maxWidth: "16ch",
                margin: "28px auto 0",
              }}
            >
              Free.{" "}
              <em style={{ color: "var(--accent)", fontStyle: "italic" }}>Forever.</em>{" "}
              Full stop.
            </h1>
            <p
              style={{
                margin: "28px auto 0",
                maxWidth: "44ch",
                fontFamily: "var(--serif)",
                fontSize: "20px",
                lineHeight: 1.45,
                color: "var(--ink-2)",
              }}
            >
              Built for churches that don&apos;t have a budget, don&apos;t have a volunteer,
              and still have a service this Sunday.
            </p>
            <div
              style={{
                marginTop: "36px",
                display: "inline-flex",
                gap: "14px",
                alignItems: "baseline",
                fontFamily: "var(--mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "var(--muted)",
                paddingTop: "24px",
                borderTop: "1px solid var(--rule-soft)",
              }}
            >
              <span>Competing tools · $500 – $1,500 / yr</span>
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "32px",
                  color: "var(--accent)",
                  fontWeight: 400,
                  fontStyle: "italic",
                  letterSpacing: "-0.02em",
                  textTransform: "none",
                }}
              >
                $0
              </span>
              <span>openworship</span>
            </div>
          </div>
        </section>

        {/* Download cards */}
        <section style={{ paddingTop: 0 }}>
          <div className="container">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1px",
                background: "var(--rule-soft)",
                border: "1px solid var(--rule-soft)",
                marginTop: "64px",
              }}
              className="dl-grid"
            >
              {PLATFORMS.map(({ os, name, glyph, file, arches, recommended }) => (
                <div
                  key={name}
                  style={{
                    background: recommended ? "var(--bg-2)" : "var(--bg)",
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "380px",
                    position: "relative",
                    transition: "background 150ms",
                  }}
                >
                  {recommended && (
                    <span
                      style={{
                        position: "absolute",
                        top: "20px",
                        right: "24px",
                        fontFamily: "var(--mono)",
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        color: "var(--accent)",
                        padding: "4px 8px",
                        border: "1px solid var(--accent)",
                        borderRadius: "2px",
                      }}
                    >
                      Recommended
                    </span>
                  )}
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      color: "var(--muted)",
                      marginBottom: "12px",
                    }}
                  >
                    {os}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--serif)",
                      fontWeight: 400,
                      fontSize: "44px",
                      lineHeight: 1,
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {name}
                  </h3>
                  <div
                    style={{
                      marginTop: "20px",
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: "56px",
                      color: "var(--accent)",
                      lineHeight: 1,
                    }}
                  >
                    {glyph}
                  </div>
                  <div
                    style={{
                      marginTop: "24px",
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      color: "var(--muted)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {file.split("0.1.0").map((part, i) => (
                      <span key={i}>
                        {part}
                        {i === 0 && <strong style={{ color: "var(--ink)", fontWeight: 500 }}>0.1.0</strong>}
                      </span>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--muted)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {arches}
                  </div>
                  <a
                    href="#"
                    style={{
                      marginTop: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      padding: "14px 22px",
                      fontSize: "14px",
                      fontFamily: "var(--sans)",
                      borderRadius: "2px",
                      border: "1px solid var(--rule)",
                      background: "var(--ink)",
                      color: "var(--bg)",
                      transition: "all 150ms",
                    }}
                  >
                    Download for {name} ↓
                  </a>
                </div>
              ))}
            </div>

            {/* Also available */}
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginTop: "40px" }}
              className="also-grid"
            >
              <div
                style={{
                  padding: "28px 32px",
                  border: "1px solid var(--rule-soft)",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h4
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "24px",
                    fontWeight: 400,
                    letterSpacing: "-0.015em",
                    marginBottom: "8px",
                  }}
                >
                  Install with Homebrew.
                </h4>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "20px" }}>
                  One-line install on macOS. Keeps openworship on the brew upgrade path.
                </p>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "12px",
                    background: "var(--bg-2)",
                    padding: "10px 14px",
                    borderRadius: "2px",
                    color: "var(--ink)",
                    marginBottom: "16px",
                  }}
                >
                  brew install openworship
                </div>
                <a
                  href="#"
                  style={{
                    color: "var(--accent)",
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginTop: "auto",
                  }}
                >
                  Homebrew formula →
                </a>
              </div>
              <div
                style={{
                  padding: "28px 32px",
                  border: "1px solid var(--rule-soft)",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h4
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: "24px",
                    fontWeight: 400,
                    letterSpacing: "-0.015em",
                    marginBottom: "8px",
                  }}
                >
                  Run the web app.
                </h4>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "20px" }}>
                  Self-host the Next.js build on localhost or a server you control. Same
                  engine, browser-only.
                </p>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "12px",
                    background: "var(--bg-2)",
                    padding: "10px 14px",
                    borderRadius: "2px",
                    color: "var(--ink)",
                    marginBottom: "16px",
                  }}
                >
                  docker run openworship/web
                </div>
                <Link
                  href="/docs"
                  style={{
                    color: "var(--accent)",
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginTop: "auto",
                  }}
                >
                  Deployment guide →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* System requirements */}
        <section>
          <div className="container">
            <Eyebrow>System requirements</Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: "24px",
                maxWidth: "20ch",
              }}
            >
              Runs on{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                the laptop in the back.
              </em>
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                borderTop: "1px solid var(--rule)",
                borderBottom: "1px solid var(--rule)",
                marginTop: "56px",
              }}
              className="reqs-grid"
            >
              {REQUIREMENTS.map(({ label, value, sub }, i) => (
                <div
                  key={label}
                  style={{
                    padding: "32px 24px",
                    borderRight: i < REQUIREMENTS.length - 1 ? "1px solid var(--rule-soft)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--muted)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      marginTop: "14px",
                      fontFamily: "var(--serif)",
                      fontSize: "26px",
                      lineHeight: 1.1,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    <em style={{ color: "var(--accent)", fontStyle: "italic" }}>{value}</em>{" "}
                    {sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Changelog */}
        <section>
          <div className="container">
            <Eyebrow>Changelog</Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: "24px",
                marginBottom: "56px",
                maxWidth: "18ch",
              }}
            >
              What&apos;s shipped.{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>What&apos;s next.</em>
            </h2>

            <div style={{ maxWidth: "720px", margin: "0 auto" }}>
              {CHANGELOG.map(({ version, date, title, body, items }) => (
                <div
                  key={version}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    gap: "32px",
                    padding: "24px 0",
                    borderTop: "1px solid var(--rule-soft)",
                  }}
                  className="changelog-row"
                >
                  <div>
                    <strong
                      style={{
                        color: "var(--accent)",
                        display: "block",
                        fontFamily: "var(--serif)",
                        fontStyle: "italic",
                        fontSize: "20px",
                        letterSpacing: "-0.01em",
                        marginBottom: "2px",
                        textTransform: "none",
                        fontWeight: 400,
                      }}
                    >
                      {version}
                    </strong>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "11px",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {date}
                    </span>
                  </div>
                  <div>
                    <h4
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: "22px",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        marginBottom: "6px",
                      }}
                    >
                      {title}
                    </h4>
                    <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.55, maxWidth: "50ch" }}>
                      {body}
                    </p>
                    <ul style={{ marginTop: "12px", paddingLeft: "20px", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.7 }}>
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--rule-soft)" }} />
            </div>
          </div>
        </section>

        {/* Dark CTA */}
        <section
          style={{
            background: "var(--ink)",
            color: "var(--bg)",
            textAlign: "center",
            borderTop: "none !important" as "none",
          }}
        >
          <div className="container">
            <Eyebrow center light>
              Source · open
            </Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                color: "var(--bg)",
                margin: "24px auto",
                maxWidth: "18ch",
              }}
            >
              Read the code.{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>Fork the project.</em>
            </h2>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: "20px",
                lineHeight: 1.4,
                maxWidth: "40ch",
                margin: "0 auto 40px",
                color: "rgba(245,241,232,0.75)",
              }}
            >
              openworship is developed in the open. The source, the issues, the roadmap —
              all on GitHub.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href="https://github.com/mbao01/openworship"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 22px",
                  fontSize: "14px",
                  fontFamily: "var(--sans)",
                  borderRadius: "2px",
                  border: "1px solid var(--bg)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  transition: "all 150ms",
                }}
              >
                GitHub · source →
              </a>
              <Link
                href="/docs"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 22px",
                  fontSize: "14px",
                  fontFamily: "var(--sans)",
                  borderRadius: "2px",
                  border: "1px solid rgba(245,241,232,0.3)",
                  background: "transparent",
                  color: "var(--bg)",
                  transition: "all 150ms",
                }}
              >
                Documentation
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 900px) {
          .dl-grid { grid-template-columns: 1fr !important; }
          .also-grid { grid-template-columns: 1fr !important; }
          .reqs-grid { grid-template-columns: 1fr 1fr !important; }
          .reqs-grid > div { border-right: 0 !important; border-bottom: 1px solid var(--rule-soft); }
          .changelog-row { grid-template-columns: 1fr !important; gap: 10px !important; }
        }
      `}</style>
    </>
  );
}
