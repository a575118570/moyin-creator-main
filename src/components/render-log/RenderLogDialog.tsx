// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useRenderLogStore, type RenderLogEntry } from "@/stores/render-log-store";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import { Trash2, Copy, CircleCheck, CircleX, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function levelIcon(level: RenderLogEntry["level"]) {
  if (level === "success") return <CircleCheck className="h-4 w-4 text-green-500" />;
  if (level === "error") return <CircleX className="h-4 w-4 text-destructive" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
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
  const logs = useRenderLogStore((s) => (projectId ? s.logsByProjectId[projectId] || [] : []));
  const clearProject = useRenderLogStore((s) => s.clearProject);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-3xl h-[85dvh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>渲染日志（生成历史）</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!projectId || logs.length === 0}
                onClick={() => {
                  if (!projectId) return;
                  clearProject(projectId);
                  toast.success("已清空渲染日志");
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                清空
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-2" data-scrollable>
            {logs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                暂无日志。开始生成图片/视频后，这里会记录每次开始/完成/失败。
              </div>
            ) : (
              <div className="space-y-2 py-1">
                {logs.map((log) => {
                  const detail = [
                    log.error ? `error=${log.error}` : null,
                    log.url ? `url=${log.url}` : null,
                    log.entityId ? `id=${log.entityId}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n");

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "rounded-lg border bg-card p-3",
                        log.level === "error" && "border-destructive/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {levelIcon(log.level)}
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatTime(log.ts)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {log.source}/{log.kind}
                            </span>
                            {log.label && (
                              <span className="text-xs text-foreground/90 font-medium truncate">
                                {log.label}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm">
                            {log.message}
                            {log.status ? (
                              <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                                ({log.status})
                              </span>
                            ) : null}
                          </div>
                          {log.error && (
                            <div className="mt-2 text-xs text-destructive break-words whitespace-pre-wrap">
                              {log.error}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={async () => {
                            const payload =
                              `time=${new Date(log.ts).toISOString()}\n` +
                              `source=${log.source}\nkind=${log.kind}\n` +
                              (log.label ? `label=${log.label}\n` : "") +
                              (log.status ? `status=${log.status}\n` : "") +
                              `message=${log.message}\n` +
                              (detail ? `${detail}\n` : "");
                            const ok = await copyToClipboard(payload);
                            if (ok) toast.success("已复制日志详情");
                            else toast.error("复制失败");
                          }}
                          aria-label="复制日志详情"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

