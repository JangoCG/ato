import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export type SearchMode = "search" | "vsearch" | "query";

export interface QmdSearchResult {
  docid: string;
  score: number;
  file: string;
  title: string;
  context: string | null;
  snippet: string | null;
}

export interface QmdStatus {
  available: boolean;
  version: string | null;
  collection_exists: boolean;
  collection_name: string | null;
}

interface UseQmdSearchOptions {
  debounceMs?: number;
  limit?: number;
  collection?: string;
}

interface UseQmdSearchReturn {
  results: QmdSearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string, mode?: SearchMode) => void;
  clearResults: () => void;
}

export function useQmdSearch(options: UseQmdSearchOptions = {}): UseQmdSearchReturn {
  const { debounceMs = 200, limit = 20, collection } = options;

  const [results, setResults] = useState<QmdSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, QmdSearchResult[]>>(new Map());

  const search = useCallback(
    (query: string, mode: SearchMode = "search") => {
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Empty query clears results
      if (!query.trim()) {
        setResults([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Check cache
      const cacheKey = `${mode}:${query}:${limit}:${collection ?? ""}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setResults(cached);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);

      debounceRef.current = setTimeout(async () => {
        try {
          const searchResults = await invoke<QmdSearchResult[]>("qmd_search", {
            query,
            mode,
            limit,
            collection,
          });

          // Cache results
          cacheRef.current.set(cacheKey, searchResults);

          // Limit cache size
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            if (firstKey) cacheRef.current.delete(firstKey);
          }

          setResults(searchResults);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs, limit, collection]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { results, isLoading, error, search, clearResults };
}

export async function checkQmdStatus(vaultPath: string): Promise<QmdStatus> {
  return invoke<QmdStatus>("qmd_status", { vaultPath });
}

export async function ensureQmdCollection(
  vaultPath: string,
  collectionName?: string
): Promise<QmdStatus> {
  return invoke<QmdStatus>("qmd_ensure_collection", {
    vaultPath,
    collectionName,
  });
}
