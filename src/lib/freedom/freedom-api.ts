// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * Freedom Panel API Client
 * Wraps moyin-creator's existing AI infrastructure for single-shot generation
 * Features: smart endpoint routing, retry with exponential backoff
 */

import {
  getAllFeatureConfigs,
  getFeatureConfig,
  getFeatureNotConfiguredMessage,
  type FeatureConfig,
} from '@/lib/ai/feature-router';
import { resolveImageApiFormat } from '@/lib/api-key-manager';
import { uploadBase64Image } from '@/lib/utils/image-upload';
import { isVeoModel, resolveVeoUploadCapability } from '@/lib/freedom/veo-capability';
import { type AIFeature, useAPIConfigStore } from '@/stores/api-config-store';
import { useMediaStore } from '@/stores/media-store';
import { useProjectStore } from '@/stores/project-store';
import { toast } from 'sonner';

// ==================== Types ====================

export interface FreedomImageParams {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  width?: number;
  height?: number;
  negativePrompt?: string;
  extraParams?: Record<string, any>;
}

export type FreedomVideoUploadRole = 'single' | 'first' | 'last' | 'reference';

export interface FreedomVideoUploadFile {
  role: FreedomVideoUploadRole;
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
}

export interface FreedomVideoParams {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  uploadFiles?: FreedomVideoUploadFile[];
}

export interface GenerationResult {
  url: string;
  taskId?: string;
  mediaId?: string;
}

// ==================== Constants ====================

const IMAGE_POLL_INTERVAL = 2000;
const IMAGE_POLL_MAX_ATTEMPTS = 60;
const VIDEO_POLL_INTERVAL = 2000;
const VIDEO_POLL_MAX_ATTEMPTS = 120;

// Aspect ratio to pixel dimension mapping
const ASPECT_RATIO_DIMS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1920, height: 1920 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
  '4:3': { width: 2560, height: 1920 },
  '3:4': { width: 1920, height: 2560 },
  '3:2': { width: 2560, height: 1707 },
  '2:3': { width: 1707, height: 2560 },
  '21:9': { width: 2932, height: 1257 },
};

const RESOLUTION_MULTIPLIERS: Record<string, number> = {
  '1K': 1,
  '2K': 2,
  '4K': 4,
};

function getTargetDimensions(aspectRatio: string, resolution?: string): { width: number; height: number } | undefined {
  const baseDims = ASPECT_RATIO_DIMS[aspectRatio];
  if (!baseDims) return undefined;
  const multiplier = RESOLUTION_MULTIPLIERS[resolution || '2K'] || 2;
  return {
    width: baseDims.width * multiplier,
    height: baseDims.height * multiplier,
  };
}

/**
 * 判断模型是否需要像素尺寸格式 (如 "1024x1024") 而非比例格式 (如 "1:1")
 * doubao-seedream, cogview 等国产模型需要像素尺寸
 */
function needsPixelSize(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('doubao') || m.includes('seedream') || m.includes('cogview') || false;
}

// Retry config
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 3000;

// ==================== Retry Logic ====================

/**
 * Check if an error is retryable (429 rate limit OR 503 service unavailable)
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  // Check status code
  if (err.status === 429 || err.status === 503) return true;
  if (err.code === 429 || err.code === 503) return true;
  // Check error message
  const message = (err.message || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('503') ||
    message.includes('rate') ||
    message.includes('quota') ||
    message.includes('too many requests') ||
    message.includes('service unavailable') ||
    message.includes('temporarily unavailable')
  );
}

/**
 * Retry an operation with exponential backoff for retryable errors
 */
