import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import type { AppSettings, AttachmentLocation } from "./settings";

export type ObsidianAttachmentSettings = {
  attachmentLocation: AttachmentLocation;
  attachmentSubfolder?: string;
  attachmentSpecifiedFolder?: string;
};

/**
 * Parse Obsidian's attachmentFolderPath setting into our attachment settings format.
 *
 * Obsidian uses these conventions:
 * - "/" or "" or undefined: Vault root
 * - ".": Same folder as current file
 * - "./subfolder": Subfolder under current folder (e.g., "./attachments")
 * - "subfolder" or "/subfolder": Specific folder relative to vault root
 */
export function parseObsidianAttachmentPath(
  attachmentPath: string | undefined
): ObsidianAttachmentSettings {
  if (!attachmentPath || attachmentPath === "/" || attachmentPath === "") {
    return { attachmentLocation: "vault" };
  }

  if (attachmentPath === ".") {
    return { attachmentLocation: "same" };
  }

  if (attachmentPath.startsWith("./")) {
    return {
      attachmentLocation: "subfolder",
      attachmentSubfolder: attachmentPath.slice(2),
    };
  }

  // Specific folder relative to vault root
  return {
    attachmentLocation: "specified",
    attachmentSpecifiedFolder: attachmentPath.replace(/^\//, ""),
  };
}

/**
 * Detect if a folder is an Obsidian vault and extract its attachment settings.
 * Returns null if not an Obsidian vault or if settings couldn't be read.
 */
export async function detectObsidianVault(
  folderPath: string
): Promise<ObsidianAttachmentSettings | null> {
  try {
    const isObsidianVault = await exists(`${folderPath}/.obsidian`);
    if (!isObsidianVault) {
      return null;
    }

    const configText = await readTextFile(`${folderPath}/.obsidian/app.json`);
    const config = JSON.parse(configText);
    const attachmentPath = config.attachmentFolderPath as string | undefined;

    return parseObsidianAttachmentPath(attachmentPath);
  } catch {
    return null;
  }
}

/**
 * Get folder settings, auto-detecting Obsidian vault configuration if present.
 * Always returns at least the dataFolder setting.
 */
export async function getFolderSettings(
  folderPath: string
): Promise<Partial<AppSettings>> {
  const settings: Partial<AppSettings> = {
    dataFolder: folderPath,
  };

  const obsidianSettings = await detectObsidianVault(folderPath);
  if (obsidianSettings) {
    Object.assign(settings, obsidianSettings);
  }

  return settings;
}
