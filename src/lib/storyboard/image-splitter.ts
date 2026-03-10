// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Image Splitter for Storyboard
 * 
 * Uses FIXED UNIFORM GRID approach (方案 D):
 * - Always uses uniform grid based on expected cols/rows from grid-calculator
 * - Adds edge margin cropping for tolerance (removes separator line residue)
 * - No complex image detection needed - coordinates are 100% deterministic
 */

import type { AspectRatio, Resolution, GridConfig } from './grid-calculator';
import { calculateGrid } from './grid-calculator';
import { isMobileDevice, getMaxCanvasSize, getOptimalImageSize, getDevicePerformanceLevel } from '../utils/device-detection';

// ==================== Types ====================

export interface SplitResult {
  id: number;
  dataUrl: string;
  width: number;
  height: number;
  originalIndex: number;
  isEmpty: boolean;
  // Grid position info for Gemini
  row: number;
  col: number;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SplitOptions {
  threshold?: number;      // 0-255 sensitivity for border removal (default: 30)
  padding?: number;        // Extra padding to trim (default: 0)
  filterEmpty?: boolean;   // Whether to filter out empty/black cells (default: true)
  expectedCols?: number;   // Hint for expected column count
  expectedRows?: number;   // Hint for expected row count
  edgeMarginPercent?: number; // Edge margin to crop from each cell (default: 0.03 = 3%)
}

export interface SplitConfig {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  sceneCount: number;
  options?: SplitOptions;
}

// ==================== Image Loading ====================

/**
 * 通过 fetch 将图片 URL 转换为 data URL，绕过 CORS 限制
 */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  // 方法1: 尝试直接 fetch（如果服务器允许 CORS）
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.warn('[ImageSplitter] Direct CORS fetch failed, trying proxy...', error);
  }

  // 方法2: 尝试通过代理 API（如果存在）
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      throw new Error(`Proxy returned ${response.status}`);
    }
  } catch (proxyError) {
    console.warn('[ImageSplitter] Proxy fetch failed:', proxyError);
  }

  // 方法3: 尝试 no-cors 模式（虽然不能读取响应，但可以尝试创建一个新的 Image 对象）
  // 注意：no-cors 模式下无法读取响应内容，所以这个方法实际上不可行
  // 但我们可以尝试创建一个隐藏的 img 元素，通过 canvas 转换
  try {
    // 创建一个临时的 img 元素，不使用 crossOrigin
    const tempImg = new Image();
    await new Promise<void>((resolve, reject) => {
      tempImg.onload = () => resolve();
      tempImg.onerror = reject;
      tempImg.src = url; // 不使用 crossOrigin，浏览器可能允许加载但无法读取像素
    });

    // 尝试将图片绘制到 canvas 并转换为 data URL
    const canvas = document.createElement('canvas');
    canvas.width = tempImg.width;
    canvas.height = tempImg.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(tempImg, 0, 0);
      try {
        return canvas.toDataURL('image/png');
      } catch (e: any) {
        if (e.name === 'SecurityError') {
          throw new Error('Canvas is tainted by cross-origin data');
        }
        throw e;
      }
    }
  } catch (noCorsError) {
    console.warn('[ImageSplitter] No-CORS method failed:', noCorsError);
  }

  throw new Error('所有图片加载方法都失败了，无法绕过 CORS 限制');
}