async function freedomRetry<T>(
  operation: () => Promise<T>,
  label: string
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (!isRetryableError(error)) throw error;
      if (attempt < RETRY_MAX_ATTEMPTS - 1) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        console.warn(
          `[Freedom] ${label} hit retryable error, retrying in ${delay}ms... ` +
          `(Attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS}): ${lastError.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ==================== Helpers: Endpoint Building ====================

function buildEndpoint(baseUrl: string, path: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return /\/v\d+$/.test(normalized) ? `${normalized}/${path}` : `${normalized}/v1/${path}`;
}

function getRootBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.replace(/\/v\d+$/, '');
}

/**
 * In Web (browser) environment, direct requests to some providers (e.g. Volcano Ark)
 * are blocked by CORS. We route them through Vite's dev proxy (`/api/volcano`)
 * to keep requests same-origin.
 *
 * Note: `vite.web.config.ts` proxies `/api/volcano/*` → `https://ark.cn-beijing.volces.com/*`
 */
function maybeProxyVolcanoBaseUrl(baseUrl: string): string {
  // Only needed in browser runtime
  if (typeof window === 'undefined') return baseUrl;
  const trimmed = baseUrl.replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const isArk =
      host === 'ark.cn-beijing.volces.com' ||
      host.endsWith('.volces.com') && host.includes('ark') ||
      host === 'ark.volces.com';
    if (!isArk) return baseUrl;
    // Preserve pathname (e.g. /api/v3) so buildEndpoint keeps working
    return `/api/volcano${u.pathname}`;
  } catch {
    // If it's already a relative url like /api/volcano/api/v3, keep as-is
    return baseUrl;
  }
}

function pickFeatureConfig(feature: AIFeature, requestedModel?: string): FeatureConfig | null {
  const all = getAllFeatureConfigs(feature);
  if (all.length === 0) return null;
  if (requestedModel) {
    return all.find((c) => c.model === requestedModel) ?? null;
  }
  return getFeatureConfig(feature) ?? all[0];
}

function resolveFreedomFeatureConfig(
  feature: 'freedom_image' | 'freedom_video',
  fallback: 'character_generation' | 'video_generation',
  requestedModel?: string,
): { config: FeatureConfig | null; source: string } {
  const primary = pickFeatureConfig(feature, requestedModel);
  if (primary) return { config: primary, source: feature };

  const fb = pickFeatureConfig(fallback, requestedModel);
  if (fb) return { config: fb, source: `${fallback} (fallback)` };

  return { config: null, source: feature };
}

type FreedomImageRoute = 'midjourney' | 'ideogram' | 'kling_image' | 'openai_chat' | 'openai_images' | 'replicate';

function detectFreedomImageRoute(model: string, endpointTypes?: string[]): FreedomImageRoute {
  const lower = model.toLowerCase();
  const hasEndpoint = (re: RegExp) => (endpointTypes || []).some((t) => re.test(t));

  if (/^mj_/i.test(model) || /midjourney/i.test(model) || /^niji-/i.test(model) || hasEndpoint(/midjourney/i)) {
    return 'midjourney';
  }
  if (/^ideogram_/i.test(model)) {
    return 'ideogram';
  }
  if (/^kling-(image|omni-image)$/i.test(model)) {
    return 'kling_image';
  }

  // Replicate: endpoint type uses '{org}/{model}异步' pattern (contains '/' before '异步')
  if ((endpointTypes || []).some(t => t.includes('/') && t.endsWith('异步'))) {
    return 'replicate';
  }

  const baseRoute = resolveImageApiFormat(endpointTypes, model);
  return baseRoute === 'openai_chat' ? 'openai_chat' : 'openai_images';
}

type FreedomVideoRoute = 'openai_official' | 'unified' | 'volc' | 'wan' | 'kling' | 'replicate';

const FREEDOM_VIDEO_ROUTE_MAP: Record<string, FreedomVideoRoute> = {
  'openAI官方视频格式': 'openai_official',
  'openAI视频格式': 'openai_official',
  '豆包视频异步': 'volc',  // doubao-seedance uses /volc/v1/contents/generations/tasks
  '异步': 'wan',
  '文生视频': 'kling',
  '图生视频': 'kling',
  '视频延长': 'kling',
  'omni-video': 'kling',
  '动作控制': 'kling',
  '多模态视频编辑': 'kling',
  '数字人': 'kling',
  '对口型': 'kling',
  '视频特效': 'kling',
  '视频统一格式': 'unified',
  'grok视频': 'unified',
  'openai-response': 'unified',
  '海螺视频生成': 'unified',
  'luma视频生成': 'unified',
  'luma视频扩展': 'unified',
  'runway图生视频': 'unified',
  'aigc-video': 'unified',
  'wan视频生成': 'unified',  // wan2.6 models use memefast /v1/video/generations
  // Vidu endpoint types (all route to unified /v1/video/generations)
  'vidu文生视频': 'unified',
  'vidu图生视频': 'unified',
  'vidu参考生视频': 'unified',
  'vidu首尾帧': 'unified',
  'luma视频延长': 'unified',  // luma extend uses 延长 (file 04 naming)
};

function detectFreedomVideoRoute(model: string, endpointTypes?: string[]): FreedomVideoRoute {
  if (endpointTypes && endpointTypes.length > 0) {
    // 优先级：官方 Sora -> Kling -> Volc -> Wan -> Replicate -> Unified
    for (const t of endpointTypes) {
      if (FREEDOM_VIDEO_ROUTE_MAP[t] === 'openai_official') return 'openai_official';
    }
    for (const t of endpointTypes) {
      if (FREEDOM_VIDEO_ROUTE_MAP[t] === 'kling') return 'kling';
    }
    for (const t of endpointTypes) {
      if (FREEDOM_VIDEO_ROUTE_MAP[t] === 'volc') return 'volc';
    }
    for (const t of endpointTypes) {
      if (FREEDOM_VIDEO_ROUTE_MAP[t] === 'wan') return 'wan';
    }
    // Replicate: endpoint type uses '{org}/{model}异步' pattern (contains '/' before '异步')
    if (endpointTypes.some(t => t.includes('/') && t.endsWith('异步'))) return 'replicate';
    for (const t of endpointTypes) {
      if (FREEDOM_VIDEO_ROUTE_MAP[t] === 'unified') return 'unified';
    }
  }

  const m = model.toLowerCase();
  if (m.includes('sora-2')) return 'openai_official';
  if (m.includes('kling')) return 'kling';
  // Doubao / Seedance (Volcano Ark) models should route via volc API
  // Some configs may not populate endpointTypes; fall back to model ID heuristics.
  if (m.includes('doubao') || m.includes('seedance')) return 'volc';
  if (m.includes('wan')) return 'wan';
  return 'unified';
}

// ==================== Image Generation ====================

export async function generateFreedomImage(
  params: FreedomImageParams
): Promise<GenerationResult> {
  return freedomRetry(() => _generateFreedomImageInner(params), 'Image generation');
}

async function _generateFreedomImageInner(
  params: FreedomImageParams
): Promise<GenerationResult> {
  const { config, source: configSource } = resolveFreedomFeatureConfig(
    'freedom_image',
    'character_generation',
    params.model,
  );
  if (!config) {
    const msg = getFeatureNotConfiguredMessage('character_generation');
    toast.error('自由板块图片生成未配置：请在设置中配置「自由板块-图片」或「图片生成」服务映射');
    throw new Error(msg);
  }
  console.log(`[Freedom] Image config source: ${configSource}`);

  const { apiKey, baseUrl, model: defaultModel } = config;
  // 模型 ID 直接透传：UI 选的就是供应商原始 ID，无需转换
  const model = params.model || defaultModel;
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  // ── Smart Routing: choose endpoint based on model metadata ──
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];
  const route = detectFreedomImageRoute(model, endpointTypes);

  console.log('[Freedom] Generating image:', {
    model,
    route,
    endpointTypes,
    prompt: params.prompt.slice(0, 50),
  });
  if (route === 'midjourney') {
    return await generateViaMidjourneyEndpoint(params, model, apiKey, normalizedBase);
  }
  if (route === 'ideogram') {
    return await generateViaIdeogramEndpoint(params, model, apiKey, normalizedBase);
  }
  if (route === 'openai_chat') {
    return await generateViaChatCompletions(params, model, apiKey, normalizedBase);
  }
  if (route === 'kling_image') {
    return await generateViaKlingImagesEndpoint(params, model, apiKey, normalizedBase);
  }
  if (route === 'replicate') {
    return await generateViaReplicateImageEndpoint(params, model, apiKey, normalizedBase);
  }
  return await generateViaImagesEndpoint(params, model, apiKey, normalizedBase);
}

/**
 * Generate image via /v1/chat/completions (for Gemini, GPT-image, etc.)
 */
async function generateViaChatCompletions(
  params: FreedomImageParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const endpoint = buildEndpoint(baseUrl, 'chat/completions');
  const aspectRatio = params.aspectRatio || '1:1';

  const userContent: Array<{ type: string; text?: string }> = [
    { type: 'text', text: `Generate an image with aspect ratio ${aspectRatio}: ${params.prompt}` },
  ];

  const requestBody = {
    model,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 4096,
  };

  console.log('[Freedom] Submitting via chat completions:', { model, endpoint });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `图片生成 API 错误: ${response.status}`;
    try { const j = JSON.parse(errorText); msg = j.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const imageUrl = extractChatCompletionsImage(data);

  if (!imageUrl) {
    throw new Error('未能从聊天响应中提取图片 URL');
  }

  const mediaId = saveToMediaLibrary(imageUrl, params.prompt, 'ai-image');
  return { url: imageUrl, mediaId };
}

/**
 * Extract image URL from chat completions response (multiple formats)
 */
function extractChatCompletionsImage(data: any): string | null {
  const choice = data.choices?.[0];
  if (!choice) return null;

  const message = choice.message;

  // Format 1: content is array with image parts (OpenAI multimodal)
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        return part.image_url.url;
      }
      if (part.type === 'image' && part.image?.url) {
        return part.image.url;
      }
      if (part.type === 'image' && part.data) {
        return `data:image/png;base64,${part.data}`;
      }
    }
  }

  // Format 2: content is string with markdown image link or base64
  if (typeof message?.content === 'string') {
    const mdMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    if (mdMatch) return mdMatch[1];
    const b64Match = message.content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
    if (b64Match) return b64Match[1];
  }

  return null;
}

/**
 * Generate image via standard /v1/images/generations endpoint
 */
