"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ImageIcon, Loader2, Download, Save, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFreedomStore } from '@/stores/freedom-store';
import { ModelSelector } from './ModelSelector';
import { GenerationHistory } from './GenerationHistory';
import { generateFreedomImage, generateFreedomVideo, type FreedomVideoUploadFile } from '@/lib/freedom/freedom-api';
import { splitStoryboardImage } from '@/lib/storyboard/image-splitter';
import { useMediaStore } from '@/stores/media-store';
import { useProjectStore } from '@/stores/project-store';
import {
  getT2IModelById,
  getAspectRatiosForT2IModel,
} from '@/lib/freedom/model-registry';

interface LocalUploadAsset {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

// 确保作为视频首帧的参考图尺寸足够（Seedance 官方要求最小高度/宽度 >= 300px）
async function ensureMinVideoImageSize(dataUrl: string, minSize: number = 300): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const minDim = Math.min(width, height);
      if (minDim >= minSize) {
        resolve(dataUrl);
        return;
      }
      const scale = minSize / minDim;
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function ImageStudio() {
  const {
    imagePrompt, setImagePrompt,
    selectedImageModel, setSelectedImageModel,
    imageAspectRatio, setImageAspectRatio,
    imageResolution, setImageResolution,
    imageExtraParams, setImageExtraParams,
    imageResult, setImageResult,
    imageGenerating, setImageGenerating,
    // 视频相关（用于一键生成视频）
    videoPrompt, setVideoPrompt,
    selectedVideoModel,
    videoAspectRatio,
    videoDuration,
    videoResolution,
    videoResult,
    videoGenerating, setVideoGenerating,
    setVideoResult,
    addHistoryEntry,
  } = useFreedomStore();

  const { addMediaFromUrl, getOrCreateCategoryFolder } = useMediaStore();
  const { activeProjectId } = useProjectStore();

  const model = useMemo(() => getT2IModelById(selectedImageModel), [selectedImageModel]);

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

  // Dynamic capabilities based on selected model
  const aspectRatios = useMemo(() => getAspectRatiosForT2IModel(selectedImageModel), [selectedImageModel]);
  
  const hasResolution = useMemo(() => {
    return model?.inputs?.resolution?.enum != null;
  }, [model]);

  const resolutions = useMemo(() => {
    return (model?.inputs?.resolution?.enum as string[]) || [];
  }, [model]);

  // Midjourney-specific params
  const hasMidjourneyParams = /midjourney|^mj_|^niji-/i.test(selectedImageModel);
  const hasIdeogramParams = selectedImageModel.includes('ideogram');
  const hasImageUrl = model?.inputs?.image_url != null;
  const hasStrength = model?.inputs?.strength != null;

  const referenceInputRef = useRef<HTMLInputElement>(null);
  const maxReferenceImages = useMemo(() => {
    const input = model?.inputs?.image_url;
    if (!input) return 0;
    // If the registry marks it as array, respect maxItems; else treat as single.
    if (input.type === 'array') return typeof input.maxItems === 'number' ? input.maxItems : 4;
    return 1;
  }, [model?.inputs?.image_url]);

  const [referenceAssets, setReferenceAssets] = useState<LocalUploadAsset[]>([]);
  const [referenceStrength, setReferenceStrength] = useState<number>(() => {
    const def = model?.inputs?.strength?.default;
    return typeof def === 'number' ? def : 0.6;
  });

  useEffect(() => {
    // When switching model, reset reference image if new model doesn't support it
    setReferenceAssets([]);
    const def = model?.inputs?.strength?.default;
    setReferenceStrength(typeof def === 'number' ? def : 0.6);
  }, [selectedImageModel, model?.inputs?.strength?.default]);

  const handleReferenceChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    try {
      const mapped: LocalUploadAsset[] = [];
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        mapped.push({
          dataUrl,
          fileName: file.name,
          mimeType: file.type || 'image/png',
        });
      }
      setReferenceAssets((prev) => {
        const merged = [...prev, ...mapped];
        const limited = merged.slice(0, Math.max(1, maxReferenceImages || 1));
        return limited;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '读取文件失败';
      toast.error(message);
    }
  }, [maxReferenceImages]);

