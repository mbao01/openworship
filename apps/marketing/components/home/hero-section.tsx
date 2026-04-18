import Link from "next/link";
import { Eyebrow } from "../ui/eyebrow";
import { LiveDemo } from "./live-demo";

export function HeroSection() {
  return (
    <section
      style={{
        paddingTop: "clamp(48px, 8vw, 100px)",
        paddingBottom: "clamp(64px, 10vw, 140px)",
      }}
    >
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "48px",
            alignItems: "baseline",
          }}
        >
          <Eyebrow>A worship display platform · 2026</Eyebrow>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "12px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            free · offline-first · open
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "clamp(40px, 7vw, 96px)",
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* Copy */}
          <div>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 400,
                fontSize: "clamp(48px, 9vw, 132px)",
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                color: "var(--ink)",
              }}
            >
              Every word
              <br />
              <em style={{ fontStyle: "italic", color: "var(--accent)", fontWeight: 400 }}>
                lands.
              </em>
              <br />
              On screen. In hearts.
            </h1>

            <p
              style={{
                marginTop: "32px",
                fontSize: "clamp(17px, 1.6vw, 20px)",
                lineHeight: 1.45,
                color: "var(--ink-2)",
                maxWidth: "48ch",
                fontFamily: "var(--serif)",
              }}
            >
              openworship listens to the service and displays the right scripture, lyric, or
              slide the moment it&apos;s spoken. No queue to babysit. No cues to miss. Just
              the word, on screen, on time.
            </p>

            <div style={{ display: "flex", gap: "12px", marginTop: "40px", flexWrap: "wrap" }}>
              <Link
                href="/download"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
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
                Download for free →
              </Link>
              <Link
                href="/features"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 22px",
                  fontSize: "14px",
                  fontFamily: "var(--sans)",
                  borderRadius: "2px",
                  border: "1px solid var(--rule)",
                  background: "transparent",
                  color: "var(--ink)",
                  transition: "all 150ms",
                }}
              >
                See how it works
              </Link>
            </div>

            <div
              style={{
                display: "flex",
                gap: "24px",
                marginTop: "40px",
                paddingTop: "24px",
                borderTop: "1px solid var(--rule-soft)",
                fontFamily: "var(--mono)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--muted)",
                flexWrap: "wrap",
              }}
            >
              {["Mac · Windows · Linux", "Offline · 100ms", "No account"].map((note) => (
                <span key={note}>
                  <span
                    style={{
                      color: "var(--accent)",
                      marginRight: "6px",
                      fontSize: "8px",
                      verticalAlign: "middle",
                    }}
                  >
                    ●
                  </span>
                  {note}
                </span>
              ))}
            </div>
          </div>

          {/* Live demo */}
          <LiveDemo />
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}
