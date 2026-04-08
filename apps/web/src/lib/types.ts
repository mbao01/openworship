/** Matches the Rust `TranscriptEvent` struct emitted via `stt://transcript`. */
export interface TranscriptEvent {
  text: string;
  offset_ms: number;
  duration_ms: number;
  mic_active: boolean;
}

export interface ContentItem {
  id: string;
  kind: "scripture" | "lyrics" | "announcement";
  body: string;
}

export interface ServiceProject {
  id: string;
  title: string;
  items: ContentItem[];
}

export interface VerseResult {
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  reference: string;
}

export interface TranslationInfo {
  id: string;
  name: string;
  abbreviation: string;
}
