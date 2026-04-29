import Link from "next/link";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Listens",
    body: "AI transcribes the sermon in real time using speech-to-text. Fully offline or cloud-accelerated.",
  },
  {
    step: "02",
    title: "Detects",
    body: "Scripture references, song lyrics, and announcements identified instantly from the live transcript.",
  },
  {
    step: "03",
    title: "Displays",
    body: "Content pushed to the projection screen automatically. No manual lookup, no delay.",
  },
  {
    step: "04",
    title: "Learns",
    body: "Gets smarter with every service. Remembers your translations, your songs, your patterns.",
  },
] as const;

const MODES = [
  {
    name: "Auto",
    body: "Nobody at the controls. AI listens, detects, and pushes to screen instantly.",
  },
  {
    name: "Copilot",
    body: "AI detects and suggests. You approve before it hits the screen.",
  },
  {
    name: "Airplane",
    body: "No mic. AI-powered search across scriptures and lyrics. You select and push.",
  },
  {
    name: "Offline",
    body: "No AI. Manual operation. A simple, reliable worship display app.",
  },
] as const;

const RELEASES_URL = "https://github.com/mbao01/openworship/releases/latest";

const DOWNLOAD_BUTTONS = [
  { label: "macOS (.dmg)", href: RELEASES_URL },
  { label: "Windows (.exe)", href: RELEASES_URL },
  { label: "Linux (.AppImage)", href: RELEASES_URL },
] as const;

const FOOTER_LINKS = [
  { label: "GitHub", href: "https://github.com/mbao01/openworship" },
  { label: "Documentation", href: "#" },
  { label: "License: MIT", href: "https://github.com/mbao01/openworship/blob/main/LICENSE" },
] as const;