async function generateViaImagesEndpoint(
  params: FreedomImageParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const body: Record<string, any> = {
    prompt: params.prompt,
    model,
  };

  // Check if model needs pixel size format (e.g., doubao-seedream)
  const usePixelSize = needsPixelSize(model);

  if (params.aspectRatio) {
    if (usePixelSize) {
      // For models like doubao-seedream, use size parameter with pixel dimensions
      const baseDims = ASPECT_RATIO_DIMS[params.aspectRatio];
      if (baseDims) {
        // Use base dimensions without resolution multiplier for size parameter
        body.size = `${baseDims.width}x${baseDims.height}`;
      }
    } else {
      // For other models, use aspect_ratio and optionally width/height
      body.aspect_ratio = params.aspectRatio;
      
      // If width/height are provided, use them directly
      if (params.width && params.height) {
        body.width = params.width;
        body.height = params.height;
      } else {
        // Convert aspectRatio + resolution to width/height if needed
        const dims = getTargetDimensions(params.aspectRatio, params.resolution);
        if (dims) {
          body.width = dims.width;
          body.height = dims.height;
        }
      }
    }
  } else if (params.width && params.height) {
    // If width/height are provided without aspectRatio, use them directly
    body.width = params.width;
    body.height = params.height;
  }
  
  if (params.resolution && !usePixelSize) body.resolution = params.resolution;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.extraParams) {
    Object.assign(body, params.extraParams);
  }

  const submitUrl = buildEndpoint(baseUrl, 'images/generations');
  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${errText}`);
  }

  const data = await response.json();

  // Try to get image URL directly
  let imageUrl = extractImageUrl(data);

  // If async task, poll for result
  if (!imageUrl && data.task_id) {
    imageUrl = await pollForResult(
      `${baseUrl}/v1/images/generations/${data.task_id}`,
      apiKey,
      IMAGE_POLL_INTERVAL,
      IMAGE_POLL_MAX_ATTEMPTS
    );
  }

  if (!imageUrl) {
    throw new Error('No image URL in response');
  }

  const mediaId = saveToMediaLibrary(imageUrl, params.prompt, 'ai-image');
  return { url: imageUrl, taskId: data.task_id, mediaId };
}

/**
 * Generate image via Kling's native /kling/v1/images/* endpoints
 * Falls back to standard /v1/images/generations if native endpoint fails
 */
async function generateViaKlingImagesEndpoint(
  params: FreedomImageParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const rootBase = getRootBaseUrl(baseUrl);
  const nativePath = model === 'kling-omni-image'
    ? 'kling/v1/images/omni-image'
    : 'kling/v1/images/generations';

  const body: Record<string, any> = { prompt: params.prompt, model };
  if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.extraParams) Object.assign(body, params.extraParams);

  let response: Response;
  try {
    response = await fetch(`${rootBase}/${nativePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch {
    return generateViaImagesEndpoint(params, model, apiKey, baseUrl);
  }

  if (!response.ok) {
    return generateViaImagesEndpoint(params, model, apiKey, baseUrl);
  }

  const data = await response.json();
  let imageUrl = extractImageUrl(data);

  if (!imageUrl && data.task_id) {
    imageUrl = await pollForResult(
      `${rootBase}/${nativePath}/${data.task_id}`,
      apiKey,
      IMAGE_POLL_INTERVAL,
      IMAGE_POLL_MAX_ATTEMPTS,
    );
  }

  if (!imageUrl) {
    return generateViaImagesEndpoint(params, model, apiKey, baseUrl);
  }

  const mediaId = saveToMediaLibrary(imageUrl, params.prompt, 'ai-image');
  return { url: imageUrl, taskId: data.task_id, mediaId };
}

function toHttpError(prefix: string, status: number, body: string): Error & { status: number } {
  const err = new Error(`${prefix}: ${status} ${body}`) as Error & { status: number };
  err.status = status;
  return err;
}

function buildMidjourneyPrompt(params: FreedomImageParams): string {
  let prompt = params.prompt;
  const extra = params.extraParams || {};
  const aspect = params.aspectRatio;
  const stylization = typeof extra.stylization === 'number' ? extra.stylization : undefined;
  const weirdness = typeof extra.weirdness === 'number' ? extra.weirdness : undefined;

  if (aspect && !/\s--ar\s+\S+/i.test(prompt)) {
    prompt += ` --ar ${aspect}`;
  }
  if (stylization !== undefined && !/\s--s(tylize)?\s+\S+/i.test(prompt)) {
    prompt += ` --s ${stylization}`;
  }
  if (weirdness !== undefined && !/\s--weird\s+\S+/i.test(prompt)) {
    prompt += ` --weird ${weirdness}`;
  }
  return prompt;
}

function mapMidjourneyMode(speed: unknown): string[] | undefined {
  if (typeof speed !== 'string') return undefined;
  const normalized = speed.toLowerCase();
  if (normalized === 'relaxed') return ['RELAX'];
  if (normalized === 'fast') return ['FAST'];
  if (normalized === 'turbo') return ['TURBO'];
  return undefined;
}

async function generateViaMidjourneyEndpoint(
  params: FreedomImageParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const rootBase = getRootBaseUrl(baseUrl);
  const submitUrl = `${rootBase}/mj/submit/imagine`;
  const extra = params.extraParams || {};
  const requestBody: Record<string, any> = {
    prompt: buildMidjourneyPrompt(params),
  };
  const modes = mapMidjourneyMode(extra.speed);
  if (modes) requestBody.accountFilter = { modes };
  if (/niji/i.test(model)) requestBody.botType = 'NIJI_JOURNEY';
  // 垫图：base64Array（图片引导，格式 data:image/png;base64,xxx）
  if (Array.isArray(extra.base64Array) && extra.base64Array.length > 0) {
    requestBody.base64Array = extra.base64Array;
  }

  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!submitResp.ok) {
    throw toHttpError('Midjourney submit failed', submitResp.status, await submitResp.text());
  }

  const submitData = await submitResp.json();
  // MJ API 成功时 code === 1；其他值表示 API 层错误（即使 HTTP 200）
  if (submitData.code !== undefined && submitData.code !== 1) {
    throw new Error(submitData.description || submitData.error || `Midjourney 提交失败 (code=${submitData.code})`);
  }
  const taskId = submitData.result || submitData.task_id || submitData.id;
  if (!taskId) throw new Error('Midjourney 返回空任务 ID');

  const pollUrl = `${rootBase}/mj/task/${taskId}/fetch`;
  for (let i = 0; i < IMAGE_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.status || '').toLowerCase();
    if (status === 'success' || status === 'succeeded' || status === 'completed') {
      const imageUrl =
        pollData.imageUrl ||
        pollData.image_url ||
        pollData.url ||
        pollData.data?.imageUrl ||
        pollData.data?.image_url;
      if (!imageUrl) throw new Error('Midjourney 成功但未返回图片 URL');
      const mediaId = saveToMediaLibrary(imageUrl, params.prompt, 'ai-image');
      return { url: imageUrl, taskId: String(taskId), mediaId };
    }
    if (status === 'failure' || status === 'failed' || status === 'error') {
      throw new Error(pollData.failReason || pollData.message || 'Midjourney 生成失败');
    }
  }

  throw new Error('Midjourney 生成超时');
}

function toIdeogramAspectRatio(model: string, aspectRatio?: string): string | undefined {
  if (!aspectRatio) return undefined;

  // V1/V2 使用 ASPECT_16_9；V3 使用 16x9
  if (/_V_[12](_|$)/i.test(model)) {
    return `ASPECT_${aspectRatio.replace(':', '_')}`;
  }
  return aspectRatio.replace(':', 'x');
}

