import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
} from 'lucide-react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { memo } from 'react';

const icons = {
  left_panel_hidden: PanelLeftOpenIcon,
  left_panel_visible: PanelLeftCloseIcon,
  settings: SettingsIcon,
  empty: (props: HTMLAttributes<HTMLSpanElement>) => <div {...props} />,
};

export type IconName = keyof typeof icons;

export interface IconProps {
  icon: IconName;
  className?: string;
  style?: CSSProperties;
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  spin?: boolean;
  title?: string;
  color?: 'default' | 'secondary' | 'primary' | 'danger' | 'success' | 'info' | 'warning' | 'notice';
}

export const Icon = memo(function Icon({
  icon,
  color = 'default',
  spin,
  size = 'md',
  style,
  className,
  title,
}: IconProps) {
  const Component = icons[icon] ?? icons.empty;
  const classes = [
    className,
    !spin && 'transform-gpu',
    spin && 'animate-spin',
    'flex-shrink-0',
    size === 'xl' && 'h-6 w-6',
    size === 'lg' && 'h-5 w-5',
    size === 'md' && 'h-4 w-4',
    size === 'sm' && 'h-3.5 w-3.5',
    size === 'xs' && 'h-3 w-3',
    size === '2xs' && 'h-2.5 w-2.5',
    color === 'default' && 'inherit',
    color === 'danger' && 'text-danger',
    color === 'warning' && 'text-warning',
    color === 'notice' && 'text-notice',
    color === 'info' && 'text-info',
    color === 'success' && 'text-success',
    color === 'primary' && 'text-primary',
    color === 'secondary' && 'text-secondary',
  ].filter(Boolean).join(' ');

  return (
    <Component
      style={style}
      title={title}
      className={classes}
    />
  );
});
