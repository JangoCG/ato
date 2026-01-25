import type { HTMLAttributes, ReactNode, ForwardedRef } from 'react';
import { forwardRef } from 'react';

const gapClasses = {
  0: 'gap-0',
  0.5: 'gap-0.5',
  1: 'gap-1',
  1.5: 'gap-1.5',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
};

interface HStackProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  space?: keyof typeof gapClasses;
  alignItems?: 'start' | 'center' | 'stretch' | 'end';
  justifyContent?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
}

export const HStack = forwardRef(function HStack(
  { className, space, children, alignItems = 'center', justifyContent, wrap, ...props }: HStackProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const classes = [
    className,
    'flex flex-row',
    space != null && gapClasses[space],
    alignItems === 'center' && 'items-center',
    alignItems === 'start' && 'items-start',
    alignItems === 'stretch' && 'items-stretch',
    alignItems === 'end' && 'items-end',
    justifyContent === 'start' && 'justify-start',
    justifyContent === 'center' && 'justify-center',
    justifyContent === 'end' && 'justify-end',
    justifyContent === 'between' && 'justify-between',
    wrap && 'flex-wrap',
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} {...props}>
      {children}
    </div>
  );
});

interface VStackProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  space?: keyof typeof gapClasses;
  alignItems?: 'start' | 'center' | 'stretch' | 'end';
  justifyContent?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
}

export const VStack = forwardRef(function VStack(
  { className, space, children, alignItems, justifyContent, wrap, ...props }: VStackProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const classes = [
    className,
    'flex flex-col',
    space != null && gapClasses[space],
    alignItems === 'center' && 'items-center',
    alignItems === 'start' && 'items-start',
    alignItems === 'stretch' && 'items-stretch',
    alignItems === 'end' && 'items-end',
    justifyContent === 'start' && 'justify-start',
    justifyContent === 'center' && 'justify-center',
    justifyContent === 'end' && 'justify-end',
    justifyContent === 'between' && 'justify-between',
    wrap && 'flex-wrap',
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} {...props}>
      {children}
    </div>
  );
});
