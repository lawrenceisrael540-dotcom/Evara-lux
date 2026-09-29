import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a minor-unit amount (e.g. kobo, cents) as a localized currency string. */
export function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)
}
