// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
// Generic utilities

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uppercase(str: string) {
  return str.toUpperCase();
}

/**
 * Generates a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise falls back to a custom implementation
 */
export function generateUUID(): string {
  // Use the native crypto.randomUUID if available
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Secure fallback using crypto.getRandomValues (if available)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version 4 (UUIDv4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant 10xxxxxx
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));

    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  // Last resort (non-crypto): Math.random UUIDv4-like
  // Good enough for local IDs; not for security.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isDOMElement(el: any): el is HTMLElement {
  return !!el && (el instanceof Element || el instanceof HTMLElement);
}

export function isTypableElement(el: HTMLElement): boolean {
  // If content editable, then it is editable
  if (el.isContentEditable) return true;

  // If element is an input and the input is enabled, then it is typable
  if (el.tagName === "INPUT") {
    return !(el as HTMLInputElement).disabled;
  }
  // If element is a textarea and the input is enabled, then it is typable
  if (el.tagName === "TEXTAREA") {
    return !(el as HTMLTextAreaElement).disabled;
  }

  return false;
}
export function isAppleDevice() {
  return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
}

export function getPlatformSpecialKey() {
  return isAppleDevice() ? "⌘" : "Ctrl";
}

export function getPlatformAlternateKey() {
  return isAppleDevice() ? "⌥" : "Alt";
}

/**
 * 将火山方舟 API URL 转换为代理路径，解决 CORS 问题
 * @param url 原始 API URL
 * @returns 转换后的 URL（使用代理路径，通过 Cloudflare Worker 或 Vite 代理）
 */
export function getProxiedApiUrl(url: string): string {
  // 如果是火山方舟 API，使用代理路径
  if (url.includes('ark.cn-beijing.volces.com') || url.includes('ark.volces.com')) {
    try {
      const urlObj = new URL(url);
      // 将 https://ark.cn-beijing.volces.com/api/v3/models 转换为 /api/volcano/api/v3/models
      // 在开发环境通过 Vite 代理，在生产环境通过 Cloudflare Worker 代理
      return `/api/volcano${urlObj.pathname}${urlObj.search}`;
    } catch (e) {
      console.warn('[getProxiedApiUrl] Failed to parse URL:', url, e);
      return url;
    }
  }
  
  return url;
}
