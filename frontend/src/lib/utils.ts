import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/**
 * Turns a stored upload path ("uploads/logo-123.png") into a URL the browser
 * can load. Absolute URLs are passed through untouched.
 */
export function getUploadUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = API_BASE_URL.replace("/api/v1", "");
  return `${host}/${path.replace(/^\/+/, "")}`;
}