function toIdeogramRenderSpeed(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const normalized = input.toLowerCase();
  if (normalized === 'turbo') return 'TURBO';
  if (normalized === 'quality') return 'QUALITY';
  if (normalized === 'balanced') return 'DEFAULT';
  return input.toUpperCase();
}

/**
 * 从 model 名后缀自动提取 rendering_speed
 * e.g. ideogram_generate_V_3_TURBO → 'TURBO'
 */
function toIdeogramRenderSpeedFromModel(model: string): string | undefined {
  const match = model.match(/_(TURBO|DEFAULT|QUALITY|FLASH)$/i);
  return match ? match[1].toUpperCase() : undefined;
}

async function generateViaIdeogramEndpoint(
  params: FreedomImageParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  // Ideogram 原生路径：/ideogram/v1/ideogram-v3/generate（不是 /v1/ideogram-v3/generate）
  const rootBase = getRootBaseUrl(baseUrl);
  const endpoint = `${rootBase}/ideogram/v1/ideogram-v3/generate`;
  const extra = params.extraParams || {};
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', params.prompt);

  const aspect = toIdeogramAspectRatio(model, params.aspectRatio);
  if (aspect) form.append('aspect_ratio', aspect);

  // extraParams 优先；无则从 model 名后缀推断（e.g. ideogram_generate_V_3_TURBO）
  const speed = toIdeogramRenderSpeed(extra.render_speed || extra.rendering_speed)
    ?? toIdeogramRenderSpeedFromModel(model);
  if (speed) form.append('rendering_speed', speed);

  if (typeof extra.style === 'string') form.append('style_type', extra.style.toUpperCase());
  if (typeof params.negativePrompt === 'string' && params.negativePrompt.trim()) {
    form.append('negative_prompt', params.negativePrompt);
  }
  if (typeof extra.num_images === 'number') form.append('num_images', String(extra.num_images));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw toHttpError('Ideogram generate failed', response.status, await response.text());
  }

  const data = await response.json();
  const imageUrl = extractImageUrl(data);
  if (!imageUrl) throw new Error('Ideogram 响应未包含图片 URL');
  const mediaId = saveToMediaLibrary(imageUrl, params.prompt, 'ai-image');
  return { url: imageUrl, mediaId };
}

/**
 * Generate image via Replicate's /replicate/v1/predictions endpoint
 * Request body: { model, input: { prompt, aspect_ratio, ... } }
 * Poll until status === 'succeeded' / 'failed' / 'canceled'
 */
async function generateViaReplicateImageEndpoint(
  params: FreedomImageParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const rootBase = getRootBaseUrl(baseUrl);
  const submitUrl = `${rootBase}/replicate/v1/predictions`;

  const input: Record<string, any> = { prompt: params.prompt };
  
  // If width/height are provided, use them directly
  if (params.width && params.height) {
    input.width = params.width;
    input.height = params.height;
  } else if (params.aspectRatio) {
    // Convert aspectRatio + resolution to width/height if needed
    const dims = getTargetDimensions(params.aspectRatio, params.resolution);
    if (dims) {
      input.width = dims.width;
      input.height = dims.height;
    }
    // Also include aspect_ratio for APIs that support it
    input.aspect_ratio = params.aspectRatio;
  }
  
  if (params.resolution) input.resolution = params.resolution;
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
  if (params.extraParams) Object.assign(input, params.extraParams);

  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input }),
  });
  if (!submitResp.ok) {
    throw toHttpError('Replicate submit failed', submitResp.status, await submitResp.text());
  }

  const submitData = await submitResp.json();
  const directUrl = extractImageUrl(submitData);
  if (directUrl) {
    const mediaId = saveToMediaLibrary(directUrl, params.prompt, 'ai-image');
    return { url: directUrl, mediaId };
  }

  const predictionId = submitData.id;
  if (!predictionId) throw new Error('Replicate 返回空 prediction ID');

  const pollUrl = `${rootBase}/replicate/v1/predictions/${predictionId}`;
  for (let i = 0; i < IMAGE_POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, IMAGE_POLL_INTERVAL));
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.status || '').toLowerCase();
    if (status === 'succeeded') {
      const imageUrl = extractImageUrl(pollData);
      if (!imageUrl) throw new Error('Replicate 成功但未返回图片 URL');
      const mediaId = saveToMediaLibrary(imageUrl, params.prompt, 'ai-image');
      return { url: imageUrl, taskId: String(predictionId), mediaId };
    }
    if (status === 'failed' || status === 'canceled') {
      throw new Error(pollData.error || 'Replicate 图片生成失败');
    }
  }
  throw new Error('Replicate 图片生成超时');
}

// ==================== Video Generation ====================

export async function generateFreedomVideo(
  params: FreedomVideoParams
): Promise<GenerationResult> {
  return freedomRetry(() => _generateFreedomVideoInner(params), 'Video generation');
}

async function _generateFreedomVideoInner(
  params: FreedomVideoParams
): Promise<GenerationResult> {
  const { config, source: configSource } = resolveFreedomFeatureConfig(
    'freedom_video',
    'video_generation',
    params.model,
  );
  if (!config) {
    const msg = getFeatureNotConfiguredMessage('video_generation');
    toast.error('自由板块视频生成未配置：请在设置中配置「自由板块-视频」或「视频生成」服务映射');
    throw new Error(msg);
  }
  console.log(`[Freedom] Video config source: ${configSource}`);

  const { apiKey, baseUrl, model: defaultModel } = config;
  // 模型 ID 直接透传：UI 选的就是供应商原始 ID，无需转换
  const model = params.model || defaultModel;
  // CORS workaround for Web: proxy Volcano Ark through same-origin endpoint
  const effectiveBaseUrl = maybeProxyVolcanoBaseUrl(baseUrl);

  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];
  const route = detectFreedomVideoRoute(model, endpointTypes);
  console.log('[Freedom] Generating video:', {
    model,
    route,
    endpointTypes,
    prompt: params.prompt.slice(0, 50),
  });

  let result: GenerationResult;
  switch (route) {
    case 'openai_official':
      result = await generateVideoViaOpenAIOfficial(params, model, apiKey, effectiveBaseUrl);
      break;
    case 'volc':
      result = await generateVideoViaVolc(params, model, apiKey, effectiveBaseUrl);
      break;
    case 'wan':
      result = await generateVideoViaWan(params, model, apiKey, effectiveBaseUrl);
      break;
    case 'kling':
      result = await generateVideoViaKling(params, model, apiKey, effectiveBaseUrl);
      break;
    case 'replicate':
      result = await generateVideoViaReplicate(params, model, apiKey, effectiveBaseUrl);
      break;
    default:
      result = await generateVideoViaUnified(params, model, apiKey, effectiveBaseUrl);
      break;
  }

  const mediaId = saveToMediaLibrary(result.url, params.prompt, 'ai-video');
  return { ...result, mediaId };
}

/**
 * Convert aspect ratio string to Runway pixel-format ratio (e.g. '16:9' → '1280:720')
 */
function toRunwayRatio(aspectRatio: string): string {
  const map: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1':  '720:720',
    '4:3':  '960:720',
    '3:4':  '720:960',
    '21:9': '2048:880',
  };
  return map[aspectRatio] ?? aspectRatio;
}

