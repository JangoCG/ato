export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export type FlattenedItem = FileNode & {
  parentId: string | null;
  depth: number;
  index: number;
};

export function flattenTree(
  items: FileNode[],
  parentId: string | null = null,
  depth = 0,
): FlattenedItem[] {
  return items.flatMap((item, index) => {
    const flattened: FlattenedItem = {
      ...item,
      parentId,
      depth,
      index,
    };
    const children = item.children ?? [];
    return [flattened, ...flattenTree(children, item.id, depth + 1)];
  });
}

export function buildTree(flattenedItems: FlattenedItem[]): FileNode[] {
  const root: FileNode[] = [];
  const nodes = new Map<string, FileNode>();

  for (const item of flattenedItems) {
    nodes.set(item.id, { id: item.id, name: item.name, type: item.type, children: [] });
  }

  for (const item of flattenedItems) {
    const node = nodes.get(item.id);
    if (!node) continue;
    if (item.parentId == null) {
      root.push(node);
    } else {
      const parent = nodes.get(item.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      }
    }
  }

  const sortByIndex = (items: FileNode[], parentId: string | null) => {
    items.sort((a, b) => {
      const aItem = flattenedItems.find((i) => i.id === a.id && i.parentId === parentId);
      const bItem = flattenedItems.find((i) => i.id === b.id && i.parentId === parentId);
      return (aItem?.index ?? 0) - (bItem?.index ?? 0);
    });
    for (const item of items) {
      if (item.children) {
        sortByIndex(item.children, item.id);
      }
    }
  };

  sortByIndex(root, null);
  return root;
}

export function removeChildrenOf(
  items: FlattenedItem[],
  collapsedIds: Set<string>,
): FlattenedItem[] {
  const collapsed = new Set(collapsedIds);
  return items.filter((item) => {
    if (!item.parentId) return true;
    let parentId: string | null = item.parentId;
    while (parentId) {
      if (collapsed.has(parentId)) return false;
      const parent = items.find((i) => i.id === parentId);
      parentId = parent?.parentId ?? null;
    }
    return true;
  });
}

function getParentIdForDepth(
  items: FlattenedItem[],
  index: number,
  depth: number,
): string | null {
  if (depth === 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.depth === depth - 1) {
      return item.type === "folder" ? item.id : item.parentId;
    }
  }
  return null;
}

export function getProjection(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  offsetLeft: number,
  indentationWidth: number,
): { depth: number; parentId: string | null } | null {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1) return null;

  const activeItem = items[activeIndex];
  const newItems = [...items];
  newItems.splice(activeIndex, 1);
  newItems.splice(overIndex, 0, activeItem);

  const previousItem = newItems[overIndex - 1];
  const nextItem = newItems[overIndex + 1];

  const dragDepth = Math.round(offsetLeft / indentationWidth);
  let projectedDepth = activeItem.depth + dragDepth;

  const maxDepth = previousItem
    ? previousItem.depth + (previousItem.type === "folder" ? 1 : 0)
    : 0;
  const minDepth = nextItem ? nextItem.depth : 0;

  projectedDepth = Math.min(Math.max(projectedDepth, minDepth), maxDepth);

  const parentId = getParentIdForDepth(newItems, overIndex, projectedDepth);
  return { depth: projectedDepth, parentId };
}

export function findNodeById(items: FileNode[], id: string): FileNode | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findNodeById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getChildrenForParent(items: FileNode[], parentId: string | null): FileNode[] {
  if (parentId == null) return items;
  const parent = findNodeById(items, parentId);
  return parent?.children ?? [];
}

export function getParentIdForNode(
  items: FileNode[],
  id: string,
  parentId: string | null = null,
): string | null {
  for (const item of items) {
    if (item.id === id) return parentId;
    if (item.children) {
      const found = getParentIdForNode(item.children, id, item.id);
      if (found !== null) return found;
    }
  }
  return null;
}

export function filterTree(items: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return items;
  const lower = query.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(lower);

  const filterNodes = (nodes: FileNode[]): FileNode[] => {
    const result: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === "folder") {
        const filteredChildren = filterNodes(node.children ?? []);
        if (matches(node.name) || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      } else if (matches(node.name)) {
        result.push(node);
      }
    }
    return result;
  };

  return filterNodes(items);
}
