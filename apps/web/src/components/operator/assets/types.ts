import type { ArtifactEntry } from "../../../lib/types";

export type Nav =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "starred" }
  | { kind: "service"; id: string; name: string }
  | { kind: "cloud_branch" }
  | { kind: "cloud_shared" };

export interface CtxMenu {
  x: number;
  y: number;
  entry: ArtifactEntry;
}