function toSoraSize(aspectRatio?: string, resolution?: string): string {
  const isPortrait = aspectRatio === '9:16' || aspectRatio === '3:4';
  const is1080 = (resolution || '').toLowerCase().includes('1080');
  if (is1080) return isPortrait ? '1080x1920' : '1920x1080';
  return isPortrait ? '720x1280' : '1280x720';
}

function toVeoOpenAIVideoSize(aspectRatio?: string): string {
  const isPortrait = aspectRatio === '9:16' || aspectRatio === '3:4';
  return isPortrait ? '1080x1920' : '1920x1080';
}

function groupVideoUploadFiles(uploadFiles?: FreedomVideoUploadFile[]) {
  const grouped: {
    single?: FreedomVideoUploadFile;
    first?: FreedomVideoUploadFile;
    last?: FreedomVideoUploadFile;
    references: FreedomVideoUploadFile[];
  } = { references: [] };

  for (const file of uploadFiles || []) {
    if (file.role === 'single' && !grouped.single) grouped.single = file;
    if (file.role === 'first' && !grouped.first) grouped.first = file;
    if (file.role === 'last' && !grouped.last) grouped.last = file;
    if (file.role === 'reference') grouped.references.push(file);
  }

  return grouped;
}

function countVideoUploadFiles(grouped: ReturnType<typeof groupVideoUploadFiles>): number {
  return (
    (grouped.single ? 1 : 0) +
    (grouped.first ? 1 : 0) +
    (grouped.last ? 1 : 0) +
    grouped.references.length
  );
}

function validateVeoVideoUploads(
  model: string,
  endpointTypes: string[] | undefined,
  uploadFiles?: FreedomVideoUploadFile[],
): ReturnType<typeof groupVideoUploadFiles> {
  const capability = resolveVeoUploadCapability(model, endpointTypes);
  const grouped = groupVideoUploadFiles(uploadFiles);
  const total = countVideoUploadFiles(grouped);

  if (!capability.isVeo) return grouped;

  if (capability.mode === 'none') {
    if (total > 0) throw new Error(`模型 ${model} 不支持上传文件输入`);
    return grouped;
  }

  if (capability.mode === 'single') {
    const file = grouped.single || grouped.first;
    // 允许纯文本生成：只有当用户上传了文件但格式不对时才报错
    // 如果用户没有上传任何文件，允许继续（纯文本模式）
    if (total > 0 && capability.minFiles > 0 && !file) {
      throw new Error(`模型 ${model} 需要上传 1 张图片`);
    }
    if (grouped.references.length > 0 || !!grouped.last || (!!grouped.single && !!grouped.first)) {
      throw new Error(`模型 ${model} 仅支持 1 张图片输入`);
    }
    return grouped;
  }

  if (capability.mode === 'first_last') {
    if (grouped.references.length > 0 || !!grouped.single) {
      throw new Error(`模型 ${model} 仅支持首帧/尾帧输入`);
    }
    // 允许纯文本生成：只有当用户上传了文件但格式不对时才报错
    if (total > 0 && capability.minFiles > 0 && !grouped.first) {
      throw new Error(`模型 ${model} 需要上传首帧图片`);
    }
    if (!grouped.first && grouped.last) {
      throw new Error(`模型 ${model} 仅上传尾帧无效，请先上传首帧`);
    }
    if (total > capability.maxFiles) {
      throw new Error(`模型 ${model} 最多支持 2 张图片（首帧/尾帧）`);
    }
    return grouped;
  }

  if (capability.mode === 'multi') {
    if (!!grouped.single || !!grouped.first || !!grouped.last) {
      throw new Error(`模型 ${model} 仅支持多参考图输入`);
    }
    // 允许纯文本生成：只有当用户上传了文件但数量不足时才报错
    // 如果用户没有上传任何文件，允许继续（纯文本模式）
    if (total > 0 && grouped.references.length < capability.minFiles) {
      throw new Error(`模型 ${model} 至少需要上传 ${capability.minFiles} 张参考图`);
    }
    if (grouped.references.length > capability.maxFiles) {
      throw new Error(`模型 ${model} 最多支持 ${capability.maxFiles} 张参考图`);
    }
    return grouped;
  }

  return grouped;
}

async function toUploadHttpUrl(file: FreedomVideoUploadFile): Promise<string> {
  if (/^https?:\/\//i.test(file.dataUrl)) return file.dataUrl;
  return uploadBase64Image(file.dataUrl);
}

function dataUrlToBlob(dataUrl: string, mimeHint?: string): Blob {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('上传文件格式无效，必须是 data URL 或 http(s) URL');
  const mime = match[1] || mimeHint || 'image/png';
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function toUploadBlob(file: FreedomVideoUploadFile): Promise<Blob> {
  if (/^https?:\/\//i.test(file.dataUrl)) {
    const resp = await fetch(file.dataUrl);
    if (!resp.ok) throw new Error(`无法下载上传素材：${resp.status}`);
    return resp.blob();
  }
  return dataUrlToBlob(file.dataUrl, file.mimeType);
}

async function appendVeoMultipartReferences(
  form: FormData,
  model: string,
  endpointTypes: string[] | undefined,
  uploadFiles?: FreedomVideoUploadFile[],
) {
  const capability = resolveVeoUploadCapability(model, endpointTypes);
  if (!capability.isVeo) return;

  const grouped = validateVeoVideoUploads(model, endpointTypes, uploadFiles);
  const ordered: FreedomVideoUploadFile[] = [];

  if (capability.mode === 'single') {
    const single = grouped.single || grouped.first;
    if (single) ordered.push(single);
  } else if (capability.mode === 'first_last') {
    if (grouped.first) ordered.push(grouped.first);
    if (grouped.last) ordered.push(grouped.last);
  } else if (capability.mode === 'multi') {
    ordered.push(...grouped.references.slice(0, capability.maxFiles));
  }

  for (let i = 0; i < ordered.length; i++) {
    const file = ordered[i];
    const blob = await toUploadBlob(file);
    const fileName = file.fileName || `veo-reference-${i + 1}.png`;
    form.append('input_reference', blob, fileName);
  }
}

async function buildVeoUnifiedVideoBody(
  params: FreedomVideoParams,
  model: string,
  endpointTypes: string[] | undefined,
): Promise<Record<string, any>> {
  const capability = resolveVeoUploadCapability(model, endpointTypes);
  const grouped = validateVeoVideoUploads(model, endpointTypes, params.uploadFiles);
  const body: Record<string, any> = {
    model,
    prompt: params.prompt,
  };
  const metadata: Record<string, any> = {};

  if (params.duration) body.duration = params.duration;
  if (params.aspectRatio) metadata.aspectRatio = params.aspectRatio;
  if (params.resolution) metadata.resolution = params.resolution.toLowerCase();

  if (capability.mode === 'single') {
    const single = grouped.single || grouped.first;
    if (single) body.image = await toUploadHttpUrl(single);
  } else if (capability.mode === 'first_last') {
    if (grouped.first) body.image = await toUploadHttpUrl(grouped.first);
    if (grouped.last) {
      metadata.lastFrame = { url: await toUploadHttpUrl(grouped.last) };
    }
  } else if (capability.mode === 'multi') {
    const refs = grouped.references.slice(0, capability.maxFiles);
    metadata.referenceImages = await Promise.all(
      refs.map(async (f) => ({ url: await toUploadHttpUrl(f) })),
    );
  }

  if (Object.keys(metadata).length > 0) body.metadata = metadata;
  return body;
}

async function generateVideoViaOpenAIOfficial(
  params: FreedomVideoParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const endpoint = buildEndpoint(baseUrl, 'videos');
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];
  const isVeo = isVeoModel(model);
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', params.prompt);
  form.append('size', isVeo ? toVeoOpenAIVideoSize(params.aspectRatio) : toSoraSize(params.aspectRatio, params.resolution));
  form.append('seconds', String(params.duration || (isVeo ? 8 : 10)));
  if (isVeo) {
    await appendVeoMultipartReferences(form, model, endpointTypes, params.uploadFiles);
  }

  const submitResp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  });
  if (!submitResp.ok) {
    throw toHttpError('Sora submit failed', submitResp.status, await submitResp.text());
  }

  const submitData = await submitResp.json();
  const taskId = submitData.id || submitData.video_id;
  const directUrl = extractVideoUrl(submitData);
  if (directUrl) return { url: directUrl, taskId: taskId ? String(taskId) : undefined };
  if (!taskId) throw new Error('Sora 返回空任务 ID');

  const pollUrl = buildEndpoint(baseUrl, `videos/${taskId}`);
  for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL));
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.status || '').toLowerCase();
    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      const videoUrl = extractVideoUrl(pollData) || buildEndpoint(baseUrl, `videos/${taskId}/content`);
      return { url: videoUrl, taskId: String(taskId) };
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(pollData.error?.message || pollData.error || pollData.message || 'Sora 生成失败');
    }
  }

  throw new Error('Sora 生成超时');
}

