import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Copy, FileText, FolderClosed, FolderOpen, Pencil, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useMemo, useState } from "react";
import type { FileNode } from "./treeUtils";
import {
  filterTree,
  flattenTree,
  removeChildrenOf,
} from "./treeUtils";
import { ContextMenu } from "./components/ContextMenu";

const INDENTATION_WIDTH = 16;

// Get display name without .md extension for markdown files
const getDisplayName = (name: string, type: "file" | "folder"): string => {
  if (type === "file" && name.toLowerCase().endsWith(".md")) {
    return name.slice(0, -3);
  }
  return name;
};

type DragResult = {
  activeId: string;
  overId: string;
  parentId: string | null;
  index: number;
  items: FileNode[];
};

type SidebarTreeProps = {
  items: FileNode[];
  collapsedIds: Set<string>;
  activeId: string | null;
  filterText: string;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onItemsChange: (items: FileNode[], result: DragResult) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

type TreeRowProps = {
  item: FileNode;
  depth: number;
  isCollapsed: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isDragOver: boolean;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

function RootDropArea({ activeDragId, isOverRoot, children }: { activeDragId: string | null; isOverRoot: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: "drop-root",
    data: { isRoot: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-col gap-1 pr-2 min-h-[50px]",
        activeDragId && isOverRoot ? "bg-[#b4d5fe]/30 rounded" : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function TreeRow({
  item,
  depth,
  isCollapsed,
  isSelected,
  isEditing,
  isDragOver,
  onToggleCollapse,
  onSelect,
  onRename,
  onRenameCancel,
  onContextMenu,
}: TreeRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: item.id, disabled: isEditing });

  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: `drop-${item.id}`,
    disabled: item.type !== "folder",
    data: { item },
  });

  const style = {
    paddingLeft: 12 + depth * INDENTATION_WIDTH,
  };

  const showDropHighlight = item.type === "folder" && (isDragOver || isOver);

  const rowClassName = [
    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] select-none",
    "text-textSubtle cursor-default",
    "hover:bg-surface-highlight hover:text-text",
    "data-[context-menu-open=true]:bg-surface-highlight data-[context-menu-open=true]:text-text",
    isSelected ? "bg-surface-active text-text" : "",
    isDragging ? "opacity-50" : "",
    showDropHighlight ? "bg-[#b4d5fe] text-text" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={style}
      className={rowClassName}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(item.id)}
      onContextMenu={onContextMenu}
    >
      {item.type === "folder" ? (
        <button
          className="w-[18px] h-[18px] flex-shrink-0 border-none bg-transparent text-inherit inline-flex items-center justify-center cursor-default"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(item.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      ) : (
        <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex" />
      )}
      <span className="inline-flex items-center text-text-subtlest">
        {item.type === "folder" ? (
          isCollapsed ? <FolderClosed size={16} /> : <FolderOpen size={16} />
        ) : (
          <FileText size={16} />
        )}
      </span>
      {isEditing ? (
        <input
          className="bg-surface border border-border text-text rounded px-1.5 py-0.5 text-[13px] w-full outline-none select-text selection:bg-[#b4d5fe] selection:text-text"
          defaultValue={getDisplayName(item.name, item.type)}
          autoFocus
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => onRename(item.id, event.currentTarget.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              onRename(item.id, event.currentTarget.value);
            }
            if (event.key === "Escape") {
              onRenameCancel();
            }
          }}
        />
      ) : (
        <span className="truncate">{getDisplayName(item.name, item.type)}</span>
      )}
    </div>
  );
}

