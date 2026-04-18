import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";

export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <Link
              href="/"
              className="brand"
              style={{ marginBottom: "16px", display: "inline-flex" }}
            >
              <BrandMark />
              openworship
            </Link>
            <p
              style={{
                fontSize: "14px",
                color: "var(--muted)",
                marginTop: "12px",
                maxWidth: "32ch",
                lineHeight: 1.55,
              }}
            >
              Free, AI-powered worship display. Built for every church,
              everywhere.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link href="/features">Features</Link>
            <Link href="/features#modes">Modes</Link>
            <Link href="/features#content">Content types</Link>
            <Link href="/download">Download</Link>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <Link href="/docs">Documentation</Link>
            <Link href="/docs#quickstart">Quickstart</Link>
            <Link href="/docs#obs">OBS setup</Link>
            <Link href="/docs#faq">FAQ</Link>
          </div>
          <div className="footer-col">
            <h4>Project</h4>
            <a
              href="https://github.com/mbao01/openworship"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a href="#">Roadmap</a>
            <a href="#">Community</a>
            <a href="#">Contact</a>
          </div>
        </div>
        <div className="footer-bottom flex items-center gap-2">
          <span>openworship · v0.1 · free forever</span>

          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