async function generateVideoViaUnified(
  params: FreedomVideoParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];

  let body: Record<string, any>;
  if (isVeoModel(model)) {
    body = await buildVeoUnifiedVideoBody(params, model, endpointTypes);
  } else {
    const isLuma = (endpointTypes || []).some(t => /luma/i.test(t));
    const isRunway = (endpointTypes || []).some(t => /runway/i.test(t));

    body = { model, prompt: params.prompt };
    const metadata: Record<string, any> = {};

    // Duration: Luma requires string with unit ("5s"), other models use number
    if (params.duration) {
      body.duration = isLuma ? `${params.duration}s` : params.duration;
    }

    // AspectRatio: Runway uses metadata.ratio (pixel format); all others use metadata.aspect_ratio
    if (params.aspectRatio) {
      if (isRunway) {
        metadata.ratio = toRunwayRatio(params.aspectRatio);
      } else {
        metadata.aspect_ratio = params.aspectRatio;
      }
    }

    // Resolution: all non-Runway models pass via metadata
    if (params.resolution && !isRunway) {
      metadata.resolution = params.resolution;
    }

    // Image inputs (wan2.6, doubao, luma, vidu, minimax, runway, etc.)
    const grouped = groupVideoUploadFiles(params.uploadFiles);
    if (grouped.single || grouped.first) {
      body.image = await toUploadHttpUrl((grouped.single || grouped.first)!);
    }
    if (grouped.last) {
      metadata.image_end = await toUploadHttpUrl(grouped.last);
    }
    // Reference images: vidu参考生视频 and similar models
    if (grouped.references.length > 0) {
      metadata.reference_images = await Promise.all(
        grouped.references.map(async (f) => ({ url: await toUploadHttpUrl(f) }))
      );
    }

    if (Object.keys(metadata).length > 0) body.metadata = metadata;
  }

  const submitCandidates = [
    buildEndpoint(baseUrl, 'video/generations'),
    buildEndpoint(baseUrl, 'video/create'),
  ];

  let submitData: any = null;
  let submitError: Error | null = null;
  for (const submitUrl of submitCandidates) {
    const resp = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      submitData = await resp.json();
      submitError = null;
      break;
    }

    const text = await resp.text();
    const err = toHttpError('Unified video submit failed', resp.status, text);
    if (resp.status === 404 || resp.status === 405) {
      submitError = err;
      continue;
    }
    throw err;
  }
  if (!submitData) throw submitError || new Error('Unified video submit failed');

  const taskId = submitData.task_id || submitData.id || submitData.request_id;
  const directUrl = extractVideoUrl(submitData);
  if (directUrl) return { url: directUrl, taskId: taskId ? String(taskId) : undefined };
  if (!taskId) throw new Error('统一视频接口返回空任务 ID');

  const pollUrls = [
    buildEndpoint(baseUrl, `video/generations/${taskId}`),
    buildEndpoint(baseUrl, `video/query?id=${taskId}`),
  ];

  for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL));
    for (const pollUrl of pollUrls) {
      const pollResp = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      const status = String(pollData.status || pollData.state || pollData.data?.status || '').toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const videoUrl = extractVideoUrl(pollData);
        if (videoUrl) return { url: videoUrl, taskId: String(taskId) };
      }
      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        throw new Error(pollData.error?.message || pollData.error || pollData.message || '视频生成失败');
      }
    }
  }

  throw new Error('视频生成超时');
}

