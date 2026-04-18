"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Docs", href: "/docs" },
  { label: "Download", href: "/download" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav max-lg:px-4">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <BrandMark />
          openworship
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
            >
              {label}
            </Link>
          ))}
          <Link href="/download" className="nav-cta">
            Free download →
          </Link>
        </div>
      </div>
    </nav>
  );
}
