// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * Export Service (Director splitScenes)
 * Exports split-scene images/videos + a manifest for external editors.
 */

import type { SplitScene } from "@/stores/director-store";

export interface SplitScenesExportConfig {
  projectName: string;
  splitScenes: SplitScene[];
  includeImages: boolean;
  includeVideos: boolean;
}

export interface ExportProgress {
  current: number;
  total: number;
  message: string;
}

function sanitizeName(name: string) {
  return (name || "project").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadFile(url: string): Promise<Blob> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download: ${resp.status}`);
  return await resp.blob();
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  // fetch() supports data: URLs in modern browsers
  const resp = await fetch(dataUrl);
  if (!resp.ok) throw new Error(`Failed to read dataUrl: ${resp.status}`);
  return await resp.blob();
}

export async function exportSplitScenesFiles(
  config: SplitScenesExportConfig,
  onProgress?: (p: ExportProgress) => void
): Promise<void> {
  const projectName = sanitizeName(config.projectName);
  const { splitScenes, includeImages, includeVideos } = config;

  const scenesSorted = [...splitScenes].sort((a, b) => a.id - b.id);

  const manifest = {
    version: "1.0.0",
    projectName,
    exportedAt: new Date().toISOString(),
    type: "director_split_scenes",
    scenes: scenesSorted.map((s) => ({
      id: s.id,
      sceneName: s.sceneName,
      sceneLocation: s.sceneLocation,
      duration: s.duration,
      imageStatus: s.imageStatus,
      videoStatus: s.videoStatus,
      imageDataUrl: s.imageDataUrl ? "embedded(dataUrl)" : null,
      imageHttpUrl: s.imageHttpUrl,
      endFrameImageUrl: s.endFrameImageUrl,
      endFrameHttpUrl: s.endFrameHttpUrl,
      videoUrl: s.videoUrl,
      prompts: {
        imagePrompt: s.imagePrompt,
        imagePromptZh: s.imagePromptZh,
        videoPrompt: s.videoPrompt,
        videoPromptZh: s.videoPromptZh,
        endFramePrompt: s.endFramePrompt,
        endFramePromptZh: s.endFramePromptZh,
      },
    })),
  };

  const files: Array<{ kind: "manifest" | "image" | "video"; src: string; filename: string }> = [];

  // manifest.json
  files.push({
    kind: "manifest",
    src: "",
    filename: `${projectName}_manifest.json`,
  });

  // images/videos
  for (const s of scenesSorted) {
    const idx = String(s.id + 1).padStart(3, "0");
    if (includeImages && s.imageDataUrl) {
      files.push({
        kind: "image",
        src: s.imageDataUrl,
        filename: `${projectName}_scene_${idx}.png`,
      });
    }
    if (includeVideos && s.videoUrl) {
      files.push({
        kind: "video",
        src: s.videoUrl,
        filename: `${projectName}_scene_${idx}.mp4`,
      });
    }
  }

  // Download manifest first
  triggerDownload(
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    `${projectName}_manifest.json`
  );

  // Download all assets (browser fallback)
  const assetFiles = files.filter((f) => f.kind !== "manifest");
  for (let i = 0; i < assetFiles.length; i++) {
    const f = assetFiles[i];
    onProgress?.({ current: i + 1, total: assetFiles.length, message: `下载 ${f.filename}` });
    try {
      const blob =
        f.kind === "image" ? await dataUrlToBlob(f.src) : await downloadFile(f.src);
      triggerDownload(blob, f.filename);
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error("[ExportSplitScenes] Failed:", f.filename, e);
    }
  }

  onProgress?.({
    current: assetFiles.length,
    total: assetFiles.length,
    message: "导出完成",
  });
}

