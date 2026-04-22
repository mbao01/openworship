/* eslint-disable react-refresh/only-export-components */
import type { TaskStatus } from "@/lib/types";
import {
  BookOpenIcon,
  DiamondIcon,
  HeartHandshakeIcon,
  MegaphoneIcon,
  MusicIcon,
  PenLineIcon,
} from "lucide-react";

export const TYPE_ICONS: Record<string, React.ReactNode> = {
  song: <MusicIcon className="h-3.5 w-3.5 shrink-0" />,
  scripture: <BookOpenIcon className="h-3.5 w-3.5 shrink-0" />,
  prayer: <HeartHandshakeIcon className="h-3.5 w-3.5 shrink-0" />,
  announcement: <MegaphoneIcon className="h-3.5 w-3.5 shrink-0" />,
  sermon: <PenLineIcon className="h-3.5 w-3.5 shrink-0" />,
  other: <DiamondIcon className="h-3.5 w-3.5 shrink-0" />,
};

export const TYPE_LABELS: Record<string, string> = {
  song: "Song",
  scripture: "Scripture",
  prayer: "Prayer",
  announcement: "Announcement",
  sermon: "Sermon",
  other: "Other",
};

export const ITEM_TYPES = [
  "song",
  "scripture",
  "prayer",
  "announcement",
  "sermon",
  "other",
] as const;

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "cancelled",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: "text-muted bg-bg-3",
  todo: "text-ink-3 bg-bg-2",
  in_progress: "text-accent bg-accent-soft",
  done: "text-success bg-success/10",
  cancelled: "text-danger bg-danger/10",
};

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatComputedTime(
  baseMs: number,
  cumulativeSecs: number,
): string {
  const d = new Date(baseMs + cumulativeSecs * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDuration(secs: number): string {
  return `${Math.round(secs / 60)}m`;
}
