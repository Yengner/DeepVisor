'use client';
import type { ReactNode } from 'react';
import classes from './RangeSwitch.module.css';

/**
 * One pill switch for every time range (and other small either/or choices) across Overview,
 * Campaigns and Reports, so the same control looks and reads the same everywhere.
 */
export type SwitchOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** On phones, show only the icon; the label stays as the accessible name. */
  iconOnlyOnPhone?: boolean;
  title?: string;
  disabled?: boolean;
};

export default function RangeSwitch<T extends string>({ label, value, options, onChange, pending = false, className }: {
  label: string;
  value: T | undefined;
  options: ReadonlyArray<SwitchOption<T>>;
  onChange: (value: T) => void;
  pending?: boolean;
  className?: string;
}) {
  return (
    <div className={`${classes.switch} ${className ?? ''}`} role="group" aria-label={label} aria-busy={pending || undefined}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-label={option.iconOnlyOnPhone ? option.label : undefined}
          title={option.title}
          disabled={option.disabled}
          data-compact={option.iconOnlyOnPhone || undefined}
          onClick={() => { if (!pending && option.value !== value) onChange(option.value); }}
        >
          {option.icon}
          <span className={classes.text}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
