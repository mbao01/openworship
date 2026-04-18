import type { Metadata } from "next";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Docs — openworship",
  description:
    "Get openworship on screen by Sunday. Quickstart guide, install instructions, operating modes, shortcuts, OBS setup, and FAQ.",
};

const NAV_SECTIONS = [
  {
    heading: "Getting started",
    links: [
      { href: "#quickstart", label: "Quickstart" },
      { href: "#install", label: "Install" },
      { href: "#first-service", label: "Your first service" },
    ],
  },
  {
    heading: "Operating",
    links: [
      { href: "#modes", label: "Modes" },
      { href: "#shortcuts", label: "Shortcuts" },
      { href: "#correction", label: "Correction loop" },
    ],
  },
  {
    heading: "Integrations",
    links: [
      { href: "#obs", label: "OBS" },
      { href: "#ccli", label: "CCLI & lyrics" },
      { href: "#translations", label: "Translations" },
    ],
  },
  {
    heading: "Reference",
    links: [
      { href: "#faq", label: "FAQ" },
      { href: "#support", label: "Support" },
    ],
  },
] as const;

const QUICKSTART_STEPS = [
  {
    title: "Download and install.",
    body: "Pick your platform from the Download page. Open the installer. openworship ships as a signed, single binary — no companion services, no background daemons.",
  },
  {
    title: "Open a new service project.",
    body: 'Launch openworship, click New service, name it (e.g. "Sunday Apr 19"), and choose a service folder. All your media and notes for this service live here.',
  },
  {
    title: "Pick a mode and a microphone.",
    body: "Choose Copilot for your first service. Select your room microphone from the audio source dropdown. openworship shows a live transcript so you can verify audio is landing clean.",
  },
  {
    title: "Open the display.",
    body: "Click Open display. A fullscreen browser page opens — drag it to the projection screen, or copy the URL into OBS as a browser source. Start the service.",
  },
] as const;

