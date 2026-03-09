// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { useThemeStore } from "@/stores/theme-store";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { parseApiKeys } from "@/lib/api-key-manager";
import { Loader2 } from "lucide-react";
import { migrateToProjectStorage, recoverFromLegacy } from "@/lib/storage-migration";
import { LicenseGate } from "@/components/LicenseGate";
import { useLicenseStore } from "@/stores/license-store";
import { formatRemaining, useTrialStore } from "@/stores/trial-store";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";

function App() {
  const { theme } = useThemeStore();
  const [isMigrating, setIsMigrating] = useState(true);
  const licenseStatus = useLicenseStore((s) => s.status);
  const refreshLicense = useLicenseStore((s) => s.refresh);
  const initTrial = useTrialStore((s) => s.init);
  const getTrialStatus = useTrialStore((s) => s.getStatus);
  const [trialBanner, setTrialBanner] = useState<string>("");

  // 启动时运行存储迁移 + 数据恢复
  useEffect(() => {
    (async () => {
      try {
        console.log('[App] Starting migration...');
        await migrateToProjectStorage();
        await recoverFromLegacy();
        console.log('[App] Migration complete');
      } catch (err) {
        console.error('[App] Migration/recovery error:', err);
      } finally {
        console.log('[App] Setting isMigrating to false');
        setIsMigrating(false);
      }
    })();
  }, []);

  // 迁移完成后刷新 license 校验（防止热更新/恢复造成的状态不一致）
  useEffect(() => {
    if (isMigrating) return;
    refreshLicense();
  }, [isMigrating, refreshLicense]);

  // 迁移完成后初始化试用期（首次启动起算 3 天）
  useEffect(() => {
    if (isMigrating) return;
    const s = initTrial();
    if (s.active) {
      setTrialBanner(`当前为 3 天试用期，剩余：${formatRemaining(s.remainingMs)}（到期需输入开门密钥）`);
    } else {
      setTrialBanner(s.reason);
    }
  }, [isMigrating, initTrial]);

  // 解析分享链接：?projectId=...&tab=...
  useEffect(() => {
    if (isMigrating) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId");
    const tab = params.get("tab");

    if (!projectId && !tab) return;

    // 1) 切换项目（若本地存在）
    if (projectId) {
      const { projects, setActiveProject } = useProjectStore.getState();
      const exists = projects.some((p) => p.id === projectId);
      if (exists) {
        setActiveProject(projectId);
      } else {
        toast.error("该分享链接对应的项目不在本机，请先导入/同步项目数据后再打开。");
      }
    }

    // 2) 切换到指定页面（安全白名单）
    if (tab) {
      const allowed = new Set([
        "dashboard",
        "script",
        "characters",
        "scenes",
        "freedom",
        "director",
        "sclass",
        "media",
        "export",
        "settings",
        "help",
      ]);
      if (allowed.has(tab)) {
        useMediaPanelStore.getState().setActiveTab(tab as any);
      }
    } else if (projectId) {
      // 没指定 tab，但指定了 projectId：默认进入项目（剧本页）
      useMediaPanelStore.getState().setActiveTab("script");
    }
  }, [isMigrating]);

  // 启动时自动同步所有已配置 API Key 的供应商模型元数据
  useEffect(() => {
    if (isMigrating) return;
    const { providers, syncProviderModels } = useAPIConfigStore.getState();
    for (const p of providers) {
      if (parseApiKeys(p.apiKey).length > 0) {
        syncProviderModels(p.id).then(result => {
          if (result.success) {
            console.log(`[App] Auto-synced ${p.name}: ${result.count} models`);
          }
        });
      }
    }
  }, [isMigrating]);

  // 同步主题到 html 元素
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  // 防止移动端拖动和触摸手势
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      // 允许在可滚动区域内滚动
      const target = e.target as HTMLElement;
      const isScrollable = target.closest('.overflow-auto, .overflow-y-auto, [data-scrollable]');
      if (!isScrollable && e.touches.length > 1) {
        e.preventDefault(); // 阻止多指缩放
      }
    };

    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    // 阻止默认的触摸行为（除了滚动）
    document.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('selectstart', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
      }
    });

    return () => {
      document.removeEventListener('touchmove', preventDefault);
      document.removeEventListener('dragstart', preventDrag);
    };
  }, []);

  // 迁移中显示加载界面
  if (isMigrating) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">正在初始化...</p>
        </div>
      </div>
    );
  }

  // 开门密钥门禁（无有效 license 不允许进入主界面）
  console.log('[App] License status:', licenseStatus);
  if (!licenseStatus.valid) {
    const ts = getTrialStatus();
    console.log('[App] Trial status:', ts);
    if (ts.active) {
      // 试用未到期，允许进入主界面
      console.log('[App] Trial active, showing main layout');
      return (
        // 使用自然滚动布局，由页面内容决定高度
        <div className="w-full min-h-screen">
          <Layout />
          <Toaster richColors position="top-center" />
        </div>
      );
    }

    // 试用到期：强制门禁
    console.log('[App] Showing license gate');
    return <LicenseGate bannerText={trialBanner || ts.reason} />;
  }

  console.log('[App] License valid, showing main layout');
  return (
    // 使用自然滚动布局，由页面内容决定高度
    <div className="w-full min-h-screen">
      <Layout />
      <Toaster richColors position="top-center" />
    </div>
  );
}

export default App;
