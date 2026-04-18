import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  center?: boolean;
  light?: boolean;
}

export function Eyebrow({ children, center, light }: EyebrowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontFamily: "var(--mono)",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: light ? "rgba(245,241,232,0.6)" : "var(--muted)",
        justifyContent: center ? "center" : undefined,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "24px",
          height: "1px",
          background: light ? "rgba(245,241,232,0.4)" : "var(--rule)",
          flexShrink: 0,
        }}
      />
      {children}
    </div>
  );
}
