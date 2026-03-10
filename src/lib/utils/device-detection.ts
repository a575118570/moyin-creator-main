// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * 设备检测工具
 * 用于检测设备类型和性能特征，优化移动端体验
 */

/**
 * 检测是否为移动设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // 检查用户代理
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  
  if (mobileRegex.test(userAgent)) {
    return true;
  }
  
  // 检查屏幕尺寸（作为辅助判断）
  if (window.innerWidth <= 768) {
    return true;
  }
  
  // 检查触摸支持
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    return true;
  }
  
  return false;
}

/**
 * 检测设备的内存限制
 * 返回建议的最大 Canvas 尺寸（像素数）
 */
export function getMaxCanvasSize(): { width: number; height: number; maxPixels: number } {
  if (typeof window === 'undefined') {
    return { width: 4096, height: 4096, maxPixels: 16777216 }; // 默认值
  }
  
  const isMobile = isMobileDevice();
  
  if (isMobile) {
    // 移动设备：更保守的限制
    // 大多数移动设备支持 2048x2048，但为了稳定性，我们使用更小的值
    return {
      width: 2048,
      height: 2048,
      maxPixels: 4194304, // 2048 * 2048
    };
  }
  
  // 桌面设备：更大的限制
  return {
    width: 4096,
    height: 4096,
    maxPixels: 16777216, // 4096 * 4096
  };
}

/**
 * 检测设备性能等级
 * 返回 'low' | 'medium' | 'high'
 */
export function getDevicePerformanceLevel(): 'low' | 'medium' | 'high' {
  if (typeof window === 'undefined') return 'medium';
  
  const isMobile = isMobileDevice();
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = (navigator as any).deviceMemory || 4; // GB
  
  if (isMobile) {
    // 移动设备：根据硬件配置判断
    if (hardwareConcurrency >= 8 && deviceMemory >= 6) {
      return 'high';
    } else if (hardwareConcurrency >= 4 && deviceMemory >= 4) {
      return 'medium';
    }
    return 'low';
  }
  
  // 桌面设备：通常性能更好
  if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
    return 'high';
  } else if (hardwareConcurrency >= 4 && deviceMemory >= 4) {
    return 'medium';
  }
  return 'low';
}

/**
 * 计算适合设备的图片处理尺寸
 * 如果原图太大，会返回缩放后的尺寸
 */
export function getOptimalImageSize(
  originalWidth: number,
  originalHeight: number,
  maxPixels?: number
): { width: number; height: number; scale: number } {
  const { maxPixels: defaultMaxPixels } = getMaxCanvasSize();
  const limitPixels = maxPixels || defaultMaxPixels;
  
  const originalPixels = originalWidth * originalHeight;
  
  if (originalPixels <= limitPixels) {
    return {
      width: originalWidth,
      height: originalHeight,
      scale: 1,
    };
  }
  
  // 需要缩放
  const scale = Math.sqrt(limitPixels / originalPixels);
  return {
    width: Math.floor(originalWidth * scale),
    height: Math.floor(originalHeight * scale),
    scale,
  };
}
