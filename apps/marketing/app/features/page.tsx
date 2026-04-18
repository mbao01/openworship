import type { Metadata } from "next";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Features — openworship",
  description:
    "A complete reference for what openworship does — operating modes, content types, service projects, multi-branch support, roadmap, and technical architecture.",
};

const MODES = [
  {
    name: "Auto",
    who: "Nobody",
    desc: "AI listens, detects cues across all content types, and pushes to screen instantly. Best for experienced, consistent speakers.",
  },
  {
    name: "Copilot",
    who: "1 operator",
    desc: "AI detects and queues suggestions with confidence scores. Operator reviews and approves before display. Full control, zero lookup time.",
  },
  {
    name: "Airplane",
    who: "1 operator · no mic",
    desc: "No microphone input. Operator manually searches or triggers content. AI still powers search across scriptures, lyrics, and slides.",
  },
  {
    name: "Offline",
    who: "1 operator · no AI",
    desc: "Conventional manual operation. Functions as a standard worship display app for churches that want simplicity or do not trust AI in a live service.",
  },
] as const;

const CONTENT_TYPES = [
  {
    glyph: "§",
    name: "Scripture",
    desc: "Detected by exact reference, paraphrase, or story beat. 50+ translations bundled offline. Live translation swap while a verse is on screen.",
    meta: "Exact · Paraphrase\nStory-based\n50+ translations",
  },
  {
    glyph: "♪",
    name: "Lyrics",
    desc: "Detected by song title, opening line, or mid-song phrase. Line-by-line display auto-advances with the pace of speech.",
    meta: "CCLI SongSelect\nOpenLP XML\nManual entry",
  },
  {
    glyph: "❡",
    name: "Announcements",
    desc: 'Keyword-cued or operator-triggered. Pre-loaded with the service plan. The word "announcements" pushes the deck.',
    meta: "Keyword cues\nManual trigger\nPre-loaded decks",
  },
  {
    glyph: "⊡",
    name: "Custom slides",
    desc: "Free-form text, images, and countdowns. Keyword-cued or pushed by hand. For everything that isn't one of the above.",
    meta: "Text · Image\nCountdown\nKeyword / manual",
  },
  {
    glyph: "⌇",
    name: "Sermon notes",
    desc: "Outline-driven and operator-advanced. Optional speaker-facing monitor shows the next point before it's spoken.",
    meta: "Outline input\nOperator-advanced\nSpeaker monitor",
  },
] as const;

const SERVICE_ROWS = [
  {
    glyph: "A",
    name: "Pre-service preparation",
    desc: "Load scriptures, lyrics, announcements, sermon notes, and custom slides before the service. On Sunday, open the file — everything is already there.",
    meta: "One file per service\nEdit in advance",
  },
  {
    glyph: "B",
    name: "Historical services",
    desc: "Past projects are saved and accessible in a locked read-only state. Reviewable, referenceable, never accidentally editable.",
    meta: "Locked · archive\nSearchable",
  },
  {
    glyph: "C",
    name: "Content bank",
    desc: "Every artifact used in a service — lyrics, images, slides, announcements, notes — is automatically indexed into a shared bank for reuse.",
    meta: "Auto-indexed\nCross-service search",
  },
  {
    glyph: "D",
    name: "Service summaries",
    desc: "AI-generated summary of each service — scriptures used, songs, announcements, themes — emailed to subscribed addresses at a configurable delay.",
    meta: "Per-church subscribers\nDelay configurable",
  },
] as const;

const PHASES = [
  {
    tag: "Phase 1 · MVP",
    title: "Live scripture detection.",
    sub: "Shipping today",
    items: [
      "Continuous STT with rolling context window (10s default, tunable)",
      "Exact reference via regex + Tantivy in-memory full-text index",
      "Fullscreen browser display, WebSocket-synced",
      "OBS integration via browser source URL",
      "Basic FIFO content queue",
      "Auto and Copilot modes",
      "Offline (Whisper.cpp) and Online (Deepgram) paths",
      "Target latency: <200ms offline · <100ms online",
    ],
    status: "shipping",
    statusLabel: "● Available now",
  },
  {
    tag: "Phase 2 · Content expansion",
    title: "AI matching and lyrics.",
    sub: "Next",
    items: [
      "Semantic embeddings (local Ollama) for paraphrase & story match",
      "Multi-translation live swap while a verse is on screen",
      "Song lyrics: detect by title, opening line, mid-lyric phrase",
      "Line-by-line lyrics display, auto-advancing with speech",
      "Lyrics library: CCLI, OpenLP XML, manual",
      "Airplane mode with AI-powered free-text search",
      "Multi-reference detection per utterance",
      "Operator-visible confidence scores",
    ],
    status: "planned",
    statusLabel: "○ In development",
  },
  {
    tag: "Phase 3 · Platform",
    title: "Full display platform.",
    sub: "Planned",
    items: [
      "Announcements & custom slides, keyword-cued",
      "Sermon notes / outline display, speaker monitor",
      "Countdown timers and interstitial slides",
      '"Not this one" correction — re-ranks without interrupting',
      "Per-church session memory (translations, songs, refs)",
      "Full service plan builder",
      "Airplane mode extended to every content type",
      "Multi-branch cloud artifacts & sharing",
    ],
    status: "planned",
    statusLabel: "○ Planned",
  },
] as const;

