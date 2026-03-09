// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { DirectorContextPanel } from "@/components/panels/director/context-panel";

export function RightPanel() {
  const { activeTab } = useMediaPanelStore();

  // 根据当前Tab显示不同内容
  const renderContent = () => {
    switch (activeTab) {
      case "director":
      case "sclass":
        return <DirectorContextPanel />;
      default:
        return (
          <div className="md:flex-1 flex items-center justify-center text-muted-foreground text-sm py-4 px-2">
            <p>待定</p>
          </div>
        );
    }
  };

  return (
    <div className="md:h-full flex flex-col bg-panel min-h-0">
      <div className="p-2 md:p-3 border-b border-border flex-shrink-0">
        <h3 className="font-medium text-sm">属性</h3>
      </div>
      <div className="md:flex-1 md:overflow-y-auto min-h-0 py-2">
        {renderContent()}
      </div>
    </div>
  );
}