export default function Home() {
  return (
    <div style={{ background: "#0a0a0a", color: "#efefef", minHeight: "100vh" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6"
        style={{
          height: "48px",
          background: "rgba(20,20,20,0.8)",
          borderBottom: "1px solid #2a2a2a",
          backdropFilter: "blur(8px)",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#efefef",
            fontFamily: "var(--font-geist)",
            fontSize: "14px",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            textDecoration: "none",
          }}
        >
          openworship
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          {(
            [
              { label: "Features", href: "#features" },
              { label: "Modes", href: "#modes" },
              { label: "Download", href: "#download" },
              {
                label: "GitHub",
                href: "https://github.com/mbao01/openworship",
                external: true,
              },
            ] as const
          ).map(({ label, href, ...rest }) => (
            <a
              key={label}
              href={href}
              className="nav-link text-sm"
              {...("external" in rest && rest.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Mobile nav — CSS-only disclosure */}
        <details className="md:hidden relative">
          <summary
            className="list-none cursor-pointer select-none"
            style={{ color: "#808080", fontSize: "20px", lineHeight: 1 }}
            aria-label="Open navigation menu"
          >
            ☰
          </summary>
          <nav
            className="absolute right-0 top-full flex flex-col gap-4 p-4 z-50"
            style={{
              background: "#141414",
              border: "1px solid #2a2a2a",
              minWidth: "160px",
              marginTop: "8px",
              borderRadius: "4px",
            }}
            aria-label="Mobile navigation"
          >
            {(
              [
                { label: "Features", href: "#features" },
                { label: "Modes", href: "#modes" },
                { label: "Download", href: "#download" },
                {
                  label: "GitHub",
                  href: "https://github.com/mbao01/openworship",
                  external: true,
                },
              ] as const
            ).map(({ label, href, ...rest }) => (
              <a
                key={label}
                href={href}
                className="nav-link text-sm"
                {...("external" in rest && rest.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {label}
              </a>
            ))}
          </nav>
        </details>
      </header>

      <main className="mx-auto w-full" style={{ maxWidth: "1200px", padding: "0 24px" }}>
        {/* ── Hero ── */}
        <section
          id="features"
          className="pt-24 pb-24 md:pt-32 md:pb-32"
          style={{ borderBottom: "1px solid #2a2a2a" }}
        >
          <div style={{ maxWidth: "640px" }}>
            <h1
              className="mb-6"
              style={{
                fontFamily: "var(--font-garamond)",
                fontSize: "clamp(48px, 6vw, 80px)",
                fontWeight: 600,
                color: "#efefef",
                lineHeight: 1.15,
              }}
            >
              Every word lands.
              <br />
              On screen. And in hearts.
            </h1>
            <p
              className="mb-10"
              style={{
                fontFamily: "var(--font-geist)",
                fontSize: "18px",
                lineHeight: 1.65,
                color: "#808080",
                maxWidth: "520px",
              }}
            >
              Free, AI-powered worship display software. Detects scripture and lyrics in real
              time. No manual lookup. No expensive licenses.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#download"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #e6c364 0%, #c9a84c 100%)",
                  color: "#0a0a0a",
                  fontFamily: "var(--font-geist)",
                  fontSize: "15px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  textDecoration: "none",
                }}
              >
                Download for Free
              </a>
              <a
                href="https://github.com/mbao01/openworship"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 24px",
                  border: "1px solid #2a2a2a",
                  color: "#efefef",
                  fontFamily: "var(--font-geist)",
                  fontSize: "15px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  textDecoration: "none",
                }}
              >
                View on GitHub →
              </a>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-24">
          <h2
            className="mb-12"
            style={{
              fontFamily: "var(--font-garamond)",
              fontSize: "clamp(36px, 4vw, 48px)",
              fontWeight: 600,
              color: "#efefef",
            }}
          >
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div
                key={step}
                style={{
                  background: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  padding: "24px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    marginBottom: "12px",
                    color: "#c9a84c",
                    fontFamily: "var(--font-geist)",
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {step}
                </span>
                <h3
                  style={{
                    marginBottom: "8px",
                    fontFamily: "var(--font-geist)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#efefef",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-geist)",
                    fontSize: "16px",
                    lineHeight: 1.6,
                    color: "#808080",
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Operating Modes ── */}
        <section
          id="modes"
          className="py-24"
          style={{ borderTop: "1px solid #2a2a2a" }}
        >
          <h2
            className="mb-12"
            style={{
              fontFamily: "var(--font-garamond)",
              fontSize: "clamp(36px, 4vw, 48px)",
              fontWeight: 600,
              color: "#efefef",
            }}
          >
            Four ways to run
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODES.map(({ name, body }) => (
              <div
                key={name}
                className="mode-card"
                style={{
                  background: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  padding: "24px",
                }}
              >
                <h3
                  style={{
                    marginBottom: "8px",
                    fontFamily: "var(--font-geist)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#efefef",
                  }}
                >
                  {name}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-geist)",
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "#808080",
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why openworship ── */}
        <section
          className="py-24"
          style={{ borderTop: "1px solid #2a2a2a" }}
        >
          <h2
            className="mb-12"
            style={{
              fontFamily: "var(--font-garamond)",
              fontSize: "clamp(36px, 4vw, 48px)",
              fontWeight: 600,
              color: "#efefef",
            }}
          >
            Why openworship
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              style={{
                background: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "32px",
              }}
            >
              <h3
                style={{
                  marginBottom: "16px",
                  fontFamily: "var(--font-geist)",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#808080",
                }}
              >
                Other tools
              </h3>
              <ul
                style={{
                  fontFamily: "var(--font-geist)",
                  fontSize: "16px",
                  color: "#808080",
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <li>$500–1,500/year</li>
                <li>Trained volunteer required</li>
                <li>Manual lookup delays</li>
                <li>Windows-only or locked ecosystems</li>
              </ul>
            </div>
            <div
              style={{
                background: "#141414",
                border: "1px solid #2a2a2a",
                borderLeft: "2px solid #c9a84c",
                borderRadius: "8px",
                padding: "32px",
              }}
            >
              <h3
                style={{
                  marginBottom: "16px",
                  fontFamily: "var(--font-geist)",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#efefef",
                }}
              >
                openworship
              </h3>
              <ul
                style={{
                  fontFamily: "var(--font-geist)",
                  fontSize: "16px",
                  color: "#efefef",
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <li>Free forever</li>
                <li>Works with no operator</li>
                <li>AI-powered, &lt;200ms latency</li>
                <li>macOS, Windows, Linux</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Download CTA ── */}
        <section
          id="download"
          className="py-24"
          style={{ borderTop: "1px solid #2a2a2a" }}
        >
          <div
            style={{
              background: "#141414",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "clamp(40px, 6vw, 64px)",
            }}
          >
            <h2
              className="mb-4"
              style={{
                fontFamily: "var(--font-garamond)",
                fontSize: "clamp(36px, 4vw, 56px)",
                fontWeight: 600,
                color: "#efefef",
              }}
            >
              openworship is free. Forever.
            </h2>
            <p
              className="mb-8"
              style={{
                fontFamily: "var(--font-geist)",
                fontSize: "16px",
                color: "#808080",
              }}
            >
              No account required. No telemetry. Your data stays on your machine.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              {DOWNLOAD_BUTTONS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled="true"
                  title="Coming soon — release pending"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, #e6c364 0%, #c9a84c 100%)",
                    color: "#0a0a0a",
                    fontFamily: "var(--font-geist)",
                    fontSize: "14px",
                    fontWeight: 600,
                    borderRadius: "4px",
                    textDecoration: "none",
                    cursor: "not-allowed",
                    opacity: 0.6,
                    pointerEvents: "none",
                  }}
                >
                  {label}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "1px 5px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "3px",
                    }}
                  >
                    Soon
                  </span>
                </a>
              ))}
            </div>
            <a
              href="https://github.com/mbao01/openworship"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link text-sm"
            >
              Source code on GitHub →
            </a>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        className="mt-auto"
        style={{ borderTop: "1px solid #2a2a2a", padding: "20px 24px" }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{ maxWidth: "1200px" }}
        >
          <Link
            href="/"
            style={{
              color: "#4a4a4a",
              fontFamily: "var(--font-geist)",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            openworship
          </Link>
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            {FOOTER_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="footer-link text-sm"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