const TECH_ROWS = [
  { label: "Speech-to-text (offline)", value: "Whisper.cpp bundled as sidecar binary. Runs on CPU. No GPU required." },
  { label: "Speech-to-text (online)", value: "Deepgram streaming API. First-word latency ~100ms." },
  { label: "Scripture matching · Phase 1", value: "Regex for reference parsing; Tantivy (Rust, in-memory) for full-text search — faster than SQLite FTS5 and native to Tauri. Bible DB (~4MB) loaded into RAM at startup." },
  { label: "Scripture matching · Phase 2", value: "nomic-embed-text via Ollama, cosine similarity on pre-embedded verse index." },
  { label: "Lyrics matching", value: "FTS5 for title and opening line; embedding model for mid-lyric detection." },
  { label: "Bible database", value: "Open-licensed translations (eBible, OpenBible). SQLite, bundled." },
  { label: "Desktop app", value: "Tauri (Rust + web frontend). Ships .exe, .dmg, .AppImage." },
  { label: "Web app", value: "Next.js. Runs on localhost or cloud-hosted." },
  { label: "Display output", value: "Local WebSocket server → fullscreen browser page. Shareable as an OBS browser source URL." },
  { label: "Content queue", value: "In-memory priority queue, WebSocket-synced to all display clients." },
  { label: "Confidence scoring", value: "BM25 / cosine similarity normalised to 0–100% per content type." },
  { label: "Artifact storage · local", value: "Filesystem with configurable per-service root. Indexed in SQLite for search and content bank integration." },
  { label: "Artifact storage · cloud", value: "S3-compatible object storage, per-branch namespace isolation. Rust sync engine for conflicts and delta uploads." },
  { label: "Sharing & permissions", value: "ACL-based: owner, branch-level grants (view/comment/edit), church-wide public flag. Enforced server-side on every read/write." },
] as const;

