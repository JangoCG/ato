import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Download, CheckCircle, XCircle, Loader2, HardDrive } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import {
  checkModelStatus,
  downloadModels,
  type ModelsStatus,
  type DownloadProgress,
} from "../hooks/useQmdSearch";

interface ModelDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReady: () => void;
  autoStart?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function ModelDownloadModal({ isOpen, onClose, onReady, autoStart = false }: ModelDownloadModalProps) {
  const [status, setStatus] = useState<ModelsStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Check model status when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasAutoStarted(false);
      checkModelStatus()
        .then(setStatus)
        .catch((e) => setError(String(e)));
    }
  }, [isOpen]);

  // Auto-start download if requested
  useEffect(() => {
    if (isOpen && autoStart && status && !status.semantic_ready && !isDownloading && !hasAutoStarted) {
      setHasAutoStarted(true);
      setIsDownloading(true);
      setError(null);
      setProgress(null);
      downloadModels().catch((e) => {
        setError(String(e));
        setIsDownloading(false);
      });
    }
  }, [isOpen, autoStart, status, isDownloading, hasAutoStarted]);

  // Listen for download progress events
  useEffect(() => {
    if (!isDownloading) return;

    const unlisten = listen<DownloadProgress>("qmd-download-progress", (event) => {
      setProgress(event.payload);

      if (event.payload.done) {
        setIsDownloading(false);
        if (event.payload.error) {
          setError(event.payload.error);
        } else {
          // Refresh status and notify ready
          checkModelStatus().then((newStatus) => {
            setStatus(newStatus);
            if (newStatus.semantic_ready) {
              onReady();
            }
          });
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isDownloading, onReady]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(null);
    try {
      await downloadModels();
    } catch (e) {
      setError(String(e));
      setIsDownloading(false);
    }
  }, []);

  if (!isOpen) return null;

  const totalSize = status
    ? (status.embedding.exists ? 0 : 329) + // ~329MB
      (status.generation.exists ? 0 : 1300) + // ~1.3GB
      (status.reranking.exists ? 0 : 650) // ~650MB
    : 0;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            AI Models Required
          </h2>
          <p className="text-sm text-textSubtle mt-1">
            Semantic search requires AI models to be downloaded.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">
              {error}
            </div>
          )}

          {status && (
            <div className="space-y-3">
              {/* Embedding Model */}
              <ModelRow
                name="Embedding Model"
                description="embeddinggemma-300M (~329MB)"
                exists={status.embedding.exists}
                size={status.embedding.size_bytes}
                isDownloading={isDownloading && progress?.model === "embedding"}
                progress={progress?.model === "embedding" ? progress : null}
              />

              {/* Generation Model */}
              <ModelRow
                name="Query Expansion Model"
                description="qmd-query-expansion-1.7B (~1.3GB)"
                exists={status.generation.exists}
                size={status.generation.size_bytes}
                isDownloading={isDownloading && progress?.model === "generation"}
                progress={progress?.model === "generation" ? progress : null}
              />

              {/* Reranking Model */}
              <ModelRow
                name="Reranking Model"
                description="qwen3-reranker-0.6b (~650MB)"
                exists={status.reranking.exists}
                size={status.reranking.size_bytes}
                isDownloading={isDownloading && progress?.model === "reranking"}
                progress={progress?.model === "reranking" ? progress : null}
              />
            </div>
          )}

          {/* Overall Progress */}
          {isDownloading && progress && !progress.done && (
            <div className="mt-4 p-3 bg-surfaceHighlight rounded-md">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-textSubtle">Downloading...</span>
                <span className="text-text font-mono">
                  {progress.speed} {progress.eta && `| ${progress.eta} left`}
                </span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-textSubtlest">
            {totalSize > 0 ? `~${(totalSize / 1024).toFixed(1)}GB to download` : "All models ready"}
          </span>
          <div className="flex gap-2">
            {!isDownloading && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-textSubtle hover:text-text hover:bg-surfaceHighlight rounded-md transition-colors"
              >
                Cancel
              </button>
            )}
            {!status?.semantic_ready && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Models
                  </>
                )}
              </button>
            )}
            {status?.semantic_ready && (
              <button
                onClick={onReady}
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

interface ModelRowProps {
  name: string;
  description: string;
  exists: boolean;
  size: number;
  isDownloading: boolean;
  progress: DownloadProgress | null;
}

function ModelRow({ name, description, exists, size, isDownloading, progress }: ModelRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surfaceHighlight rounded-md">
      <div className="flex-shrink-0">
        {exists ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : isDownloading ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <XCircle className="w-5 h-5 text-textSubtle" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{name}</div>
        <div className="text-xs text-textSubtle">{description}</div>
        {isDownloading && progress && (
          <div className="mt-1 w-full h-1 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        )}
      </div>
      <div className="text-xs text-textSubtlest">
        {exists ? formatBytes(size) : "Not installed"}
      </div>
    </div>
  );
}
