import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "../hooks/useClickOutside";

export type ContextMenuItem = {
  label: string;
  icon?: ReactNode;
  tone?: "danger";
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

type ContextMenuProps = {
  triggerPosition: { x: number; y: number } | null;
  items: ContextMenuItem[];
  onClose: () => void;
  className?: string;
};

export function ContextMenu({ triggerPosition, items, onClose, className }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(menuRef, onClose);

  useEffect(() => {
    if (!triggerPosition) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, triggerPosition]);

  const styles = useMemo<{
    container: CSSProperties;
    menu: CSSProperties;
  }>(() => {
    if (triggerPosition == null) return { container: {}, menu: {} };

    const triggerShape = {
      top: triggerPosition.y,
      bottom: triggerPosition.y,
      left: triggerPosition.x,
      right: triggerPosition.x,
    };

    const menuMarginY = 5;
    const docRect = document.documentElement.getBoundingClientRect();
    const heightAbove = triggerShape.top;
    const heightBelow = docRect.height - triggerShape.bottom;
    const horizontalSpaceRemaining = docRect.width - triggerShape.left;
    const top = triggerShape.bottom;
    const onRight = horizontalSpaceRemaining < 300;
    const upsideDown = heightBelow < heightAbove && heightBelow < items.length * 25 + 20 + 200;

    return {
      container: {
        top: !upsideDown ? top + menuMarginY : undefined,
        bottom: upsideDown
          ? docRect.height - top - (triggerShape.top - triggerShape.bottom) + menuMarginY
          : undefined,
        right: onRight ? docRect.width - triggerShape.right : undefined,
        left: !onRight ? triggerShape.left : undefined,
        maxWidth: "40rem",
      },
      menu: {
        maxHeight: `${(upsideDown ? heightAbove : heightBelow) - 15}px`,
      },
    };
  }, [items.length, triggerPosition]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  if (!triggerPosition) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`x-theme-menu outline-none my-1 pointer-events-auto z-40 fixed ${className ?? ""}`}
      style={styles.container}
      role="menu"
      onContextMenu={handleContextMenu}
    >
      <div
        className="h-auto bg-surface rounded-md shadow-lg py-1.5 border border-border-subtle overflow-y-auto overflow-x-hidden mx-0.5"
        style={styles.menu}
      >
        {items.map((item) => (
          <button
            key={item.label}
            className={[
              "w-full h-xs min-w-[8rem] outline-none px-2 mx-1.5",
              "flex items-center gap-2 whitespace-nowrap rounded text-sm",
              "hover:bg-surface-highlight focus:bg-surface-highlight",
              "focus:text focus:outline-none focus-visible:outline-1",
              item.tone === "danger" ? "text-danger" : "text-text",
              item.disabled ? "opacity-disabled cursor-not-allowed" : "cursor-default",
            ].join(" ")}
            onClick={async () => {
              if (item.disabled) return;
              await item.onSelect();
              onClose();
            }}
            role="menuitem"
            disabled={item.disabled}
          >
            {item.icon && (
              <span className="text-text-subtle [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>
            )}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
