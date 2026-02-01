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

  // Reset cache and pending debounce when collection changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    cacheRef.current.clear();
    clearResults();
  }, [collection, clearResults]);

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

// Model status types
export interface ModelInfo {
  name: string;
  filename: string;
  exists: boolean;
  size_bytes: number;
  required_for: string;
}

export interface ModelsStatus {
  embedding: ModelInfo;
  generation: ModelInfo;
  reranking: ModelInfo;
  all_ready: boolean;
  semantic_ready: boolean;
}

export interface DownloadProgress {
  model: string;
  progress: number;
  downloaded_mb: number;
  total_mb: number;
  speed: string;
  eta: string;
  done: boolean;
  error: string | null;
}

export async function checkModelStatus(): Promise<ModelsStatus> {
  return invoke<ModelsStatus>("qmd_model_status");
}

export async function downloadModels(): Promise<void> {
  return invoke<void>("qmd_download_models");
}

// Vector index status
export interface VectorIndexStatus {
  has_vectors: boolean;
  vector_count: number;
  pending_count: number;
}

export async function checkVectorStatus(): Promise<VectorIndexStatus> {
  return invoke<VectorIndexStatus>("qmd_vector_status");
}

// Embed progress
export interface EmbedProgress {
  phase: string; // "chunking", "embedding", "done"
  current: number;
  total: number;
  percent: number;
  done: boolean;
  error: string | null;
}

export async function startEmbedding(): Promise<void> {
  return invoke<void>("qmd_embed");
}
