"use client";

import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  name?: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: any;
  componentStack?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // 让 Electron main.ts 的 webContents.on('console-message') 能抓到关键信息
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary] ${this.props.name || "Unknown"} crashed:`, error, info);
    this.setState({ componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error?.message ||
      (typeof this.state.error === "string" ? this.state.error : "未知错误");

    const stack =
      this.state.error?.stack && typeof this.state.error.stack === "string"
        ? this.state.error.stack
        : "";

    return (
      <div className="w-full min-h-[40vh] p-6 md:p-10 flex items-center justify-center">
        <div className="max-w-2xl w-full rounded-xl border bg-card p-6 space-y-3">
          <div className="text-base font-semibold">
            页面渲染失败{this.props.name ? `：${this.props.name}` : ""}
          </div>
          <div className="text-sm text-muted-foreground break-words whitespace-pre-wrap">{message}</div>
          {(stack || this.state.componentStack) && (
            <details className="rounded-lg border bg-muted/40 p-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">查看错误详情（stack）</summary>
              {stack && (
                <pre className="mt-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
                  {stack}
                </pre>
              )}
              {this.state.componentStack && (
                <pre className="mt-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
                  {this.state.componentStack}
                </pre>
              )}
            </details>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
              }}
            >
              重试渲染
            </Button>
            <Button
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
            >
              刷新页面
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            若软件端出现黑屏，按 <b>F12</b> 打开开发者工具，把控制台里 <code>[ErrorBoundary]</code>{" "}
            的报错发我即可精确定位。
          </div>
        </div>
      </div>
    );
  }
}

