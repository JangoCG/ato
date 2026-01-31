import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, parserCtx, editorViewCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Slice } from "@milkdown/prose/model";
import { SquarePen, FolderPlus, Search, Settings } from "lucide-react";
import { writeTextFile, readTextFile, readDir, mkdir, exists, rename, remove, writeFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { SidebarTree } from "./SidebarTree";
import { HeaderSize } from "./components/HeaderSize";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { SettingsMenu } from "./components/SettingsMenu";
import { SetupScreen } from "./components/SetupScreen";
import type { ResizeHandleEvent } from "./components/ResizeHandle";
import { ResizeHandle } from "./components/ResizeHandle";
import { getSettings, subscribeToSettings, type AppSettings } from "./lib/settings";
import { applyTheme } from "./lib/themes";
import {
  findNodeById,
  getChildrenForParent,
  getParentIdForNode,
  type FileNode,
} from "./treeUtils";

const ORDER_FILE = ".ato-order.json";

const defaultMarkdown = `# Welcome to Ato

Start typing to experience **live formatting** as you write.

## Features

- Type \`#\` for headings
- Use **bold** and *italic* naturally
- Create lists with \`-\` or \`1.\`
- Add \`code\` with backticks

Happy writing!
`;

const markdownHeuristics = [
  /(^|\n)#{1,6}\s+/,
  /(^|\n)\s*>\s+/,
  /(^|\n)\s*[-*+]\s+/,
  /(^|\n)\s*\d+\.\s+/,
  /(^|\n)```/,
  /(^|\n)\|.*\|/,
  /\[.+?\]\(.+?\)/,
  /(^|\n)---(\n|$)/,
];

const looksLikeMarkdown = (text: string) => markdownHeuristics.some((pattern) => pattern.test(text));

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico"];

const isImageFile = (path: string) => {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const isRelevantFile = (name: string) => {
  const lower = name.toLowerCase();
  return lower.endsWith(".md") || IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

// Convert Obsidian-style wiki-link images to standard markdown
// ![[image.png]] -> ![](<image.png>)
// ![[image.png|alt text]] -> ![alt text](<image.png>)
// Uses angle brackets to handle filenames with spaces
const convertObsidianImages = (markdown: string): string => {
  return markdown.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
    (_, filename, alt) => `![${alt || ""}](<${filename}>)`
  );
};

function MilkdownEditor({
  content,
  onSave,
  onPasteImage,
  baseDir,
  vaultRoot,
  attachmentLocation,
  attachmentSubfolder,
  attachmentSpecifiedFolder,
}: {
  content: string;
  onSave: (markdown: string) => void;
  onPasteImage?: (file: File) => Promise<string | null>;
  baseDir: string;
  vaultRoot: string;
  attachmentLocation: string;
  attachmentSubfolder: string;
  attachmentSpecifiedFolder: string;
}) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const onPasteImageRef = useRef(onPasteImage);
  onPasteImageRef.current = onPasteImage;

  const contentRef = useRef(content);
  contentRef.current = content;

  const baseDirRef = useRef(baseDir);
  baseDirRef.current = baseDir;

  const vaultRootRef = useRef(vaultRoot);
  vaultRootRef.current = vaultRoot;

  const attachmentLocationRef = useRef(attachmentLocation);
  attachmentLocationRef.current = attachmentLocation;

  const attachmentSubfolderRef = useRef(attachmentSubfolder);
  attachmentSubfolderRef.current = attachmentSubfolder;

  const attachmentSpecifiedFolderRef = useRef(attachmentSpecifiedFolder);
  attachmentSpecifiedFolderRef.current = attachmentSpecifiedFolder;

  const didFocusRef = useRef(false);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, contentRef.current);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          nodeViews: {
            ...prev.nodeViews,
            image: (node) => {
              const container = document.createElement("span");
              container.className = "image-wrapper";

              const img = document.createElement("img");
              const src = node.attrs.src as string;

              // Transform relative paths to asset URLs
              // Use exact location based on settings (no fallback)
              if (src && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("asset://")) {
                let fullPath: string;

                switch (attachmentLocationRef.current) {
                  case "vault":
                    // Images are in vault root
                    fullPath = `${vaultRootRef.current}/${src}`;
                    break;
                  case "subfolder": {
                    // Images are in subfolder under current folder
                    const subfolder = attachmentSubfolderRef.current || "attachments";
                    fullPath = `${baseDirRef.current}/${subfolder}/${src}`;
                    break;
                  }
                  case "specified": {
                    // Images are in specified folder relative to vault root
                    const specifiedFolder = attachmentSpecifiedFolderRef.current || "assets";
                    fullPath = `${vaultRootRef.current}/${specifiedFolder}/${src}`;
                    break;
                  }
                  case "same":
                  default:
                    // Images are in same folder as markdown file
                    fullPath = `${baseDirRef.current}/${src}`;
                    break;
                }

                img.src = convertFileSrc(fullPath);
              } else {
                img.src = src;
              }

              img.alt = (node.attrs.alt as string) || "";
              if (node.attrs.title) {
                img.title = node.attrs.title as string;
              }
              img.style.maxWidth = "100%";

              container.appendChild(img);
              return {
                dom: container,
              };
            },
          },
          handlePaste: (view, event) => {
            if (prev.handlePaste?.(view, event, Slice.empty)) return true;
            const { clipboardData } = event;
            if (!clipboardData) return false;

            // Check for pasted images first
            const items = clipboardData.items;
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file && onPasteImageRef.current) {
                  event.preventDefault();
                  onPasteImageRef.current(file).then((relativePath) => {
                    if (relativePath) {
                      // Insert as an actual image node
                      const imageType = view.state.schema.nodes.image;
                      if (imageType) {
                        const imageNode = imageType.create({ src: relativePath, alt: "" });
                        const tr = view.state.tr.replaceSelectionWith(imageNode);
                        view.dispatch(tr.scrollIntoView());
                      }
                    }
                  });
                  return true;
                }
              }
            }

            const currentNode = view.state.selection.$from.node();
            if (currentNode.type.spec.code) return false;

            const text = clipboardData.getData("text/plain");
            const html = clipboardData.getData("text/html");
            const vscodeData = clipboardData.getData("vscode-editor-data");
            if (!text || !html || vscodeData) return false;
            if (!looksLikeMarkdown(text)) return false;

            event.preventDefault();
            try {
              const parser = ctx.get(parserCtx);
              const doc = parser(text);
              if (!doc || typeof doc === "string") return false;
              const slice = Slice.maxOpen(doc.content);
              const tr = view.state.tr.replaceSelection(slice);
              view.dispatch(tr.scrollIntoView());
              return true;
            } catch (error) {
              console.warn("Failed to parse markdown from clipboard:", error);
              return false;
            }
          },
        }));
      })
      .use(commonmark)
      .use(gfm)
      .use(clipboard)
      .use(history)
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onSaveRef.current(markdown);
        });
      })
  , []);

  useEffect(() => {
    if (didFocusRef.current) return;
    const editor = get();
    if (editor) {
      requestAnimationFrame(() => {
        try {
          const view = editor.ctx.get(editorViewCtx);
          view.focus();
          didFocusRef.current = true;
        } catch {
          // Editor not ready yet
        }
      });
    }
  }, [get]);

  return <Milkdown />;
}

const DEFAULT_SIDEBAR_WIDTH = 240;

function EditorApp({ dataFolder }: { dataFolder: string }) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startWidth = useRef<number | null>(null);
  const [activePath, setActivePath] = useState("Untitled.md");
  const [editingFilename, setEditingFilename] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [treeItems, setTreeItems] = useState<FileNode[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState(defaultMarkdown);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [settings, setSettings] = useState(getSettings);
  const [appVersion, setAppVersion] = useState("0.0.0");
  const openSettings = useCallback(async () => {
    try {
      await invoke("open_settings_window");
    } catch (err) {
      console.error("Failed to open settings window:", err);
    }
  }, []);

  // Resize handlers (yaak style)
  const handleResizeMove = useCallback(
    ({ x, xStart }: ResizeHandleEvent) => {
      if (startWidth.current == null) return;
      const newWidth = startWidth.current + (x - xStart);
      if (newWidth < 50) {
        if (!sidebarHidden) setSidebarHidden(true);
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
      } else {
        if (sidebarHidden) setSidebarHidden(false);
        setSidebarWidth(Math.max(150, Math.min(500, newWidth)));
      }
    },
    [sidebarHidden],
  );

  const handleResizeStart = useCallback(() => {
    startWidth.current = sidebarWidth;
    setIsResizing(true);
  }, [sidebarWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    startWidth.current = null;
  }, []);

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  }, []);

  const saveTimeoutRef = useRef<number | null>(null);
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const getFullPath = useCallback((relativePath: string) => {
    return relativePath ? `${dataFolder}/${relativePath}` : dataFolder;
  }, [dataFolder]);

  const getBaseName = useCallback((path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] ?? path;
  }, []);

  const getParentDir = useCallback((path: string) => {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
  }, []);

  const ensureAppFolder = useCallback(async () => {
    const dirExists = await exists(dataFolder);
    if (!dirExists) {
      await mkdir(dataFolder, { recursive: true });
    }
  }, [dataFolder]);

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // Subscribe to settings changes from other windows
  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  // Fetch app version on mount
  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  const readOrder = useCallback(
    async (relativeDir: string) => {
      try {
        const orderPath = `${getFullPath(relativeDir)}/${ORDER_FILE}`;
        const data = await readTextFile(orderPath);
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : null;
      } catch {
        return null;
      }
    },
    [getFullPath],
  );

  const writeOrder = useCallback(
    async (relativeDir: string, names: string[]) => {
      const orderPath = `${getFullPath(relativeDir)}/${ORDER_FILE}`;
      await writeTextFile(orderPath, JSON.stringify(names));
    },
    [getFullPath],
  );

  const readTree = useCallback(
    async (relativeDir = ""): Promise<FileNode[]> => {
      const dirPath = getFullPath(relativeDir);
      const entries = await readDir(dirPath);
      // Filter out hidden files/folders (starting with .) and the order file
      const visibleEntries = entries.filter((entry) =>
        !entry.name.startsWith(".") && entry.name !== ORDER_FILE
      );
      const order = await readOrder(relativeDir);
      const entryMap = new Map(visibleEntries.map((entry) => [entry.name, entry]));

      const sortedNames = order
        ? [
            ...order.filter((name) => entryMap.has(name)),
            ...visibleEntries
              .map((entry) => entry.name)
              .filter((name) => !order.includes(name))
              .sort(),
          ]
        : visibleEntries.map((entry) => entry.name).sort();

      const nodes: FileNode[] = [];
      for (const name of sortedNames) {
        const entry = entryMap.get(name);
        if (!entry) continue;
        const id = relativeDir ? `${relativeDir}/${name}` : name;
        if (entry.isDirectory) {
          const children = await readTree(id);
          // Only include folders that contain relevant files
          if (children.length > 0) {
            nodes.push({
              id,
              name,
              type: "folder",
              children,
            });
          }
        } else if (entry.isFile && isRelevantFile(name)) {
          nodes.push({ id, name, type: "file" });
        }
      }
      // Sort: folders first, then files, alphabetically within each group
      nodes.sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
      return nodes;
    },
    [getFullPath, readOrder],
  );

  const loadTree = useCallback(async () => {
    try {
      await ensureAppFolder();
      const tree = await readTree("");
      setTreeItems(tree);
      const activeNode = findNodeById(tree, activePathRef.current);
      setSelectedId(activeNode ? activeNode.id : null);
    } catch (err) {
      console.error("Failed to read directory tree:", err);
    }
  }, [ensureAppFolder, readTree]);

  useEffect(() => {
    const initFs = async () => {
      console.log("initFs called, checking:", dataFolder);
      try {
        await loadTree();
      } catch (err) {
        console.error("Failed to initialize FS:", err);
      }
    };
    initFs();
  }, [loadTree]);

  const createNewFile = async () => {
    console.log("createNewFile called");
    let newName = "Untitled.md";
    let counter = 1;
    const rootNames = treeItems.map((node) => node.name);

    while (rootNames.includes(newName)) {
      newName = `Untitled ${counter}.md`;
      counter++;
    }

    console.log("Creating file:", `${dataFolder}/${newName}`);
    try {
      await writeTextFile(getFullPath(newName), "");
      console.log("File created successfully");
      await loadTree();
      setActivePath(newName);
      setSelectedId(newName);
      setContent("");
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  };

  const createNewFolder = async () => {
    console.log("createNewFolder called");
    let newName = "New Folder";
    let counter = 1;
    const rootNames = treeItems.map((node) => node.name);

    while (rootNames.includes(newName)) {
      newName = `New Folder ${counter}`;
      counter++;
    }

    try {
      await mkdir(getFullPath(newName), { recursive: true });
      await loadTree();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const updateOrderAfterRename = useCallback(
    async (relativeDir: string, oldName: string, newName: string) => {
      const order = await readOrder(relativeDir);
      if (!order) return;
      const updated = order.map((name) => (name === oldName ? newName : name));
      await writeOrder(relativeDir, updated);
    },
    [readOrder, writeOrder],
  );

  const renameFile = async (newName: string) => {
    const currentName = getBaseName(activePath);
    if (newName === currentName || !newName.trim()) {
      setIsEditingName(false);
      return;
    }

    // Ensure .md extension
    if (!newName.endsWith(".md")) {
      newName = newName + ".md";
    }

    const parentDir = getParentDir(activePath);
    const parentId = parentDir ? parentDir : null;
    const siblingNames = getChildrenForParent(treeItems, parentId).map((node) => node.name);
    if (siblingNames.includes(newName)) {
      console.error("File already exists:", newName);
      setIsEditingName(false);
      return;
    }

    try {
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;
      const oldFullPath = getFullPath(activePath);
      const newFullPath = getFullPath(newPath);

      // Check if the old file exists on disk
      const fileExists = await exists(oldFullPath);

      if (fileExists) {
        // File exists, rename it
        await rename(oldFullPath, newFullPath);
        await updateOrderAfterRename(parentDir, currentName, newName);
      } else {
        // File doesn't exist yet, create it with the new name
        await writeTextFile(newFullPath, content);
      }

      setActivePath(newPath);
      setSelectedId(newPath);
      await loadTree();
    } catch (err) {
      console.error("Failed to rename file:", err);
    }
    setIsEditingName(false);
  };

  const openFile = async (path: string) => {
    try {
      const fullPath = getFullPath(path);
      if (isImageFile(path)) {
        const src = convertFileSrc(fullPath);
        setImageSrc(src);
        setContent("");
      } else {
        const text = await readTextFile(fullPath);
        setImageSrc(null);
        // Convert Obsidian wiki-link images to standard markdown
        setContent(convertObsidianImages(text));
      }
      setActivePath(path);
      setSelectedId(path);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  const saveFile = useCallback((markdown: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await ensureAppFolder();
        const path = getFullPath(activePathRef.current);
        const fileExists = await exists(path);
        await writeTextFile(path, markdown);
        if (!fileExists) {
          await loadTree();
        }
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    }, 100);
  }, [ensureAppFolder, getFullPath, loadTree]);

  const handlePasteImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const currentPath = activePathRef.current;
      const parentDir = getParentDir(currentPath);

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const ext = file.type.split("/")[1] || "png";
      const filename = `image-${timestamp}.${ext}`;

      // Determine save location based on settings
      let saveDir: string;
      let markdownRef: string;

      switch (settings.attachmentLocation) {
        case "vault":
          // Save to vault root
          saveDir = "";
          markdownRef = filename;
          break;
        case "same":
          // Save to same folder as current file
          saveDir = parentDir;
          markdownRef = filename;
          break;
        case "subfolder": {
          // Save to subfolder under current folder
          const subfolder = settings.attachmentSubfolder || "attachments";
          saveDir = parentDir ? `${parentDir}/${subfolder}` : subfolder;
          markdownRef = `${subfolder}/${filename}`;
          break;
        }
        case "specified": {
          // Save to specified folder relative to vault root
          const specifiedFolder = settings.attachmentSpecifiedFolder || "assets";
          saveDir = specifiedFolder;
          markdownRef = `${specifiedFolder}/${filename}`;
          break;
        }
        default:
          saveDir = parentDir;
          markdownRef = filename;
      }

      // Ensure the save directory exists
      const saveDirFull = getFullPath(saveDir);
      const dirExists = await exists(saveDirFull);
      if (!dirExists) {
        await mkdir(saveDirFull, { recursive: true });
      }

      // Get the full path for saving
      const relativePath = saveDir ? `${saveDir}/${filename}` : filename;
      const fullPath = getFullPath(relativePath);

      // Read file as ArrayBuffer and save
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await writeFile(fullPath, uint8Array);

      // Refresh the tree to show the new file
      await loadTree();

      // Return the path for the markdown reference
      return markdownRef;
    } catch (err) {
      console.error("Failed to save pasted image:", err);
      return null;
    }
  }, [getFullPath, getParentDir, loadTree, settings.attachmentLocation, settings.attachmentSubfolder, settings.attachmentSpecifiedFolder]);

  const updateActivePath = useCallback((oldPath: string, newPath: string) => {
    const currentActive = activePathRef.current;
    if (currentActive === oldPath) {
      setActivePath(newPath);
      return;
    }
    if (currentActive.startsWith(`${oldPath}/`)) {
      setActivePath(currentActive.replace(oldPath, newPath));
    }
  }, []);

  const getDuplicateName = useCallback((name: string, siblings: string[], isFile: boolean) => {
    const extIndex = isFile ? name.lastIndexOf(".") : -1;
    const base = extIndex > 0 ? name.slice(0, extIndex) : name;
    const ext = extIndex > 0 ? name.slice(extIndex) : "";
    let candidate = `${base} copy${ext}`;
    let counter = 2;
    while (siblings.includes(candidate)) {
      candidate = `${base} copy ${counter}${ext}`;
      counter += 1;
    }
    return candidate;
  }, []);

  const copyDirectory = useCallback(
    async (sourceRel: string, targetRel: string) => {
      await mkdir(getFullPath(targetRel), { recursive: true });
      const entries = await readDir(getFullPath(sourceRel));
      for (const entry of entries) {
        const from = `${sourceRel}/${entry.name}`;
        const to = `${targetRel}/${entry.name}`;
        if (entry.isDirectory) {
          await copyDirectory(from, to);
        } else if (entry.isFile) {
          const text = await readTextFile(getFullPath(from));
          await writeTextFile(getFullPath(to), text);
        }
      }
    },
    [getFullPath],
  );

  const renameItem = useCallback(
    async (id: string, newName: string) => {
      const node = findNodeById(treeItems, id);
      if (!node) return;
      if (!newName.trim()) return;

      const parentId = getParentIdForNode(treeItems, id);
      const parentDir = parentId ?? "";
      const siblings = getChildrenForParent(treeItems, parentId).map((child) => child.name);

      let finalName = newName.trim();
      if (node.type === "file" && !finalName.endsWith(".md")) {
        finalName = `${finalName}.md`;
      }
      if (siblings.includes(finalName)) {
        return;
      }

      const newPath = parentDir ? `${parentDir}/${finalName}` : finalName;
      await rename(getFullPath(id), getFullPath(newPath));
      await updateOrderAfterRename(parentDir, node.name, finalName);
      updateActivePath(id, newPath);
      await loadTree();
    },
    [getFullPath, loadTree, treeItems, updateActivePath, updateOrderAfterRename],
  );

  const duplicateItem = useCallback(
    async (id: string) => {
      const node = findNodeById(treeItems, id);
      if (!node) return;
      const parentId = getParentIdForNode(treeItems, id);
      const parentDir = parentId ?? "";
      const siblings = getChildrenForParent(treeItems, parentId).map((child) => child.name);
      const newName = getDuplicateName(node.name, siblings, node.type === "file");
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;

      if (node.type === "file") {
        const text = await readTextFile(getFullPath(id));
        await writeTextFile(getFullPath(newPath), text);
      } else {
        await copyDirectory(id, newPath);
      }
      await loadTree();
    },
    [copyDirectory, getDuplicateName, getFullPath, loadTree, treeItems],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const node = findNodeById(treeItems, id);
      if (!node) return;
      const parentId = getParentIdForNode(treeItems, id);
      const parentDir = parentId ?? "";

      await remove(getFullPath(id), { recursive: true });
      const order = await readOrder(parentDir);
      if (order) {
        await writeOrder(parentDir, order.filter((name) => name !== node.name));
      }

      const currentActive = activePathRef.current;
      if (currentActive === id || currentActive.startsWith(`${id}/`)) {
        setActivePath("Untitled.md");
        setContent(defaultMarkdown);
      }

      await loadTree();
    },
    [getFullPath, loadTree, readOrder, treeItems, writeOrder],
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const updateOrderForParent = useCallback(
    async (parentId: string | null, items: FileNode[]) => {
      const relativeDir = parentId ?? "";
      const children = getChildrenForParent(items, parentId);
      const names = children.map((child) => child.name);
      await writeOrder(relativeDir, names);
    },
    [writeOrder],
  );

  const moveItemToParent = useCallback(
    async (id: string, newParentId: string | null) => {
      const item = findNodeById(treeItems, id);
      if (!item) return;
      const oldPath = id;
      const newPath = newParentId ? `${newParentId}/${item.name}` : item.name;
      if (oldPath === newPath) return;

      await rename(getFullPath(oldPath), getFullPath(newPath));

      const currentActive = activePathRef.current;
      if (currentActive === oldPath) {
        setActivePath(newPath);
      } else if (currentActive.startsWith(`${oldPath}/`)) {
        setActivePath(currentActive.replace(oldPath, newPath));
      }
    },
    [getFullPath, treeItems],
  );

  const handleTreeChange = useCallback(
    async (items: FileNode[], result: { activeId: string; parentId: string | null }) => {
      const previousParentId = getParentIdForNode(treeItems, result.activeId);
      setTreeItems(items);

      try {
        if (previousParentId !== result.parentId) {
          await moveItemToParent(result.activeId, result.parentId);
        }
        await updateOrderForParent(previousParentId, items);
        if (previousParentId !== result.parentId) {
          await updateOrderForParent(result.parentId, items);
        }
        await loadTree();
      } catch (err) {
        console.error("Failed to apply tree change:", err);
        await loadTree();
      }
    },
    [loadTree, moveItemToParent, treeItems, updateOrderForParent],
  );

  const displayName = getBaseName(activePath);

  const sideWidth = sidebarHidden ? 0 : sidebarWidth;

  // Grid layout like yaak Workspace
  const gridStyle = useMemo(
    () => ({
      gridTemplate: `
        'head head head' auto
        'side drag body' minmax(0,1fr)
        / ${sideWidth}px 0 1fr`,
    }),
    [sideWidth],
  );

  return (
    <div
      style={gridStyle}
      className={`grid w-full h-screen bg-surface text-text overflow-hidden ${!isResizing ? 'transition-[grid-template]' : ''}`}
    >
      <HeaderSize size="lg" className="x-theme-appHeader bg-[var(--appHeaderSurface)]" style={{ gridArea: 'head' }}>
        <WorkspaceHeader
          sidebarHidden={sidebarHidden}
          onToggleSidebar={() => setSidebarHidden(!sidebarHidden)}
          title={displayName}
          isEditingTitle={isEditingName}
          editingTitle={editingFilename}
          onEditingTitleChange={setEditingFilename}
          onTitleClick={() => {
            setEditingFilename(displayName);
            setIsEditingName(true);
          }}
          onTitleBlur={() => renameFile(editingFilename)}
          onTitleKeyDown={(e) => {
            if (e.key === "Enter") renameFile(editingFilename);
            if (e.key === "Escape") setIsEditingName(false);
          }}
        />
      </HeaderSize>

      {/* Sidebar */}
      <aside
        style={{ gridArea: 'side' }}
        className="x-theme-sidebar h-full grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[var(--sidebarSurface)] border-r border-[var(--sidebarBorder)]"
      >
        <div className="w-full pl-3 pr-0.5 pt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center">
          <div className="flex items-center gap-2 text-textSubtle">
            <Search size={14} />
            <input
              type="text"
              className="bg-transparent border-0 outline-none text-[13px] w-full text-text placeholder:text-textSubtlest"
              value={sidebarFilter}
              onChange={(event) => setSidebarFilter(event.target.value)}
              placeholder="Search"
              aria-label="Filter files"
            />
          </div>
          <div className="flex gap-0.5">
            <button
              className="h-7 w-7 flex items-center justify-center rounded text-textSubtle cursor-pointer hover:text-text hover:bg-surfaceHighlight"
              aria-label="New File"
              onClick={createNewFile}
            >
              <SquarePen size={14} className="pointer-events-none" />
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center rounded text-textSubtle cursor-pointer hover:text-text hover:bg-surfaceHighlight"
              aria-label="New Folder"
              onClick={createNewFolder}
            >
              <FolderPlus size={14} className="pointer-events-none" />
            </button>
          </div>
        </div>
        <nav className="pl-2 pr-3 pt-2 pb-2 overflow-auto overflow-x-hidden">
          <SidebarTree
            items={treeItems}
            collapsedIds={collapsedIds}
            activeId={selectedId}
            filterText={sidebarFilter}
            onSelect={(id) => {
              const node = findNodeById(treeItems, id);
              if (!node) return;
              setSelectedId(id);
              if (node.type === "file") {
                openFile(id);
              }
            }}
            onToggleCollapse={toggleCollapse}
            onItemsChange={handleTreeChange}
            onRename={renameItem}
            onDuplicate={duplicateItem}
            onDelete={deleteItem}
          />
        </nav>
        <SettingsMenu version={appVersion} onOpenSettings={openSettings}>
          <button
            className="w-full cursor-pointer px-3 h-9 border-t border-border flex items-center justify-between text-textSubtle outline-none hover:bg-surfaceHighlight focus-visible:bg-surfaceHighlight"
            aria-label="Settings"
          >
            <div className="min-w-0 text-sm grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 cursor-pointer">
              <Settings size={14} className="cursor-pointer" />
              <div className="truncate cursor-pointer">Settings</div>
            </div>
          </button>
        </SettingsMenu>
      </aside>

      {/* Resize Handle */}
      <ResizeHandle
        style={{ gridArea: 'drag' }}
        className="-translate-x-[1px]"
        justify="end"
        side="right"
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
        onResizeMove={handleResizeMove}
        onReset={resetSidebarWidth}
      />

      {/* Main Content */}
      <div style={{ gridArea: 'body' }} className="flex flex-col min-w-0 min-h-0 bg-surface">
        <div className="flex-1 min-h-0 overflow-auto pl-16 prose">
          {imageSrc ? (
            <div className="flex items-center justify-center h-full p-8">
              <img
                src={imageSrc}
                alt={getBaseName(activePath)}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <MilkdownProvider key={activePath}>
              <MilkdownEditor
                content={content}
                onSave={saveFile}
                onPasteImage={handlePasteImage}
                baseDir={getFullPath(getParentDir(activePath))}
                vaultRoot={dataFolder}
                attachmentLocation={settings.attachmentLocation}
                attachmentSubfolder={settings.attachmentSubfolder}
                attachmentSpecifiedFolder={settings.attachmentSpecifiedFolder}
              />
            </MilkdownProvider>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(getSettings);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  const handleSetupComplete = useCallback((folder: string) => {
    setSettings((prev) => ({ ...prev, dataFolder: folder }));
  }, []);

  if (!settings.dataFolder) {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  return <EditorApp key={settings.dataFolder} dataFolder={settings.dataFolder} />;
}

export default App;
