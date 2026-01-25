import { useEffect, useMemo, useState, useCallback } from "react";
import { FolderOpen, Moon, Palette, Settings as SettingsIcon, Sun } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, saveSettings, subscribeToSettings, type AppSettings } from "../lib/settings";
import { applyTheme } from "../lib/themes";
import { HeaderSize } from "./HeaderSize";

export type ThemeDefinition = {
  id: string;
  label: string;
  dark: boolean;
};

type TabId = "general" | "theme";

/**
 * SettingsPage - Standalone settings page for the native settings window
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("theme");
  const [settings, setSettings] = useState<AppSettings>(getSettings);

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
    if (selected && typeof selected === "string") {
      updateSettings({ dataFolder: selected });
    }
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
        id: "theme" as const,
        label: "Theme",
        icon: <Palette className="h-4 w-4 text-secondary" />,
      },
    ],
    [],
  );

  return (
    <div className="grid grid-rows-[auto_minmax(0,1fr)] h-screen bg-surface text-text overflow-hidden">
      <HeaderSize
        size="lg"
        className="x-theme-appHeader bg-[var(--appHeaderSurface)] text-text-subtle flex items-center justify-center border-b border-[var(--appHeaderBorder)] text-sm font-semibold"
      >
        <div className="w-full h-full pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center font-semibold text-text-subtle">Settings</div>
        </div>
      </HeaderSize>

      {/* Content */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="min-w-[10rem] bg-[var(--sidebarSurface)] x-theme-sidebar border-r border-[var(--sidebarBorder)] pl-3 pr-2 py-2">
          <div className="flex flex-col gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center rounded whitespace-nowrap px-2 ml-[1px] outline-none border min-w-[10rem] h-sm ${tab.id === activeTab
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

        {/* Main Content */}
        <div className="overflow-y-auto h-full px-6 py-4">
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
