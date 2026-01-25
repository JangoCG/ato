import { type } from '@tauri-apps/plugin-os';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useMemo } from 'react';
import { getSettings } from '../lib/settings';

const HEADER_SIZE_MD = '27px';
const HEADER_SIZE_LG = '40px';

interface HeaderSizeProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  size: 'md' | 'lg';
}

export function HeaderSize({
  className,
  style,
  size,
  children,
}: HeaderSizeProps) {
  const settings = getSettings();
  const nativeTitlebar = settings.useNativeTitlebar;

  const finalStyle = useMemo<CSSProperties>(() => {
    const s = { ...style };

    if (size === 'md') s.minHeight = HEADER_SIZE_MD;
    if (size === 'lg') s.minHeight = HEADER_SIZE_LG;

    if (!nativeTitlebar && type() === 'macos') {
      // Add padding for window controls on macOS (traffic lights ~68px + 16px gap)
      s.paddingLeft = 100;
    }

    return s;
  }, [size, style, nativeTitlebar]);

  const classes = [
    className,
    'pt-[1px]',
    'select-none relative',
    'w-full border-b border-border-subtle min-w-0',
  ].filter(Boolean).join(' ');

  return (
    <div
      data-tauri-drag-region
      style={finalStyle}
      className={classes}
    >
      <div className="pointer-events-none h-full w-full overflow-x-auto grid px-1">
        {children}
      </div>
    </div>
  );
}
