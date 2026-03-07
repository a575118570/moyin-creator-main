// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { mainNavItems, bottomNavItems, Tab, useMediaPanelStore } from "@/stores/media-panel-store";
import { useThemeStore } from "@/stores/theme-store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, LayoutDashboard, Settings, Sun, Moon, HelpCircle, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect, useRef } from "react";

export function TabBar() {
  const { activeTab, inProject, setActiveTab, setInProject } = useMediaPanelStore();
  const { theme, toggleTheme } = useThemeStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // 滑动手势支持：从右侧滑动打开侧边栏
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;
      
      // 从右侧向左滑动（deltaX < -50）且垂直滑动距离小于水平滑动距离
      if (deltaX < -50 && Math.abs(deltaX) > Math.abs(deltaY) && touchStartX.current > window.innerWidth - 100) {
        setIsMobileNavOpen(true);
      }
      
      // 从左侧向右滑动关闭（仅在侧边栏打开时）
      if (isMobileNavOpen && deltaX > 50 && Math.abs(deltaX) > Math.abs(deltaY) && touchStartX.current < 100) {
        setIsMobileNavOpen(false);
      }
      
      touchStartX.current = null;
      touchStartY.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobileNavOpen]);

  // Dashboard mode
  if (!inProject) {
    return (
      <>
        {/* Desktop: Sidebar */}
        <div className="hidden md:flex flex-col w-14 bg-panel border-r border-border py-2">
        <div className="p-2">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center mx-auto rounded">
            <span className="text-sm font-bold">M</span>
          </div>
        </div>
        {/* Dashboard nav */}
        <nav className="flex-1 py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={cn(
                    "w-full flex flex-col items-center py-2.5 transition-colors",
                    activeTab === "dashboard"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <LayoutDashboard className="h-5 w-5 mb-0.5" />
                  <span className="text-[9px]">项目</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">项目仪表盘</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
        {/* Bottom: Help + Settings + Theme */}
        <div className="mt-auto border-t border-border py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("help")}
                  className={cn(
                    "w-full flex flex-col items-center py-2 transition-colors",
                    activeTab === "help" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="text-[8px]">帮助</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">使用帮助</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={cn(
                    "w-full flex flex-col items-center py-2 transition-colors",
                    activeTab === "settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-[8px]">设置</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">系统设置</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Theme Toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleTheme}
                  className="w-full flex flex-col items-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span className="text-[8px]">{theme === "dark" ? "浅色" : "深色"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {/* Mobile: Right Sidebar Navigation */}
      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetTrigger asChild>
          <button className="md:hidden fixed top-4 right-4 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50">
            <Menu className="h-6 w-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] p-0 bg-panel border-l">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded">
                  <span className="text-sm font-bold">M</span>
                </div>
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto py-2">
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setIsMobileNavOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                  activeTab === "dashboard"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span className="text-sm">项目</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("help");
                  setIsMobileNavOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                  activeTab === "help" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <HelpCircle className="h-5 w-5" />
                <span className="text-sm">帮助</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("settings");
                  setIsMobileNavOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                  activeTab === "settings" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Settings className="h-5 w-5" />
                <span className="text-sm">设置</span>
              </button>
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                <span className="text-sm">{theme === "dark" ? "浅色模式" : "深色模式"}</span>
              </button>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
      </>
    );
  }

  // Project mode - flat navigation
  return (
    <>
      {/* Desktop: Sidebar */}
      <div className="hidden md:flex flex-col w-14 bg-panel border-r border-border">
      {/* Logo + Back */}
      <div className="p-2 border-b border-border">
        <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center mx-auto rounded mb-1">
          <span className="text-sm font-bold">M</span>
        </div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setInProject(false)}
                className="flex items-center justify-center w-full h-5 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">返回项目列表</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-1">
        {mainNavItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <TooltipProvider key={item.id} delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex flex-col items-center py-2.5 transition-colors",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-5 w-5 mb-0.5" />
                    <span className="text-[9px]">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}{item.phase ? ` (Phase ${item.phase})` : ""}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </nav>

      {/* Bottom: Help + Settings + Theme */}
      <div className="mt-auto border-t border-border py-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveTab("help")}
                className={cn(
                  "w-full flex flex-col items-center py-2 transition-colors",
                  activeTab === "help" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="text-[8px]">帮助</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">使用帮助</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {bottomNavItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <TooltipProvider key={item.id} delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex flex-col items-center py-2 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[8px]">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
        {/* Theme Toggle */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="w-full flex flex-col items-center py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="text-[8px]">{theme === "dark" ? "浅色" : "深色"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
      {/* Mobile: Right Sidebar Navigation */}
      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetTrigger asChild>
          <button className="md:hidden fixed top-4 right-4 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50">
            <Menu className="h-6 w-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] p-0 bg-panel border-l">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded">
                  <span className="text-sm font-bold">M</span>
                </div>
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => {
                  setInProject(false);
                  setIsMobileNavOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm">返回项目列表</span>
              </button>
            </div>
            
            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto py-2">
              {mainNavItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
              {bottomNavItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileNavOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                      isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                <span className="text-sm">{theme === "dark" ? "浅色模式" : "深色模式"}</span>
              </button>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
