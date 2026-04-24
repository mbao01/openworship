import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatDate,
  mimeCategory,
  guessMimeFromExt,
  formatStorageBytes,
} from "./helpers";

describe("formatBytes", () => {
  it("returns '—' for null", () => {
    expect(formatBytes(null)).toBe("—");
  });

  it("formats bytes under 1024", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats KB (1024 to <1MB)", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB (≥1MB)", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(2097152)).toBe("2.0 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });
});

describe("formatDate", () => {
  it("returns a string for a valid timestamp", () => {
    const result = formatDate(1700000000000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("mimeCategory", () => {
  it("returns 'other' for null", () => {
    expect(mimeCategory(null)).toBe("other");
  });

  it("categorizes image mimes", () => {
    expect(mimeCategory("image/png")).toBe("image");
    expect(mimeCategory("image/jpeg")).toBe("image");
    expect(mimeCategory("image/webp")).toBe("image");
  });

  it("categorizes video mimes", () => {
    expect(mimeCategory("video/mp4")).toBe("video");
    expect(mimeCategory("video/webm")).toBe("video");
  });

  it("categorizes audio mimes", () => {
    expect(mimeCategory("audio/mpeg")).toBe("audio");
    expect(mimeCategory("audio/wav")).toBe("audio");
  });

  it("categorizes document mimes", () => {
    expect(mimeCategory("application/pdf")).toBe("document");
    expect(mimeCategory("text/plain")).toBe("document");
    expect(mimeCategory("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("document");
  });

  it("categorizes slide mimes", () => {
    // "powerpoint" matches but not "document"/"pdf"/"text/"
    expect(mimeCategory("application/vnd.ms-powerpoint")).toBe("slide");
    // Note: presentationml.presentation also contains "document" (officedocument),
    // so it matches the document branch first per the implementation
    expect(mimeCategory("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("document");
  });

  it("returns 'other' for unknown mime", () => {
    expect(mimeCategory("application/octet-stream")).toBe("other");
    expect(mimeCategory("application/zip")).toBe("other");
  });
});

describe("guessMimeFromExt", () => {
  it("maps image extensions", () => {
    expect(guessMimeFromExt("png")).toBe("image/png");
    expect(guessMimeFromExt("jpg")).toBe("image/jpeg");
    expect(guessMimeFromExt("jpeg")).toBe("image/jpeg");
    expect(guessMimeFromExt("gif")).toBe("image/gif");
    expect(guessMimeFromExt("webp")).toBe("image/webp");
    expect(guessMimeFromExt("svg")).toBe("image/svg+xml");
  });

  it("maps video extensions", () => {
    expect(guessMimeFromExt("mp4")).toBe("video/mp4");
    expect(guessMimeFromExt("webm")).toBe("video/webm");
    expect(guessMimeFromExt("mov")).toBe("video/quicktime");
  });

  it("maps audio extensions", () => {
    expect(guessMimeFromExt("mp3")).toBe("audio/mpeg");
    expect(guessMimeFromExt("wav")).toBe("audio/wav");
    expect(guessMimeFromExt("ogg")).toBe("audio/ogg");
    expect(guessMimeFromExt("flac")).toBe("audio/flac");
  });

  it("maps document extensions", () => {
    expect(guessMimeFromExt("pdf")).toBe("application/pdf");
    expect(guessMimeFromExt("txt")).toBe("text/plain");
    expect(guessMimeFromExt("md")).toBe("text/markdown");
    expect(guessMimeFromExt("json")).toBe("application/json");
  });

  it("returns 'application/octet-stream' for unknown ext", () => {
    expect(guessMimeFromExt("xyz")).toBe("application/octet-stream");
    expect(guessMimeFromExt("unknown")).toBe("application/octet-stream");
  });
});

describe("formatStorageBytes", () => {
  it("formats bytes under 1024", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(512)).toBe("512 B");
  });

  it("formats KB", () => {
    expect(formatStorageBytes(1024)).toBe("1.0 KB");
    expect(formatStorageBytes(2560)).toBe("2.5 KB");
  });

  it("formats MB", () => {
    expect(formatStorageBytes(1048576)).toBe("1.0 MB");
    expect(formatStorageBytes(5242880)).toBe("5.0 MB");
  });

  it("formats GB", () => {
    expect(formatStorageBytes(1073741824)).toBe("1.0 GB");
    expect(formatStorageBytes(2147483648)).toBe("2.0 GB");
  });
});