/**
 * Load an image from a Data URL or URL source
 * 自动处理 CORS 问题，通过 fetch 转换为 data URL 作为回退方案
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(async (resolve, reject) => {
    if (!src) {
      reject(new Error('故事板图片地址为空，无法加载。'));
      return;
    }

    // 桌面版使用的 local-image:// 协议在浏览器/手机端是无效的
    if (src.startsWith('local-image://') || src.startsWith('local-video://')) {
      reject(new Error('当前故事板图片是桌面版本地路径（local-image://），在手机/浏览器中无法加载，请在此设备重新上传图片到素材库后再尝试切割。'));
      return;
    }

    // 如果已经是 data URL，直接加载
    if (src.startsWith('data:')) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error('[ImageSplitter] Failed to load data URL image', e);
        reject(new Error('图片数据格式错误，无法加载。'));
      };
      img.src = src;
      return;
    }

    // 关键：对 http/https 远程图片，优先通过 fetchImageAsDataUrl（内部含 /api/proxy-image）
    // 将图片转为同源 dataURL 再加载，避免“图片能显示但 canvas 被污染”导致切割失败。
    if (src.startsWith('http://') || src.startsWith('https://')) {
      try {
        console.log('[ImageSplitter] Remote image -> dataURL pipeline (proxy if needed):', src);
        const dataUrl = await fetchImageAsDataUrl(src);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => {
          console.error('[ImageSplitter] Failed to load proxied data URL image', e);
          reject(new Error('图片加载失败：无法通过代理转换为可切割的 data URL。'));
        };
        img.src = dataUrl;
        return;
      } catch (e) {
        console.error('[ImageSplitter] Remote image dataURL pipeline failed:', e);
        reject(e instanceof Error ? e : new Error('图片加载失败：代理转换失败。'));
        return;
      }
    }

    /**
     * 有些图床（尤其是第三方对象存储）没有正确配置 CORS，
     * 直接用 crossOrigin="anonymous" 去 load 会失败，但用户在浏览器中单独打开是没问题的。
     *
     * 这里采用多段式加载策略：
     * 1. 先尝试带 crossOrigin（如果服务器支持 CORS，可以保证后续 canvas 不被污染）
     * 2. 如果失败，尝试不带 crossOrigin 的普通加载
     * 3. 如果还是失败，通过 fetch 转换为 data URL 再加载（绕过 CORS）
     */

    const tryLoad = async (withCORS: boolean, useFetchFallback: boolean = false) => {
      const img = new Image();
      if (withCORS) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => resolve(img);
      img.onerror = async (e) => {
        // 如果是带 CORS 的首次尝试失败，自动再试一次不带 crossOrigin
        if (withCORS && !useFetchFallback) {
          console.warn('[ImageSplitter] Image load with CORS failed, retrying without CORS...', {
            event: e,
            srcPreview: src?.slice(0, 128) || '',
          });
          tryLoad(false, false);
          return;
        }

        // 如果普通加载也失败，尝试通过 fetch 转换为 data URL
        if (!useFetchFallback && (src.startsWith('http://') || src.startsWith('https://'))) {
          console.warn('[ImageSplitter] Image load failed, trying fetch-to-dataURL fallback...', {
            event: e,
            srcPreview: src?.slice(0, 128) || '',
          });
          
          try {
            const dataUrl = await fetchImageAsDataUrl(src);
            console.log('[ImageSplitter] Successfully converted to data URL, loading...');
            // 使用转换后的 data URL 重新加载
            const fallbackImg = new Image();
            fallbackImg.onload = () => resolve(fallbackImg);
            fallbackImg.onerror = (fallbackError) => {
              console.error('[ImageSplitter] Failed to load converted data URL', fallbackError);
              reject(new Error('图片加载失败：即使转换为 data URL 后仍无法加载。'));
            };
            fallbackImg.src = dataUrl;
            return;
          } catch (fetchError) {
            console.error('[ImageSplitter] Fetch-to-dataURL fallback failed:', fetchError);
            // 继续执行到最终错误处理
          }
        }

        // 最终失败：给出友好错误信息 + 调试日志
        console.error('[ImageSplitter] All image load methods failed', {
          event: e,
          srcPreview: src?.slice(0, 128) || '',
        });

        let hostHint = '';
        try {
          const url = new URL(src);
          hostHint = url.hostname;
        } catch {
          // src 可能是 data:URL 或自定义协议，忽略解析错误
        }

        const message = hostHint
          ? `故事板图片加载失败（来源：${hostHint}）。图床可能未开启跨域（CORS），已尝试多种方法但仍无法加载。建议：1) 在桌面版中完成切割；2) 重新生成故事板；3) 将图片上传到支持 CORS 的图床。`
          : '故事板图片加载失败，已尝试多种方法但仍无法加载。建议在桌面版中完成切割或重新生成故事板。';

        reject(new Error(message));
      };

      img.src = src;
    };

    // 先按原行为尝试带 CORS 加载，失败时自动回退
    tryLoad(true, false);
  });
}

