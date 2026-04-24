import type { ArtifactEntry } from "../../lib/types";
import { mimeCategory } from "../../lib/artifact-utils";

export function IconFolder() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 4.5C1.5 3.948 1.948 3.5 2.5 3.5H6L7.5 5H12.5C13.052 5 13.5 5.448 13.5 6V11.5C13.5 12.052 13.052 12.5 12.5 12.5H2.5C1.948 12.5 1.5 12.052 1.5 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFile() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 1.5h5.5L11 4v8.5H3V1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 1.5V4H11"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconImage() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="11"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
      <path
        d="M1.5 9l3-3 2.5 2.5 2-2 3 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconVideo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="2.5"
        width="9"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M10 5l3-1.5v7L10 9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconAudio() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 5v4M6.5 3.5v7M9 5v4M11.5 4v6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconDoc() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 1.5h5.5L11 4v8.5H3V1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M5 6h4M5 8h3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSlide() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="2"
        width="12"
        height="8"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M7 10v2M5 12h4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconCloud() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 8.5c1.105 0 2-.784 2-1.75S11.105 5 10 5c-.09 0-.18.007-.27.02C9.42 3.866 8.298 3 7 3c-1.51 0-2.75 1.104-2.75 2.5 0 .046.002.09.004.136A1.75 1.75 0 0 0 3 7.25c0 .69.398 1.29.98 1.613"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M7 8v4M5.5 10.5l1.5 1.5 1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M9 9l3 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconUpload() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 1v7M4 3.5L6.5 1 9 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 9.5v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSync() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 6.5A4.5 4.5 0 0 1 2.636 9.364"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M2 6.5A4.5 4.5 0 0 1 10.364 3.636"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M10 1.5l.364 2.136L8.228 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5l-.364-2.136L4.772 9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 3.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconList() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 3.5h7M4 6.5h7M4 9.5h7M2 3.5h.01M2 6.5h.01M2 9.5h.01"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGrid() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="7.5"
        y="1.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="1.5"
        y="7.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="7.5"
        y="7.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function FileIcon({ entry: e }: { entry: ArtifactEntry }) {
  if (e.is_dir)
    return (
      <span className="text-accent/80">
        <IconFolder />
      </span>
    );
  const cat = mimeCategory(e.mime_type);
  const colorCls =
    cat === "image"
      ? "text-[#7ba6d4]"
      : cat === "video"
        ? "text-[#9a7dd4]"
        : cat === "audio"
          ? "text-[#7dd4a0]"
          : cat === "document"
            ? "text-[#d4a07d]"
            : cat === "slide"
              ? "text-[#d47d7d]"
              : "text-ink-3";
  return (
    <span className={colorCls}>
      {cat === "image" ? (
        <IconImage />
      ) : cat === "video" ? (
        <IconVideo />
      ) : cat === "audio" ? (
        <IconAudio />
      ) : cat === "document" ? (
        <IconDoc />
      ) : cat === "slide" ? (
        <IconSlide />
      ) : (
        <IconFile />
      )}
    </span>
  );
}
