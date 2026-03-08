// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { TabBar } from "./TabBar";
import { PreviewPanel } from "./PreviewPanel";
import { RightPanel } from "./RightPanel";
import { SimpleTimeline } from "./SimpleTimeline";
import { Dashboard } from "./Dashboard";
import { ProjectHeader } from "./ProjectHeader";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { usePreviewStore } from "@/stores/preview-store";
import { useActiveScriptProject } from "@/stores/script-store";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

// Panel imports
import { ScriptView } from "@/components/panels/script";
import { DirectorView } from "@/components/panels/director";
import { SClassView } from "@/components/panels/sclass";
import { CharactersView } from "@/components/panels/characters";
import { ScenesView } from "@/components/panels/scenes";
import { FreedomView } from "@/components/panels/freedom";
import { MediaView } from "@/components/panels/media";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { ExportView } from "@/components/panels/export";
import { HelpPanel } from "@/components/panels/HelpPanel";

export function Layout() {
  const { activeTab, inProject } = useMediaPanelStore();
  const { previewItem } = usePreviewStore();
  const scriptProject = useActiveScriptProject();
  const hasScriptData = scriptProject?.scriptData !== null;

  // Dashboard mode - show full-screen dashboard or settings
  if (!inProject) {
    return (
      <div className="h-full flex flex-col md:flex-row bg-background">
        <TabBar />
        <div className="flex-1 overflow-auto">
          {activeTab === "settings" ? <SettingsPanel /> : activeTab === "help" ? <HelpPanel /> : <Dashboard />}
        </div>
      </div>
    );
  }

  // Full-screen views (no resizable panels)
  // 这些板块有自己的多栏布局，不需要全局的预览和属性面板
  const fullScreenTabs = ["export", "settings", "help", "script", "characters", "scenes", "freedom"];
  if (fullScreenTabs.includes(activeTab)) {
    return (
      <div className="h-full flex flex-col md:flex-row bg-background">
        <TabBar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab !== "help" && <ProjectHeader />}
          <div className="flex-1 overflow-auto">
            {activeTab === "export" && <ExportView />}
            {activeTab === "settings" && <SettingsPanel />}
            {activeTab === "help" && <HelpPanel />}
            {activeTab === "script" && <ScriptView />}
            {activeTab === "characters" && <CharactersView />}
            {activeTab === "scenes" && <ScenesView />}
            {activeTab === "freedom" && <FreedomView />}
          </div>
        </div>
      </div>
    );
  }

  // Only show timeline for director and media tabs
  const showTimeline = activeTab === "director" || activeTab === "sclass" || activeTab === "media";

  // Left panel content based on active tab
  const renderLeftPanel = () => {
    switch (activeTab) {
      case "script":
        return <ScriptView />;
      case "director":
        // 保持原有 AI 导演功能
        return <DirectorView />;
      case "sclass":
        return <SClassView />;
      case "characters":
        return <CharactersView />;
      case "scenes":
        return <ScenesView />;
      case "media":
        return <MediaView />;
      case "settings":
        return <SettingsPanel />;
      default:
        return <ScriptView />;
    }
  };

  // Right panel content based on active tab
  const renderRightPanel = () => {
    return <RightPanel />;
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-background">
      {/* Left: TabBar - full height on desktop, hidden on mobile */}
      <TabBar />

      {/* Right content area */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        {/* Top: Project Header with save status */}
        <ProjectHeader />
        
        {/* Mobile: Single column layout with preview and properties panels in scrollable content */}
        <div className="md:hidden flex-1 overflow-auto">
          <div className="flex flex-col min-h-full bg-panel">
            {/* Left Panel Content */}
            <div className="flex-shrink-0">
              {renderLeftPanel()}
            </div>
            {/* Preview Panel - as part of scrollable content, not fixed - only show when there's content */}
            {(activeTab === "director" || activeTab === "sclass" || activeTab === "media") && previewItem && (
              <div className="flex-shrink-0 border-t border-border">
                <div className="h-[40vh] min-h-[200px] max-h-[400px]">
                  <PreviewPanel />
                </div>
              </div>
            )}
            {/* Properties Panel - as part of scrollable content, not fixed - smaller height when no script data */}
            {(activeTab === "director" || activeTab === "sclass" || activeTab === "media") && (
              <div className="flex-shrink-0 border-t border-border">
                <div className={hasScriptData ? "min-h-[250px]" : "h-auto"}>
                  {renderRightPanel()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Main content with resizable panels */}
        <ResizablePanelGroup direction="vertical" className="hidden md:flex flex-1">
        {/* Main content row */}
        <ResizablePanel defaultSize={85} minSize={50}>
          <ResizablePanelGroup direction="horizontal">
            {/* Left Panel: Content based on active tab */}
            <ResizablePanel id="moyin-left-panel" defaultSize={28} minSize={20} maxSize={45}>
              <div className="h-full overflow-hidden bg-panel border-r border-border">
                {renderLeftPanel()}
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Center: Preview */}
            <ResizablePanel id="moyin-center-panel" defaultSize={52} minSize={25}>
              <div className="h-full overflow-hidden">
                <PreviewPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: Properties */}
            <ResizablePanel id="moyin-right-panel" defaultSize={20} minSize={12} maxSize={35}>
              <div className="h-full overflow-hidden border-l border-border">
                {renderRightPanel()}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

          {/* Bottom: Timeline - only for director and media tabs */}
          {showTimeline && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={15} minSize={10} maxSize={40}>
                <SimpleTimeline />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