// ==================== Energy Analysis ====================

/**
 * Check if a pixel is bright green (grid separator color #00FF00)
 */
function isGreenPixel(r: number, g: number, b: number): boolean {
  // Green channel should be high, R and B should be low
  return g > 200 && r < 100 && b < 100;
}

/**
 * Calculates energy profile of the image to find content vs solid borders.
 * Now also detects bright green separator lines specifically.
 */
export function getEnergyProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  axis: 'x' | 'y'
): Float32Array {
  const length = axis === 'x' ? width : height;
  const profile = new Float32Array(length);
  
  // Optimization: Sample every Nth pixel to keep it fast
  const stride = 2;

  if (axis === 'y') {
    // Row profile
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let greenCount = 0;
      let sampleCount = 0;
      
      for (let x = stride; x < width; x += stride) {
        const i = (y * width + x) * 4;
        const prev = (y * width + (x - stride)) * 4;
        
        // Check for green separator
        if (isGreenPixel(data[i], data[i + 1], data[i + 2])) {
          greenCount++;
        }
        sampleCount++;
        
        // Normal energy calculation
        sum += Math.abs(data[i] - data[prev]) +
               Math.abs(data[i + 1] - data[prev + 1]) +
               Math.abs(data[i + 2] - data[prev + 2]);
      }
      
      // If this row has significant green pixels, mark as LOW energy (separator)
      const greenRatio = greenCount / sampleCount;
      if (greenRatio > 0.3) {
        profile[y] = 0; // Force to 0 = separator line
      } else {
        profile[y] = sum;
      }
    }
  } else {
    // Column profile
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let greenCount = 0;
      let sampleCount = 0;
      
      for (let y = stride; y < height; y += stride) {
        const i = (y * width + x) * 4;
        const prev = ((y - stride) * width + x) * 4;
        
        // Check for green separator
        if (isGreenPixel(data[i], data[i + 1], data[i + 2])) {
          greenCount++;
        }
        sampleCount++;
        
        // Normal energy calculation
        sum += Math.abs(data[i] - data[prev]) +
               Math.abs(data[i + 1] - data[prev + 1]) +
               Math.abs(data[i + 2] - data[prev + 2]);
      }
      
      // If this column has significant green pixels, mark as LOW energy (separator)
      const greenRatio = greenCount / sampleCount;
      if (greenRatio > 0.3) {
        profile[x] = 0; // Force to 0 = separator line
      } else {
        profile[x] = sum;
      }
    }
  }
  return profile;
}

// ==================== Segment Detection ====================

interface Segment {
  start: number;
  end: number;
  size: number;
}

/**
 * Analyzes a profile to find distinct high-energy regions (the photos/frames).
 * Uses adaptive thresholding and gap detection for thin black borders.
 */
