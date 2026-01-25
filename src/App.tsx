import { useState, useEffect, useCallback, useRef } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, parserCtx, editorViewCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Slice } from "@milkdown/prose/model";
import { File, FolderPlus, Search, Settings } from "lucide-react";
import { writeTextFile, readTextFile, readDir, mkdir, exists, rename, remove } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { SidebarTree } from "./SidebarTree";
import { HeaderSize } from "./components/HeaderSize";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { SettingsMenu } from "./components/SettingsMenu";
import { SetupScreen } from "./components/SetupScreen";
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

function MilkdownEditor({ content, onSave }: { content: string; onSave: (markdown: string) => void }) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const contentRef = useRef(content);
  contentRef.current = content;

  const didFocusRef = useRef(false);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, contentRef.current);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          handlePaste: (view, event) => {
            if (prev.handlePaste?.(view, event, Slice.empty)) return true;
            const { clipboardData } = event;
            if (!clipboardData) return false;

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

function EditorApp({ dataFolder }: { dataFolder: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePath, setActivePath] = useState("Untitled.md");
  const [editingFilename, setEditingFilename] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [treeItems, setTreeItems] = useState<FileNode[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState(defaultMarkdown);
  const [settings, setSettings] = useState(getSettings);
  const [appVersion, setAppVersion] = useState("0.0.0");
  const openSettings = useCallback(async () => {
    try {
      await invoke("open_settings_window");
    } catch (err) {
      console.error("Failed to open settings window:", err);
    }
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
          nodes.push({
            id,
            name,
            type: "folder",
            children: await readTree(id),
          });
        } else if (entry.isFile) {
          nodes.push({ id, name, type: "file" });
        }
      }
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
      await rename(getFullPath(activePath), getFullPath(newPath));
      await updateOrderAfterRename(parentDir, currentName, newName);
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
      const text = await readTextFile(getFullPath(path));
      setContent(text);
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

  return (
    <div className="grid grid-rows-[auto_minmax(0,1fr)] h-screen w-full bg-surface text-text overflow-hidden">
      <HeaderSize size="lg" className="x-theme-appHeader bg-[var(--appHeaderSurface)]">
        <WorkspaceHeader
          sidebarHidden={!sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
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

      <div className="grid grid-cols-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
        <aside
          className={`h-full grid grid-rows-[auto_minmax(0,1fr)_auto] min-w-0 flex-shrink-0 overflow-hidden transition-[width] duration-200 bg-[var(--sidebarSurface)] border-r border-[var(--sidebarBorder)] ${
            sidebarOpen ? "w-60" : "w-0"
          }`}
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
                className="h-7 w-7 flex items-center justify-center rounded text-textSubtle hover:text-text hover:bg-surfaceHighlight"
                aria-label="New File"
                onClick={createNewFile}
              >
                <File size={14} />
              </button>
              <button
                className="h-7 w-7 flex items-center justify-center rounded text-textSubtle hover:text-text hover:bg-surfaceHighlight"
                aria-label="New Folder"
                onClick={createNewFolder}
              >
                <FolderPlus size={14} />
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
              className="w-full px-3 h-9 border-t border-border flex items-center justify-between text-textSubtle outline-none hover:bg-surfaceHighlight focus-visible:bg-surfaceHighlight"
              aria-label="Settings"
            >
              <div className="min-w-0 text-sm grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                <Settings size={14} />
                <div className="truncate">Settings</div>
              </div>
            </button>
          </SettingsMenu>
        </aside>

        <div className="flex flex-col min-w-0 min-h-0 bg-surface">
          <div className="flex-1 min-h-0 overflow-auto pl-16 prose">
            <MilkdownProvider key={activePath}>
              <MilkdownEditor content={content} onSave={saveFile} />
            </MilkdownProvider>
          </div>
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
