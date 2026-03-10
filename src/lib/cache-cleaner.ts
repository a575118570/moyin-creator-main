// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * 自动清理缓存服务
 * 定期清理超过指定天数的 AI 生成的图片和视频
 */

import { useMediaStore } from '@/stores/media-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import { useProjectStore } from '@/stores/project-store';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CLEANUP_CHECK_INTERVAL = 60 * 60 * 1000; // 每小时检查一次
const STARTUP_DELAY_MS = 3 * 60 * 1000; // 启动后延迟 3 分钟再开始第一次清理，避免误删/惊吓
const LAST_RUN_KEY = 'moyin_cache_cleaner_last_run_ms';

function normalizeCreatedAt(input: unknown): number {
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n) || n <= 0) return 0;

  // 兼容旧数据：有些历史数据 createdAt 可能是“秒”而不是“毫秒”
  // - 毫秒时间戳一般 >= 1e12（2001 年之后）
  // - 秒时间戳一般 ~ 1e9（2001 年之后）
  if (n < 1e12) return n * 1000;
  return n;
}

function shouldRunNow(): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_RUN_KEY) || '0');
    const now = Date.now();
    // 至少间隔 1 小时再运行一次（避免频繁误删）
    return !Number.isFinite(last) || now - last >= CLEANUP_CHECK_INTERVAL;
  } catch {
    return true;
  }
}

