// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Help Panel - 教程页面
 * 显示漫果AI基本工作流教程
 */

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Mail, ExternalLink } from "lucide-react";
import { ScriptFormatExampleDialog } from "./ScriptFormatExampleDialog";

export function HelpPanel() {
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* 标题 */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">🎬 漫果AI — 基本工作流教程</h1>
              <p className="text-muted-foreground text-lg">
                从剧本到成片的完整创作流程指南
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              漫果AI内置了多种工作流，各板块可以自由组合、独立使用，满足不同创作场景的需求。
              <strong> 本教程介绍的是最常用的基础工作流，推荐新用户从这里开始。</strong>
            </p>

            <Separator />

            {/* 流程总览 */}
            <Card>
              <CardHeader>
                <CardTitle>📋 流程总览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  ⚙️ 准备工作 → 📝 剧本 → 🔧 AI校准 → 🌄 场景/🎭 角色（可选） → 🎬 导演 / ⭐ S级 → 🎥 生成视频
                </div>
              </CardContent>
            </Card>

            {/* 准备工作 */}
            <Card>
              <CardHeader>
                <CardTitle>准备工作：环境配置</CardTitle>
                <CardDescription>在开始创作前，需要先完成以下配置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">1. 添加 API 服务商</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    进入 <strong>设置 → API 配置 → 添加服务商</strong>，配置你的 AI 服务商账号。
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>建议添加 <strong>尽可能多的 API Key</strong>，系统支持多 Key 轮询负载均衡</li>
                    <li>Key 越多，<strong>并发线程数越高</strong>，批量生成速度越快</li>
                    <li>支持的服务商：memefast、RunningHub 等</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">2. 服务映射</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    进入 <strong>设置 → 服务映射</strong>，为各功能选择对应的 AI 模型：
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>为「文生图」「图生视频」「文生视频」等功能分别指定模型</li>
                    <li>根据你的服务商和需求选择合适的模型</li>
                  </ul>
                  <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-semibold mb-1">💡 新手推荐：</p>
                    <p className="text-sm">测试时建议先用以下模型：</p>
                    <ul className="list-disc list-inside space-y-1 text-sm mt-1 ml-4">
                      <li><strong>图片生成</strong>：<code className="bg-background px-1 rounded">gemini-3-pro-image-preview</code></li>
                      <li><strong>视频生成</strong>：<code className="bg-background px-1 rounded">doubao-seedance-1-5-pro-251215</code></li>
                    </ul>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">3. 图床配置</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    进入 <strong>设置 → 图床配置</strong>，配置图片托管服务：
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li>申请一个图床服务（用于上传参考图、首帧图等素材）</li>
                    <li>同样建议配置 <strong>多个 Key</strong>，提升并发上传速度</li>
                  </ul>
                </div>

                <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-sm">✅ 以上配置完成后，就可以开始创作了。</p>
                </div>
              </CardContent>
            </Card>

            {/* 第一步：剧本板块 */}
            <Card>
              <CardHeader>
                <CardTitle>第一步：剧本板块</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  进入 <strong>剧本板块</strong>，有两种方式开始：
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                  <li><strong>A. 导入剧本</strong> — 将已有的完整剧本粘贴或导入到编辑区</li>
                  <li><strong>B. AI 创作</strong> — 使用 AI 辅助从零创作剧本</li>
                </ul>
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm mb-2">
                    📄 <strong>剧本格式参考</strong>：查看剧本导入格式示例，了解标准的场景头、对白、舞台指示等写法。
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormatDialogOpen(true)}
                    className="w-full"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    查看剧本导入格式示例
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  系统会自动对剧本进行结构化分析，拆解为场景、分镜、角色、对白等元素。
                </p>
              </CardContent>
            </Card>

            {/* 第二步：AI 二次校准 */}
            <Card>
              <CardHeader>
                <CardTitle>第二步：AI 二次校准</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  系统自动分析完成后，依次点击以下三个校准按钮进行 <strong>二次深化</strong>：
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li><strong>AI 场景校准</strong> — 优化每个场景的环境描述、氛围、光影等细节</li>
                  <li><strong>API 校准分镜</strong> — 精确校准每个分镜的镜头语言、景别、构图</li>
                  <li><strong>AI 角色校准</strong> — 深化角色外观描述、表情、动作等一致性锚点</li>
                </ol>
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-sm">
                    校准后，系统会自动为每一步生成更精细、更专业的提示词，大幅提升后续生图/生视频的质量。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 第三步：生成素材 */}
            <Card>
              <CardHeader>
                <CardTitle>第三步：生成素材（可选）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  校准完成后，可以选择性地预先生成素材：
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                  <li><strong>A. 生成场景</strong> — 根据校准后的场景描述批量生成场景参考图</li>
                  <li><strong>B. 生成角色</strong> — 根据校准后的角色描述生成角色参考图</li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  这一步是可选的。如果直接进入导演/S级板块，系统也会自动调用相关素材。
                </p>
              </CardContent>
            </Card>

            {/* 第四步：进入导演板块 / S级板块 */}
            <Card>
              <CardHeader>
                <CardTitle>第四步：进入导演板块 / S级板块</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  切换到 <strong>导演板块</strong> 或 <strong>⭐ S级板块</strong>：
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li>
                    点击 <strong>右边栏「加载剧本分镜」</strong> — 将剧本中的所有分镜导入当前板块
                  </li>
                  <li>
                    <strong>左边栏</strong> 会自动为每个分镜填写：
                    <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                      <li>首帧提示词</li>
                      <li>尾帧提示词</li>
                      <li>视频提示词</li>
                    </ul>
                  </li>
                  <li>
                    所有参数均可根据个人喜好 <strong>自由微调</strong>（如镜头运动、时长、风格等）
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* 第五步：生成图片与视频 */}
            <Card>
              <CardHeader>
                <CardTitle>第五步：生成图片与视频</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  在导演板块 / S级板块的 <strong>分镜编辑</strong> 中（左边栏）：
                </p>

                <div>
                  <h3 className="font-semibold mb-2 text-sm">生图方式（二选一）</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                    <li><strong>A. 单镜生成</strong> — 逐个分镜单独生成图片</li>
                    <li><strong>B. 合并生成（推荐）</strong> — 将多个分镜合并批量生成</li>
                  </ul>
                  <div className="mt-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <p className="text-sm">
                      💡 <strong>推荐使用「合并生成」</strong>，生成后的图片会自动分配到对应的每一个分镜上。
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 text-sm">生成视频</h3>
                  <p className="text-sm text-muted-foreground">
                    图片分配完成后，点击 <strong>「生成视频」</strong> 即可开始批量生成分镜视频。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 第六步：S级板块 */}
            <Card>
              <CardHeader>
                <CardTitle>第六步：S级板块 — Seedance 2.0 进阶</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  S级板块支持 <strong>Seedance 2.0</strong> 的多镜头合并叙事功能：
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                  <li>
                    导入剧本后，可以自由选择 <strong>视频分组长短</strong>：
                    <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                      <li>1 个镜头 → 15 秒短片</li>
                      <li>多个镜头合并 → 15 秒叙事片段</li>
                      <li>根据需要灵活调整分组</li>
                    </ul>
                  </li>
                  <li>系统自动收集 @Image / @Video / @Audio 多模态引用</li>
                  <li>点击 <strong>「生成视频」</strong> 即可</li>
                </ol>
                <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <p className="text-sm">
                    S级板块会自动处理首帧图拼接、提示词三层融合（动作 + 镜头语言 + 对白唇形同步）、参数约束校验等。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 小贴士 */}
            <Card>
              <CardHeader>
                <CardTitle>💡 小贴士</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li><strong>先校准，再生成</strong> — 二次校准能显著提升输出质量，不要跳过</li>
                  <li><strong>合并生成优先</strong> — 合并生成比单镜生成效率更高，风格更统一</li>
                  <li><strong>参数可调</strong> — 每个分镜的提示词、首帧、尾帧都支持手动微调</li>
                  <li><strong>S级板块适合</strong> — 需要多镜头连贯叙事的场景（短剧、番剧预告等）</li>
                  <li><strong>导演板块适合</strong> — 逐镜头精细控制的场景</li>
                </ul>
              </CardContent>
            </Card>

            {/* 联系方式 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>有问题？联系 <a href="mailto:1240821936@qq.com" className="text-primary hover:underline">1240821936@qq.com</a></span>
                </div>
              </CardContent>
            </Card>

            <div className="h-8" />
          </div>
        </ScrollArea>
      </div>

      {/* 剧本格式示例对话框 */}
      <ScriptFormatExampleDialog
        open={formatDialogOpen}
        onOpenChange={setFormatDialogOpen}
      />
    </div>
  );
}
