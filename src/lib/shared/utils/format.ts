import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const parseStringify = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value))

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
