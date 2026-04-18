import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  children: ReactNode;
  arrow?: boolean;
  className?: string;
}

type ButtonAsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: "button" };

type ButtonAsAnchor = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: "a" };

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  padding: "14px 22px",
  fontSize: "14px",
  fontFamily: "var(--sans)",
  borderRadius: "2px",
  cursor: "pointer",
  border: "1px solid var(--rule)",
  transition: "all 150ms",
  textDecoration: "none",
  letterSpacing: "-0.005em",
};

const variants: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--ink)",
    color: "var(--bg)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ink)",
  },
};

export function Button({ variant = "primary", children, arrow, className, as, ...rest }: ButtonProps & { as?: "a" | "button" }) {
  const style = { ...base, ...variants[variant] };

  const content = (
    <>
      {children}
      {arrow && <span style={{ display: "inline-block", transition: "transform 150ms" }}>→</span>}
    </>
  );

  if (as === "a") {
    return (
      <a style={style} className={className} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }

  return (
    <button style={style} className={className} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
