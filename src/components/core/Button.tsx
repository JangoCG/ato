import classNames from 'classnames';
import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef, useRef } from 'react';

export type Color =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'notice'
  | 'warning'
  | 'danger';

export type ButtonProps = Omit<HTMLAttributes<HTMLButtonElement>, 'color' | 'onChange'> & {
  innerClassName?: string;
  color?: Color | 'custom';
  variant?: 'border' | 'solid';
  isLoading?: boolean;
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'auto';
  justify?: 'start' | 'center';
  type?: 'button' | 'submit';
  forDropdown?: boolean;
  disabled?: boolean;
  title?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    isLoading,
    className,
    innerClassName,
    children,
    forDropdown,
    color = 'default',
    type = 'button',
    justify = 'center',
    size = 'md',
    variant = 'solid',
    leftSlot,
    rightSlot,
    disabled,
    title,
    onClick,
    ...props
  }: ButtonProps,
  ref,
) {
  if (isLoading) {
    disabled = true;
  }

  const classes = classNames(
    className,
    'x-theme-button',
    `x-theme-button--${variant}`,
    `x-theme-button--${variant}--${color}`,
    'border', // They all have borders to ensure the same width
    'max-w-full min-w-0', // Help with truncation
    'hocus:opacity-100', // Force opacity for certain hover effects
    'whitespace-nowrap outline-none',
    'flex-shrink-0 flex items-center',
    'outline-0',
    disabled ? 'pointer-events-none opacity-disabled' : 'pointer-events-auto',
    justify === 'start' && 'justify-start',
    justify === 'center' && 'justify-center',
    size === 'md' && 'h-md px-3 rounded-md',
    size === 'sm' && 'h-sm px-2.5 rounded-md',
    size === 'xs' && 'h-xs px-2 text-sm rounded-md',
    size === '2xs' && 'h-2xs px-2 text-xs rounded',

    // Solids
    variant === 'solid' && 'border-transparent',
    variant === 'solid' && color === 'custom' && 'focus-visible:outline-2 outline-border-focus',
    variant === 'solid' &&
      color !== 'custom' &&
      'text-text enabled:hocus:text-text enabled:hocus:bg-surface-highlight outline-border-subtle',
    variant === 'solid' && color !== 'custom' && color !== 'default' && 'bg-surface',

    // Borders
    variant === 'border' && 'border',
    variant === 'border' &&
      color !== 'custom' &&
      'border-border-subtle text-text-subtle enabled:hocus:border-border ' +
        'enabled:hocus:bg-surface-highlight enabled:hocus:text-text outline-border-subtler',
  );

  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref || buttonRef}
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      onDoubleClick={(e) => {
        // Kind of a hack? This prevents double-clicks from going through buttons. For example, when
        // double-clicking the workspace header to toggle window maximization
        e.stopPropagation();
      }}
      title={title}
      {...props}
    >
      {leftSlot ? <div className="mr-2">{leftSlot}</div> : null}
      <div
        className={classNames(
          'truncate w-full',
          justify === 'start' ? 'text-left' : 'text-center',
          innerClassName,
        )}
      >
        {children}
      </div>
      {rightSlot && <div className="ml-1">{rightSlot}</div>}
    </button>
  );
});