  const [isSplitting, setIsSplitting] = useState(false);
  const [isStoryboardVideoLoading, setIsStoryboardVideoLoading] = useState(false);

  const inferGridFromPrompt = useCallback((): { rows: number; cols: number } | null => {
    const p = (imagePrompt || '').replace(/\s+/g, '');
    if (!p) return null;
    // Simple heuristics for common storyboard prompts
    if (/9宫格|九宫格|9格/.test(p)) return { rows: 3, cols: 3 };
    if (/6宫格|六宫格|6格/.test(p)) return { rows: 2, cols: 3 };
    if (/4宫格|四宫格|4格/.test(p)) return { rows: 2, cols: 2 };
    // Sometimes people say "3x2" / "2x3"
    const m = p.match(/(\d)\s*[x×]\s*(\d)/i);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
        return { rows: a, cols: b };
      }
    }
    return null;
  }, [imagePrompt]);

  const handleSplitStoryboard = useCallback(async () => {
    if (!imageResult) {
      toast.error('暂无可切割的图片');
      return;
    }
    if (isSplitting) return;

    // Only 16:9 / 9:16 are supported by the storyboard splitter grid-calculator.
    const ar = imageAspectRatio === '9:16' ? '9:16' : '16:9';
    const inferred = inferGridFromPrompt();
    const preset = inferred ?? { rows: 2, cols: 3 }; // default 6-grid (2x3)

    let rows = preset.rows;
    let cols = preset.cols;
    // Allow override via prompt to avoid extra UI.
    const input = window.prompt('切割分镜图：请输入 行x列（例如 2x3、3x3），留空使用默认', `${rows}x${cols}`);
    if (input != null && input.trim()) {
      const m = input.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
      if (!m) {
        toast.error('格式不正确，请输入如 2x3 / 3x3');
        return;
      }
      rows = Math.max(1, Number(m[1]));
      cols = Math.max(1, Number(m[2]));
      if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows * cols > 64) {
        toast.error('行列数不合法（最多 64 张）');
        return;
      }
    }

    try {
      setIsSplitting(true);
      toast.message(`正在切割为 ${rows}x${cols}...`);

      const results = await splitStoryboardImage(imageResult, {
        aspectRatio: ar as any,
        resolution: '2K' as any,
        sceneCount: rows * cols,
        options: {
          expectedRows: rows,
          expectedCols: cols,
          filterEmpty: false,
          edgeMarginPercent: 0.02,
        },
      });

      const folderId = getOrCreateCategoryFolder('ai-image');
      const baseName = (imagePrompt || '分镜切割').slice(0, 24);
      results.forEach((r) => {
        addMediaFromUrl({
          url: r.dataUrl,
          name: `${baseName}-${r.row + 1}-${r.col + 1}`,
          type: 'image',
          source: 'ai-image',
          folderId,
          projectId: activeProjectId || undefined,
        });
      });

      toast.success(`切割完成：已保存 ${results.length} 张到素材库`);
    } catch (err: any) {
      toast.error(`切割失败: ${err?.message || String(err)}`);
    } finally {
      setIsSplitting(false);
    }
  }, [
    imageResult,
    isSplitting,
    imageAspectRatio,
    inferGridFromPrompt,
    imagePrompt,
    addMediaFromUrl,
    getOrCreateCategoryFolder,
    activeProjectId,
  ]);

  const handleOneClickVideo = useCallback(async () => {
    if (!imageResult) {
      toast.error('暂无可生成的视频源图片');
      return;
    }
    if (!selectedVideoModel) {
      toast.error('请先在视频工作室选择模型');
      return;
    }
    if (videoGenerating || isStoryboardVideoLoading) return;

    // 与切割分镜保持一致的网格推断逻辑
    const ar = imageAspectRatio === '9:16' ? '9:16' : '16:9';
    const inferred = inferGridFromPrompt();
    const preset = inferred ?? { rows: 2, cols: 3 };

    let rows = preset.rows;
    let cols = preset.cols;

    const input = window.prompt(
      '一键生成视频：将优先使用左上角分镜作为首帧。\n请输入 行x列（例如 2x3、3x3），留空使用默认',
      `${rows}x${cols}`,
    );
    if (input != null && input.trim()) {
      const m = input.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
      if (!m) {
        toast.error('格式不正确，请输入如 2x3 / 3x3');
        return;
      }
      rows = Math.max(1, Number(m[1]));
      cols = Math.max(1, Number(m[2]));
      if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows * cols > 64) {
        toast.error('行列数不合法（最多 64 张）');
        return;
      }
    }

    try {
      setIsStoryboardVideoLoading(true);
      setVideoGenerating(true);
      setVideoResult(null);

      toast.message('正在切割分镜并生成视频...');

      const results = await splitStoryboardImage(imageResult, {
        aspectRatio: ar as any,
        resolution: '2K' as any,
        sceneCount: rows * cols,
        options: {
          expectedRows: rows,
          expectedCols: cols,
          filterEmpty: false,
          edgeMarginPercent: 0.02,
        },
      });

      const firstFrame = results.find((r) => !r.isEmpty) || results[0];
      if (!firstFrame) {
        toast.error('未找到可用的分镜画面');
        return;
      }

      // 官方 Seedance 接口要求最小高度 300px，这里自动放大到满足要求，避免 400 错误
      const safeFirstFrameDataUrl = await ensureMinVideoImageSize(firstFrame.dataUrl, 300);

      const uploadFiles: FreedomVideoUploadFile[] = [
        {
          role: 'single',
          dataUrl: safeFirstFrameDataUrl,
          fileName: 'storyboard-frame.png',
          mimeType: 'image/png',
        },
      ];

      const promptForVideo = (imagePrompt && imagePrompt.trim()) || videoPrompt || '根据分镜生成视频';
      setVideoPrompt(promptForVideo);

      // 强制走图生视频：必须使用分镜图作为参考，不再降级到纯文本
      const video = await generateFreedomVideo({
        prompt: promptForVideo,
        model: selectedVideoModel,
        aspectRatio: videoAspectRatio || imageAspectRatio,
        duration: videoDuration,
        resolution: videoResolution || undefined,
        uploadFiles,
      });

      setVideoResult(video.url);

      addHistoryEntry({
        id: `vid_${Date.now()}`,
        prompt: promptForVideo,
        model: selectedVideoModel,
        resultUrl: video.url,
        params: {
          aspectRatio: videoAspectRatio || imageAspectRatio,
          duration: videoDuration,
          resolution: videoResolution,
          uploadCount: uploadFiles.length,
        },
        createdAt: Date.now(),
        mediaId: video.mediaId,
        type: 'video',
      });

      toast.success('视频生成成功！已保存到素材库');
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('图床未配置') || msg.includes('图床上传失败')) {
        toast.error('一键生视频失败：当前模型需要图床配置才能使用图生视频，请先在「设置 → 图床」里配置，再重试。');
      } else {
        toast.error(`生成失败: ${msg}`);
      }
    } finally {
      setIsStoryboardVideoLoading(false);
      setVideoGenerating(false);
    }
  }, [
    imageResult,
    imageAspectRatio,
    inferGridFromPrompt,
    selectedVideoModel,
    videoAspectRatio,
    videoDuration,
    videoResolution,
    videoPrompt,
    imagePrompt,
    videoGenerating,
    setVideoGenerating,
    setVideoResult,
    addHistoryEntry,
    setVideoPrompt,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!imagePrompt.trim()) {
      toast.error('请输入描述文字');
      return;
    }

    setImageGenerating(true);
    setImageResult(null);

    try {
      const mergedExtraParams: Record<string, any> = { ...imageExtraParams };
      if (hasImageUrl && referenceAssets.length > 0) {
        // Compatibility: keep single field + also provide array field.
        mergedExtraParams.image_url = referenceAssets[0]?.dataUrl;
        mergedExtraParams.image_urls = referenceAssets.map((a) => a.dataUrl);
      }
      if (hasStrength && typeof referenceStrength === 'number') mergedExtraParams.strength = referenceStrength;

      const result = await generateFreedomImage({
        prompt: imagePrompt,
        model: selectedImageModel,
        aspectRatio: imageAspectRatio,
        resolution: imageResolution || undefined,
        extraParams: Object.keys(mergedExtraParams).length > 0 ? mergedExtraParams : undefined,
      });

      setImageResult(result.url);

      // Add to history
      addHistoryEntry({
        id: `img_${Date.now()}`,
        prompt: imagePrompt,
        model: selectedImageModel,
        resultUrl: result.url,
        params: { aspectRatio: imageAspectRatio, resolution: imageResolution, ...mergedExtraParams },
        createdAt: Date.now(),
        mediaId: result.mediaId,
        type: 'image',
      });

      toast.success('图片生成成功！已保存到素材库');
    } catch (err: any) {
      toast.error(`生成失败: ${err.message}`);
    } finally {
      setImageGenerating(false);
    }
  }, [
    imagePrompt,
    selectedImageModel,
    imageAspectRatio,
    imageResolution,
    imageExtraParams,
    hasImageUrl,
    hasStrength,
    referenceAssets,
    referenceStrength,
  ]);

  const updateExtraParam = (key: string, value: any) => {
    setImageExtraParams({ ...imageExtraParams, [key]: value });
  };

  // 控制面板内容（复用）
  const renderControls = () => (
          <div className="p-4 space-y-5">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">模型选择</Label>
              <ModelSelector
                type="image"
                value={selectedImageModel}
                onChange={setSelectedImageModel}
              />
              {model && (
                <p className="text-xs text-muted-foreground">
                  ID: {model.id}
                </p>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">宽高比</Label>
              <div className="flex flex-wrap gap-1.5">
                {aspectRatios.map((ratio) => (
                  <Button
                    key={ratio}
                    variant={imageAspectRatio === ratio ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setImageAspectRatio(ratio)}
                  >
                    {ratio}
                  </Button>
                ))}
              </div>
            </div>

            {/* Resolution (conditional) */}
            {hasResolution && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">分辨率</Label>
                <Select value={imageResolution} onValueChange={setImageResolution}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="选择分辨率" />
                  </SelectTrigger>
                  <SelectContent>
                    {resolutions.map((r) => (
                      <SelectItem key={r} value={String(r)}>{String(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reference Image (conditional) */}
            {hasImageUrl && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">参考图</Label>
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/*"
                  multiple={maxReferenceImages > 1}
                  className="hidden"
                  onChange={handleReferenceChange}
                />
                {referenceAssets.length > 0 ? (
                  <div className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        已选择 {referenceAssets.length} 张{maxReferenceImages > 1 ? `（最多 ${maxReferenceImages} 张）` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReferenceAssets([])}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="清除参考图"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {referenceAssets.map((asset, idx) => (
                        <div key={`${asset.fileName}_${idx}`} className="relative">
                          <img
                            src={asset.dataUrl}
                            alt={asset.fileName}
                            className="h-20 w-full rounded object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setReferenceAssets((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 rounded bg-black/60 text-white p-1"
                            aria-label="删除参考图"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => referenceInputRef.current?.click()}
                      disabled={imageGenerating}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> 添加/更换参考图
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9"
                    onClick={() => referenceInputRef.current?.click()}
                    disabled={imageGenerating}
                  >
                    <Upload className="h-4 w-4 mr-2" /> 上传参考图
                  </Button>
                )}
              </div>
            )}

            {/* Reference Strength (conditional) */}
            {hasStrength && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">参考强度</Label>
                  <span className="text-xs text-muted-foreground">{referenceStrength.toFixed(2)}</span>
                </div>
                <Slider
                  value={[referenceStrength]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => setReferenceStrength(v[0] ?? 0.6)}
                />
                <p className="text-xs text-muted-foreground">
                  数值越低越贴近参考图；越高越偏向文本生成
                </p>
              </div>
            )}

            {/* Midjourney Params */}
            {hasMidjourneyParams && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">速度</Label>
                  <Select
                    value={imageExtraParams.speed || 'fast'}
                    onValueChange={(v) => updateExtraParam('speed', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="turbo">Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Stylization</Label>
                    <span className="text-xs text-muted-foreground">{imageExtraParams.stylization || 1}</span>
                  </div>
                  <Slider
                    min={0} max={1000} step={1}
                    value={[imageExtraParams.stylization || 1]}
                    onValueChange={([v]) => updateExtraParam('stylization', v)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Weirdness</Label>
                    <span className="text-xs text-muted-foreground">{imageExtraParams.weirdness || 1}</span>
                  </div>
                  <Slider
                    min={0} max={3000} step={1}
                    value={[imageExtraParams.weirdness || 1]}
                    onValueChange={([v]) => updateExtraParam('weirdness', v)}
                  />
                </div>
              </>
            )}

            {/* Ideogram Params */}
            {hasIdeogramParams && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">渲染速度</Label>
                  <Select
                    value={imageExtraParams.render_speed || 'Balanced'}
                    onValueChange={(v) => updateExtraParam('render_speed', v)}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Turbo">Turbo</SelectItem>
                      <SelectItem value="Balanced">Balanced</SelectItem>
                      <SelectItem value="Quality">Quality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">风格</Label>
                  <Select
                    value={imageExtraParams.style || 'Auto'}
                    onValueChange={(v) => updateExtraParam('style', v)}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Auto">Auto</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Realistic">Realistic</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Prompt Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">描述文字</Label>
              <Textarea
                placeholder="描述你想生成的图片..."
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="min-h-[120px] resize-none"
              />
            </div>

            {/* Generate Button */}
            <Button
              className="w-full h-11"
              onClick={handleGenerate}
              disabled={imageGenerating || !imagePrompt.trim()}
            >
              {imageGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> 生成图片</>
              )}
            </Button>
          </div>
  );

  // 结果区域内容（复用）
  const renderResult = () => (
    <div className="flex items-center justify-center p-4 md:p-8 bg-muted/30">
        {imageGenerating ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">图片生成中，请稍候...</p>
          </div>
        ) : imageResult ? (
          <div className="max-w-full max-h-full relative group">
            <img
              src={imageResult}
              alt="Generated"
              className="max-w-full max-h-[calc(100vh-200px)] rounded-lg shadow-lg object-contain"
            />
            {/* 手机端默认显示；桌面端 hover 才显示 */}
            <div className="absolute bottom-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleOneClickVideo}
                disabled={videoGenerating || isStoryboardVideoLoading || imageGenerating}
              >
                {videoGenerating || isStoryboardVideoLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 一键生视频
                  </>
                ) : (
                  <>一键生视频</>
                )}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleSplitStoryboard} disabled={isSplitting || imageGenerating}>
                {isSplitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 切割中</> : <>切割分镜</>}
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <a href={getDownloadHref(imageResult)} download target="_blank" rel="noopener">
                  <Download className="h-4 w-4 mr-1" /> 下载
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ImageIcon className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">图片工作室</p>
            <p className="text-sm">选择模型，输入描述，生成你想要的图片</p>
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
          <div className="w-full min-h-0 flex-shrink-0 border-b pb-3">
            {renderControls()}
          </div>

          {/* 第二个面板：结果区 */}
          <div className="w-full min-h-[300px] flex-shrink-0">
            {renderResult()}
          </div>

          {/* 第三个面板：历史记录 */}
          <div className="w-full min-h-0 flex-shrink-0 border-t pt-3">
            <GenerationHistory type="image" onSelect={(entry) => {
              setImagePrompt(entry.prompt);
              setSelectedImageModel(entry.model);
              setImageResult(entry.resultUrl);
            }} />
          </div>
        </div>
      </div>

      {/* ========== 桌面端布局（保持原样，完全不变） ========== */}
      {/* 桌面端：水平布局 - 仅在 >= 768px 显示 */}
      <div className="hidden md:flex h-full">
        {/* Left: Controls */}
        <div className="w-[340px] border-r flex flex-col">
          <ScrollArea className="flex-1">
            {renderControls()}
          </ScrollArea>
        </div>

        {/* Center: Result */}
        <div className="flex-1">
          {renderResult()}
      </div>

      {/* Right: History */}
      <div className="w-[240px] border-l">
        <GenerationHistory type="image" onSelect={(entry) => {
          setImagePrompt(entry.prompt);
          setSelectedImageModel(entry.model);
          setImageResult(entry.resultUrl);
        }} />
        </div>
      </div>
    </div>
  );
}
