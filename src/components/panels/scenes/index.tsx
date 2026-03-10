// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Scenes View - Three Column Layout
 * Left: Generation Console
 * Middle: Scene Gallery (folders + cards)
 * Right: Scene Detail Panel
 */

import { useMemo } from "react";
import { useSceneStore, type Scene } from "@/stores/scene-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useProjectStore } from "@/stores/project-store";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { GenerationPanel } from "./generation-panel";
import { SceneGallery } from "./scene-gallery";
import { SceneDetail } from "./scene-detail";

export function ScenesView() {
  const { scenes, selectedSceneId, selectScene } = useSceneStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();

  const visibleScenes = useMemo(() => {
    if (resourceSharing.shareScenes) return scenes;
    if (!activeProjectId) return [];
    return scenes.filter((s) => s.projectId === activeProjectId);
  }, [scenes, resourceSharing.shareScenes, activeProjectId]);

  const selectedScene = useMemo(
    () => visibleScenes.find((s) => s.id === selectedSceneId) || null,
    [visibleScenes, selectedSceneId]
  );

  const handleSceneSelect = (scene: Scene | null) => {
    selectScene(scene?.id || null);
    // 手机端：选中场景后自动滚动到上方“生成控制台”，并触发一键切割（如果已有联合图）
    if (scene && typeof window !== "undefined" && window.innerWidth < 768) {
      const genEl = document.getElementById("moyin-scene-generation-panel");
      if (genEl) {
        genEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // 通知 GenerationPanel 进行一键切割+保存视角图（仅当该场景已有联合图时才会真正执行）
      window.dispatchEvent(new CustomEvent("moyin-mobile-auto-split", { detail: { sceneId: scene.id } }));
    }
  };

  return (
    <div className="md:h-full">
      {/* ========== 手机端布局（独立，不影响桌面端） ========== */}
      {/* 手机端：垂直布局，滚动交给外层 Layout，避免双层滚动导致"很难滑动" */}
      <div className="md:hidden flex-1">
        <div className="flex flex-col gap-3 p-2">
          {/* 第一个面板：生成控制台 */}
          <div id="moyin-scene-generation-panel" className="w-full min-h-0 flex-shrink-0">
            <GenerationPanel 
              selectedScene={selectedScene}
              onSceneCreated={(id) => selectScene(id)}
            />
          </div>

          {/* 第二个面板：场景库 */}
          <div className="w-full min-h-0 flex-shrink-0">
            <SceneGallery
              onSceneSelect={handleSceneSelect}
              selectedSceneId={selectedSceneId}
            />
          </div>

          {/* 第三个面板：场景详情 */}
          <div id="moyin-scene-detail-panel" className="w-full min-h-0 flex-shrink-0">
            <SceneDetail scene={selectedScene} />
          </div>
        </div>
      </div>

      {/* ========== 桌面端布局（保持原样，完全不变） ========== */}
      {/* 桌面端：水平布局，可调整大小 - 仅在 >= 768px 显示 */}
      <ResizablePanelGroup direction="horizontal" className="hidden md:flex h-full">
        {/* Left column - Generation Console */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <GenerationPanel 
            selectedScene={selectedScene}
            onSceneCreated={(id) => selectScene(id)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle column - Scene Gallery */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <SceneGallery
            onSceneSelect={handleSceneSelect}
            selectedSceneId={selectedSceneId}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right column - Scene Detail */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="overflow-hidden">
          <SceneDetail scene={selectedScene} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
