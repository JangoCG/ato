import { memo, useRef, useEffect, useState } from 'react';
import { IconButton } from './core/IconButton';
import { HStack } from './core/Stacks';

interface Props {
  className?: string;
  sidebarHidden: boolean;
  onToggleSidebar: () => void;
  title: string;
  isEditingTitle: boolean;
  editingTitle: string;
  onEditingTitleChange: (value: string) => void;
  onTitleClick: () => void;
  onTitleBlur: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent) => void;
}

export const WorkspaceHeader = memo(function WorkspaceHeader({
  className,
  sidebarHidden,
  onToggleSidebar,
  title,
  isEditingTitle,
  editingTitle,
  onEditingTitleChange,
  onTitleClick,
  onTitleBlur,
  onTitleKeyDown,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [blurEnabled, setBlurEnabled] = useState(false);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      // Enable blur handling after a short delay to prevent immediate blur
      const timer = setTimeout(() => setBlurEnabled(true), 100);
      return () => clearTimeout(timer);
    } else {
      setBlurEnabled(false);
    }
  }, [isEditingTitle]);

  const classes = [
    className,
    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center w-full h-full',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <HStack space={0.5} className="flex-1 pointer-events-none">
        <HStack className="h-full">
          <IconButton
            onClick={onToggleSidebar}
            className="pointer-events-auto"
            iconSize="lg"
            title="Toggle sidebar"
            icon={sidebarHidden ? 'left_panel_hidden' : 'left_panel_visible'}
            iconColor="secondary"
          />
        </HStack>
      </HStack>
      <div className="pointer-events-none w-full max-w-[30vw] mx-auto flex justify-center">
        <div className="relative pointer-events-auto">
          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              className="bg-transparent text-text text-[13px] px-2 py-1 rounded text-center font-medium outline-none border border-border select-text selection:bg-[#b4d5fe] selection:text-text"
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onKeyDown={onTitleKeyDown}
              onBlur={() => {
                if (blurEnabled) onTitleBlur();
              }}
            />
          ) : (
            <button
              type="button"
              data-tauri-drag-region="false"
              className="text-[13px] text-text-subtle px-2 py-1 rounded cursor-pointer font-medium hover:bg-surface-highlight hover:text-text"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTitleClick();
              }}
            >
              {title}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
});
