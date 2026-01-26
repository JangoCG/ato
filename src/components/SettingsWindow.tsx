import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FolderOpen, Link, Moon, Palette, Settings as SettingsIcon, Sun } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import { getSettings, saveSettings, subscribeToSettings, type AppSettings, type AttachmentLocation } from "../lib/settings";
import { applyTheme } from "../lib/themes";
import { HeaderSize } from "./HeaderSize";
import type { ResizeHandleEvent } from "./ResizeHandle";
import { ResizeHandle } from "./ResizeHandle";

export type ThemeDefinition = {
  id: string;
  label: string;
  dark: boolean;
};

type TabId = "general" | "files" | "theme";

const DEFAULT_SIDEBAR_WIDTH = 180;

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [settings, setSettings] = useState<AppSettings>(getSettings);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startWidth = useRef<number | null>(null);

  // Apply theme whenever settings change
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // Subscribe to settings changes from other windows
  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        await getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Resize handlers (yaak style)
  const handleResizeMove = useCallback(
    ({ x, xStart }: ResizeHandleEvent) => {
      if (startWidth.current == null) return;
      const newWidth = Math.max(150, Math.min(400, startWidth.current + (x - xStart)));
      setSidebarWidth(newWidth);
    },
    [],
  );

  const handleResizeStart = useCallback(() => {
    startWidth.current = sidebarWidth;
    setIsResizing(true);
  }, [sidebarWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    startWidth.current = null;
  }, []);

  const resetWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    const updated = saveSettings(updates);
    setSettings(updated);
  }, []);

  const handleChangeFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select folder for your notes",
      defaultPath: settings.dataFolder ?? undefined,
    });
    if (!selected || typeof selected !== "string") return;

    const updates: Partial<AppSettings> = {
      dataFolder: selected,
    };

    // Auto-detect Obsidian vault and import attachment settings
    try {
      const isObsidianVault = await exists(`${selected}/.obsidian`);
      if (isObsidianVault) {
        const configText = await readTextFile(`${selected}/.obsidian/app.json`);
        const config = JSON.parse(configText);
        const attachmentPath = config.attachmentFolderPath as string | undefined;

        if (!attachmentPath || attachmentPath === "/" || attachmentPath === "") {
          updates.attachmentLocation = "vault";
        } else if (attachmentPath === ".") {
          updates.attachmentLocation = "same";
        } else if (attachmentPath.startsWith("./")) {
          updates.attachmentLocation = "subfolder";
          updates.attachmentSubfolder = attachmentPath.slice(2);
        } else {
          updates.attachmentLocation = "specified";
          updates.attachmentSpecifiedFolder = attachmentPath.replace(/^\//, "");
        }
      }
    } catch (e) {
      console.log("Could not detect Obsidian vault:", e);
    }

    updateSettings(updates);
  }, [settings.dataFolder, updateSettings]);

  const showLight = settings.appearance === "system" || settings.appearance === "light";
  const showDark = settings.appearance === "system" || settings.appearance === "dark";

  useEffect(() => {
    const updates: Partial<AppSettings> = {};
    if (settings.lightTheme !== "ato-light") {
      updates.lightTheme = "ato-light";
    }
    if (settings.darkTheme !== "ato-dark") {
      updates.darkTheme = "ato-dark";
    }
    if (Object.keys(updates).length > 0) {
      updateSettings(updates);
    }
  }, [settings.darkTheme, settings.lightTheme, updateSettings]);

  const tabs = useMemo(
    () => [
      {
        id: "general" as const,
        label: "General",
        icon: <SettingsIcon className="h-4 w-4 text-secondary" />,
      },
      {
        id: "files" as const,
        label: "Files & Links",
        icon: <Link className="h-4 w-4 text-secondary" />,
      },
      {
        id: "theme" as const,
        label: "Theme",
        icon: <Palette className="h-4 w-4 text-secondary" />,
      },
    ],
    [],
  );

  // Grid layout like yaak Workspace
  const gridStyle = useMemo(
    () => ({
      gridTemplate: `
        'head head head' auto
        'side drag body' minmax(0,1fr)
        / ${sidebarWidth}px 0 1fr`,
    }),
    [sidebarWidth],
  );

  return (
    <div
      style={gridStyle}
      className={`grid w-full h-screen bg-surface text-text overflow-hidden ${!isResizing ? 'transition-[grid-template]' : ''}`}
    >
      <HeaderSize
        size="lg"
        className="x-theme-appHeader bg-[var(--appHeaderSurface)] text-text-subtle flex items-center justify-center border-b border-[var(--appHeaderBorder)] text-sm font-semibold"
        style={{ gridArea: 'head' }}
      >
        <div className="w-full h-full pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center font-semibold text-text-subtle">Settings</div>
        </div>
      </HeaderSize>

      {/* Sidebar */}
      <div
        style={{ gridArea: 'side' }}
        className="x-theme-sidebar overflow-hidden bg-[var(--sidebarSurface)] border-r border-[var(--sidebarBorder)]"
      >
        <div className="h-full pl-3 pr-2 py-2">
          <div className="flex flex-col gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center rounded whitespace-nowrap px-2 ml-[1px] outline-none border h-sm ${tab.id === activeTab
                  ? "text-text border-surface-active bg-surface-active"
                  : "border-transparent text-text-subtle hover:bg-surface-highlight"
                  }`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <ResizeHandle
        style={{ gridArea: 'drag' }}
        className="-translate-x-[1px]"
        justify="end"
        side="right"
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
        onResizeMove={handleResizeMove}
        onReset={resetWidth}
      />

      {/* Main Content */}
      <div style={{ gridArea: 'body' }} className="overflow-y-auto h-full px-6 py-4">
        {activeTab === "general" && (
          <div className="flex flex-col gap-3 mb-4">
            <div className="mb-3">
              <h1 className="font-semibold text-text text-2xl">General</h1>
              <p className="text-text-subtle">
                Configure general settings for your notes.
              </p>
            </div>

            {/* Data Folder */}
            <div className="x-theme-input w-full flex-row gap-0.5">
              <label className="text-text-subtle text-sm mb-0.5 block">Notes Folder</label>
              <div className="flex flex-row gap-2 w-full rounded-md text-text text-sm font-mono border border-border items-center">
                <div className="flex-1 px-2 py-1.5 truncate text-text-subtle">
                  {settings.dataFolder || "No folder selected"}
                </div>
                <button
                  type="button"
                  onClick={handleChangeFolder}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text hover:bg-surface-highlight border-l border-border"
                >
                  <FolderOpen className="h-4 w-4" />
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="flex flex-col gap-4 mb-4">
            <div className="mb-3">
              <h1 className="font-semibold text-text text-2xl">Files & Links</h1>
              <p className="text-text-subtle">
                Configure how files and attachments are handled.
              </p>
            </div>

            {/* Default location for new attachments */}
            <div className="flex flex-row items-start justify-between gap-4 py-3 border-b border-border">
              <div className="flex flex-col gap-1">
                <span className="text-text font-medium">Default location for new attachments</span>
                <span className="text-text-subtle text-sm">Where newly added attachments are placed.</span>
              </div>
              <div className="flex-shrink-0">
                <select
                  value={settings.attachmentLocation}
                  onChange={(e) =>
                    updateSettings({ attachmentLocation: e.target.value as AttachmentLocation })
                  }
                  className="px-3 py-1.5 pr-8 text-sm bg-surface border border-border rounded-md text-text outline-none"
                  style={selectBackgroundStyles}
                >
                  <option value="vault">Vault folder</option>
                  <option value="same">Same folder as current file</option>
                  <option value="subfolder">In subfolder under current folder</option>
                  <option value="specified">In the folder specified below</option>
                </select>
              </div>
            </div>

            {/* Subfolder name - only shown when "subfolder" is selected */}
            {settings.attachmentLocation === "subfolder" && (
              <div className="flex flex-row items-start justify-between gap-4 py-3 border-b border-border">
                <div className="flex flex-col gap-1">
                  <span className="text-text font-medium">Subfolder name</span>
                  <span className="text-text-subtle text-sm">
                    If your file is in "vault/folder", and you set subfolder name to
                    "{settings.attachmentSubfolder || "attachments"}", attachments will be saved to
                    "vault/folder/{settings.attachmentSubfolder || "attachments"}".
                  </span>
                </div>
                <div className="flex-shrink-0">
                  <input
                    type="text"
                    value={settings.attachmentSubfolder}
                    onChange={(e) => updateSettings({ attachmentSubfolder: e.target.value })}
                    placeholder="attachments"
                    className="px-3 py-1.5 text-sm bg-surface border border-border rounded-md text-text outline-none w-40"
                  />
                </div>
              </div>
            )}

            {/* Specified folder - only shown when "specified" is selected */}
            {settings.attachmentLocation === "specified" && (
              <div className="flex flex-row items-start justify-between gap-4 py-3 border-b border-border">
                <div className="flex flex-col gap-1">
                  <span className="text-text font-medium">Attachment folder path</span>
                  <span className="text-text-subtle text-sm">
                    All attachments will be saved to this folder relative to your vault root.
                  </span>
                </div>
                <div className="flex-shrink-0">
                  <input
                    type="text"
                    value={settings.attachmentSpecifiedFolder}
                    onChange={(e) => updateSettings({ attachmentSpecifiedFolder: e.target.value })}
                    placeholder="assets"
                    className="px-3 py-1.5 text-sm bg-surface border border-border rounded-md text-text outline-none w-40"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "theme" && (
          <div className="flex flex-col gap-3 mb-4">
            <div className="mb-3">
              <h1 className="font-semibold text-text text-2xl">Theme</h1>
              <p className="text-text-subtle">
                Customize the appearance of the application.
              </p>
            </div>

            {/* Appearance Select */}
            <div className="x-theme-input w-full flex-row gap-0.5">
              <label className="text-text-subtle text-sm mb-0.5 block">Appearance</label>
              <div className="flex flex-row gap-2 w-full rounded-md text-text text-sm font-mono pl-2 border border-border h-sm items-center">
                <select
                  value={settings.appearance}
                  onChange={(e) =>
                    updateSettings({ appearance: e.target.value as AppSettings["appearance"] })
                  }
                  className="pr-7 w-full outline-none bg-transparent leading-[1] rounded-none"
                  style={selectBackgroundStyles}
                >
                  <option value="system">Automatic</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>

            {/* Theme Selects */}
            <div className="flex flex-row gap-2">
              {showLight && (
                <div className="x-theme-input w-full flex-row gap-0.5 flex-1">
                  <label className="text-text-subtle text-sm mb-0.5 block">Light Theme</label>
                  <div className="flex flex-row gap-2 w-full rounded-md text-text text-sm font-mono px-2 border border-border h-sm items-center">
                    <Sun className="h-4 w-4 text-secondary flex-shrink-0" />
                    <span className="text-text">Ato</span>
                  </div>
                </div>
              )}
              {showDark && (
                <div className="x-theme-input w-full flex-row gap-0.5 flex-1">
                  <label className="text-text-subtle text-sm mb-0.5 block">Dark Theme</label>
                  <div className="flex flex-row gap-2 w-full rounded-md text-text text-sm font-mono px-2 border border-border h-sm items-center">
                    <Moon className="h-4 w-4 text-secondary flex-shrink-0" />
                    <span className="text-text">Ato</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const selectBackgroundStyles: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
  backgroundPosition: "right 0.3rem center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "1.5em 1.5em",
  appearance: "none",
  printColorAdjust: "exact",
};
