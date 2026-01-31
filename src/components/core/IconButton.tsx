import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { forwardRef, useCallback } from 'react';
import type { IconProps, IconName } from './Icon';
import { Icon } from './Icon';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  icon: IconName;
  iconClassName?: string;
  iconSize?: IconProps['size'];
  iconColor?: IconProps['color'];
  title: string;
  size?: 'md' | 'sm' | 'xs' | '2xs';
  spin?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    onClick,
    className,
    iconClassName,
    tabIndex,
    size = 'md',
    iconSize,
    iconColor,
    spin,
    type = 'button',
    disabled,
    ...props
  },
  ref,
) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
    },
    [onClick],
  );

  const classes = [
    className,
    'group/button relative flex-shrink-0 cursor-pointer',
    'flex items-center justify-center',
    'border border-transparent',
    'outline-none',
    'text-text-subtle',
    'hocus:text-text hocus:bg-surface-highlight hocus:border-border',
    'rounded-md',
    disabled && 'pointer-events-none opacity-disabled',
    size === 'md' && 'h-md w-md',
    size === 'sm' && 'h-sm w-sm',
    size === 'xs' && 'h-xs w-xs',
    size === '2xs' && 'h-5 w-5',
  ].filter(Boolean).join(' ');

  const iconClasses = [
    iconClassName,
    'group-hover/button:text-text',
    disabled && 'opacity-70',
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      aria-hidden={icon === 'empty'}
      disabled={disabled || icon === 'empty'}
      tabIndex={(tabIndex ?? icon === 'empty') ? -1 : undefined}
      onClick={handleClick}
      type={type}
      className={classes}
      {...props}
    >
      <Icon
        size={iconSize}
        icon={icon}
        spin={spin}
        color={iconColor}
        className={iconClasses}
      />
    </button>
  );
});
