// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Dashboard - Project List and Management
 * Features: create, open, rename, duplicate, batch select & delete
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { useLicenseStore } from "@/stores/license-store";
import { formatRemaining, useTrialStore } from "@/stores/trial-store";
import { switchProject } from "@/lib/project-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  FolderOpen,
  Clock,
  Film,
  Aperture,
  X,
  MoreVertical,
  Pencil,
  Copy,
  CheckSquare,
} from "lucide-react";
import { cn, generateUUID } from "@/lib/utils";
import { toast } from "sonner";
import type { Project } from "@/stores/project-store";
import { generateSceneImage } from "@/lib/ai/image-generator";
import { saveImageToLocal } from "@/lib/image-storage";
import { useScriptStore } from "@/stores/script-store";
import { generateShotImage } from "@/lib/script/shot-generator";
import { getFeatureConfig, getFeatureNotConfiguredMessage } from "@/lib/ai/feature-router";
import { ImageIcon, Loader2, Upload, Sparkles } from "lucide-react";
import { useMediaStore } from "@/stores/media-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Dashboard() {
  const { projects, createProject, deleteProject, renameProject, setProjectThumbnail } = useProjectStore();
  const { setActiveTab } = useMediaPanelStore();
  const licenseValid = useLicenseStore((s) => s.status.valid);
  const trialStatus = useTrialStore((s) => s.getStatus)();
  const scriptStore = useScriptStore();
  
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [generatingImagesForProject, setGeneratingImagesForProject] = useState<string | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  // Rename dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Duplicate loading
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Delete confirm dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Thumbnail dialog
  const [thumbnailDialogOpen, setThumbnailDialogOpen] = useState(false);
  const [thumbnailProjectId, setThumbnailProjectId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const thumbnailFileInputRef = useRef<HTMLInputElement | null>(null);
  
  const { mediaFiles, folders, getOrCreateCategoryFolder } = useMediaStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();

  // ==================== Check if project has script ====================
  const hasScript = useCallback((projectId: string): boolean => {
    const scriptData = scriptStore.projects[projectId];
    if (!scriptData) return false;
    // Check if has meaningful script content
    if (scriptData.rawScript && scriptData.rawScript.trim().length > 10) return true;
    if (scriptData.shots && scriptData.shots.length > 0) return true;
    if (scriptData.scriptData && scriptData.scriptData.episodes && scriptData.scriptData.episodes.length > 0) return true;
    if (scriptData.episodeRawScripts && scriptData.episodeRawScripts.length > 0) return true;
    return false;
  }, [scriptStore.projects]);

  // ==================== Thumbnail Management ====================
  const openThumbnailDialog = useCallback((projectId: string) => {
    setThumbnailProjectId(projectId);
    setThumbnailDialogOpen(true);
    setSelectedFolderId(null);
  }, []);

  const handleSelectThumbnailFromMedia = useCallback(async (imageUrl: string) => {
    if (!thumbnailProjectId) return;
    try {
      // Convert to local path if needed
      const localPath = await saveImageToLocal(imageUrl, "projects", `project_${thumbnailProjectId}_cover.png`);
      setProjectThumbnail(thumbnailProjectId, localPath);
      toast.success("封面设置成功");
      setThumbnailDialogOpen(false);
    } catch (error) {
      console.error("[Dashboard] Failed to set thumbnail:", error);
      toast.error("设置封面失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [thumbnailProjectId, setProjectThumbnail]);

  const handleUploadThumbnail = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!thumbnailProjectId || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast.error("请选择图片文件");
      return;
    }

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const localPath = await saveImageToLocal(dataUrl, "projects", `project_${thumbnailProjectId}_cover.png`);
      setProjectThumbnail(thumbnailProjectId, localPath);
      toast.success("封面设置成功");
      setThumbnailDialogOpen(false);
    } catch (error) {
      console.error("[Dashboard] Failed to upload thumbnail:", error);
      toast.error("上传封面失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [thumbnailProjectId, setProjectThumbnail]);

  const handleGenerateThumbnailFromScript = useCallback(async () => {
    if (!thumbnailProjectId) return;
    const project = projects.find(p => p.id === thumbnailProjectId);
    if (!project) return;

    try {
      const prompt = `为一个名为《${project.name}》的动漫短剧项目生成一张 16:9 比例的精美封面插画，构图居中，画面完整，无裁切，适合作为项目封面。`;
      const { imageUrl } = await generateSceneImage({
        prompt,
        aspectRatio: "16:9",
        resolution: "1K",
      });

      if (imageUrl) {
        const localPath = await saveImageToLocal(imageUrl, "projects", `project_${thumbnailProjectId}_cover.png`);
        setProjectThumbnail(thumbnailProjectId, localPath);
        toast.success("封面生成成功");
        setThumbnailDialogOpen(false);
      }
    } catch (error) {
      console.error("[Dashboard] Failed to generate thumbnail:", error);
      toast.error("生成封面失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [thumbnailProjectId, projects, setProjectThumbnail]);

  // ==================== Generate images from script ====================
  const handleGenerateImagesFromScript = useCallback(async (projectId: string) => {
    const scriptData = scriptStore.projects[projectId];
    if (!scriptData || !scriptData.shots || scriptData.shots.length === 0) {
      toast.error('该项目没有可用的剧本镜头');
      return;
    }

    const imageConfig = getFeatureConfig('character_generation');
    if (!imageConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    const apiKey = imageConfig.apiKey;
    const baseUrl = imageConfig.baseUrl?.replace(/\/+$/, '');
    const model = imageConfig.models?.[0];
    if (!apiKey || !baseUrl || !model) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    setGeneratingImagesForProject(projectId);
    const shots = scriptData.shots.filter(s => !s.imageUrl || s.imageStatus !== 'completed');
    const totalShots = shots.length;

    if (totalShots === 0) {
      toast.info('所有镜头已生成图片');
      setGeneratingImagesForProject(null);
      return;
    }

    toast.info(`开始为 ${totalShots} 个镜头生成图片...`);

    // Get style tokens
    const styleMap: Record<string, string[]> = {
      '2d_ghibli': ["Studio Ghibli style", "anime", "soft colors", "hand-drawn"],
      '2d_miyazaki': ["Miyazaki style", "detailed backgrounds", "fantasy", "nature elements"],
      '3d_disney': ["Disney animation style", "3D render", "vibrant colors"],
      '3d_pixar': ["Pixar style", "3D animation", "detailed textures", "cinematic lighting"],
      '2d_anime': ["anime style", "manga art", "2D animation", "cel shaded"],
      'live_action': ["live action", "cinematic photography", "realistic"],
      'documentary': ["documentary photography", "National Geographic style", "natural lighting"],
    };
    const styleTokens = styleMap[scriptData.styleId] || [];

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      try {
        scriptStore.updateShot(projectId, shot.id, { imageStatus: 'generating', imageProgress: 0 });
        
        // Get character reference images (simplified - you may need to enhance this)
        const referenceImages: string[] = [];
        
        const imageUrl = await generateShotImage(
          shot,
          {
            apiKey,
            baseUrl,
            model,
            aspectRatio: '16:9',
            styleTokens,
            referenceImages,
          },
          (progress) => {
            scriptStore.updateShot(projectId, shot.id, { imageProgress: progress });
          }
        );

        scriptStore.updateShot(projectId, shot.id, {
          imageStatus: 'completed',
          imageProgress: 100,
          imageUrl,
        });
        successCount++;
      } catch (error) {
        const err = error as Error;
        scriptStore.updateShot(projectId, shot.id, {
          imageStatus: 'failed',
          imageError: err.message,
        });
        failCount++;
        console.error(`[Dashboard] Failed to generate image for shot ${shot.id}:`, err);
      }
    }

    setGeneratingImagesForProject(null);
    if (failCount === 0) {
      toast.success(`成功为 ${successCount} 个镜头生成图片`);
    } else {
      toast.warning(`完成：${successCount} 成功，${failCount} 失败`);
    }
  }, [scriptStore]);

  // Sort projects by updatedAt descending
  const sortedProjects = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  // ==================== Create / Open ====================

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;

    const project = createProject(name);
    setNewProjectName("");
    setShowNewProject(false);
    await switchProject(project.id);
    setActiveTab("script");

    // 异步生成封面图（不阻塞项目创建）
    try {
      const prompt = `为一个名为《${name}》的动漫短剧项目生成一张 16:9 比例的精美封面插画，构图居中，画面完整，无裁切，适合作为项目封面。`;
      const { imageUrl } = await generateSceneImage({
        prompt,
        aspectRatio: "16:9",
        resolution: "1K",
      });

      if (imageUrl) {
        const localPath = await saveImageToLocal(imageUrl, "projects", `project_${project.id}_cover.png`);
        setProjectThumbnail(project.id, localPath);
      }
    } catch (error) {
      console.warn("[Dashboard] 自动生成项目封面失败:", error);
      toast.error("自动生成封面失败，可稍后在场景/角色中手动生成素材。");
    }
  };

  const handleOpenProject = async (projectId: string) => {
    if (selectionMode) return; // Don't open in selection mode
    await switchProject(projectId);
    setActiveTab("script");
  };

  // ==================== Selection ====================

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set()); // Clear on exit
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
    }
  }, [projects, selectedIds.size]);

  // ==================== Batch Delete ====================

  const handleBatchDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteProject(id));
    toast.success(`已删除 ${selectedIds.size} 个项目`);
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
    setSelectionMode(false);
  }, [selectedIds, deleteProject]);

  // ==================== Rename ====================

  const openRenameDialog = useCallback((id: string, name: string) => {
    setRenameTarget({ id, name });
    setRenameValue(name);
    setRenameDialogOpen(true);
  }, []);

  const handleRename = useCallback(() => {
    if (!renameTarget || !renameValue.trim()) return;
    renameProject(renameTarget.id, renameValue.trim());
    setRenameDialogOpen(false);
    setRenameTarget(null);
    toast.success("项目已重命名");
  }, [renameTarget, renameValue, renameProject]);

  // ==================== Duplicate ====================

  const handleDuplicate = useCallback(async (projectId: string) => {
    const source = projects.find((p) => p.id === projectId);
    if (!source) return;

    setDuplicatingId(projectId);

    try {
      const fs = window.fileStorage;
      if (!fs) {
        toast.warning('文件存储不可用，仅复制了项目名称');
        setDuplicatingId(null);
        return;
      }

      // STEP 1: Ensure source project data is persisted to disk.
      // Per-project files (_p/{pid}/*.json) only exist after a store's setItem is called.
      // If data was loaded from legacy storage but never modified, the per-project files
      // won't exist. Force a switchProject to trigger rehydrate → state merge → persist write.
      const currentPid = useProjectStore.getState().activeProjectId;
      if (currentPid === projectId) {
        // switchProject would no-op for same ID. Temporarily deactivate to force full cycle.
        useProjectStore.getState().setActiveProject(null);
      }
      await switchProject(projectId);
      // Wait for all async IPC persist writes to complete
      await new Promise(r => setTimeout(r, 500));

      // STEP 2: Generate new project ID BEFORE creating the project entry.
      // CRITICAL: Do NOT call createProject() here — it would change
      // project-store's activeProjectId, which affects getActiveProjectId() used by
      // all storage adapters. Any pending persist writes could then route to the
      // wrong per-project file, overwriting the copied data.
      const newProjectId = generateUUID();
      const newProjectName = `${source.name} (副本)`;

      // STEP 3: Copy per-project files with project ID rewriting.
      // activeProjectId still points to the source project during this step.
      const KNOWN_STORES = [
        'director', 'script', 'sclass', 'timeline',   // createProjectScopedStorage
        'characters', 'media', 'scenes',               // createSplitStorage (per-project portion)
      ];

      let copiedCount = 0;
      let keysToCopy: string[] = await fs.listKeys?.(`_p/${projectId}`) ?? [];
      console.log(`[Duplicate] listKeys('_p/${projectId}') → ${keysToCopy.length} keys:`, keysToCopy);

      if (keysToCopy.length === 0) {
        keysToCopy = KNOWN_STORES.map(s => `_p/${projectId}/${s}`);
        console.log('[Duplicate] Fallback to known store names');
      }

      for (const key of keysToCopy) {
        const rawData = await fs.getItem(key);
        if (!rawData) continue;

        // Rewrite activeProjectId so the new project's merge() keys data correctly.
        let dataToWrite = rawData;
        try {
          const parsed = JSON.parse(rawData);
          const state = parsed?.state ?? parsed;

          if (state && typeof state === 'object') {
            if (state.activeProjectId === projectId) {
              state.activeProjectId = newProjectId;
            }
            // Handle legacy format where projects is a dict keyed by projectId
            if (state.projects && typeof state.projects === 'object' && state.projects[projectId]) {
              state.projects[newProjectId] = state.projects[projectId];
              delete state.projects[projectId];
            }
          }
          dataToWrite = JSON.stringify(parsed);
        } catch {
          console.warn(`[Duplicate] Could not parse ${key}, copying raw`);
        }

        const newKey = key.replace(`_p/${projectId}`, `_p/${newProjectId}`);
        await fs.setItem(newKey, dataToWrite);
        copiedCount++;
        console.log(`[Duplicate] Copied: ${key} → ${newKey}`);
      }

      // STEP 4: NOW add the project entry to project-store (after all files are copied).
      // Use setState directly to add the project WITHOUT changing activeProjectId.
      // This prevents any persist writes from being routed to the new project's files
      // before the copy is fully complete.
      const newProject: Project = {
        id: newProjectId,
        name: newProjectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      useProjectStore.setState((state) => ({
        projects: [newProject, ...state.projects],
      }));

      if (copiedCount > 0) {
        toast.success(`已复制项目「${source.name}」(${copiedCount} 个数据文件)`);
      } else {
        toast.warning('项目数据文件为空，仅复制了项目名称');
      }

      // STEP 5: Reset activeProjectId so the next project open triggers a full switchProject.
      useProjectStore.getState().setActiveProject(null);
    } catch (err) {
      console.error('[Duplicate] Failed:', err);
      toast.error(`复制项目数据失败: ${(err as Error).message}`);
    } finally {
      setDuplicatingId(null);
    }
  }, [projects]);

  // ==================== Helpers ====================

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return new Date(timestamp).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const allSelected = projects.length > 0 && selectedIds.size === projects.length;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="h-14 md:h-16 border-b border-border bg-panel px-2 md:px-8 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Aperture className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-lg font-bold text-foreground tracking-wide truncate">漫果AI</h1>
            <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:block">Manguo AI Studio</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {!licenseValid && trialStatus.active && (
            <div className="px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[9px] md:text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 mr-1 md:mr-2 whitespace-nowrap">
              <span className="hidden sm:inline">试用剩余 </span>
              {formatRemaining(trialStatus.remainingMs)}
            </div>
          )}
          {projects.length > 0 && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
              className="h-8 md:h-9 px-2 md:px-3 text-xs md:text-sm"
            >
              <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1.5" />
              <span className="hidden sm:inline">{selectionMode ? "退出选择" : "管理"}</span>
            </Button>
          )}
          <Button
            onClick={() => setShowNewProject(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium h-8 md:h-9 px-2 md:px-4 text-xs md:text-sm"
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
            <span className="hidden sm:inline">新建项目</span>
            <span className="sm:hidden">新建</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">我的项目</h2>
              <p className="text-xs md:text-sm text-muted-foreground">
                共 {projects.length} 个项目
                {selectionMode && selectedIds.size > 0 && (
                  <span className="text-primary ml-2">· 已选 {selectedIds.size} 个</span>
                )}
              </p>
            </div>

            {/* Selection toolbar */}
            {selectionMode && (
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-xs md:text-sm h-8 md:h-9">
                  {allSelected ? "取消全选" : "全选"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => setBatchDeleteConfirm(true)}
                  className="text-xs md:text-sm h-8 md:h-9"
                >
                  <Trash2 className="w-3.5 h-3.5 md:mr-1.5" />
                  <span className="hidden sm:inline">删除选中</span>
                  <span className="sm:hidden">删除</span>
                  <span className="ml-1">({selectedIds.size})</span>
                </Button>
              </div>
            )}
          </div>

          {/* New Project Input */}
          {showNewProject && (
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-muted/50 border border-border rounded-lg">
              <div className="flex items-center gap-2 md:gap-3">
                <Input
                  placeholder="输入项目名称..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  className="flex-1 text-sm md:text-base"
                  autoFocus
                />
                <Button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="h-9 md:h-10 text-xs md:text-sm">
                  创建
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowNewProject(false);
                    setNewProjectName("");
                  }}
                  className="h-9 w-9 md:h-10 md:w-10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Project Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((project) => {
              const isSelected = selectedIds.has(project.id);
              const isDuplicating = duplicatingId === project.id;

              return (
                <div
                  key={project.id}
                  className={cn(
                    "group relative bg-card border rounded-xl overflow-hidden transition-all duration-200",
                    selectionMode
                      ? isSelected
                        ? "border-primary ring-1 ring-primary/30 cursor-pointer"
                        : "border-border cursor-pointer hover:border-muted-foreground/30"
                      : "border-border hover:border-primary/50 cursor-pointer",
                  )}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelect(project.id);
                    } else {
                      handleOpenProject(project.id);
                    }
                  }}
                >
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(project.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background/80 backdrop-blur-sm"
                      />
                    </div>
                  )}

                  {/* Delete Button (top right, always visible) */}
                  {!selectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: project.id, name: project.name });
                        setDeleteConfirmOpen(true);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-sm"
                      title="删除项目"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  )}

                  {/* Project Thumbnail */}
                  <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-12 h-12 text-muted-foreground/30" />
                    )}
                    {isDuplicating && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    )}
                  </div>

                  {/* Project Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-foreground truncate mb-2">
                      {project.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(project.updatedAt)}</span>
                      </div>

                      {/* Actions (hidden in selection mode) */}
                      {!selectionMode && (
                        <div className="flex items-center gap-1">
                          {/* Set Thumbnail Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openThumbnailDialog(project.id);
                            }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-all"
                            title="设置封面"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                          
                          {/* Actions menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded hover:bg-muted text-muted-foreground transition-all"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => openRenameDialog(project.id, project.name)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(project.id)}
                                disabled={isDuplicating}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                复制项目
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  deleteProject(project.id);
                                  toast.success(`已删除「${project.name}」`);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover Overlay (not in selection mode) */}
                  {!selectionMode && (
                    <>
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2">
                          <FolderOpen className="w-4 h-4" />
                          打开项目
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Empty State */}
            {projects.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Film className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  还没有项目
                </h3>
                <p className="text-sm text-muted-foreground/70 mb-6">
                  创建你的第一个 AI 视频项目
                </p>
                <Button onClick={() => setShowNewProject(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新建项目
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== Rename Dialog ==================== */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            placeholder="输入新名称..."
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Single Delete Confirm Dialog ==================== */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            即将删除项目 <span className="text-foreground font-medium">「{deleteTarget?.name}」</span>，
            此操作不可撤销。确定继续？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteProject(deleteTarget.id);
                  toast.success(`已删除「${deleteTarget.name}」`);
                  setDeleteConfirmOpen(false);
                  setDeleteTarget(null);
                }
              }}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Batch Delete Confirm Dialog ==================== */}
      <Dialog open={batchDeleteConfirm} onOpenChange={setBatchDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            即将删除 <span className="text-foreground font-medium">{selectedIds.size}</span> 个项目，
            此操作不可撤销。确定继续？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteConfirm(false)}>取消</Button>
            <Button variant="destructive" onClick={handleBatchDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Set Thumbnail Dialog ==================== */}
      <Dialog open={thumbnailDialogOpen} onOpenChange={setThumbnailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>设置项目封面</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="media" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="media">从素材库</TabsTrigger>
                <TabsTrigger value="upload">上传文件</TabsTrigger>
                {thumbnailProjectId && hasScript(thumbnailProjectId) && (
                  <TabsTrigger value="generate">根据剧本生成</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="media" className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
                {(() => {
                  const visibleFolders = resourceSharing.shareMedia 
                    ? folders 
                    : folders.filter(f => !activeProjectId || f.projectId === activeProjectId || f.isSystem);
                  const visibleMedia = resourceSharing.shareMedia
                    ? mediaFiles
                    : mediaFiles.filter(m => !activeProjectId || m.projectId === activeProjectId);
                  const imageFiles = visibleMedia.filter(f => f.type === 'image' && !f.ephemeral);
                  
                  // Filter folders: only show folders that contain images, and exclude "上传文件" system folder
                  const foldersWithImages = visibleFolders.filter(folder => {
                    // Exclude "上传文件" system folder (already have upload tab)
                    if (folder.isSystem && folder.category === 'upload') return false;
                    // Exclude "AI视频" folder (only need images for cover)
                    if (folder.isSystem && folder.category === 'ai-video') return false;
                    // Only show folders that have images
                    return imageFiles.some(img => img.folderId === folder.id);
                  });
                  
                  const filteredImages = selectedFolderId === null
                    ? imageFiles
                    : imageFiles.filter(f => f.folderId === selectedFolderId);
                  
                  return (
                    <>
                      {foldersWithImages.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedFolderId(null)}
                            className={cn(
                              "px-2 py-1 rounded text-xs transition-colors",
                              selectedFolderId === null
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            )}
                          >
                            全部
                          </button>
                          {foldersWithImages.map(folder => (
                            <button
                              key={folder.id}
                              onClick={() => setSelectedFolderId(folder.id)}
                              className={cn(
                                "px-2 py-1 rounded text-xs transition-colors",
                                selectedFolderId === folder.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
                              )}
                            >
                              {folder.name}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {filteredImages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          素材库中没有图片
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {filteredImages.map(image => (
                            <button
                              key={image.id}
                              onClick={() => handleSelectThumbnailFromMedia(image.url)}
                              className="relative aspect-video rounded overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                            >
                              <img
                                src={image.url}
                                alt={image.name}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </TabsContent>
              
              <TabsContent value="upload" className="mt-4">
                <div className="space-y-4">
                  <input
                    ref={thumbnailFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadThumbnail}
                    className="hidden"
                  />
                  <Button
                    onClick={() => thumbnailFileInputRef.current?.click()}
                    className="w-full"
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    选择图片文件
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    支持 JPG、PNG、WebP 等图片格式
                  </p>
                </div>
              </TabsContent>
              
              {thumbnailProjectId && hasScript(thumbnailProjectId) && (
                <TabsContent value="generate" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">根据剧本生成封面</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          将使用 AI 根据项目名称和剧本内容生成封面图
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleGenerateThumbnailFromScript}
                      className="w-full"
                      disabled={generatingImagesForProject === thumbnailProjectId}
                    >
                      {generatingImagesForProject === thumbnailProjectId ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成封面
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
