// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

import { useRenderLogStore, type RenderLogEntry } from "@/stores/render-log-store";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
// 注意：此组件做极限兜底渲染，尽量减少依赖与 JSX 动态节点，避免 Electron 打包环境下触发 React #185

function formatTime(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function levelIcon(level: RenderLogEntry["level"]) {
  // 纯文本兜底：避免某些打包环境里第三方 Icon 组件引发不可预期的渲染异常
  if (level === "success") return "✓";
  if (level === "error") return "✕";
  return "i";
}

function toText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (v instanceof Error) return v.stack || v.message || String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function RenderLogDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null | undefined;
}) {
  // 重要：在一些打包/受限环境里，Dialog(Portal) 或持久化 store 的初始化可能在“未打开弹窗”时也触发异常，
  // 进而导致整页崩溃。关闭时直接不挂载，保证页面可用性。
  if (!open) return null;

  // 这里刻意**不使用 zustand 的 hook 订阅**，而是一次性读取快照，
  // 避免在 dev / Electron 打包环境下，持久化 store 的被动更新与本组件形成
  // 「订阅 -> 渲染 -> 挂载 effect -> 触发 store 更新 -> 再渲染」的死循环，
  // 导致 "Maximum update depth exceeded"。
  const storeState = useRenderLogStore.getState();
  const logs = projectId ? storeState.logsByProjectId[projectId] || [] : [];
  const clearProject = (pid: string) => {
    useRenderLogStore.getState().clearProject(pid);
  };

  // 最小渲染路径：把所有日志先拍平成纯文本，避免任何“对象作为 React 子节点”的可能
  const logsText = logs
    .map((log) => {
      const header =
        `${formatTime(log.ts)} ` +
        `[${toText(log.level)}] ` +
        `${toText(log.source)}/${toText(log.kind)}` +
        (log.label ? ` ${toText(log.label)}` : "");
      const lines = [
        header,
        `message=${toText(log.message)}`,
        log.status ? `status=${toText(log.status)}` : null,
        log.entityId ? `id=${toText(log.entityId)}` : null,
        log.url ? `url=${toText(log.url)}` : null,
        log.error ? `error=${toText(log.error)}` : null,
      ].filter(Boolean) as string[];
      return lines.join("\n");
    })
    .join("\n\n");

  return (
    <div className="fixed inset-0 z-250">
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="关闭渲染日志"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[92vw] max-w-3xl h-[85dvh] overflow-hidden flex flex-col rounded-lg border bg-popover shadow-lg relative">
          <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-base font-semibold">渲染日志（生成历史）</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 px-3 rounded-md border text-sm bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!projectId || logs.length === 0}
                onClick={() => {
                  if (!projectId) return;
                  clearProject(projectId);
                  toast.success("已清空渲染日志");
                }}
              >
                清空
              </button>
              <button
                type="button"
                className="h-9 px-3 rounded-md border text-sm bg-background hover:bg-muted transition-colors"
                onClick={() => onOpenChange(false)}
              >
                关闭
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-4">
            {/* Electron 打包环境偶发 ScrollArea/Radix 组合渲染兼容问题：这里用原生滚动容器兜底 */}
            <div className="h-full overflow-auto pr-2" data-scrollable>
              {logs.length === 0 ? (
                <div className="text-sm text-muted-foreground py-10 text-center">
                  暂无日志。开始生成图片/视频后，这里会记录每次开始/完成/失败。
                </div>
              ) : (
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className="h-9 px-3 rounded-md border text-sm bg-background hover:bg-muted transition-colors"
                      onClick={async () => {
                        const payload = logsText || "";
                        const ok = await copyToClipboard(payload);
                        if (ok) toast.success("已复制全部日志");
                        else toast.error("复制失败");
                      }}
                      aria-label="复制全部日志"
                    >
                      复制全部
                    </button>
                  </div>
                  <pre className="text-[11px] leading-snug whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3">
                    {logsText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