export default function FeaturesPage() {
  const tocLinks = [
    { href: "#modes", label: "01 · Operating modes" },
    { href: "#content", label: "02 · Content types" },
    { href: "#service", label: "03 · Service projects" },
    { href: "#branches", label: "04 · Multi-branch" },
    { href: "#phases", label: "05 · Roadmap" },
    { href: "#tech", label: "06 · Technical" },
  ];

  return (
    <>
      <Nav />
      <main>
        {/* Page header */}
        <div
          style={{
            paddingTop: "64px",
            paddingBottom: "48px",
            borderBottom: "1px solid var(--rule-soft)",
          }}
        >
          <div className="container">
            <Eyebrow>Features · v0.1 · PRD v2</Eyebrow>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(48px, 7vw, 104px)",
                lineHeight: 0.98,
                letterSpacing: "-0.035em",
                maxWidth: "20ch",
                marginTop: "24px",
              }}
            >
              Every cue,{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                every content type,
              </em>{" "}
              every mode of trust.
            </h1>
            <p
              style={{
                marginTop: "32px",
                maxWidth: "48ch",
                fontFamily: "var(--serif)",
                fontSize: "20px",
                lineHeight: 1.45,
                color: "var(--ink-2)",
              }}
            >
              A complete reference for what openworship does today, what it&apos;s doing
              next, and how it gets out of your way during a live service.
            </p>
            <div
              style={{
                marginTop: "48px",
                display: "flex",
                gap: "28px",
                flexWrap: "wrap",
                fontFamily: "var(--mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              {tocLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  style={{
                    color: "var(--muted)",
                    padding: "6px 0",
                    borderBottom: "1px solid var(--rule-soft)",
                    transition: "color 120ms, border-color 120ms",
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* MODES */}
        <section id="modes">
          <div className="container">
            <div
              style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "80px", alignItems: "start" }}
              className="feat-grid"
            >
              <div style={{ position: "sticky", top: "100px" }}>
                <Eyebrow>01 · Modes</Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--serif)",
                    fontWeight: 400,
                    fontSize: "48px",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    marginTop: "18px",
                    marginBottom: "16px",
                  }}
                >
                  How much you trust{" "}
                  <em style={{ fontStyle: "italic", color: "var(--accent)" }}>the machine.</em>
                </h2>
                <p style={{ fontFamily: "var(--serif)", fontSize: "17px", lineHeight: 1.45, color: "var(--ink-2)" }}>
                  Four ways to run a service. All four available in every build. Switch between
                  them at any time — even mid-service.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--accent)",
                    padding: "4px 8px",
                    border: "1px solid var(--accent)",
                    borderRadius: "2px",
                  }}
                >
                  Available in Phase 1
                </span>
              </div>
              <div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr>
                      {["Mode", "Operator", "Behaviour"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            fontFamily: "var(--mono)",
                            fontSize: "10px",
                            color: "var(--muted)",
                            fontWeight: 400,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            padding: "14px 0",
                            borderBottom: "1px solid var(--rule)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODES.map(({ name, who, desc }) => (
                      <tr key={name}>
                        <td
                          style={{
                            padding: "20px 20px 20px 0",
                            verticalAlign: "top",
                            borderBottom: "1px solid var(--rule-soft)",
                            width: "200px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--serif)",
                              fontSize: "22px",
                              letterSpacing: "-0.01em",
                            }}
                          >
                            <em style={{ color: "var(--accent)", fontStyle: "italic" }}>{name}</em>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "20px 20px 20px 0",
                            verticalAlign: "top",
                            borderBottom: "1px solid var(--rule-soft)",
                            width: "160px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: "11px",
                              color: "var(--muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            {who}
                          </div>
                        </td>
                        <td style={{ padding: "20px 0", verticalAlign: "top", borderBottom: "1px solid var(--rule-soft)" }}>
                          <div style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5, maxWidth: "46ch" }}>
                            {desc}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* CONTENT TYPES */}
        <section id="content">
          <div className="container">
            <div
              style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "80px", alignItems: "start" }}
              className="feat-grid"
            >
              <div style={{ position: "sticky", top: "100px" }}>
                <Eyebrow>02 · Content types</Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--serif)",
                    fontWeight: 400,
                    fontSize: "48px",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    marginTop: "18px",
                    marginBottom: "16px",
                  }}
                >
                  One queue.{" "}
                  <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                    Every kind of cue.
                  </em>
                </h2>
                <p style={{ fontFamily: "var(--serif)", fontSize: "17px", lineHeight: 1.45, color: "var(--ink-2)" }}>
                  Detected together, ranked by confidence, stacked in the order they were
                  heard. Scripture, lyrics, announcements, slides, and sermon notes — equal
                  citizens.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--accent)",
                    padding: "4px 8px",
                    border: "1px solid var(--accent)",
                    borderRadius: "2px",
                  }}
                >
                  Phase 1 → Phase 3
                </span>
              </div>
              <div>
                <div style={{ borderTop: "1px solid var(--rule)" }}>
                  {CONTENT_TYPES.map(({ glyph, name, desc, meta }) => (
                    <div
                      key={name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 200px 1fr 180px",
                        gap: "24px",
                        padding: "28px 0",
                        borderBottom: "1px solid var(--rule-soft)",
                        alignItems: "baseline",
                      }}
                      className="ct-row"
                    >
                      <div
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: "28px",
                          fontStyle: "italic",
                          color: "var(--accent)",
                        }}
                      >
                        {glyph}
                      </div>
                      <h4
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: "24px",
                          letterSpacing: "-0.015em",
                          fontWeight: 400,
                        }}
                      >
                        {name}
                      </h4>
                      <div style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>
                        {desc}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "11px",
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          lineHeight: 1.6,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {meta}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICE PROJECTS */}
        <section id="service">
          <div className="container">
            <div
              style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "80px", alignItems: "start" }}
              className="feat-grid"
            >
              <div style={{ position: "sticky", top: "100px" }}>
                <Eyebrow>03 · Service projects</Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--serif)",
                    fontWeight: 400,
                    fontSize: "48px",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    marginTop: "18px",
                    marginBottom: "16px",
                  }}
                >
                  The whole service,{" "}
                  <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                    in a single file.
                  </em>
                </h2>
                <p style={{ fontFamily: "var(--serif)", fontSize: "17px", lineHeight: 1.45, color: "var(--ink-2)" }}>
                  Each service is a named, saved project with its own content plan, order, and
                  settings. Past services lock to read-only. Every used artifact flows into a
                  shared, searchable content bank.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--accent)",
                    padding: "4px 8px",
                    border: "1px solid var(--accent)",
                    borderRadius: "2px",
                  }}
                >
                  Phase 3
                </span>
              </div>
              <div>
                <div style={{ borderTop: "1px solid var(--rule)" }}>
                  {SERVICE_ROWS.map(({ glyph, name, desc, meta }) => (
                    <div
                      key={name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 200px 1fr 180px",
                        gap: "24px",
                        padding: "28px 0",
                        borderBottom: "1px solid var(--rule-soft)",
                        alignItems: "baseline",
                      }}
                      className="ct-row"
                    >
                      <div
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: "28px",
                          fontStyle: "italic",
                          color: "var(--accent)",
                        }}
                      >
                        {glyph}
                      </div>
                      <h4
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: "24px",
                          letterSpacing: "-0.015em",
                          fontWeight: 400,
                        }}
                      >
                        {name}
                      </h4>
                      <div style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{desc}</div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "11px",
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          lineHeight: 1.6,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {meta}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BRANCHES */}
        <section id="branches">
          <div className="container">
            <div
              style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "80px", alignItems: "start" }}
              className="feat-grid"
            >
              <div style={{ position: "sticky", top: "100px" }}>
                <Eyebrow>04 · Multi-branch church</Eyebrow>
                <h2
                  style={{
                    fontFamily: "var(--serif)",
                    fontWeight: 400,
                    fontSize: "48px",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    marginTop: "18px",
                    marginBottom: "16px",
                  }}
                >
                  One church.{" "}
                  <em style={{ fontStyle: "italic", color: "var(--accent)" }}>Many rooms.</em>{" "}
                  Shared memory.
                </h2>
                <p style={{ fontFamily: "var(--serif)", fontSize: "17px", lineHeight: 1.45, color: "var(--ink-2)" }}>
                  A church has one or more branches. One branch is designated HQ. HQ
                  administers the shared space and manages branch membership. Each branch
                  keeps its own artifacts private by default.
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--accent)",
                    padding: "4px 8px",
                    border: "1px solid var(--accent)",
                    borderRadius: "2px",
                  }}
                >
                  Phase 3
                </span>
              </div>
              <div>
                <div
                  style={{
                    padding: "40px",
                    background: "var(--bg-2)",
                    border: "1px solid var(--rule-soft)",
                    borderRadius: "4px",
                  }}
                >
                  {/* Org diagram */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        padding: "14px 24px",
                        border: "1px solid var(--rule)",
                        background: "var(--ink)",
                        color: "var(--bg)",
                        fontFamily: "var(--serif)",
                        fontSize: "18px",
                        letterSpacing: "-0.01em",
                        minWidth: "180px",
                        textAlign: "center",
                      }}
                    >
                      Grace Community
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "9px",
                          color: "rgba(245,241,232,0.5)",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          display: "block",
                          marginTop: "2px",
                        }}
                      >
                        Church (HQ)
                      </span>
                    </div>
                    <div style={{ width: "1px", height: "30px", background: "var(--rule)" }} />
                    <div style={{ display: "flex", gap: "40px", position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          top: "-15px",
                          left: "50%",
                          width: "calc(100% - 180px)",
                          height: "1px",
                          background: "var(--rule)",
                          transform: "translateX(-50%)",
                        }}
                      />
                      {["Downtown", "Westside", "Riverside"].map((branch) => (
                        <div
                          key={branch}
                          style={{
                            padding: "14px 24px",
                            border: "1px solid var(--rule)",
                            background: "var(--bg)",
                            fontFamily: "var(--serif)",
                            fontSize: "18px",
                            letterSpacing: "-0.01em",
                            minWidth: "180px",
                            textAlign: "center",
                          }}
                        >
                          {branch}
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: "9px",
                              color: "var(--muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              display: "block",
                              marginTop: "2px",
                            }}
                          >
                            branch
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: "40px" }}>
                    <h4
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: "22px",
                        letterSpacing: "-0.01em",
                        marginBottom: "8px",
                        fontWeight: 400,
                      }}
                    >
                      Visibility, scoped.
                    </h4>
                    <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.55, maxWidth: "60ch" }}>
                      A branch only sees artifacts it has been granted access to — its own
                      private storage, the shared church space, and anything explicitly shared
                      with it. Branch A cannot see Branch B&apos;s artifacts by default.
                    </p>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", marginTop: "24px" }}>
                    <thead>
                      <tr>
                        {["Permission", "View", "Comment", "Edit"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "14px 16px",
                              textAlign: "left",
                              fontFamily: "var(--mono)",
                              fontSize: "10px",
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              color: "var(--muted)",
                              fontWeight: 400,
                              borderBottom: "1px solid var(--rule)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { perm: "See & download", v: true, c: true, e: true },
                        { perm: "Annotate", v: false, c: true, e: true },
                        { perm: "Upload · modify", v: false, c: false, e: true },
                        { perm: "Delete", v: false, c: false, e: true },
                      ].map(({ perm, v, c, e }) => (
                        <tr key={perm}>
                          <td style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule-soft)", verticalAlign: "top" }}>
                            <div style={{ fontFamily: "var(--serif)", fontSize: "18px", color: "var(--ink)", letterSpacing: "-0.005em" }}>
                              {perm}
                            </div>
                          </td>
                          {[v, c, e].map((val, i) => (
                            <td key={i} style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule-soft)" }}>
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  fontSize: "14px",
                                  color: val ? "var(--accent)" : "var(--muted)",
                                }}
                              >
                                {val ? "●" : "○"}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PHASES */}
        <section id="phases">
          <div className="container">
            <Eyebrow>05 · Roadmap</Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: "24px",
                marginBottom: "56px",
                maxWidth: "22ch",
              }}
            >
              Ship the loop.{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>Then expand.</em>
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1px",
                background: "var(--rule-soft)",
                border: "1px solid var(--rule-soft)",
              }}
              className="phases-grid"
            >
              {PHASES.map(({ tag, title, sub, items, status, statusLabel }) => (
                <div
                  key={tag}
                  style={{
                    padding: "36px 32px",
                    background: "var(--bg)",
                    minHeight: "480px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      color: "var(--accent)",
                    }}
                  >
                    {tag}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: "28px",
                      lineHeight: 1.05,
                      letterSpacing: "-0.02em",
                      margin: "16px 0 12px",
                      fontWeight: 400,
                    }}
                  >
                    {title}
                  </h3>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      paddingBottom: "20px",
                      borderBottom: "1px solid var(--rule-soft)",
                    }}
                  >
                    {sub}
                  </div>
                  <ul style={{ listStyle: "none", marginTop: "20px", flex: 1 }}>
                    {items.map((item) => (
                      <li
                        key={item}
                        style={{
                          padding: "10px 0",
                          fontSize: "13px",
                          color: "var(--ink-2)",
                          lineHeight: 1.5,
                          borderBottom: "1px solid var(--rule-soft)",
                        }}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div
                    style={{
                      marginTop: "20px",
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: status === "shipping" ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {statusLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TECH */}
        <section id="tech">
          <div className="container">
            <Eyebrow>06 · Technical</Eyebrow>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                marginTop: "24px",
                marginBottom: "16px",
                maxWidth: "22ch",
              }}
            >
              Built to run{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>
                on the laptop in the back.
              </em>
            </h2>
            <p style={{ marginBottom: "48px", fontSize: "18px", color: "var(--ink-2)", fontFamily: "var(--serif)" }}>
              No GPU requirement. Single binary. Ships as .exe, .dmg, and .AppImage.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "240px 1fr",
                borderTop: "1px solid var(--rule)",
              }}
              className="tech-grid"
            >
              {TECH_ROWS.map(({ label, value }) => (
                <div key={label} style={{ display: "contents" }}>
                  <div
                    style={{
                      padding: "22px 24px 22px 0",
                      borderBottom: "1px solid var(--rule-soft)",
                      fontFamily: "var(--serif)",
                      fontSize: "18px",
                      letterSpacing: "-0.005em",
                      color: "var(--ink)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      padding: "22px 0",
                      borderBottom: "1px solid var(--rule-soft)",
                      fontSize: "14px",
                      color: "var(--ink-2)",
                      lineHeight: 1.55,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 900px) {
          .feat-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .feat-grid > div:first-child { position: static !important; }
          .phases-grid { grid-template-columns: 1fr !important; }
          .ct-row { grid-template-columns: 1fr !important; gap: 8px !important; padding: 20px 0 !important; }
          .tech-grid { grid-template-columns: 1fr !important; }
          .tech-grid > div { padding: 12px 0 !important; }
        }
      `}</style>
    </>
  );
}
