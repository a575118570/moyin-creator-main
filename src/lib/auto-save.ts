// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * 自动保存工具
 * 确保在页面关闭前保存所有状态，防止数据丢失
 */

import { useProjectStore } from '@/stores/project-store';
import { useAPIConfigStore } from '@/stores/api-config-store';
import { useScriptStore } from '@/stores/script-store';
import { useDirectorStore } from '@/stores/director-store';
import { useMediaStore } from '@/stores/media-store';
import { useCharacterLibraryStore } from '@/stores/character-library-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSClassStore } from '@/stores/sclass-store';
import { useSimpleTimelineStore } from '@/stores/simple-timeline-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import { useLicenseStore } from '@/stores/license-store';
import { useTrialStore } from '@/stores/trial-store';

/**
 * 所有需要自动保存的 store 列表
 * 包括所有设置页面的配置项
 */
const STORES_TO_SAVE = [
  { name: 'project-store', store: useProjectStore },
  { name: 'api-config-store', store: useAPIConfigStore }, // 供应商配置、API Key、功能绑定等
  { name: 'app-settings-store', store: useAppSettingsStore }, // 资源分享、存储路径、缓存设置
  { name: 'license-store', store: useLicenseStore }, // 许可证密钥
  { name: 'trial-store', store: useTrialStore }, // 试用期设置
  { name: 'script-store', store: useScriptStore },
  { name: 'director-store', store: useDirectorStore },
  { name: 'media-store', store: useMediaStore },
  { name: 'character-library-store', store: useCharacterLibraryStore },
  { name: 'scene-store', store: useSceneStore },
  { name: 'sclass-store', store: useSClassStore },
  { name: 'timeline-store', store: useSimpleTimelineStore },
] as const;

/**
 * 强制保存所有 store 的状态
 */
export async function saveAllStores(): Promise<void> {
  console.log('[AutoSave] 开始保存所有 store 状态...');
  
  const savePromises = STORES_TO_SAVE.map(async ({ name, store }) => {
    try {
      // 如果 store 有 persist 中间件，调用 persist 的 flush 方法
      if (store.persist && typeof store.persist.flush === 'function') {
        await store.persist.flush();
        console.log(`[AutoSave] ✅ ${name} 已保存`);
      } else if (store.persist && typeof store.persist.rehydrate === 'function') {
        // 某些版本的 zustand persist 可能没有 flush，尝试通过状态更新触发
        const state = store.getState();
        // 通过设置一个不改变状态的更新来触发保存
        store.setState(state);
        console.log(`[AutoSave] ⚠️ ${name} 通过状态更新触发保存`);
      } else {
        // 如果没有 persist，尝试手动触发状态更新
        const state = store.getState();
        store.setState(state);
        console.log(`[AutoSave] ⚠️ ${name} 没有 persist 中间件，已触发状态更新`);
      }
    } catch (error) {
      console.error(`[AutoSave] ❌ ${name} 保存失败:`, error);
    }
  });

  await Promise.allSettled(savePromises);
  
  // 额外确保 localStorage 同步写入（如果使用 localStorage）
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 触发一个小的写入操作来确保同步
      const syncKey = '__autosave_sync__';
      localStorage.setItem(syncKey, Date.now().toString());
      localStorage.removeItem(syncKey);
    }
  } catch (error) {
    console.warn('[AutoSave] localStorage 同步写入失败:', error);
  }
  
  console.log('[AutoSave] 所有 store 保存完成');
}

/**
 * 初始化自动保存功能
 * 监听页面关闭、隐藏等事件，确保数据不会丢失
 */
