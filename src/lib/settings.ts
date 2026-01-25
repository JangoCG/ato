/**
 * Simple settings persistence using localStorage with cross-window sync via Tauri events
 */

import { emit, listen } from "@tauri-apps/api/event";

export type AppSettings = {
  appearance: "system" | "light" | "dark";
  lightTheme: string;
  darkTheme: string;
  useNativeTitlebar: boolean;
  interfaceFontSize: number;
  dataFolder: string | null;
};

const SETTINGS_KEY = "ato-settings";
const SETTINGS_EVENT = "settings-changed";

const defaultSettings: AppSettings = {
  appearance: "system",
  lightTheme: "ato-light",
  darkTheme: "ato-dark",
  useNativeTitlebar: false,
  interfaceFontSize: 14,
  dataFolder: null,
};

export function getSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to read settings:", e);
  }
  return defaultSettings;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    // Emit Tauri event for cross-window sync
    emit(SETTINGS_EVENT, updated).catch(console.error);
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
  return updated;
}

export function subscribeToSettings(callback: (settings: AppSettings) => void): () => void {
  let unlisten: (() => void) | null = null;

  // Listen for Tauri events from any window
  listen<AppSettings>(SETTINGS_EVENT, (event) => {
    callback(event.payload);
  }).then((fn) => {
    unlisten = fn;
  });

  return () => {
    unlisten?.();
  };
}
