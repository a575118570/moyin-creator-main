// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { fileStorage } from "@/lib/indexed-db-storage";
import { generateUUID } from "@/lib/utils";

export type RenderLogLevel = "info" | "success" | "error";
export type RenderLogSource = "director" | "script" | "export";
export type RenderLogKind = "image" | "video" | "endFrame" | "materials";

export interface RenderLogEntry {
  id: string;
  projectId: string;
  ts: number;
  level: RenderLogLevel;
  source: RenderLogSource;
  kind: RenderLogKind;
  entityId?: string; // shotId or sceneId
  label?: string; // e.g. "分镜 003"
  status?: string; // e.g. generating/completed/failed
  message: string;
  error?: string;
  url?: string;
}

interface RenderLogStoreState {
  logsByProjectId: Record<string, RenderLogEntry[]>;
}

interface RenderLogStoreActions {
  append: (projectId: string, entry: Omit<RenderLogEntry, "id" | "projectId" | "ts"> & { ts?: number }) => void;
  clearProject: (projectId: string) => void;
}

type RenderLogStore = RenderLogStoreState & RenderLogStoreActions;

const MAX_LOGS_PER_PROJECT = 500;

function toText(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (v instanceof Error) return v.stack || v.message || String(v);
  try {
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return undefined;
    }
  }
}

export const useRenderLogStore = create<RenderLogStore>()(
  persist(
    (set, get) => ({
      logsByProjectId: {},
      append: (projectId, entry) => {
        if (!projectId) return;
        const state = get();
        const prev = state.logsByProjectId[projectId] || [];
        const next: RenderLogEntry = {
          id: generateUUID(),
          projectId,
          ts: entry.ts ?? Date.now(),
          level: entry.level,
          source: entry.source,
          kind: entry.kind,
          entityId: toText(entry.entityId),
          label: toText(entry.label),
          status: toText(entry.status),
          message: toText(entry.message) || "",
          error: toText(entry.error),
          url: toText(entry.url),
        };
        const merged = [next, ...prev].slice(0, MAX_LOGS_PER_PROJECT);
        set({
          logsByProjectId: {
            ...state.logsByProjectId,
            [projectId]: merged,
          },
        });
      },
      clearProject: (projectId) => {
        const state = get();
        if (!state.logsByProjectId[projectId]) return;
        const { [projectId]: _removed, ...rest } = state.logsByProjectId;
        set({ logsByProjectId: rest });
      },
    }),
    {
      name: "moyin-render-log-store",
      storage: createJSONStorage(() => fileStorage),
      partialize: (s) => ({ logsByProjectId: s.logsByProjectId }),
    }
  )
);

