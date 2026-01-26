import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseObsidianAttachmentPath, detectObsidianVault, getFolderSettings } from "./useObsidianImport";

// Mock Tauri fs plugin
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
}));

import { exists, readTextFile } from "@tauri-apps/plugin-fs";

const mockExists = vi.mocked(exists);
const mockReadTextFile = vi.mocked(readTextFile);

describe("parseObsidianAttachmentPath", () => {
  it("returns vault location for undefined path", () => {
    expect(parseObsidianAttachmentPath(undefined)).toEqual({
      attachmentLocation: "vault",
    });
  });

  it("returns vault location for empty string", () => {
    expect(parseObsidianAttachmentPath("")).toEqual({
      attachmentLocation: "vault",
    });
  });

  it("returns vault location for root slash", () => {
    expect(parseObsidianAttachmentPath("/")).toEqual({
      attachmentLocation: "vault",
    });
  });

  it("returns same location for dot", () => {
    expect(parseObsidianAttachmentPath(".")).toEqual({
      attachmentLocation: "same",
    });
  });

  it("returns subfolder location for ./subfolder pattern", () => {
    expect(parseObsidianAttachmentPath("./attachments")).toEqual({
      attachmentLocation: "subfolder",
      attachmentSubfolder: "attachments",
    });
  });

  it("returns subfolder location for ./nested/path pattern", () => {
    expect(parseObsidianAttachmentPath("./assets/images")).toEqual({
      attachmentLocation: "subfolder",
      attachmentSubfolder: "assets/images",
    });
  });

  it("returns specified location for absolute path", () => {
    expect(parseObsidianAttachmentPath("/assets")).toEqual({
      attachmentLocation: "specified",
      attachmentSpecifiedFolder: "assets",
    });
  });

  it("returns specified location for relative path without dot prefix", () => {
    expect(parseObsidianAttachmentPath("assets")).toEqual({
      attachmentLocation: "specified",
      attachmentSpecifiedFolder: "assets",
    });
  });

  it("returns specified location for nested path without dot prefix", () => {
    expect(parseObsidianAttachmentPath("media/attachments")).toEqual({
      attachmentLocation: "specified",
      attachmentSpecifiedFolder: "media/attachments",
    });
  });
});

describe("detectObsidianVault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null if .obsidian folder does not exist", async () => {
    mockExists.mockResolvedValue(false);

    const result = await detectObsidianVault("/path/to/folder");

    expect(result).toBeNull();
    expect(mockExists).toHaveBeenCalledWith("/path/to/folder/.obsidian");
  });

  it("returns vault settings when Obsidian vault has no attachment config", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(JSON.stringify({}));

    const result = await detectObsidianVault("/path/to/vault");

    expect(result).toEqual({ attachmentLocation: "vault" });
  });

  it("returns correct settings for subfolder attachment config", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({ attachmentFolderPath: "./attachments" })
    );

    const result = await detectObsidianVault("/path/to/vault");

    expect(result).toEqual({
      attachmentLocation: "subfolder",
      attachmentSubfolder: "attachments",
    });
  });

  it("returns correct settings for same folder attachment config", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({ attachmentFolderPath: "." })
    );

    const result = await detectObsidianVault("/path/to/vault");

    expect(result).toEqual({ attachmentLocation: "same" });
  });

  it("returns correct settings for specified folder attachment config", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({ attachmentFolderPath: "assets" })
    );

    const result = await detectObsidianVault("/path/to/vault");

    expect(result).toEqual({
      attachmentLocation: "specified",
      attachmentSpecifiedFolder: "assets",
    });
  });

  it("returns null when config file cannot be read", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockRejectedValue(new Error("File not found"));

    const result = await detectObsidianVault("/path/to/vault");

    expect(result).toBeNull();
  });

  it("returns null when config file contains invalid JSON", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue("not valid json");

    const result = await detectObsidianVault("/path/to/vault");

    expect(result).toBeNull();
  });
});

describe("getFolderSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only dataFolder when not an Obsidian vault", async () => {
    mockExists.mockResolvedValue(false);

    const result = await getFolderSettings("/path/to/folder");

    expect(result).toEqual({ dataFolder: "/path/to/folder" });
  });

  it("returns dataFolder with attachment settings for Obsidian vault", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue(
      JSON.stringify({ attachmentFolderPath: "./attachments" })
    );

    const result = await getFolderSettings("/path/to/vault");

    expect(result).toEqual({
      dataFolder: "/path/to/vault",
      attachmentLocation: "subfolder",
      attachmentSubfolder: "attachments",
    });
  });

  it("returns only dataFolder when Obsidian detection fails", async () => {
    mockExists.mockRejectedValue(new Error("Permission denied"));

    const result = await getFolderSettings("/path/to/folder");

    expect(result).toEqual({ dataFolder: "/path/to/folder" });
  });
});
