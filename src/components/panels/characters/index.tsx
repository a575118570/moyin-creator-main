// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Character Library View - Three Column Layout
 * Left: Generation Console
 * Middle: Character Gallery (folders + cards)
 * Right: Character Detail Panel
 */

import { useMemo } from "react";
import { useCharacterLibraryStore, type Character } from "@/stores/character-library-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useProjectStore } from "@/stores/project-store";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { GenerationPanel } from "./generation-panel";
import { CharacterGallery } from "./character-gallery";
import { CharacterDetail } from "./character-detail";

export function CharactersView() {
  const { characters, selectedCharacterId, selectCharacter } = useCharacterLibraryStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();

  const visibleCharacters = useMemo(() => {
    if (resourceSharing.shareCharacters) return characters;
    if (!activeProjectId) return [];
    return characters.filter((c) => c.projectId === activeProjectId);
  }, [characters, resourceSharing.shareCharacters, activeProjectId]);

  const selectedCharacter = useMemo(
    () => visibleCharacters.find((c) => c.id === selectedCharacterId) || null,
    [visibleCharacters, selectedCharacterId]
  );

  const handleCharacterSelect = (char: Character | null) => {
    selectCharacter(char?.id || null);
  };

  return (
    <div className="h-full">
      {/* ========== 手机端布局（独立，不影响桌面端） ========== */}
      {/* 手机端：垂直布局，可滚动 - 仅在 < 768px 显示 */}
      <div className="md:hidden flex-1">
        <div className="flex flex-col gap-3 p-2">
          {/* 第一个面板：生成控制台 */}
          <div className="w-full min-h-0 flex-shrink-0">
            <GenerationPanel 
              selectedCharacter={selectedCharacter}
              onCharacterCreated={(id) => selectCharacter(id)}
            />
          </div>

          {/* 第二个面板：角色库 */}
          <div className="w-full min-h-0 flex-shrink-0">
            <CharacterGallery
              onCharacterSelect={handleCharacterSelect}
              selectedCharacterId={selectedCharacterId}
            />
          </div>

          {/* 第三个面板：角色详情 */}
          <div className="w-full min-h-0 flex-shrink-0">
            <CharacterDetail character={selectedCharacter} />
          </div>
        </div>
      </div>

      {/* ========== 桌面端布局（保持原样，完全不变） ========== */}
      {/* 桌面端：水平布局，可调整大小 - 仅在 >= 768px 显示 */}
      <ResizablePanelGroup direction="horizontal" className="hidden md:flex h-full">
        {/* Left column - Generation Console */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <GenerationPanel 
            selectedCharacter={selectedCharacter}
            onCharacterCreated={(id) => selectCharacter(id)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle column - Character Gallery */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <CharacterGallery
            onCharacterSelect={handleCharacterSelect}
            selectedCharacterId={selectedCharacterId}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right column - Character Detail */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <CharacterDetail character={selectedCharacter} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
