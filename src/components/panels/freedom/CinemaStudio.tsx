"use client";

import { useMemo, useCallback } from 'react';
import { CameraIcon, Loader2, Download, Sparkles, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFreedomStore } from '@/stores/freedom-store';
import { CameraControls } from './CameraControls';
import { GenerationHistory } from './GenerationHistory';
import { generateFreedomImage } from '@/lib/freedom/freedom-api';
import {
  buildCinemaPrompt,
  CAMERA_MAP,
  LENS_MAP,
  FOCAL_PERSPECTIVE,
  APERTURE_EFFECT,
} from '@/lib/freedom/camera-dictionary';

export function CinemaStudio() {
  const {
    cinemaPrompt, setCinemaPrompt,
    selectedCamera, setSelectedCamera,
    selectedLens, setSelectedLens,
    selectedFocalLength, setSelectedFocalLength,
    selectedAperture, setSelectedAperture,
    cinemaResult, setCinemaResult,
    cinemaGenerating, setCinemaGenerating,
    addHistoryEntry,
  } = useFreedomStore();

  // Build the compiled prompt preview
  const compiledPrompt = useMemo(() => {
    return buildCinemaPrompt(
      cinemaPrompt || '[your prompt here]',
      selectedCamera,
      selectedLens,
      selectedFocalLength,
      selectedAperture
    );
  }, [cinemaPrompt, selectedCamera, selectedLens, selectedFocalLength, selectedAperture]);

  const getDownloadHref = useCallback((url: string) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
      }
    } catch {
      // ignore
    }
    return url;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!cinemaPrompt.trim()) {
      toast.error('请输入描述文字');
      return;
    }

    setCinemaGenerating(true);
    setCinemaResult(null);

    try {
      const fullPrompt = buildCinemaPrompt(
        cinemaPrompt,
        selectedCamera,
        selectedLens,
        selectedFocalLength,
        selectedAperture
      );

      const result = await generateFreedomImage({
        prompt: fullPrompt,
        aspectRatio: '16:9',
      });

      setCinemaResult(result.url);

      addHistoryEntry({
        id: `cin_${Date.now()}`,
        prompt: cinemaPrompt,
        model: 'cinema',
        resultUrl: result.url,
        params: {
          camera: selectedCamera,
          lens: selectedLens,
          focalLength: selectedFocalLength,
          aperture: selectedAperture,
          compiledPrompt: fullPrompt,
        },
        createdAt: Date.now(),
        mediaId: result.mediaId,
        type: 'image',
      });

      toast.success('电影级图片生成成功！已保存到素材库');
    } catch (err: any) {
      toast.error(`生成失败: ${err.message}`);
    } finally {
      setCinemaGenerating(false);
    }
  }, [cinemaPrompt, selectedCamera, selectedLens, selectedFocalLength, selectedAperture]);

  // 控制面板内容（复用）
  const renderControls = () => (
    <>
        {/* Camera summary */}
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">相机设置</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-xs">{selectedCamera}</Badge>
            <Badge variant="secondary" className="text-xs">{selectedLens}</Badge>
            <Badge variant="secondary" className="text-xs">{selectedFocalLength}mm</Badge>
            <Badge variant="secondary" className="text-xs">{selectedAperture}</Badge>
          </div>
        </div>

        {/* Scroll columns */}
        <div className="flex-1 p-4">
          <CameraControls
            camera={selectedCamera}
            lens={selectedLens}
            focalLength={selectedFocalLength}
            aperture={selectedAperture}
            onCameraChange={setSelectedCamera}
            onLensChange={setSelectedLens}
            onFocalLengthChange={setSelectedFocalLength}
            onApertureChange={setSelectedAperture}
            className="h-full"
          />
        </div>

        {/* Prompt + Generate */}
        <div className="p-4 border-t space-y-3">
          <Textarea
            placeholder="描述你的电影场景..."
            value={cinemaPrompt}
            onChange={(e) => setCinemaPrompt(e.target.value)}
            className="min-h-[80px] resize-none"
          />

          {/* Compiled prompt preview */}
          {cinemaPrompt.trim() && (
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer">查看编译后的 Prompt</summary>
              <p className="mt-1 p-2 bg-muted rounded text-muted-foreground break-words">
                {compiledPrompt}
              </p>
            </details>
          )}

          <Button
            className="w-full h-11"
            onClick={handleGenerate}
            disabled={cinemaGenerating || !cinemaPrompt.trim()}
          >
            {cinemaGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> 电影级拍摄</>
            )}
          </Button>
        </div>
    </>
  );

  // 结果区域内容（复用）
  const renderResult = () => (
    <div className="flex items-center justify-center p-4 md:p-8 bg-muted/30">
        {cinemaGenerating ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">电影级图片生成中...</p>
          </div>
        ) : cinemaResult ? (
          <div className="max-w-full max-h-full relative group">
            <img
              src={cinemaResult}
              alt="Cinema shot"
              className="max-w-full max-h-[calc(100vh-200px)] rounded-lg shadow-lg object-contain"
            />
            {/* 手机端默认显示；桌面端 hover 才显示 */}
            <div className="absolute bottom-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-2">
              <Button size="sm" variant="secondary" asChild>
                <a href={getDownloadHref(cinemaResult)} download target="_blank" rel="noopener">
                  <Download className="h-4 w-4 mr-1" /> 下载
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <CameraIcon className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">电影工作室</p>
            <p className="text-sm">选择相机、镜头、焦距、光圈，生成电影级图片</p>
            <p className="text-xs text-muted-foreground/60">相机参数会自动编译为 AI 提示词</p>
          </div>
        )}
    </div>
  );

  return (
    <div className="md:h-full">
      {/* ========== 手机端布局（独立，不影响桌面端） ========== */}
      {/* 手机端：垂直布局，可滚动 - 仅在 < 768px 显示 */}
      <div className="md:hidden flex-1">
        <div className="flex flex-col gap-3 p-2">
          {/* 第一个面板：控制面板 */}
          <div className="w-full min-h-0 flex-shrink-0 border-b pb-3 flex flex-col">
            {renderControls()}
          </div>

          {/* 第二个面板：结果区 */}
          <div className="w-full min-h-[300px] flex-shrink-0">
            {renderResult()}
          </div>

          {/* 第三个面板：历史记录 */}
          <div className="w-full min-h-0 flex-shrink-0 border-t pt-3">
            <GenerationHistory type="cinema" onSelect={(entry) => {
              setCinemaPrompt(entry.prompt);
              if (entry.params.camera) setSelectedCamera(entry.params.camera);
              if (entry.params.lens) setSelectedLens(entry.params.lens);
              if (entry.params.focalLength) setSelectedFocalLength(entry.params.focalLength);
              if (entry.params.aperture) setSelectedAperture(entry.params.aperture);
              setCinemaResult(entry.resultUrl);
            }} />
          </div>
        </div>
      </div>

      {/* ========== 桌面端布局（保持原样，完全不变） ========== */}
      {/* 桌面端：水平布局 - 仅在 >= 768px 显示 */}
      <div className="hidden md:flex h-full">
        {/* Left: Camera Controls */}
        <div className="w-[420px] border-r flex flex-col">
          {renderControls()}
        </div>

        {/* Center: Result */}
        <div className="flex-1">
          {renderResult()}
      </div>

      {/* Right: History */}
      <div className="w-[240px] border-l">
        <GenerationHistory type="cinema" onSelect={(entry) => {
          setCinemaPrompt(entry.prompt);
          if (entry.params.camera) setSelectedCamera(entry.params.camera);
          if (entry.params.lens) setSelectedLens(entry.params.lens);
          if (entry.params.focalLength) setSelectedFocalLength(entry.params.focalLength);
          if (entry.params.aperture) setSelectedAperture(entry.params.aperture);
          setCinemaResult(entry.resultUrl);
        }} />
        </div>
      </div>
    </div>
  );
}
