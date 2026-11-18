import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Generate a stable short id (cuid-style prefix + counter). */
export function shortId(prefix = "n"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