export function SidebarTree({
  items,
  collapsedIds,
  activeId,
  filterText,
  onSelect,
  onToggleCollapse,
  onItemsChange,
  onRename,
  onDuplicate,
  onDelete,
}: SidebarTreeProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);
  const hasFilter = filterText.trim().length > 0;
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    position: { x: number; y: number };
    target: HTMLDivElement;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => filterTree(items, filterText), [items, filterText]);
  const flattened = useMemo(() => flattenTree(filtered), [filtered]);
  const visibleItems = useMemo(
    () => (hasFilter ? flattened : removeChildrenOf(flattened, collapsedIds)),
    [collapsedIds, flattened, hasFilter],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => {
        if (hasFilter) return;
        setActiveDragId(String(event.active.id));
      }}
      onDragOver={(event) => {
        const { over } = event;
        if (!over) {
          setOverFolderId(null);
          return;
        }

        const overId = String(over.id);
        if (overId === "drop-root") {
          setOverFolderId("root");
        } else if (overId.startsWith("drop-")) {
          const folderId = overId.replace("drop-", "");
          setOverFolderId(folderId);
        } else {
          setOverFolderId(null);
        }
      }}
      onDragEnd={(event) => {
        const { active, over } = event;
        setActiveDragId(null);
        setOverFolderId(null);

        if (hasFilter) return;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        // Check if dropping on a valid target
        if (!overId.startsWith("drop-")) return;

        const isRoot = overId === "drop-root";
        const targetFolderId = isRoot ? null : overId.replace("drop-", "");

        // Don't allow dropping on self or into own children
        if (activeId === targetFolderId) return;
        if (targetFolderId && targetFolderId.startsWith(activeId + "/")) return;

        // Find the active item to get its current parent
        const activeItem = visibleItems.find((item) => item.id === activeId);
        if (!activeItem) return;

        // Don't do anything if already in that folder (or already at root)
        const currentParentId = activeItem.parentId ?? null;
        if (currentParentId === targetFolderId) return;

        onItemsChange(items, {
          activeId,
          overId: targetFolderId ?? "",
          parentId: targetFolderId,
          index: 0,
          items,
        });
      }}
      onDragCancel={() => {
        setActiveDragId(null);
        setOverFolderId(null);
      }}
    >
      <RootDropArea activeDragId={activeDragId} isOverRoot={overFolderId === "root"}>
        {visibleItems.map((item) => (
          <TreeRow
            key={item.id}
            item={item}
            depth={item.depth}
            isCollapsed={collapsedIds.has(item.id)}
            isSelected={activeId === item.id}
            isEditing={editingId === item.id}
            isDragOver={overFolderId === item.id}
            onToggleCollapse={onToggleCollapse}
            onSelect={onSelect}
            onRename={(id, name) => {
              setEditingId(null);
              onRename(id, name);
            }}
            onRenameCancel={() => setEditingId(null)}
            onContextMenu={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onSelect(item.id);
              const target = event.currentTarget;
              target.setAttribute("data-context-menu-open", "true");
              setContextMenu((prev) => {
                if (prev?.target && prev.target !== target) {
                  prev.target.removeAttribute("data-context-menu-open");
                }
                return {
                  id: item.id,
                  position: { x: event.clientX ?? 100, y: event.clientY ?? 100 },
                  target,
                };
              });
            }}
          />
        ))}
      </RootDropArea>
      <ContextMenu
        triggerPosition={contextMenu?.position ?? null}
        onClose={() => {
          if (contextMenu?.target) {
            contextMenu.target.removeAttribute("data-context-menu-open");
          }
          setContextMenu(null);
        }}
        items={
          contextMenu
            ? [
                {
                  label: "Rename",
                  icon: <Pencil size={14} />,
                  onSelect: () => setEditingId(contextMenu.id),
                },
                {
                  label: "Duplicate",
                  icon: <Copy size={14} />,
                  onSelect: () => onDuplicate(contextMenu.id),
                },
                {
                  label: "Delete",
                  tone: "danger",
                  icon: <Trash2 size={14} />,
                  onSelect: () => onDelete(contextMenu.id),
                },
              ]
            : []
        }
      />
      <DragOverlay>
        {activeDragId ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] bg-surfaceHighlight text-text shadow-lg">
            <span className="inline-flex items-center text-textSubtlest">
              {visibleItems.find((item) => item.id === activeDragId)?.type === "folder" ? (
                collapsedIds.has(activeDragId) ? <FolderClosed size={16} /> : <FolderOpen size={16} />
              ) : (
                <FileText size={16} />
              )}
            </span>
            <span className="truncate">
              {visibleItems.find((item) => item.id === activeDragId)?.name ?? ""}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