export function findSegments(profile: Float32Array, length: number, expectedCount?: number): Segment[] {
  let maxVal = 0;
  let sumVal = 0;
  for (let i = 0; i < length; i++) {
    if (profile[i] > maxVal) maxVal = profile[i];
    sumVal += profile[i];
  }
  const avgVal = sumVal / length;

  // Use lower threshold (2% of max) to better detect thin black borders
  // Also consider average energy to handle varying image brightness
  const threshold = Math.min(maxVal * 0.02, avgVal * 0.3);

  const segments: Segment[] = [];
  let inSegment = false;
  let start = 0;
  let gapStart = -1;

  // Track gaps (potential borders) - a gap needs to be at least minGap pixels wide
  const minGap = Math.max(2, Math.floor(length * 0.005)); // At least 0.5% of dimension

  for (let i = 0; i < length; i++) {
    if (profile[i] > threshold) {
      if (!inSegment) {
        // Check if the gap was wide enough to be a real border
        if (gapStart >= 0 && (i - gapStart) >= minGap) {
          // This is a real segment start after a gap
          inSegment = true;
          start = i;
        } else if (gapStart < 0) {
          // First segment
          inSegment = true;
          start = i;
        } else {
          // Gap was too small, continue previous segment
          inSegment = true;
        }
        gapStart = -1;
      }
    } else {
      if (inSegment) {
        // Mark potential gap start
        if (gapStart < 0) {
          gapStart = i;
        }
        // Check if gap is wide enough to end segment
        if ((i - gapStart) >= minGap) {
          inSegment = false;
          segments.push({ start, end: gapStart, size: gapStart - start });
        }
      } else if (gapStart < 0) {
        gapStart = i;
      }
    }
  }
  if (inSegment) {
    segments.push({ start, end: length, size: length - start });
  }

  // Filter out tiny noise segments (< 3% of total length, reduced from 5%)
  const minSize = length * 0.03;
  let validSegments = segments.filter(s => s.size > minSize);

  // If we have an expected count and found more segments, take the largest ones
  if (expectedCount && validSegments.length > expectedCount) {
    validSegments.sort((a, b) => b.size - a.size);
    validSegments = validSegments.slice(0, expectedCount);
    validSegments.sort((a, b) => a.start - b.start); // Restore spatial order
  }
  
  // If we found fewer segments than expected, try uniform split based on expected count
  if (expectedCount && validSegments.length < expectedCount) {
    console.log(`[findSegments] Found ${validSegments.length} segments, expected ${expectedCount}. Trying uniform split.`);
    // Fall back to uniform distribution
    const segmentSize = length / expectedCount;
    validSegments = [];
    for (let i = 0; i < expectedCount; i++) {
      validSegments.push({
        start: Math.floor(i * segmentSize),
        end: Math.floor((i + 1) * segmentSize),
        size: Math.floor(segmentSize)
      });
    }
  }

  return validSegments;
}

// ==================== Grid Detection ====================

interface DetectedGrid {
  rows: Array<{ start: number; size: number }>;
  cols: Array<{ start: number; size: number }>;
}

/**
 * Attempts to detect the grid structure automatically.
 */