async function generateVideoViaVolc(
  params: FreedomVideoParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  // 先判断是否为官方API，再处理Base URL
  // 判断是否为火山方舟官方API（包含 /api/v3 或 ark.cn-beijing.volces.com）
  const isOfficialApi = baseUrl.includes('/api/v3') || baseUrl.includes('ark.cn-beijing.volces.com') || baseUrl.includes('ark.volces.com');
  
  // 根据是否为官方API，使用不同的Base URL处理方式
  let rootBase: string;
  if (isOfficialApi) {
    // 官方API：规范化Base URL，确保正确处理
    rootBase = baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
    
    // 如果包含 /api/v3，保留它（但移除后面的内容）
    if (rootBase.includes('/api/v3')) {
      // 只保留到 /api/v3
      const match = rootBase.match(/^(https?:\/\/[^\/]+(?:\/[^\/]+)*\/api\/v3)/);
      rootBase = match ? match[1] : rootBase.split('/api/v3')[0] + '/api/v3';
    } else if (rootBase.includes('/api') && !rootBase.includes('/api/v3')) {
      // 如果只有 /api，替换为 /api/v3
      rootBase = rootBase.replace(/\/api(\/.*)?$/, '/api/v3');
    } else {
      // 如果没有 /api，添加 /api/v3
      rootBase = `${rootBase}/api/v3`;
    }
  } else {
    // 代理API：使用 getRootBaseUrl 移除版本号
    rootBase = getRootBaseUrl(baseUrl);
  }
  
  console.log('[Volc] API Detection:', {
    baseUrl,
    rootBase,
    isOfficialApi,
    model,
  });
  
  if (isOfficialApi) {
    // 检测是否为带日期后缀的新版本模型（需要使用 content 而不是 contents）
    // 带日期后缀的模型：doubao-seedance-*-*-*-251215, doubao-seedance-*-*-*-251015, doubao-seedance-*-*-*-250528, doubao-seedance-*-*-*-250428
    const isNewVersionModel = /-\d{6}$/.test(model); // 匹配以6位数字结尾的模型ID
    
    // 构建内容数组
    const contentArray: Array<Record<string, unknown>> = [];
    
    // 文本内容：prompt + 内联参数
    let textContent = params.prompt;
    if (params.resolution) textContent += ` --rs ${params.resolution.toLowerCase()}`;
    if (params.aspectRatio) textContent += ` --rt ${params.aspectRatio}`;
    if (params.duration) textContent += ` --dur ${params.duration}`;
    
    contentArray.push({ type: 'text', text: textContent });
    
    // 如果有上传文件（图生视频）
    if (params.uploadFiles && params.uploadFiles.length > 0) {
      for (const file of params.uploadFiles) {
        if (file.role === 'single' || file.role === 'first' || file.role === 'last' || file.role === 'reference') {
          const imageUrl = await toUploadHttpUrl(file);
          contentArray.push({
            type: 'image_url',
            image_url: { url: imageUrl },
            role: file.role === 'first' ? 'first_frame' : file.role === 'last' ? 'last_frame' : file.role,
          });
        }
      }
    }
    
    // 根据模型版本选择字段名：新版本使用 content（单数），旧版本使用 contents（复数）
    const body: Record<string, unknown> = {
      model,
    };
    
    if (isNewVersionModel) {
      // 带日期后缀的新版本模型使用 content（单数）数组
      body.content = contentArray;
      console.log('[Volc] Using new version format: content (singular)');
    } else {
      // 旧版本模型使用 contents（复数）数组
      body.contents = contentArray;
      console.log('[Volc] Using old version format: contents (plural)');
    }
    
    // 构建正确的API端点
    // rootBase 已经在上面处理好了，直接使用
    const apiBase = rootBase.replace(/\/+$/, ''); // 移除末尾斜杠
    
    console.log('[Volc] Official API Base URL:', apiBase);
    const submitUrl = `${apiBase}/contents/generations/tasks`;
    console.log('[Volc] Submit URL:', submitUrl, 'Model:', model, 'Original baseUrl:', baseUrl);
    
    const submitResp = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!submitResp.ok) {
      const errorText = await submitResp.text();
      console.error('[Volc] Official API Error:', {
        status: submitResp.status,
        url: submitUrl,
        error: errorText,
        baseUrl: baseUrl,
        rootBase: rootBase,
        apiBase: apiBase,
      });
      throw toHttpError('Volc official API submit failed', submitResp.status, errorText);
    }
    
    const submitData = await submitResp.json();
    const taskId = submitData.id || submitData.task_id;
    if (!taskId) throw new Error('Volc 官方API返回空任务 ID');
    
    const pollUrl = `${apiBase}/contents/generations/tasks/${taskId}`;
    
    for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL));
      const pollResp = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      const status = String(pollData.status || pollData.task_status || '').toLowerCase();
      
      if (status === 'succeeded' || status === 'completed' || status === 'success') {
        const videoUrl = pollData.video_url || pollData.url || pollData.data?.video_url || pollData.content?.video_url || extractVideoUrl(pollData);
        if (!videoUrl) throw new Error('Volc 官方API成功但无视频 URL');
        return { url: videoUrl, taskId: String(taskId) };
      }
      if (status === 'failed' || status === 'expired' || status === 'cancelled' || status === 'error') {
        const errorMsg = pollData.error?.message || pollData.message || pollData.error || 'Volc 视频生成失败';
        throw new Error(errorMsg);
      }
    }
    
    throw new Error('Volc 官方API视频生成超时');
  } else {
    // 使用旧的代理API格式：/volc/v1/contents/generations/tasks
    const promptParts = [params.prompt];
    if (params.resolution) promptParts.push(`--rs ${params.resolution.toLowerCase()}`);
    if (params.aspectRatio) promptParts.push(`--rt ${params.aspectRatio}`);
    if (params.duration) promptParts.push(`--dur ${params.duration}`);

    // Volc / Seedance 视频异步接口要求字段名为 contents（不是 content）
    const body = {
      model,
      contents: [{ type: 'text', text: promptParts.join(' ') }],
    };

    const proxyUrl = `${rootBase}/volc/v1/contents/generations/tasks`;
    console.log('[Volc] Proxy API URL:', proxyUrl);
    
    const submitResp = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!submitResp.ok) {
      const errorText = await submitResp.text();
      console.error('[Volc] Proxy API Error:', {
        status: submitResp.status,
        url: proxyUrl,
        error: errorText,
        baseUrl: baseUrl,
        rootBase: rootBase,
      });
      throw toHttpError('Volc submit failed', submitResp.status, errorText);
    }

    const submitData = await submitResp.json();
    const taskId = submitData.id;
    if (!taskId) throw new Error('Volc 返回空任务 ID');

    const pollUrl = `${rootBase}/volc/v1/contents/generations/tasks/${taskId}`;
    for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL));
      const pollResp = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      const status = String(pollData.status || '').toLowerCase();
      if (status === 'succeeded' || status === 'completed' || status === 'success') {
        const videoUrl = pollData.content?.video_url || extractVideoUrl(pollData);
        if (!videoUrl) throw new Error('Volc 成功但无视频 URL');
        return { url: videoUrl, taskId: String(taskId) };
      }
      if (status === 'failed' || status === 'expired' || status === 'cancelled' || status === 'error') {
        throw new Error(pollData.error?.message || pollData.error || 'Volc 视频生成失败');
      }
    }

    throw new Error('Volc 视频生成超时');
  }
}

async function generateVideoViaWan(
  params: FreedomVideoParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const rootBase = getRootBaseUrl(baseUrl);
  const body: Record<string, any> = {
    model,
    input: { prompt: params.prompt },
    parameters: {
      resolution: (params.resolution || '720P').toUpperCase(),
      prompt_extend: true,
      audio: true,
    },
  };
  if (params.duration) body.parameters.duration = Math.max(3, Math.min(10, params.duration));

  const submitResp = await fetch(
    `${rootBase}/ali/bailian/api/v1/services/aigc/video-generation/video-synthesis`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );
  if (!submitResp.ok) {
    throw toHttpError('Wan submit failed', submitResp.status, await submitResp.text());
  }

  const submitData = await submitResp.json();
  const taskId = submitData.output?.task_id;
  if (!taskId) throw new Error('Wan 返回空任务 ID');

  const pollUrl = `${rootBase}/alibailian/api/v1/tasks/${taskId}`;
  for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL));
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.output?.task_status || '').toUpperCase();
    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
      const videoUrl = pollData.output?.video_url || extractVideoUrl(pollData);
      if (!videoUrl) throw new Error('Wan 成功但无视频 URL');
      return { url: videoUrl, taskId: String(taskId) };
    }
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new Error(pollData.output?.message || pollData.output?.error || 'Wan 视频生成失败');
    }
  }

  throw new Error('Wan 视频生成超时');
}

// Native Kling endpoint paths (relative to /kling/v1/videos/)
// kling-video is handled dynamically: text2video vs image2video based on uploads
const KLING_VIDEO_PATH_MAP: Record<string, string> = {
  'kling-omni-video': 'omni-video',
  'kling-video-extend': 'video-extend',
  'kling-motion-control': 'motion-control',
  'kling-multi-elements': 'multi-elements',
  'kling-avatar-image2video': 'avatar/image2video',
  'kling-advanced-lip-sync': 'advanced-lip-sync',
  'kling-effects': 'effects',
};

