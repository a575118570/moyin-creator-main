import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLicenseStore } from '@/stores/license-store';
import { normalizeLicenseKey, verifyLicenseKey } from '@/lib/license/license';

export function LicenseGate({ bannerText }: { bannerText?: string }) {
  const { licenseKey, status, activate, clear, getHint } = useLicenseStore();
  const [draft, setDraft] = useState<string>(licenseKey || '');

  const hint = useMemo(() => getHint(), [getHint, status.valid]);
  const errorText = status.valid ? '' : status.reason;

  const handleActivate = () => {
    const normalized = normalizeLicenseKey(draft);
    const s = activate(normalized);
    if (s.valid) {
      toast.success('激活成功');
    } else {
      toast.error(s.reason || '激活失败');
    }
  };

  const handlePasteAndActivate = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setDraft(text);
      const normalized = normalizeLicenseKey(text);
      const s = activate(normalized);
      if (s.valid) toast.success('激活成功');
      else toast.error(s.reason || '激活失败');
    } catch {
      toast.error('读取剪贴板失败，请手动粘贴');
    }
  };

  const handleCheck = () => {
    const s = verifyLicenseKey(normalizeLicenseKey(draft));
    if (s.valid) toast.success('密钥有效');
    else toast.error(s.reason || '密钥无效');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>请输入开门密钥</CardTitle>
          <CardDescription>
            没有有效密钥将无法进入软件。密钥由管理员离线签发（无需联网）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bannerText ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              {bannerText}
            </div>
          ) : null}
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="MG1.********.********"
            showClearIcon
            onClear={() => setDraft('')}
          />

          {!status.valid ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              当前状态：{errorText}
            </p>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              已激活：{hint || '有效授权'}
            </p>
          )}

          <div className="text-xs text-muted-foreground">
            提示：如果你更换了电脑/清空了数据目录，需要重新输入密钥激活。
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleCheck}>
            校验
          </Button>
          <Button variant="outline" onClick={handlePasteAndActivate}>
            从剪贴板激活
          </Button>
          <Button variant="destructive" onClick={() => { clear(); setDraft(''); toast.success('已清除'); }}>
            清除
          </Button>
          <Button variant="primary" onClick={handleActivate}>
            激活进入
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