export function detectGrid(
  img: HTMLImageElement,
  expectedCols?: number,
  expectedRows?: number
): DetectedGrid | null {
  // Use a smaller proxy canvas for analysis speed
  const workWidth = 600;
  const scale = Math.min(1, workWidth / img.width);
  const workHeight = Math.floor(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = workWidth;
  canvas.height = workHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const rowProfile = getEnergyProfile(imageData.data, canvas.width, canvas.height, 'y');
  const colProfile = getEnergyProfile(imageData.data, canvas.width, canvas.height, 'x');

  const rowSegments = findSegments(rowProfile, canvas.height, expectedRows);
  const colSegments = findSegments(colProfile, canvas.width, expectedCols);

  // We need at least 1 distinct region in both axes to use auto-detect
  if (rowSegments.length >= 1 && colSegments.length >= 1) {
    // Map back to original coordinates
    return {
      rows: rowSegments.map(s => ({ start: s.start / scale, size: s.size / scale })),
      cols: colSegments.map(s => ({ start: s.start / scale, size: s.size / scale })),
    };
  }

  return null; // Detection failed or ambiguous
}

// ==================== Canvas Trimming ====================

/**
 * Trims borders (white/black/solid color) from a canvas context.
 * Scans from edges inwards until it finds a pixel that deviates from the edge color.
 */
export function trimCanvas(canvas: HTMLCanvasElement, threshold: number): HTMLCanvasElement | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Helper to get pixel comparison value (simple RGB distance)
  const getDiff = (i: number, r: number, g: number, b: number) => {
    return Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);
  };

  // Sample the top-left corner as the "background" color to remove
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  let top = 0;
  let bottom = height;
  let left = 0;
  let right = width;

  // Scan Top
  for (top = 0; top < height; top++) {
    let rowHasContent = false;
    for (let x = 0; x < width; x++) {
      const i = (top * width + x) * 4;
      if (getDiff(i, bgR, bgG, bgB) > threshold) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) break;
  }

  // Scan Bottom
  for (bottom = height - 1; bottom >= top; bottom--) {
    let rowHasContent = false;
    for (let x = 0; x < width; x++) {
      const i = (bottom * width + x) * 4;
      if (getDiff(i, bgR, bgG, bgB) > threshold) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) break;
  }

  // Scan Left
  for (left = 0; left < width; left++) {
    let colHasContent = false;
    for (let y = top; y <= bottom; y++) {
      const i = (y * width + left) * 4;
      if (getDiff(i, bgR, bgG, bgB) > threshold) {
        colHasContent = true;
        break;
      }
    }
    if (colHasContent) break;
  }

  // Scan Right
  for (right = width - 1; right >= left; right--) {
    let colHasContent = false;
    for (let y = top; y <= bottom; y++) {
      const i = (y * width + right) * 4;
      if (getDiff(i, bgR, bgG, bgB) > threshold) {
        colHasContent = true;
        break;
      }
    }
    if (colHasContent) break;
  }

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;

  if (trimmedWidth <= 0 || trimmedHeight <= 0) {
    return canvas;
  }

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');

  if (!trimmedCtx) return null;

  trimmedCtx.drawImage(
    canvas,
    left, top, trimmedWidth, trimmedHeight,
    0, 0, trimmedWidth, trimmedHeight
  );

  return trimmedCanvas;
}

// ==================== Empty Cell Detection ====================

/**
 * Check if a canvas cell is mostly empty (solid color / black)
 */
export function isCellEmpty(canvas: HTMLCanvasElement, threshold: number = 30): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const width = canvas.width;
  const height = canvas.height;
  
  // Sample a subset of pixels for performance
  const sampleSize = 100;
  const stepX = Math.max(1, Math.floor(width / 10));
  const stepY = Math.max(1, Math.floor(height / 10));
  
  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch (e: any) {
    // 如果画布被跨域图片污染（tainted），getImageData 会抛 SecurityError。
    // 这种情况下我们无法做“空格子检测”，但可以退化为“全部当作非空处理”，
    // 避免整个切割流程直接失败。
    if (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'SecurityError') {
      console.warn('[ImageSplitter] Canvas is tainted by cross-origin data, skip empty-cell detection for this cell.');
      return false;
    }
    throw e;
  }
  const data = imageData.data;
  
  // Get reference color from center
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const centerIdx = (centerY * width + centerX) * 4;
  const refR = data[centerIdx];
  const refG = data[centerIdx + 1];
  const refB = data[centerIdx + 2];
  
  // Check if reference is near black
  const isNearBlack = refR < 30 && refG < 30 && refB < 30;
  
  let uniformCount = 0;
  let totalSamples = 0;
  
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      const diff = Math.abs(data[i] - refR) + Math.abs(data[i + 1] - refG) + Math.abs(data[i + 2] - refB);
      
      if (diff < threshold) {
        uniformCount++;
      }
      totalSamples++;
    }
  }
  
  // If >90% of samples are uniform with reference color, and reference is near black
  const uniformRatio = uniformCount / totalSamples;
  return isNearBlack && uniformRatio > 0.9;
}

// ==================== Edge Margin Cropping ====================

/**
 * Crop edges from a canvas to remove separator line residue.
 * Default margin: 3% of each dimension.
 */
