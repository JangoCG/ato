import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

interface FindInFileProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

interface MatchRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MatchInfo {
  range: Range;
}

// Check if CSS Custom Highlight API is supported
const supportsHighlightAPI = typeof CSS !== "undefined" && "highlights" in CSS;

export function FindInFile({ isOpen, onClose, containerRef }: FindInFileProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [highlightRects, setHighlightRects] = useState<{ all: MatchRect[]; current: MatchRect | null }>({
    all: [],
    current: null,
  });
  const [searchBarPosition, setSearchBarPosition] = useState({ top: 0, right: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Update search bar position based on container
  const updateSearchBarPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSearchBarPosition({
      top: rect.top + 8,
      right: window.innerWidth - rect.right + 16,
    });
  }, [containerRef]);

  // Clear CSS Custom Highlights
  const clearCSSHighlights = useCallback(() => {
    if (supportsHighlightAPI) {
      (CSS as any).highlights.delete("find-results");
      (CSS as any).highlights.delete("find-current");
    }
  }, []);

  // Update overlay rects for fallback highlighting
  const updateOverlayRects = useCallback((matchList: MatchInfo[], currentIdx: number) => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const scrollLeft = containerRef.current.scrollLeft;

    const allRects: MatchRect[] = [];
    let currentRect: MatchRect | null = null;

    matchList.forEach((match, i) => {
      try {
        const rects = match.range.getClientRects();
        for (let j = 0; j < rects.length; j++) {
          const rect = rects[j];
          const normalizedRect: MatchRect = {
            top: rect.top - containerRect.top + scrollTop,
            left: rect.left - containerRect.left + scrollLeft,
            width: rect.width,
            height: rect.height,
          };

          if (i === currentIdx) {
            currentRect = normalizedRect;
          } else {
            allRects.push(normalizedRect);
          }
        }
      } catch {
        // Range may be invalid if DOM changed
      }
    });

    setHighlightRects({ all: allRects, current: currentRect });
  }, [containerRef]);

  // Find all matches
  const performSearch = useCallback((term: string) => {
    clearCSSHighlights();

    if (!term || !containerRef.current) {
      setMatches([]);
      setCurrentIndex(0);
      setHighlightRects({ all: [], current: null });
      return;
    }

    const container = containerRef.current;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const foundMatches: MatchInfo[] = [];
    const lowerTerm = term.toLowerCase();

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent || "";
      const lowerText = text.toLowerCase();
      let pos = 0;

      while (pos < text.length) {
        const index = lowerText.indexOf(lowerTerm, pos);
        if (index === -1) break;

        try {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + term.length);
          foundMatches.push({ range });
        } catch {
          // Skip invalid ranges
        }
        pos = index + 1;
      }
    }

    setMatches(foundMatches);

    if (foundMatches.length > 0) {
      setCurrentIndex(0);
      applyHighlights(foundMatches, 0);
    } else {
      setCurrentIndex(0);
      setHighlightRects({ all: [], current: null });
    }
  }, [containerRef, clearCSSHighlights]);

  // Apply highlights (CSS API or overlay fallback)
  const applyHighlights = useCallback((matchList: MatchInfo[], currentIdx: number) => {
    if (supportsHighlightAPI) {
      // Use CSS Custom Highlight API
      const allRanges = matchList
        .filter((_, i) => i !== currentIdx)
        .map((m) => m.range);

      if (allRanges.length > 0) {
        try {
          const allHighlight = new (window as any).Highlight(...allRanges);
          (CSS as any).highlights.set("find-results", allHighlight);
        } catch {
          (CSS as any).highlights.delete("find-results");
        }
      } else {
        (CSS as any).highlights.delete("find-results");
      }

      if (matchList[currentIdx]) {
        try {
          const currentHighlight = new (window as any).Highlight(matchList[currentIdx].range);
          (CSS as any).highlights.set("find-current", currentHighlight);
        } catch {
          (CSS as any).highlights.delete("find-current");
        }
      } else {
        (CSS as any).highlights.delete("find-current");
      }
    } else {
      // Fallback: overlay rects
      updateOverlayRects(matchList, currentIdx);
    }

    // Scroll to current match
    if (matchList[currentIdx] && containerRef.current) {
      try {
        const range = matchList[currentIdx].range;
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const isVisible =
          rect.top >= containerRect.top + 50 &&
          rect.bottom <= containerRect.bottom - 20;

        if (!isVisible) {
          const scrollContainer = containerRef.current;
          const targetTop = rect.top - containerRect.top + scrollContainer.scrollTop - containerRect.height / 2;
          scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        }
      } catch {
        // Range may be invalid
      }
    }
  }, [containerRef, updateOverlayRects]);

  // Navigate to next match
  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    applyHighlights(matches, next);
  }, [currentIndex, matches, applyHighlights]);

  // Navigate to previous match
  const goToPrevious = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    applyHighlights(matches, prev);
  }, [currentIndex, matches, applyHighlights]);

  // Handle input changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    performSearch(value);
  }, [performSearch]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [goToNext, goToPrevious, onClose]);

  // Focus input and update position when opened
  useEffect(() => {
    if (isOpen) {
      updateSearchBarPosition();
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isOpen, updateSearchBarPosition]);

  // Update position on window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => updateSearchBarPosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, updateSearchBarPosition]);

  // Clear highlights when closed
  useEffect(() => {
    if (!isOpen) {
      clearCSSHighlights();
      setSearchTerm("");
      setMatches([]);
      setCurrentIndex(0);
      setHighlightRects({ all: [], current: null });
    }
  }, [isOpen, clearCSSHighlights]);

  // Update overlay rects on scroll (for fallback mode)
  useEffect(() => {
    if (supportsHighlightAPI || !isOpen || matches.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateOverlayRects(matches, currentIndex);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isOpen, matches, currentIndex, containerRef, updateOverlayRects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearCSSHighlights();
  }, [clearCSSHighlights]);

  if (!isOpen) return null;

  const searchBar = (
    <div
      className="fixed z-50 flex items-center gap-2 bg-surface border border-border rounded-lg shadow-lg px-3 py-2"
      style={{
        top: searchBarPosition.top,
        right: searchBarPosition.right,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        placeholder="Find in file..."
        className="bg-transparent border-none outline-none text-sm text-text placeholder:text-textSubtlest w-48"
      />

      {searchTerm && (
        <span className="text-xs text-textSubtle min-w-[60px] text-center">
          {matches.length === 0 ? "No results" : `${currentIndex + 1} of ${matches.length}`}
        </span>
      )}

      <div className="flex items-center gap-0.5">
        <button
          onClick={goToPrevious}
          disabled={matches.length === 0}
          className="p-1 rounded hover:bg-surfaceHighlight disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous (Shift+Enter)"
        >
          <ChevronUp size={16} className="text-textSubtle" />
        </button>
        <button
          onClick={goToNext}
          disabled={matches.length === 0}
          className="p-1 rounded hover:bg-surfaceHighlight disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next (Enter)"
        >
          <ChevronDown size={16} className="text-textSubtle" />
        </button>
      </div>

      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-surfaceHighlight"
        title="Close (Escape)"
      >
        <X size={16} className="text-textSubtle" />
      </button>
    </div>
  );

  return (
    <>
      {/* Overlay highlights for fallback mode - rendered inside container */}
      {!supportsHighlightAPI && containerRef.current && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {highlightRects.all.map((rect, i) => (
            <div
              key={`all-${i}`}
              className="absolute"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                backgroundColor: "rgba(253, 224, 71, 0.5)",
                borderRadius: 2,
              }}
            />
          ))}
          {highlightRects.current && (
            <div
              className="absolute"
              style={{
                top: highlightRects.current.top,
                left: highlightRects.current.left,
                width: highlightRects.current.width,
                height: highlightRects.current.height,
                backgroundColor: "rgba(251, 146, 60, 0.8)",
                borderRadius: 2,
              }}
            />
          )}
        </div>
      )}

      {/* Search bar - rendered via portal to body */}
      {createPortal(searchBar, document.body)}
    </>
  );
}