export function initAutoSave(): () => void {
  console.log('[AutoSave] 初始化自动保存功能...');

  let isSaving = false;
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // 防抖保存函数
  const debouncedSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      if (!isSaving) {
        isSaving = true;
        await saveAllStores();
        isSaving = false;
      }
    }, 500); // 500ms 防抖
  };

  // 立即保存函数（用于页面关闭时）
  const immediateSave = async () => {
    if (isSaving) return;
    isSaving = true;
    try {
      await saveAllStores();
    } catch (error) {
      console.error('[AutoSave] 立即保存失败:', error);
    } finally {
      isSaving = false;
    }
  };

  // 监听页面可见性变化（用户切换标签页或最小化窗口）
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // 页面隐藏时立即保存
      immediateSave();
    }
  };

  // 监听页面卸载（用户关闭标签页或刷新）
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // 同步保存（使用 sendBeacon 或同步存储）
    if (navigator.sendBeacon) {
      // 使用 sendBeacon 发送保存请求（如果后端支持）
      // 这里我们主要依赖 localStorage 和 IndexedDB 的同步写入
      navigator.sendBeacon('/api/save', JSON.stringify({ action: 'save' }));
    }
    
    // 尝试同步保存关键数据
    try {
      // 保存项目信息
      const projectState = useProjectStore.getState();
      if (projectState.activeProjectId) {
        localStorage.setItem('moyin-project-store-backup', JSON.stringify({
          activeProjectId: projectState.activeProjectId,
          timestamp: Date.now(),
        }));
      }

      // 保存 API 配置（使用同步方法）
      const apiState = useAPIConfigStore.getState();
      if (apiState.providers && apiState.providers.length > 0) {
        localStorage.setItem('opencut-api-config-backup', JSON.stringify({
          providers: apiState.providers.map(p => ({
            id: p.id,
            name: p.name,
            // 不保存敏感信息，只保存配置结构
          })),
          timestamp: Date.now(),
        }));
      }

      // 保存应用设置（资源分享、存储路径、缓存设置等）
      const appSettingsState = useAppSettingsStore.getState();
      localStorage.setItem('moyin-app-settings-backup', JSON.stringify({
        resourceSharing: appSettingsState.resourceSharing,
        storagePaths: appSettingsState.storagePaths,
        cacheSettings: appSettingsState.cacheSettings,
        timestamp: Date.now(),
      }));

      // 保存许可证信息（不保存密钥，只保存状态）
      const licenseState = useLicenseStore.getState();
      if (licenseState.licenseKey) {
        localStorage.setItem('manguo-license-backup', JSON.stringify({
          hasLicense: true,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error('[AutoSave] 同步保存失败:', error);
    }

    // 触发异步保存（尽可能在页面关闭前完成）
    immediateSave();
  };

  // 监听页面卸载（用于 Electron 环境）
  const handleUnload = () => {
    immediateSave();
  };

  // 定期自动保存（每 30 秒）
  const autoSaveInterval = setInterval(() => {
    debouncedSave();
  }, 30000);

  // 监听供应商配置变化，立即保存（包括 API Key、功能绑定、并发数、高级选项、图床配置等）
  const unsubscribeApiConfig = useAPIConfigStore.subscribe(
    (state) => ({
      providers: state.providers,
      concurrency: state.concurrency,
      advancedOptions: state.advancedOptions,
      featureBindings: state.featureBindings,
      imageHostProviders: state.imageHostProviders,
    }),
    () => {
      // 供应商配置变化时立即保存
      debouncedSave();
    }
  );

  // 监听应用设置变化，立即保存（资源分享、存储路径、缓存设置等）
  const unsubscribeAppSettings = useAppSettingsStore.subscribe(
    (state) => ({
      resourceSharing: state.resourceSharing,
      storagePaths: state.storagePaths,
      cacheSettings: state.cacheSettings,
    }),
    () => {
      // 应用设置变化时立即保存
      debouncedSave();
    }
  );

  // 监听许可证变化，立即保存
  const unsubscribeLicense = useLicenseStore.subscribe(
    (state) => state.licenseKey,
    () => {
      // 许可证变化时立即保存
      debouncedSave();
    }
  );

  // 监听媒体文件变化，立即保存（确保生成的图片/视频被保存）
  const unsubscribeMedia = useMediaStore.subscribe(
    (state) => state.mediaFiles.length,
    () => {
      // 媒体文件变化时立即保存
      debouncedSave();
    }
  );

  // 监听用户活动（输入、点击等），延迟保存
  const handleUserActivity = () => {
    debouncedSave();
  };

  // 注册事件监听器
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleUnload);
  
  // 监听用户活动
  document.addEventListener('input', handleUserActivity, { passive: true });
  document.addEventListener('change', handleUserActivity, { passive: true });
  document.addEventListener('click', handleUserActivity, { passive: true });

  console.log('[AutoSave] 自动保存功能已启动');

  // 返回清理函数
  return () => {
    console.log('[AutoSave] 清理自动保存功能...');
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('unload', handleUnload);
    document.removeEventListener('input', handleUserActivity);
    document.removeEventListener('change', handleUserActivity);
    document.removeEventListener('click', handleUserActivity);
    
    // 取消订阅
    unsubscribeApiConfig();
    unsubscribeAppSettings();
    unsubscribeLicense();
    unsubscribeMedia();
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    clearInterval(autoSaveInterval);
    
    // 最后保存一次
    immediateSave();
  };
}

/**
 * 恢复备份数据（如果主存储失败）
 */
export function recoverFromBackup(): void {
  try {
    const projectBackup = localStorage.getItem('moyin-project-store-backup');
    if (projectBackup) {
      const backup = JSON.parse(projectBackup);
      const now = Date.now();
      // 如果备份是 5 分钟内创建的，说明可能是异常关闭
      if (now - backup.timestamp < 5 * 60 * 1000) {
        console.log('[AutoSave] 检测到最近的备份，可能发生了异常关闭');
        // 这里可以显示提示给用户
      }
    }
  } catch (error) {
    console.error('[AutoSave] 恢复备份失败:', error);
  }
}