const SHORTCUTS = [
  { action: "Push next queued", key: "Space" },
  { action: "Skip / reject", key: "X" },
  { action: '"Not this one"', key: "N" },
  { action: "Clear display (black)", key: "B" },
  { action: "Search (any library)", key: "Cmd + K" },
  { action: "Swap translation", key: "T" },
  { action: "Change mode", key: "Cmd + M" },
] as const;

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. No paid tier, no premium features, no \"free for individuals\". The whole product is free forever — it's the core differentiator over $500–$1,500/year alternatives. See the PRD for why that's a permanent commitment.",
    open: true,
  },
  {
    q: "Does it need a GPU?",
    a: "No. Whisper.cpp runs on CPU. A modern laptop (4-core, 8GB RAM) handles live transcription comfortably. A GPU speeds inference but is never required.",
    open: false,
  },
  {
    q: "Does it work offline?",
    a: "Yes. The offline path bundles Whisper and the Tantivy Bible index. Target latency is <200ms offline. Online mode (Deepgram) lowers that to ~100ms if you have connectivity.",
    open: false,
  },
  {
    q: "What if the AI gets it wrong during a service?",
    a: "Press N. The current match is rejected and the next-best candidate is promoted — no interruption. Or re-speak the reference; the loop re-detects.",
    open: false,
  },
  {
    q: "Can I run it alongside ProPresenter?",
    a: "Yes. Either use the OBS browser source alongside your existing setup, or switch between them by changing your projector's input source. Native ProPresenter integration is on the roadmap after Phase 1 adoption.",
    open: false,
  },
  {
    q: "Does it record my sermons?",
    a: "No. Audio is streamed to the STT engine (locally, or to Deepgram in online mode) and discarded. Recording and archiving are explicitly out of scope.",
    open: false,
  },
] as const;

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main>
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "240px 1fr",
              gap: "64px",
              paddingTop: "48px",
              paddingBottom: "120px",
            }}
            className="docs-layout"
          >
            {/* Sidebar nav */}
            <aside
              style={{
                position: "sticky",
                top: "90px",
                alignSelf: "start",
                maxHeight: "calc(100vh - 110px)",
                overflowY: "auto",
                paddingRight: "16px",
                borderRight: "1px solid var(--rule-soft)",
              }}
              className="docs-sidebar"
            >
              {NAV_SECTIONS.map(({ heading, links }) => (
                <div key={heading}>
                  <h4
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--muted)",
                      fontWeight: 400,
                      margin: "24px 0 10px",
                    }}
                  >
                    {heading}
                  </h4>
                  {links.map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      style={{
                        display: "block",
                        padding: "6px 0 6px 12px",
                        fontSize: "13px",
                        color: "var(--ink-2)",
                        borderLeft: "2px solid transparent",
                        marginLeft: "-14px",
                        transition: "color 120ms",
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              ))}
            </aside>

            {/* Content */}
            <div>
              <Eyebrow>Documentation · v0.1</Eyebrow>

              <h1
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "clamp(40px, 5.5vw, 72px)",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                Get it on screen{" "}
                <em style={{ color: "var(--accent)", fontStyle: "italic" }}>by Sunday.</em>
              </h1>

              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "20px",
                  lineHeight: 1.45,
                  color: "var(--ink-2)",
                  maxWidth: "54ch",
                  marginBottom: "48px",
                  paddingBottom: "32px",
                  borderBottom: "1px solid var(--rule-soft)",
                }}
              >
                openworship installs in about two minutes, connects to any microphone, and
                outputs to any screen. This guide walks through the first service — from
                download to the moment a verse appears because you spoke it.
              </p>

              {/* Quickstart */}
              <h2
                id="quickstart"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  marginBottom: "16px",
                }}
              >
                Quickstart
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                Four steps, about five minutes. No account. No setup wizard.
              </p>

              <ol
                style={{
                  counterReset: "step",
                  listStyle: "none",
                  padding: 0,
                  margin: "24px 0",
                }}
              >
                {QUICKSTART_STEPS.map(({ title, body }, i) => (
                  <li
                    key={title}
                    style={{
                      padding: "20px 0 20px 72px",
                      borderTop: "1px solid var(--rule-soft)",
                      position: "relative",
                      maxWidth: "62ch",
                    }}
                  >
                    {i === QUICKSTART_STEPS.length - 1 && (
                      <div style={{ borderBottom: "1px solid var(--rule-soft)", position: "absolute", bottom: 0, left: 0, right: 0 }} />
                    )}
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "20px",
                        fontFamily: "var(--mono)",
                        fontSize: "11px",
                        color: "var(--accent)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      0{i + 1}
                    </span>
                    <h3
                      style={{
                        margin: "0 0 6px",
                        fontFamily: "var(--serif)",
                        fontSize: "20px",
                        letterSpacing: "-0.01em",
                        fontWeight: 400,
                      }}
                    >
                      {title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.55 }}>
                      {body}
                    </p>
                  </li>
                ))}
              </ol>

              {/* Install */}
              <h2
                id="install"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Install
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                openworship is a <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Tauri</strong> desktop
                application. It ships as a signed <code style={{ fontFamily: "var(--mono)", fontSize: "13px", background: "var(--bg-2)", padding: "1px 6px", borderRadius: "2px" }}>.dmg</code> for
                macOS, <code style={{ fontFamily: "var(--mono)", fontSize: "13px", background: "var(--bg-2)", padding: "1px 6px", borderRadius: "2px" }}>.exe</code> for
                Windows, and <code style={{ fontFamily: "var(--mono)", fontSize: "13px", background: "var(--bg-2)", padding: "1px 6px", borderRadius: "2px" }}>.AppImage</code> for
                Linux.
              </p>

              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "13px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--rule-soft)",
                  borderRadius: "3px",
                  padding: "14px 18px",
                  margin: "16px 0",
                  maxWidth: "62ch",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "var(--muted)" }}># macOS (Apple Silicon or Intel)</span>
                <br />
                <span style={{ color: "var(--accent)" }}>brew install</span> openworship
                <br />
                <br />
                <span style={{ color: "var(--muted)" }}># or: download the .dmg from /download</span>
              </div>

              <div
                style={{
                  padding: "20px 24px",
                  borderLeft: "2px solid var(--accent)",
                  background: "var(--bg-2)",
                  maxWidth: "62ch",
                  margin: "24px 0",
                  fontFamily: "var(--serif)",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: "var(--ink-2)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--accent)",
                    marginBottom: "6px",
                    display: "block",
                  }}
                >
                  Offline-first
                </span>
                The first launch downloads a ~72MB package containing the offline Whisper
                model, the Tantivy Bible index, and 50+ translations. After that, openworship
                runs with no network access required.
              </div>

              {/* First service */}
              <h2
                id="first-service"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Your first service
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                Start in <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Copilot</strong> mode.
                It&apos;s the safest introduction — the AI queues suggestions with confidence scores,
                and you approve each push with the spacebar. You keep full control; the lookup just
                disappears.
              </p>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                Before the service, load anything predictable into the service plan: sermon
                scripture, planned songs, the announcement deck. During the service, openworship
                listens and queues everything else automatically.
              </p>

              {/* Modes */}
              <h2
                id="modes"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Modes
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                Switch with <kbd style={{ fontFamily: "var(--mono)", fontSize: "11px", background: "var(--bg-2)", border: "1px solid var(--rule-soft)", borderBottomWidth: "2px", borderRadius: "3px", padding: "3px 7px", color: "var(--ink)" }}>Cmd</kbd>{" "}
                +{" "}
                <kbd style={{ fontFamily: "var(--mono)", fontSize: "11px", background: "var(--bg-2)", border: "1px solid var(--rule-soft)", borderBottomWidth: "2px", borderRadius: "3px", padding: "3px 7px", color: "var(--ink)" }}>M</kbd>{" "}
                at any time, even mid-service.
              </p>
              {[
                { name: "Auto", body: "The AI pushes directly to screen. No operator. Best for experienced speakers who stay close to their notes." },
                { name: "Copilot", body: "The AI queues; you approve. Default for most churches." },
                { name: "Airplane", body: "No microphone. The operator drives by keyboard. AI still powers search." },
                { name: "Offline", body: "No AI at all. Classical manual operation, for when simplicity or trust is the priority." },
              ].map(({ name, body }) => (
                <div key={name}>
                  <h3 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: "22px", letterSpacing: "-0.01em", margin: "36px 0 12px" }}>
                    {name}
                  </h3>
                  <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                    {body}
                  </p>
                </div>
              ))}

              {/* Shortcuts */}
              <h2
                id="shortcuts"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Shortcuts
              </h2>
              <table style={{ width: "100%", maxWidth: "62ch", borderCollapse: "collapse", fontSize: "14px", margin: "16px 0" }}>
                <tbody>
                  {SHORTCUTS.map(({ action, key }) => (
                    <tr key={action}>
                      <td style={{ padding: "12px 0", borderBottom: "1px solid var(--rule-soft)", color: "var(--ink-2)", width: "180px" }}>
                        {action}
                      </td>
                      <td style={{ padding: "12px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                        {key.split(" + ").map((k, i, arr) => (
                          <span key={k}>
                            <kbd
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "11px",
                                background: "var(--bg-2)",
                                border: "1px solid var(--rule-soft)",
                                borderBottomWidth: "2px",
                                borderRadius: "3px",
                                padding: "3px 7px",
                                color: "var(--ink)",
                              }}
                            >
                              {k}
                            </kbd>
                            {i < arr.length - 1 && " + "}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Correction */}
              <h2
                id="correction"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Correction loop
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                When the AI matches the wrong verse or song, press{" "}
                <kbd style={{ fontFamily: "var(--mono)", fontSize: "11px", background: "var(--bg-2)", border: "1px solid var(--rule-soft)", borderBottomWidth: "2px", borderRadius: "3px", padding: "3px 7px", color: "var(--ink)" }}>N</kbd>{" "}
                — the current match is excluded and the next-best candidate is promoted. The
                service keeps flowing. Verbal re-cue also re-detects.
              </p>

              {/* OBS */}
              <h2
                id="obs"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                OBS
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                openworship ships a local display URL on launch. In OBS, add a{" "}
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Browser source</strong>, paste the
                URL, set resolution to match your projection output, and you&apos;re done. No
                installation, no plugin.
              </p>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "13px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--rule-soft)",
                  borderRadius: "3px",
                  padding: "14px 18px",
                  margin: "16px 0",
                  maxWidth: "62ch",
                }}
              >
                <span style={{ color: "var(--muted)" }}># Default display URL</span>
                <br />
                http://localhost:<span style={{ color: "var(--accent)" }}>7411</span>/display
              </div>

              {/* CCLI */}
              <h2
                id="ccli"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                CCLI & lyrics
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                Lyrics can be imported three ways: from CCLI SongSelect, from an OpenLP XML
                bundle, or entered manually. openworship caches lyrics per-service into the
                content bank — once a song is imported, it&apos;s searchable across every future
                service.
              </p>

              {/* Translations */}
              <h2
                id="translations"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Translations
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)", marginBottom: "16px" }}>
                openworship ships with 50+ open-licensed English translations bundled offline,
                including KJV, ASV, WEB, BSB, and others. Licensed translations like NIV, ESV,
                NKJV, NLT, and AMP can be enabled in{" "}
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Settings → Translations</strong>{" "}
                where your church&apos;s CCLI / Biblica licensing applies.
              </p>

              {/* FAQ */}
              <h2
                id="faq"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                FAQ
              </h2>
              <div style={{ maxWidth: "62ch" }}>
                {FAQ.map(({ q, a, open }) => (
                  <details
                    key={q}
                    open={open}
                    style={{ borderBottom: "1px solid var(--rule-soft)", padding: "20px 0" }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontFamily: "var(--serif)",
                        fontSize: "19px",
                        letterSpacing: "-0.01em",
                        color: "var(--ink)",
                        listStyle: "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {q}
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "20px",
                          color: "var(--muted)",
                          flexShrink: 0,
                          marginLeft: "16px",
                        }}
                      >
                        +
                      </span>
                    </summary>
                    <p style={{ marginTop: "12px", fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                      {a}
                    </p>
                  </details>
                ))}
              </div>

              {/* Support */}
              <h2
                id="support"
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  fontSize: "36px",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  margin: "64px 0 16px",
                  paddingTop: "16px",
                }}
              >
                Support
              </h2>
              <p style={{ maxWidth: "62ch", fontSize: "15px", lineHeight: 1.65, color: "var(--ink-2)" }}>
                openworship is an open project. File issues on{" "}
                <a href="https://github.com/mbao01/openworship" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                , join the{" "}
                <a href="#" style={{ color: "var(--accent)" }}>
                  community forum
                </a>
                , or email{" "}
                <a href="mailto:hello@openworship.app" style={{ color: "var(--accent)" }}>
                  hello@openworship.app
                </a>
                . There is no paid support tier — because the product is free, support is
                community-run, and replies come from the team and from other churches running
                openworship in production.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 900px) {
          .docs-layout { grid-template-columns: 1fr !important; gap: 24px !important; }
          .docs-sidebar { position: static !important; border-right: 0 !important; border-bottom: 1px solid var(--rule-soft); padding-bottom: 16px !important; }
        }
        details[open] summary { color: var(--accent); }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
    </>
  );
}