export function cropEdgeMargin(
  canvas: HTMLCanvasElement,
  marginPercent: number = 0.03
): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;
  
  // Calculate margin in pixels
  const marginX = Math.floor(width * marginPercent);
  const marginY = Math.floor(height * marginPercent);
  
  // New dimensions after cropping
  const newWidth = width - marginX * 2;
  const newHeight = height - marginY * 2;
  
  // Sanity check - don't crop if result would be too small
  if (newWidth < 50 || newHeight < 50) {
    return canvas;
  }
  
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = newWidth;
  croppedCanvas.height = newHeight;
  const ctx = croppedCanvas.getContext('2d');
  
  if (!ctx) return canvas;
  
  ctx.drawImage(
    canvas,
    marginX, marginY, newWidth, newHeight, // Source (cropped region)
    0, 0, newWidth, newHeight               // Destination
  );
  
  return croppedCanvas;
}

// ==================== Main Split Function ====================

/**
 * Main function to split a storyboard image into individual scene frames.
 * 
 * Uses FIXED UNIFORM GRID approach (方案 D):
 * - Always uses uniform grid based on expected cols/rows
 * - No complex image detection (energy analysis removed)
 * - Adds edge margin cropping for tolerance
 */
export async function splitStoryboardImage(
  imageSrc: string,
  config: SplitConfig
): Promise<SplitResult[]> {
  const { aspectRatio, resolution, sceneCount, options = {} } = config;
  const { threshold = 30, filterEmpty = true } = options;
  
  // Edge margin percentage for cropping separator line residue
  const edgeMarginPercent = options.edgeMarginPercent ?? 0.03; // Default 3%

  const img = await loadImage(imageSrc);
  let totalWidth = img.width;
  let totalHeight = img.height;

  // 手机端优化：检测设备限制并缩放图片
  const isMobile = isMobileDevice();
  const performanceLevel = getDevicePerformanceLevel();
  const { maxPixels } = getMaxCanvasSize();
  
  // 如果图片太大，需要先缩放
  let scaleFactor = 1;
  let workingImg = img; // 实际使用的图片对象
  const originalPixels = totalWidth * totalHeight;
  
  if (originalPixels > maxPixels) {
    const optimal = getOptimalImageSize(totalWidth, totalHeight, maxPixels);
    scaleFactor = optimal.scale;
    const scaledWidth = optimal.width;
    const scaledHeight = optimal.height;
    
    console.log(`[ImageSplitter] 图片过大，缩放处理: ${img.width}x${img.height} → ${scaledWidth}x${scaledHeight} (scale: ${scaleFactor.toFixed(3)})`);
    
    // 创建缩放后的图片
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;
    const scaledCtx = scaledCanvas.getContext('2d');
    if (scaledCtx) {
      scaledCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      // 将缩放后的图片数据重新加载
      const scaledDataUrl = scaledCanvas.toDataURL('image/png');
      workingImg = await loadImage(scaledDataUrl);
      totalWidth = scaledWidth;
      totalHeight = scaledHeight;
    }
  }

  const results: SplitResult[] = [];

  // Calculate expected grid using grid-calculator
  const gridConfig = calculateGrid({ sceneCount, aspectRatio, resolution });
  const expectedCols = options.expectedCols || gridConfig.cols;
  const expectedRows = options.expectedRows || gridConfig.rows;
  
  // 手机端性能优化：分批处理，避免一次性处理所有格子导致内存溢出
  const batchSize = isMobile && performanceLevel === 'low' ? 2 : isMobile ? 4 : Infinity;
  
  console.log('[ImageSplitter] 设备信息:', {
    isMobile,
    performanceLevel,
    maxPixels,
    batchSize: batchSize === Infinity ? 'unlimited' : batchSize,
    imageSize: `${totalWidth}x${totalHeight}`,
    scaleFactor: scaleFactor !== 1 ? scaleFactor.toFixed(3) : 'none',
  });

  console.log('[ImageSplitter] Using FIXED UNIFORM GRID (方案 D)', {
    imageSize: `${totalWidth}x${totalHeight}`,
    grid: `${expectedRows}x${expectedCols}`,
    sceneCount,
    edgeMarginPercent,
  });

  // Calculate uniform cell dimensions (raw from source image)
  const cellWidth = Math.floor(totalWidth / expectedCols);
  const cellHeight = Math.floor(totalHeight / expectedRows);
  
  // === 动态居中裁剪修正（学习自合并生成的切割方法）===
  // 计算目标宽高比
  const targetAspectW = aspectRatio === '16:9' ? 16 : 9;
  const targetAspectH = aspectRatio === '16:9' ? 9 : 16;
  const targetRatio = targetAspectW / targetAspectH;
  
  // 计算原图每个格子的实际比例
  const rawRatio = cellWidth / cellHeight;
  
  // 计算裁剪参数（如果比例不匹配，进行居中裁剪修正）
  let cropX = 0, cropY = 0, cropW = cellWidth, cropH = cellHeight;
  let outputWidth: number, outputHeight: number;
  
  if (Math.abs(rawRatio - targetRatio) < 0.01) {
    // 宽高比已经接近目标，直接使用
    outputWidth = cellWidth;
    outputHeight = cellHeight;
    console.log('[ImageSplitter] Ratio already matches target, no crop needed');
  } else if (rawRatio > targetRatio) {
    // 原图格子太宽，需要裁剪宽度（居中裁剪）
    cropW = Math.floor(cellHeight * targetRatio);
    cropX = Math.floor((cellWidth - cropW) / 2);
    outputWidth = cropW;
    outputHeight = cellHeight;
    console.log(`[ImageSplitter] Cell too wide (${rawRatio.toFixed(3)} > ${targetRatio.toFixed(3)}), crop width: ${cellWidth} → ${cropW}, offsetX: ${cropX}`);
  } else {
    // 原图格子太高，需要裁剪高度（居中裁剪）
    cropH = Math.floor(cellWidth / targetRatio);
    cropY = Math.floor((cellHeight - cropH) / 2);
    outputWidth = cellWidth;
    outputHeight = cropH;
    console.log(`[ImageSplitter] Cell too tall (${rawRatio.toFixed(3)} < ${targetRatio.toFixed(3)}), crop height: ${cellHeight} → ${cropH}, offsetY: ${cropY}`);
  }
  
  // 双重保险：强制输出尺寸严格符合目标宽高比
  if (aspectRatio === '16:9') {
    outputHeight = Math.round(outputWidth * 9 / 16);
  } else {
    // 9:16
    outputWidth = Math.round(outputHeight * 9 / 16);
  }
  
  // Calculate Safety Margin (Inset) - 在裁剪后的区域内再收缩
  // Default to 0.5% (0.005) if not specified
  const finalEdgeMargin = options.edgeMarginPercent ?? 0.005;
  const marginW = Math.floor(cropW * finalEdgeMargin);
  const marginH = Math.floor(cropH * finalEdgeMargin);
  
  console.log('[ImageSplitter] Split params:', {
    cellRaw: `${cellWidth}x${cellHeight}`,
    rawRatio: rawRatio.toFixed(3),
    targetRatio: targetRatio.toFixed(3),
    cropRegion: `${cropW}x${cropH} (offset: ${cropX}, ${cropY})`,
    outputStrict: `${outputWidth}x${outputHeight}`,
    margin: `${marginW}px x ${marginH}px (${finalEdgeMargin * 100}%)`,
  });
  
  // Generate cell definitions using uniform grid
  const cellDefs: Array<{ x: number; y: number; w: number; h: number; row: number; col: number }> = [];
  
  for (let row = 0; row < expectedRows; row++) {
    for (let col = 0; col < expectedCols; col++) {
      cellDefs.push({
        x: col * cellWidth,
        y: row * cellHeight,
        w: cellWidth,
        h: cellHeight,
        row,
        col,
      });
    }
  }

  // Extract each cell
  // 手机端优化：分批处理，避免内存溢出
  for (let batchStart = 0; batchStart < cellDefs.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, cellDefs.length);
    const batch = cellDefs.slice(batchStart, batchEnd);
    
    // 如果是手机端，添加延迟以避免阻塞 UI
    if (isMobile && batchStart > 0) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms 延迟
    }
    
    for (let i = batchStart; i < batchEnd; i++) {
    const def = cellDefs[i];

    // Create canvas for this cell with STRICT output dimensions
    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = outputWidth;
    cellCanvas.height = outputHeight;
    const ctx = cellCanvas.getContext('2d');

    if (!ctx) continue;

    // Calculate source rectangle with CROP + INSET (居中裁剪 + 安全边距)
    // 先应用居中裁剪偏移，再应用安全边距
      // 注意：如果图片被缩放，需要调整源坐标
      const srcX = Math.floor((def.x + cropX + marginW) * scaleFactor);
      const srcY = Math.floor((def.y + cropY + marginH) * scaleFactor);
      const srcW = Math.floor((cropW - (marginW * 2)) * scaleFactor);
      const srcH = Math.floor((cropH - (marginH * 2)) * scaleFactor);

    // Draw the cell region from source image (with crop correction)
      try {
    ctx.drawImage(
          workingImg,
          srcX, srcY, srcW, srcH, // Source (cropped + contracted, scaled if needed)
      0, 0, outputWidth, outputHeight // Destination (strict ratio)
    );
      } catch (e: any) {
        console.error(`[ImageSplitter] Failed to draw cell ${i}:`, e);
        // 如果绘制失败，跳过这个格子
        continue;
      }

    // Check if cell is empty (solid black)
    // Use a temporary context or existing method if needed, but for now we rely on the draw
    const isEmpty = filterEmpty ? isCellEmpty(cellCanvas, threshold) : false;
    
    // Skip empty cells if filtering is enabled
    if (filterEmpty && isEmpty) {
      console.log(`[ImageSplitter] Skipping empty cell ${i} (Row ${def.row}, Col ${def.col})`);
      continue;
    }

    // No further trimming needed as we strictly enforced the aspect ratio and margin above

    let cellDataUrl: string;
    try {
        // 手机端优化：使用较低质量的 JPEG 以减少内存占用（可选）
        const quality = isMobile && performanceLevel === 'low' ? 0.85 : 1.0;
        cellDataUrl = cellCanvas.toDataURL('image/png', quality);
    } catch (e: any) {
      // 如果画布被跨域图片污染，toDataURL 也会抛 SecurityError。
      // 这种情况下，浏览器根本不允许我们导出像素数据进行切割。
      if (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'SecurityError') {
        console.error('[ImageSplitter] toDataURL failed due to tainted canvas (CORS). Source likely has no Access-Control-Allow-Origin.', e);
        throw new Error(
          '当前故事板图片所在的图床未开启跨域（CORS），浏览器无法对其进行切割。' +
          '建议在本机下载该图片后上传到素材库/重新生成故事板，或在桌面版中完成切割操作。'
        );
      }
      throw e;
    }

    results.push({
      id: results.length,
      originalIndex: i,
      dataUrl: cellDataUrl,
      width: outputWidth,
      height: outputHeight,
      isEmpty,
      row: def.row,
      col: def.col,
      sourceRect: {
        x: def.x,
        y: def.y,
        width: def.w,
        height: def.h,
      },
    });
      
      // 手机端优化：及时释放 Canvas 内存
      if (isMobile) {
        // 清除 canvas 引用，帮助 GC
        cellCanvas.width = 0;
        cellCanvas.height = 0;
      }
    }
    
    // 手机端：每批处理后强制垃圾回收提示
    if (isMobile && batchEnd < cellDefs.length) {
      // 给浏览器一些时间处理内存
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[ImageSplitter] Split complete: ${results.length} valid cells from ${cellDefs.length} total`);
  return results;
}

// ==================== Export Index ====================

export function createIndex(): string {
  // Re-export for convenience
  return 'image-splitter';
}