function markRan() {
  try {
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * 清理超过指定天数的 AI 生成的图片和视频
 */
export async function cleanOldAIMedia(): Promise<{
  cleaned: number;
  errors: number;
}> {
  const { cacheSettings } = useAppSettingsStore.getState();
  
  // 如果自动清理未启用，跳过
  if (!cacheSettings.autoCleanEnabled) {
    console.log('[CacheCleaner] 自动清理未启用，跳过清理');
    return { cleaned: 0, errors: 0 };
  }

  const days = Math.max(1, Number(cacheSettings.autoCleanDays || 15));
  const cutoffTime = Date.now() - days * MS_PER_DAY;
  
  console.log(`[CacheCleaner] 开始清理 ${days} 天前的 AI 生成内容（截止时间: ${new Date(cutoffTime).toLocaleString()}）`);

  const { mediaFiles } = useMediaStore.getState();
  const { projects } = useProjectStore.getState();
  
  let cleaned = 0;
  let errors = 0;

  // 筛选需要清理的文件：AI 生成的图片/视频，且创建时间超过指定天数
  const filesToClean = mediaFiles.filter((file) => {
    // 只清理 AI 生成的内容
    if (file.source !== 'ai-image' && file.source !== 'ai-video') {
      return false;
    }
    
    // 检查创建时间
    const createdAt = normalizeCreatedAt(file.createdAt);
    if (createdAt === 0) {
      // 如果没有创建时间，尝试从文件名或 URL 中提取时间戳
      // 或者跳过（保守策略）
      return false;
    }

    // 额外保护：如果 createdAt 被解析成“未来时间”，直接跳过
    if (createdAt > Date.now() + 5 * 60 * 1000) {
      return false;
    }
    
    return createdAt < cutoffTime;
  });

  console.log(`[CacheCleaner] 找到 ${filesToClean.length} 个需要清理的文件`);

  // 逐个清理文件
  for (const file of filesToClean) {
    try {
      const projectId = file.projectId || projects[0]?.id || 'default-project';
      
      // removeMediaFile 会同时从媒体库和存储服务中删除
      await useMediaStore.getState().removeMediaFile(projectId, file.id);
      
      cleaned++;
      
      if (cleaned % 10 === 0) {
        console.log(`[CacheCleaner] 已清理 ${cleaned}/${filesToClean.length} 个文件`);
      }
    } catch (error) {
      console.error(`[CacheCleaner] 清理文件失败 ${file.id}:`, error);
      errors++;
    }
  }

  console.log(`[CacheCleaner] 清理完成：成功 ${cleaned} 个，失败 ${errors} 个`);
  
  return { cleaned, errors };
}

/**
 * 初始化自动清理任务
 * 定期检查并清理过期的 AI 生成内容
 */
export function initCacheCleaner(): () => void {
  console.log('[CacheCleaner] 初始化自动清理任务...');

  let cleanupInterval: ReturnType<typeof setInterval> | null = null;
  let isCleaning = false;
  let startupTimer: ReturnType<typeof setTimeout> | null = null;

  // 执行清理任务
  const runCleanup = async () => {
    if (isCleaning) {
      console.log('[CacheCleaner] 清理任务正在进行中，跳过本次执行');
      return;
    }

    if (!shouldRunNow()) {
      return;
    }

    isCleaning = true;
    try {
      await cleanOldAIMedia();
      markRan();
    } catch (error) {
      console.error('[CacheCleaner] 清理任务执行失败:', error);
    } finally {
      isCleaning = false;
    }
  };

  // 启动后延迟执行一次（避免打开就误删 & 让存储先完成 rehydrate）
  startupTimer = setTimeout(() => {
    runCleanup();
  }, STARTUP_DELAY_MS);

  // 设置定期清理任务
  cleanupInterval = setInterval(() => {
    runCleanup();
  }, CLEANUP_CHECK_INTERVAL);

  console.log(`[CacheCleaner] 自动清理任务已启动，每 ${CLEANUP_CHECK_INTERVAL / 1000 / 60} 分钟检查一次`);

  // 返回清理函数
  return () => {
    console.log('[CacheCleaner] 清理自动清理任务...');
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  };
}

/**
 * 手动触发清理（用于设置页面）
 * 即使自动清理未启用也会执行清理
 */
export async function manualCleanup(): Promise<{
  cleaned: number;
  errors: number;
}> {
  console.log('[CacheCleaner] 手动触发清理...');
  
  const { cacheSettings } = useAppSettingsStore.getState();
  const days = Math.max(1, Number(cacheSettings.autoCleanDays || 15));
  const cutoffTime = Date.now() - days * MS_PER_DAY;
  
  console.log(`[CacheCleaner] 手动清理 ${days} 天前的 AI 生成内容（截止时间: ${new Date(cutoffTime).toLocaleString()}）`);

  const { mediaFiles } = useMediaStore.getState();
  const { projects } = useProjectStore.getState();
  
  let cleaned = 0;
  let errors = 0;

  // 筛选需要清理的文件：AI 生成的图片/视频，且创建时间超过指定天数
  const filesToClean = mediaFiles.filter((file) => {
    // 只清理 AI 生成的内容
    if (file.source !== 'ai-image' && file.source !== 'ai-video') {
      return false;
    }
    
    // 检查创建时间
    const createdAt = normalizeCreatedAt(file.createdAt);
    if (createdAt === 0) {
      return false;
    }

    if (createdAt > Date.now() + 5 * 60 * 1000) {
      return false;
    }
    
    return createdAt < cutoffTime;
  });

  console.log(`[CacheCleaner] 找到 ${filesToClean.length} 个需要清理的文件`);

  // 逐个清理文件
  for (const file of filesToClean) {
    try {
      const projectId = file.projectId || projects[0]?.id || 'default-project';
      
      // removeMediaFile 会同时从媒体库和存储服务中删除
      await useMediaStore.getState().removeMediaFile(projectId, file.id);
      
      cleaned++;
      
      if (cleaned % 10 === 0) {
        console.log(`[CacheCleaner] 已清理 ${cleaned}/${filesToClean.length} 个文件`);
      }
    } catch (error) {
      console.error(`[CacheCleaner] 清理文件失败 ${file.id}:`, error);
      errors++;
    }
  }

  console.log(`[CacheCleaner] 手动清理完成：成功 ${cleaned} 个，失败 ${errors} 个`);
  
  return { cleaned, errors };
}
