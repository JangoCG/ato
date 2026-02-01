import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, FileText, Loader2, AlertCircle } from "lucide-react";
import { useQmdSearch, checkModelStatus, type SearchMode, type QmdSearchResult } from "../hooks/useQmdSearch";
import { ModelDownloadModal } from "./ModelDownloadModal";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
  vaultPath?: string;
}

const SEARCH_MODES: { value: SearchMode; label: string; description: string }[] = [
  { value: "search", label: "Fast", description: "BM25 keyword search" },
  { value: "vsearch", label: "Semantic", description: "Vector similarity search" },
  { value: "query", label: "Hybrid", description: "LLM-enhanced search" },
];

export function SearchModal({ isOpen, onClose, onSelectFile, vaultPath }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("search");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelsReady, setModelsReady] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Derive collection name from vault path (folder name)
  const collection = useMemo(() => {
    if (!vaultPath) return undefined;
    const parts = vaultPath.replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || undefined;
  }, [vaultPath]);

  const { results, isLoading, error, search, clearResults } = useQmdSearch({
    debounceMs: 200,
    limit: 20,
    collection,
  });

  // Search when query or mode changes
  useEffect(() => {
    if (isOpen && query.trim()) {
      // Don't search if semantic modes and models aren't ready
      if ((mode === "vsearch" || mode === "query") && modelsReady === false) {
        return;
      }
      search(query, mode);
    }
  }, [query, mode, isOpen, search, modelsReady]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      clearResults();
      // Focus input after a short delay for animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, clearResults]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Check model status when switching to semantic modes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "vsearch" || mode === "query") {
      checkModelStatus().then((status) => {
        const ready = mode === "vsearch" ? status.semantic_ready : status.all_ready;
        setModelsReady(ready);
        if (!ready) {
          setShowModelModal(true);
        }
      }).catch(() => {
        setModelsReady(false);
      });
    } else {
      setModelsReady(true);
    }
  }, [mode, isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, results.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, onClose]
  );

  const handleSelectResult = useCallback(
    (result: QmdSearchResult) => {
      // Extract relative path from qmd:// URL
      // Format: qmd://collection/path/to/file.md
      let filePath = result.file;
      if (filePath.startsWith("qmd://")) {
        // Remove qmd:// prefix and collection name
        const parts = filePath.slice(6).split("/");
        parts.shift(); // Remove collection name
        filePath = parts.join("/");
      }
      onSelectFile(filePath);
      onClose();
    },
    [onSelectFile, onClose]
  );

  const handleModelsReady = useCallback(() => {
    setShowModelModal(false);
    setModelsReady(true);
    // Trigger search if there's a pending query
    if (query.trim()) {
      search(query, mode);
    }
  }, [query, mode, search]);

  const handleModelModalClose = useCallback(() => {
    setShowModelModal(false);
    // Reset to fast search if user cancels model download
    setMode("search");
  }, []);

  const scoreToPercent = (score: number) => Math.round(score * 100);

  const formatFilePath = (file: string) => {
    // Extract just the relative path for display
    if (file.startsWith("qmd://")) {
      const parts = file.slice(6).split("/");
      parts.shift();
      return parts.join("/");
    }
    return file;
  };

  const modalContent = useMemo(() => {
    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Modal */}
        <div
          className="relative w-full max-w-[600px] mx-4 bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Search files"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-textSubtle flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search documents..."
              className="flex-1 bg-transparent border-0 outline-none text-text placeholder:text-textSubtlest text-base"
              aria-label="Search query"
            />
            {isLoading && (
              <Loader2 className="w-4 h-4 text-textSubtle animate-spin flex-shrink-0" />
            )}
            {/* Mode selector */}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SearchMode)}
              className="bg-surfaceHighlight border border-border rounded px-2 py-1 text-sm text-text outline-none cursor-pointer"
              aria-label="Search mode"
            >
              {SEARCH_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mode description */}
          <div className="px-4 py-2 text-xs text-textSubtlest border-b border-border bg-surfaceHighlight/50">
            {SEARCH_MODES.find((m) => m.value === mode)?.description}
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[400px] overflow-y-auto"
            role="listbox"
            aria-label="Search results"
          >
            {error && (
              <div className="flex items-center gap-3 px-4 py-6 text-danger">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {!error && !isLoading && query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-textSubtle">
                No results found for "{query}"
              </div>
            )}

            {!error && !query && (
              <div className="px-4 py-8 text-center text-textSubtle">
                Type to search your documents
              </div>
            )}

            {results.map((result, index) => (
              <button
                key={result.docid}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? "bg-primary/10"
                    : "hover:bg-surfaceHighlight"
                }`}
                onClick={() => handleSelectResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <FileText className="w-4 h-4 text-textSubtle flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text truncate">
                      {result.title || formatFilePath(result.file)}
                    </span>
                    <span className="text-xs text-textSubtlest px-1.5 py-0.5 bg-surfaceHighlight rounded flex-shrink-0">
                      {scoreToPercent(result.score)}%
                    </span>
                  </div>
                  <div className="text-xs text-textSubtle truncate mt-0.5">
                    {formatFilePath(result.file)}
                  </div>
                  {result.snippet && (
                    <div className="text-sm text-textSubtle mt-1 line-clamp-2">
                      {result.snippet}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border bg-surfaceHighlight/50 flex items-center justify-between text-xs text-textSubtlest">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-surface rounded border border-border">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-surface rounded border border-border ml-1">↓</kbd>
                <span className="ml-1.5">to navigate</span>
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-surface rounded border border-border">↵</kbd>
                <span className="ml-1.5">to open</span>
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-surface rounded border border-border">esc</kbd>
                <span className="ml-1.5">to close</span>
              </span>
            </div>
            {results.length > 0 && (
              <span>{results.length} results</span>
            )}
          </div>
        </div>
      </div>
    );
  }, [isOpen, query, mode, results, selectedIndex, isLoading, error, handleKeyDown, handleSelectResult, onClose]);

  return (
    <>
      {createPortal(modalContent, document.body)}
      <ModelDownloadModal
        isOpen={showModelModal}
        onClose={handleModelModalClose}
        onReady={handleModelsReady}
      />
    </>
  );
}