async function generateVideoViaKling(
  params: FreedomVideoParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const rootBase = getRootBaseUrl(baseUrl);
  const uploads = params.uploadFiles || [];
  const firstFrame = uploads.find((f) => f.role === 'single' || f.role === 'first');
  const lastFrame = uploads.find((f) => f.role === 'last');

  // Determine the endpoint path
  // Specialized models have a fixed path; all kling-video variants (kling-v2-1-master,
  // kling-v2-6-pro, kling-v3-0-pro, etc.) fall through to text2video / image2video.
  let endpointPath: string;
  const specialPath = KLING_VIDEO_PATH_MAP[model];
  if (specialPath) {
    endpointPath = specialPath;
  } else {
    endpointPath = firstFrame ? 'image2video' : 'text2video';
  }

  const body: Record<string, any> = {
    model_name: model,
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || '16:9',
    duration: String(params.duration ? Math.min(10, Math.max(5, params.duration)) : 5),
    mode: 'std',
  };

  // Attach image URLs for image-based endpoints
  if (endpointPath === 'image2video' && firstFrame) {
    body.image_url = await toUploadHttpUrl(firstFrame);
    if (lastFrame) body.tail_image_url = await toUploadHttpUrl(lastFrame);
  } else if (endpointPath === 'avatar/image2video' && firstFrame) {
    body.image_url = await toUploadHttpUrl(firstFrame);
  }

  const submitUrl = `${rootBase}/kling/v1/videos/${endpointPath}`;
  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!submitResp.ok) {
    throw toHttpError('Kling submit failed', submitResp.status, await submitResp.text());
  }

  const submitData = await submitResp.json();
  const taskId = submitData.data?.task_id;
  if (!taskId) throw new Error('Kling 返回空任务 ID');

  // Poll URL mirrors the submit path: GET /kling/v1/videos/{path}/{task_id}
  const pollUrl = `${rootBase}/kling/v1/videos/${endpointPath}/${taskId}`;
  for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL));
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.data?.task_status || '').toLowerCase();
    if (status === 'succeed' || status === 'success' || status === 'completed') {
      const videoUrl =
        pollData.data?.task_result?.videos?.[0]?.url ||
        pollData.data?.task_result?.video_url ||
        extractVideoUrl(pollData);
      if (!videoUrl) throw new Error('Kling 成功但无视频 URL');
      return { url: videoUrl, taskId: String(taskId) };
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(pollData.data?.task_status_msg || pollData.message || 'Kling 视频生成失败');
    }
  }

  throw new Error('Kling 视频生成超时');
}

/**
 * Generate video via Replicate's /replicate/v1/predictions endpoint
 * Request body: { model, input: { prompt, aspect_ratio, ... } }
 * Poll until status === 'succeeded' / 'failed' / 'canceled'
 */
async function generateVideoViaReplicate(
  params: FreedomVideoParams,
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<GenerationResult> {
  const rootBase = getRootBaseUrl(baseUrl);
  const submitUrl = `${rootBase}/replicate/v1/predictions`;

  const input: Record<string, any> = { prompt: params.prompt };
  if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
  if (params.duration) input.duration = params.duration;
  if (params.resolution) input.resolution = params.resolution;

  // Image-to-video: attach upload files inside input
  const grouped = groupVideoUploadFiles(params.uploadFiles);
  const primaryFile = grouped.single || grouped.first;
  if (primaryFile) input.image = await toUploadHttpUrl(primaryFile);
  if (grouped.last) input.tail_image = await toUploadHttpUrl(grouped.last);

  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input }),
  });
  if (!submitResp.ok) {
    throw toHttpError('Replicate video submit failed', submitResp.status, await submitResp.text());
  }

  const submitData = await submitResp.json();
  const directUrl = extractVideoUrl(submitData);
  if (directUrl) return { url: directUrl };

  const predictionId = submitData.id;
  if (!predictionId) throw new Error('Replicate 返回空 prediction ID');

  const pollUrl = `${rootBase}/replicate/v1/predictions/${predictionId}`;
  for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, VIDEO_POLL_INTERVAL));
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.status || '').toLowerCase();
    if (status === 'succeeded') {
      const videoUrl = extractVideoUrl(pollData);
      if (!videoUrl) throw new Error('Replicate 成功但未返回视频 URL');
      return { url: videoUrl, taskId: String(predictionId) };
    }
    if (status === 'failed' || status === 'canceled') {
      throw new Error(pollData.error || 'Replicate 视频生成失败');
    }
  }
  throw new Error('Replicate 视频生成超时');
}

// ==================== Helpers ====================

function extractImageUrl(data: any): string | null {
  // Handle multiple response formats
  if (data.data?.[0]?.url) return data.data[0].url;
  if (data.data?.[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
  if (data.url) return data.url;
  if (data.output?.url) return data.output.url;
  // Replicate: output as direct string URL or array of URLs
  if (typeof data.output === 'string' && data.output.startsWith('http')) return data.output;
  if (Array.isArray(data.output) && typeof data.output[0] === 'string') return data.output[0];
  if (data.outputs?.[0]) return data.outputs[0];
  // Chat completions format
  if (data.choices?.[0]?.message?.content) {
    const content = data.choices[0].message.content;
    const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    if (mdMatch) return mdMatch[1];
    if (content.startsWith('http')) return content.trim();
  }
  return null;
}

function extractVideoUrl(data: any): string | null {
  if (data.data?.[0]?.url) return data.data[0].url;
  if (data.url) return data.url;
  if (data.output?.url) return data.output.url;
  // Replicate: output as direct string URL or array of URLs (minimax/video-01, etc.)
  if (typeof data.output === 'string' && data.output.startsWith('http')) return data.output;
  if (Array.isArray(data.output) && typeof data.output[0] === 'string') return data.output[0];
  if (data.outputs?.[0]) return data.outputs[0];
  if (data.video_url) return data.video_url;
  if (data.response?.url) return data.response.url;  // doubao, jimeng, grok, wan2.6
  return null;
}

async function pollForResult(
  pollUrl: string,
  apiKey: string,
  interval: number,
  maxAttempts: number
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    try {
      const response = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const status = (data.status || data.state || '').toLowerCase();

      // Check completion - triple status normalization from Higgsfield
      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        return extractImageUrl(data) || extractVideoUrl(data);
      }

      // Check failure
      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        throw new Error(`Generation failed: ${data.error || data.message || status}`);
      }

      // Still processing
      console.log(`[Freedom] Polling attempt ${i + 1}/${maxAttempts}, status: ${status}`);
    } catch (err: any) {
      if (err.message?.startsWith('Generation failed')) throw err;
      console.warn(`[Freedom] Poll error (attempt ${i + 1}):`, err.message);
    }
  }

  return null;
}

function saveToMediaLibrary(
  url: string,
  prompt: string,
  source: 'ai-image' | 'ai-video'
): string | undefined {
  try {
    const mediaStore = useMediaStore.getState();
    const projectId = useProjectStore.getState().activeProjectId;
    const name = prompt.slice(0, 30).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') || 'freedom';
    const type = source === 'ai-image' ? 'image' : 'video';
    
    const mediaId = mediaStore.addMediaFromUrl({
      url,
      name: `${name}_${Date.now()}`,
      type: type as any,
      source,
      projectId: projectId || undefined,
    });

    return mediaId;
  } catch (err) {
    console.warn('[Freedom] Failed to save to media library:', err);
    return undefined;
  }
}
