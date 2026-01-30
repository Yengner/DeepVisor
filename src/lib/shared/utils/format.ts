import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const parseStringify = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value))

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
