import Link from "next/link";
import { Eyebrow } from "../ui/eyebrow";

export function CtaSection() {
  return (
    <section
      style={{
        textAlign: "center",
        background: "var(--ink)",
        color: "var(--bg)",
        borderTop: "none !important" as "none",
      }}
    >
      <div className="container">
        <Eyebrow center light>
          Download · free forever
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
          Put it on screen{" "}
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>this Sunday.</em>
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
          Mac, Windows, Linux. Runs offline. Drops into OBS. No sign-up, no trial, no card
          on file. If it helps your church, that&apos;s enough.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
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
              border: "1px solid var(--bg)",
              background: "var(--bg)",
              color: "var(--ink)",
              transition: "all 150ms",
            }}
          >
            Download · 72 MB ↓
          </Link>
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
            Read the docs
          </Link>
        </div>
        <div
          style={{
            marginTop: "24px",
            fontFamily: "var(--mono)",
            fontSize: "11px",
            color: "rgba(245,241,232,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          Competing tools ·{" "}
          <span style={{ textDecoration: "line-through", color: "rgba(245,241,232,0.35)" }}>
            $500–$1,500/yr
          </span>{" "}
          &nbsp; openworship · $0
        </div>
      </div>
    </section>
  );
}
