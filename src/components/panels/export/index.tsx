// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Export View - Timeline visualization and export
 * Based on CineGen-AI StageExport.tsx
 */

import { useScriptStore, useActiveScriptProject } from "@/stores/script-store";
import { useActiveDirectorProject } from "@/stores/director-store";
import { useProjectStore } from "@/stores/project-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Film,
  Download,
  Share2,
  FileVideo,
  Layers,
  Clock,
  CheckCircle,
  BarChart3,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { exportProjectFiles } from "@/lib/script/export-service";
import { exportSplitScenesFiles } from "@/lib/director/export-service";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import React, { Suspense, useState } from "react";

const LazyRenderLogDialog = React.lazy(async () => {
  const m = await import("@/components/render-log/RenderLogDialog");
  return { default: m.RenderLogDialog };
});

export function ExportView() {
  const { activeProject } = useProjectStore();
  const scriptProject = useActiveScriptProject();
  const directorProject = useActiveDirectorProject();
  const { setActiveTab } = useMediaPanelStore();
  const [renderLogOpen, setRenderLogOpen] = useState(false);

  const shots = scriptProject?.shots || [];
  const splitScenes = directorProject?.splitScenes || [];
  const scriptData = scriptProject?.scriptData;
  const targetDuration = scriptProject?.targetDuration || "60s";

  // === 进度计算：合并 Script shots 和 Director splitScenes 的状态 ===
  // Director 的 splitScenes 是实际生成作业的主数据源
  const directorCompleted = splitScenes.filter(
    (s) => s.videoStatus === 'completed' || (s.imageStatus === 'completed' && s.videoUrl)
  ).length;
  const directorWithImage = splitScenes.filter((s) => s.imageStatus === 'completed').length;
  // Script 侧的独立生成（通过 shot-list 生成的）
  const scriptCompleted = shots.filter((s) => s.imageUrl || s.videoUrl).length;

  // 优先使用 Director 的进度，因为这是实际工作流
  const hasSplitScenes = splitScenes.length > 0;
  const totalItems = hasSplitScenes ? splitScenes.length : shots.length;
  const completedItems = hasSplitScenes ? directorCompleted : scriptCompleted;
  const imageReadyItems = hasSplitScenes ? directorWithImage : scriptCompleted;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const imageProgress = totalItems > 0 ? Math.round((imageReadyItems / totalItems) * 100) : 0;

  const bestVideoUrl =
    splitScenes.find((s) => s.videoStatus === "completed" && !!s.videoUrl)?.videoUrl ||
    shots.find((s) => !!s.videoUrl)?.videoUrl ||
    null;

  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    // iOS / 部分安卓可能忽略 download，fallback 为新标签打开后手动保存
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSplitSceneVideos = async () => {
    if (!hasSplitScenes || splitScenes.length === 0) {
      toast.error("当前没有分镜视频可下载");
      return;
    }

    const videos = splitScenes
      .map((s, idx) => ({ idx, url: s.videoUrl, ok: s.videoStatus === "completed" && !!s.videoUrl }))
      .filter((v) => v.ok && !!v.url) as Array<{ idx: number; url: string; ok: true }>;

    if (videos.length === 0) {
      toast.error("还没有已生成完成的视频");
      return;
    }

    toast.loading(`开始下载 ${videos.length} 个分镜视频...`, { id: "download-scene-videos" });

    // 逐个触发下载，避免浏览器一次性拦截太多下载
    for (const v of videos) {
      const filename = `scene-${String(v.idx + 1).padStart(2, "0")}.mp4`;
      try {
        triggerDownload(v.url, filename);
        // 小延迟：给移动端浏览器留出处理时间
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 350));
      } catch (e) {
        // continue
      }
    }

    toast.success("已触发下载（若系统拦截多文件下载，请在浏览器设置里允许）", { id: "download-scene-videos" });
  };

  const handleExportMaterials = async () => {
    const projectName = activeProject?.name || scriptData?.title || "未命名项目";
    toast.loading("正在导出素材包...", { id: "export-materials" });
    try {
      if (hasSplitScenes && splitScenes.length > 0) {
        await exportSplitScenesFiles({
          projectName,
          splitScenes,
          includeImages: true,
          includeVideos: true,
        });
      } else if (scriptProject?.scriptData && shots.length > 0) {
        await exportProjectFiles({
          projectName,
          scriptData: scriptProject.scriptData,
          shots,
          targetDuration,
          includeImages: true,
          includeVideos: true,
          format: "folder",
        });
      } else {
        toast.error("没有可导出的素材", { id: "export-materials" });
        return;
      }
      toast.success("已开始下载素材包（包含 manifest.json）", { id: "export-materials" });
    } catch (e: any) {
      toast.error(`导出失败：${e?.message || "未知错误"}`, { id: "export-materials" });
    }
  };

  // 估算时长：使用实际时长数据
  const estimatedDuration = hasSplitScenes
    ? splitScenes.reduce((acc, s) => acc + (s.duration || 5), 0)
    : shots.reduce((acc, s) => acc + (s.duration || 3), 0);

  return (
    // 顶层不处理滚动，交给外层 Layout；桌面端占满高度
    <div className="flex flex-col bg-background w-full md:h-full md:overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
            <Film className="w-5 h-5 text-primary" />
            成片与导出
            <span className="text-xs text-muted-foreground font-mono font-normal uppercase tracking-wider bg-muted px-2 py-1 rounded">
              渲染与导出
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono uppercase bg-muted border border-border px-2 py-1 rounded">
            状态: {progress === 100 ? "就绪" : "进行中"}
          </span>
        </div>
      </div>

      <ScrollArea className="md:flex-1">
        <div className="p-8 md:p-12">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* 重要：渲染日志弹窗在 Electron 打包环境里偶发触发 React #185。
               这里用“懒加载 + 独立 ErrorBoundary”隔离，避免把整个 ExportView 拉崩。 */}
            {renderLogOpen ? (
              <ErrorBoundary name="RenderLogDialog">
                <Suspense fallback={null}>
                  <LazyRenderLogDialog
                    open={renderLogOpen}
                    onOpenChange={setRenderLogOpen}
                    projectId={activeProject?.id}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : null}
            {/* Main Status Panel */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-2xl relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 p-48 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 p-32 bg-green-500/5 blur-[100px] rounded-full pointer-events-none" />

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                      {scriptData?.title || activeProject?.name || "未命名项目"}
                    </h3>
                    <span className="px-2 py-0.5 bg-muted border border-border text-muted-foreground text-[10px] rounded uppercase font-mono tracking-wider">
                      主序列
                    </span>
                  </div>
                  <div className="flex items-center gap-6 mt-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                        {hasSplitScenes ? '分割场景' : '分镜'}
                      </span>
                      <span className="text-sm font-mono text-foreground/80">{totalItems}</span>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                        预计时长
                      </span>
                      <span className="text-sm font-mono text-foreground/80">~{estimatedDuration}s</span>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                        目标
                      </span>
                      <span className="text-sm font-mono text-foreground/80">{targetDuration}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right bg-muted/50 p-4 rounded-lg border border-border supports-[backdrop-filter]:backdrop-blur-sm min-w-[160px]">
                  <div className="flex items-baseline justify-end gap-1 mb-1">
                    <span className="text-3xl font-mono font-bold text-primary">{progress}</span>
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center justify-end gap-2">
                    {progress === 100 ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <BarChart3 className="w-3 h-3" />
                    )}
                    渲染状态
                  </div>
                </div>
              </div>

              {/* Timeline Visualizer Strip */}
              <div className="mb-10">
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-2 px-1">
                  <span>序列映射{hasSplitScenes ? ' (导演)' : ''}</span>
                  <span>TC 00:00:00:00</span>
                </div>
                <div className="h-20 bg-muted/30 rounded-lg border border-border flex items-center px-2 gap-1 overflow-x-auto relative shadow-inner">
                  {totalItems === 0 ? (
                    <div className="w-full flex items-center justify-center text-muted-foreground/50 text-xs font-mono uppercase tracking-widest">
                      <Film className="w-4 h-4 mr-2" />
                      暂无分镜
                    </div>
                  ) : hasSplitScenes ? (
                    splitScenes.map((scene, idx) => {
                      const hasImage = scene.imageStatus === 'completed' && !!scene.imageDataUrl;
                      const hasVideo = scene.videoStatus === 'completed' && !!scene.videoUrl;
                      return (
                        <div
                          key={scene.id}
                          className={cn(
                            "h-14 min-w-[4px] flex-1 rounded-[2px] transition-all relative group flex flex-col justify-end overflow-hidden",
                            hasVideo
                              ? "bg-green-500/40 border border-green-500/30 hover:bg-green-500/50"
                              : hasImage
                              ? "bg-primary/40 border border-primary/30 hover:bg-primary/50"
                              : "bg-muted border border-border hover:bg-muted/80"
                          )}
                          title={`Scene ${idx + 1}: ${scene.actionSummary || scene.sceneName || ''}`}
                        >
                          {hasVideo && <div className="h-full w-full bg-green-500/20" />}
                          {hasImage && !hasVideo && <div className="h-full w-full bg-primary/20" />}
                          
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 whitespace-nowrap">
                            <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border shadow-xl">
                              场景 {idx + 1}{hasVideo ? ' ✓视频' : hasImage ? ' ✓图片' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    shots.map((shot, idx) => {
                      const isDone = !!shot.imageUrl || !!shot.videoUrl;
                      return (
                        <div
                          key={shot.id}
                          className={cn(
                            "h-14 min-w-[4px] flex-1 rounded-[2px] transition-all relative group flex flex-col justify-end overflow-hidden",
                            isDone
                              ? "bg-primary/40 border border-primary/30 hover:bg-primary/50"
                              : "bg-muted border border-border hover:bg-muted/80"
                          )}
                          title={`Shot ${idx + 1}: ${shot.actionSummary}`}
                        >
                          {isDone && <div className="h-full w-full bg-primary/20" />}
                          
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 whitespace-nowrap">
                            <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border shadow-xl">
                              分镜 {idx + 1}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* 图片/视频状态摘要 */}
                {hasSplitScenes && (
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                    <span>图片: {imageReadyItems}/{totalItems}</span>
                    <span>视频: {completedItems}/{totalItems}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  disabled={!hasSplitScenes || splitScenes.length === 0}
                  className={cn(
                    "h-12 font-bold text-xs uppercase tracking-widest transition-all",
                    (hasSplitScenes && splitScenes.length > 0)
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  onClick={() => {
                    toast.info("将逐个下载已生成完成的分镜视频（多个 .mp4）。");
                    void handleDownloadSplitSceneVideos();
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载所有分镜视频（逐个 .mp4）
                </Button>

                <Button
                  variant="outline"
                  className="h-12 font-bold text-xs uppercase tracking-widest"
                  onClick={() => {
                    toast.info("将导出素材包（zip）：包含 manifest.json + 图片/视频，适合导入剪映 / PR。");
                    void handleExportMaterials();
                  }}
                >
                  <FileVideo className="w-4 h-4 mr-2" />
                  下载素材包（zip）
                </Button>
              </div>
            </div>

            {/* Secondary Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("media");
                  toast.info("已切换到「素材」页");
                }}
                className="p-5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group cursor-pointer flex flex-col justify-between h-32 text-left"
                aria-label="打开源素材（跳转到素材页）"
              >
                <Layers className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">源素材</h4>
                  <p className="text-[10px] text-muted-foreground">
                    下载所有生成的图片和原始视频片段。
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window === "undefined") return;

                  // 期望：分享“成片”。但当前 Web 端暂无合成成片能力。
                  // 若存在单个可用视频，则分享该视频链接；否则退化为分享项目链接。
                  const shareVideo = async (videoUrl: string) => {
                    const navAny = navigator as any;
                    const title = `${activeProject?.name || "项目"}（视频片段）`;
                    const text = "视频链接";
                    if (navAny?.share) {
                      await navAny.share({ title, text, url: videoUrl });
                      return;
                    }
                    const ok = await copyToClipboard(videoUrl);
                    if (ok) toast.success("视频链接已复制");
                    else toast.error("复制失败，请手动复制视频链接");
                  };

                  const shareProjectLink = async () => {
                    if (!activeProject?.id) {
                      toast.error("未找到当前项目，无法分享");
                      return;
                    }
                    const url = new URL(window.location.href);
                    url.searchParams.set("projectId", activeProject.id);
                    url.searchParams.set("tab", "export");
                    const shareUrl = url.toString();
                    const navAny = navigator as any;
                    const title = `${activeProject.name || "项目"}（漫果AI）`;
                    const text = "打开项目（需要对方已导入/同步该项目数据）";
                    if (navAny?.share) {
                      await navAny.share({ title, text, url: shareUrl });
                      return;
                    }
                    const ok = await copyToClipboard(shareUrl);
                    if (ok) toast.success("项目链接已复制");
                    else toast.error("复制失败，请手动复制地址栏链接");
                  };

                  (async () => {
                    try {
                      if (bestVideoUrl) {
                        toast.info("当前未合成单个成片 MP4，将先分享一个可用的视频片段链接。若需成片，请导出素材后在剪辑软件合成。");
                        await shareVideo(bestVideoUrl);
                      } else {
                        toast.info("暂无可分享的视频片段，先分享项目链接。");
                        await shareProjectLink();
                      }
                    } catch (e: any) {
                      if (String(e?.name) === "AbortError") return;
                      toast.error("分享失败");
                    }
                  })();
                }}
                className="p-5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group cursor-pointer flex flex-col justify-between h-32 text-left"
                aria-label="分享项目"
              >
                <Share2 className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">分享项目</h4>
                  <p className="text-[10px] text-muted-foreground">
                    创建仅供查看的链接供客户审阅。
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenderLogOpen(true);
                }}
                className="p-5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors group cursor-pointer flex flex-col justify-between h-32 text-left"
                aria-label="查看渲染日志"
              >
                <Clock className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">渲染日志</h4>
                  <p className="text-[10px] text-muted-foreground">
                    查看生成历史和令牌使用情况。
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
