import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Settings,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useClickOutside } from "../hooks/useClickOutside";

const MENU_WIDTH = 260;

type MenuItem =
  | {
    type: "item";
    label: string;
    icon: JSX.Element;
    rightSlot?: JSX.Element;
    onSelect?: () => void;
    accent?: "success";
  }
  | {
    type: "separator";
    label: string;
  };

type SettingsMenuProps = {
  version: string;
  onOpenSettings?: () => void;
  children?: React.ReactNode;
};

export function SettingsMenu({ version, onOpenSettings, children }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(menuRef, () => setIsOpen(false), buttonRef);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const items = useMemo<MenuItem[]>(() => {
    return [
      {
        type: "item",
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
        onSelect: onOpenSettings,
      },
      {
        type: "separator",
        label: `Editor v${version}`,
      },
      {
        type: "item",
        label: "Check for Updates",
        icon: <RefreshCw className="h-4 w-4" />,
      },
      {
        type: "item",
        label: "Feedback",
        icon: <MessageSquare className="h-4 w-4" />,
        rightSlot: <ExternalLink className="h-4 w-4" />,
        onSelect: () => openUrl("https://ato.featurebase.app/"),
      },
    ];
  }, [version]);

  const menuStyle = useMemo(() => {
    if (!isOpen || !buttonRef.current) return null;
    // With display:contents, we need to get rect from first child element
    const element = buttonRef.current.firstElementChild as HTMLElement | null;
    const rect = element?.getBoundingClientRect() ?? buttonRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    // If button is in lower half of screen, open menu upward
    const openUpward = rect.bottom > window.innerHeight / 2;
    if (openUpward) {
      return {
        bottom: `${window.innerHeight - rect.top + 1}px`,
        left: `${left}px`,
        width: `${MENU_WIDTH}px`,
      };
    }
    return {
      top: `${rect.bottom + 1}px`,
      left: `${left}px`,
      width: `${MENU_WIDTH}px`,
    };
  }, [isOpen]);

  const handleSelect = (item: MenuItem) => {
    if (item.type !== "item") return;
    item.onSelect?.();
    setIsOpen(false);
  };

  const defaultButton = (
    <button
      className={
        "h-8 w-8 flex items-center justify-center rounded-md border border-transparent text-text-subtle " +
        "hover:text-text hover:bg-surface-highlight hover:border-border"
      }
      aria-label="Settings"
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  return (
    <>
      <div
        ref={buttonRef as React.RefObject<HTMLDivElement>}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ display: 'contents' }}
      >
        {children ?? defaultButton}
      </div>
      {isOpen && menuStyle
        ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 select-none x-theme-menu"
            style={menuStyle}
            role="menu"
          >
            <div className="rounded-md border border-border-subtle bg-surface shadow-lg py-1.5">
              {items.map((item, index) => {
                if (item.type === "separator") {
                  return (
                    <div key={`sep-${index}`} className="mt-1 border-t border-border-subtle px-3 py-2">
                      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-text-subtlest">
                        {item.label}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.label}
                    className={
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-text " +
                      "hover:bg-surface-highlight"
                    }
                    onClick={() => handleSelect(item)}
                    role="menuitem"
                  >
                    <span className="text-text-subtle">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.rightSlot ? <span className="text-text-subtlest">{item.rightSlot}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
