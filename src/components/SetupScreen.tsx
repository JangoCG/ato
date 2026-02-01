import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { deriveQmdCollectionName, saveSettings } from "../lib/settings";

interface SetupScreenProps {
  onComplete: (folder: string) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folder for your notes",
      });
      if (selected && typeof selected === "string") {
        setSelectedFolder(selected);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleContinue = () => {
    if (selectedFolder) {
      saveSettings({
        dataFolder: selectedFolder,
        qmdCollectionName: deriveQmdCollectionName(selectedFolder),
      });
      onComplete(selectedFolder);
    }
  };

  return (
    <div className="h-screen w-full bg-surface text-text flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <h1 className="text-2xl font-bold mb-2">Welcome to Ato</h1>
        <p className="text-textSubtle mb-8">
          Choose where to store your notes. You can change this later in settings.
        </p>

        <button
          onClick={handleSelectFolder}
          disabled={isSelecting}
          className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:border-text hover:bg-surfaceHighlight transition-colors cursor-pointer disabled:opacity-50"
        >
          <FolderOpen size={32} className="text-textSubtle" />
          {selectedFolder ? (
            <span className="text-sm text-text truncate max-w-full px-4">
              {selectedFolder}
            </span>
          ) : (
            <span className="text-sm text-textSubtle">
              {isSelecting ? "Selecting..." : "Click to select folder"}
            </span>
          )}
        </button>

        <button
          onClick={handleContinue}
          disabled={!selectedFolder}
          className="w-full mt-6 h-10 bg-text text-surface rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
