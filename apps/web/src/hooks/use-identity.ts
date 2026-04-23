import { useCallback, useEffect, useState } from "react";
import {
  getIdentity,
  setIdentity as saveIdentity,
} from "@/lib/commands/identity";
import type { ChurchIdentity } from "@/lib/types";

export interface UseIdentityReturn {
  /** Resolved identity, undefined if not yet onboarded, null while loading. */
  identity: ChurchIdentity | undefined | null;
  loading: boolean;
  setIdentity: (id: ChurchIdentity) => Promise<void>;
}

/**
 * Loads church identity from the Rust backend on mount.
 * Provides `setIdentity` to persist a new or updated identity.
 * Extracted from App.tsx direct invoke usage.
 */
export function useIdentity(): UseIdentityReturn {
  const [identity, setIdentityState] = useState<
    ChurchIdentity | undefined | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIdentity()
      .then((id) => setIdentityState(id ?? undefined))
      .catch((e) => {
        console.error("[use-identity] load failed:", e);
        setIdentityState(undefined);
      })
      .finally(() => setLoading(false));
  }, []);

  const setIdentity = useCallback(async (id: ChurchIdentity) => {
    await saveIdentity(id);
    setIdentityState(id);
  }, []);

  return { identity, loading, setIdentity };
}
