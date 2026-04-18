import { useCallback, useEffect, useState } from "react";
import {
  listTranslations,
  getActiveTranslation,
  switchLiveTranslation,
} from "@/lib/commands/content";
import type { TranslationInfo } from "@/lib/types";

export interface UseTranslationsReturn {
  translations: TranslationInfo[];
  active: string;
  setActive: (abbreviation: string) => Promise<void>;
  loading: boolean;
}

/**
 * Loads available Bible translations and the currently active one.
 * Provides `setActive` to switch the live translation.
 * Used by the TranslationSwitcher in OperatorPage.
 */
export function useTranslations(): UseTranslationsReturn {
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [active, setActiveState] = useState("ESV");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listTranslations(), getActiveTranslation()])
      .then(([list, current]) => {
        setTranslations(list);
        setActiveState(current);
      })
      .catch((e) => console.error("[use-translations] load failed:", e))
      .finally(() => setLoading(false));
  }, []);

  const setActive = useCallback(async (abbreviation: string) => {
    setActiveState(abbreviation);
    try {
      await switchLiveTranslation(abbreviation);
    } catch (e) {
      console.error("[use-translations] switch failed:", e);
    }
  }, []);

  return { translations, active, setActive, loading };
}
