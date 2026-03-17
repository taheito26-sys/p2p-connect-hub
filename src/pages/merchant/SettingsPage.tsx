import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Save, RotateCcw, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import {
  useTheme,
  LAYOUTS,
  THEME_NAMES,
  FONTS,
  FONT_SIZES,
  VISION_PROFILES,
  FONT_CONFIG,
  detectOptimalFontSize,
  type ThemeDef,
} from '@/lib/theme-context';

export default function SettingsPage() {
  const {
    settings: draft,
    update,
    save,
    discard,
    isDirty: dirty,
    currentLayout,
    logs,
    clearLogs,
    downloadLogs,
  } = useTheme();
  const t = useT();

  const commitSettings = () => {
    save();
    toast.success(t('settingsSaved'));
  };

  const discardSettings = () => {
    discard();
    toast(t('discardedChanges'));
  };

  const curLayoutDef = LAYOUTS.find(l => l.id === draft.layout) || LAYOUTS[0];
  const curThemeEntries = Object.entries(curLayoutDef.themes) as [string, ThemeDef][];

  return (
    <div className="tracker-page" dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('settings')} description={t('layoutThemesData')}>
        {dirty && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={discardSettings}><RotateCcw className="w-3 h-3 mr-1" /> {t('discardBtn')}</Button>
            <Button size="sm" onClick={commitSettings}><Save className="w-3 h-3 mr-1" /> {t('saveSettings')}</Button>
          </div>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* ── Layout Templates ── */}
        <Card className="glass">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-display">{t('layoutTemplates')}</CardTitle>
              <Badge variant="outline" className="text-xs">{currentLayout.name} · {currentLayout.font}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
              {LAYOUTS.map(l => (
                <button
                  key={l.id}
                  onClick={() => update({ layout: l.id })}
                  className={cn(
                    'relative rounded-lg border p-3 text-left transition-all hover:border-primary/50',
                    draft.layout === l.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                  )}
                >
                  {draft.layout === l.id && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="text-xs font-bold">{l.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{l.desc}</div>
                  <div className="flex gap-0.5 mt-2">
                    {l.swatches.map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {/* Theme Colors */}
            <div>
              <Label className="text-xs mb-2 block">{t('colorThemes')} {currentLayout.name}</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {curThemeEntries.map(([tid, themeDef]) => {
                  const swatchColors = [themeDef.brand, themeDef.brand2, themeDef.good, themeDef.bad, themeDef.warn, themeDef.muted];
                  return (
                    <button
                      key={tid}
                      onClick={() => update({ theme: tid })}
                      className={cn(
                        'rounded-lg border p-2.5 transition-all hover:border-primary/50',
                        draft.theme === tid ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                      )}
                    >
                      <div className="flex gap-0.5 mb-1">
                        <div className="w-5 h-5 rounded-sm border" style={{ background: themeDef.bg }} title="Background" />
                        <div className="w-5 h-5 rounded-sm" style={{ background: themeDef.panel }} title="Panel" />
                        {swatchColors.map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-sm flex-1" style={{ background: c }} />
                        ))}
                      </div>
                      <div className="text-[10px] text-center font-medium">{THEME_NAMES[tid] || tid}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* ── Trading Config ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">{t('tradingConfig')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">{t('lowStockThreshold')}</Label>
                <Input
                  type="number" step={100} min={0}
                  value={draft.lowStockThreshold}
                  onChange={e => update({ lowStockThreshold: Number(e.target.value) || 0 })}
                  className="max-w-[180px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('priceAlertThreshold')}</Label>
                <Input
                  type="number" step={0.5} min={0}
                  value={draft.priceAlertThreshold}
                  onChange={e => update({ priceAlertThreshold: Number(e.target.value) || 0 })}
                  className="max-w-[180px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('allowInvalidTrades')}</Label>
                <Switch checked={draft.allowInvalidTrades} onCheckedChange={v => update({ allowInvalidTrades: v })} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t('allowInvalidTradesDesc')}
              </p>
            </CardContent>
          </Card>

          {/* ── Fonts & Accessibility ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">{t('fontsAccessibility')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs mb-2 block">{t('ledgerFont')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {FONTS.map(f => (
                    <button
                      key={f}
                      onClick={() => update({ ledgerFont: f })}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] border transition-all',
                        draft.ledgerFont === f ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/30'
                      )}
                      style={{ fontFamily: `'${f}', sans-serif` }}
                    >
                      {f.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">{t('fontSize')}</Label>
                <div className="flex gap-1.5">
                  {FONT_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => update({ ledgerFontSize: s })}
                      className={cn(
                        'px-2.5 py-1 rounded text-[10px] border transition-all',
                        draft.ledgerFontSize === s ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/30'
                      )}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <Label className="text-xs mb-2 block">{t('accessibilityProfile')}</Label>
                <div className="flex gap-1.5 mb-3">
                  {VISION_PROFILES.map(p => (
                    <button
                      key={p}
                      onClick={() => update({ fontVisionProfile: p })}
                      className={cn(
                        'px-2.5 py-1 rounded text-[10px] border transition-all capitalize',
                        draft.fontVisionProfile === p ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/30'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('autoAdjustFont')}</Label>
                  <Switch checked={!draft.autoFontDisable} onCheckedChange={v => update({ autoFontDisable: !v })} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-2">
                  {t('autoSize')}: <span className="font-mono">{detectOptimalFontSize(Number(draft.ledgerFontSize || FONT_CONFIG.baseSize), draft.fontVisionProfile)}px</span> (width {typeof window !== 'undefined' ? window.innerWidth : '?'}px)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Logs ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">{t('logs')}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{logs.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('enableLogs')}</Label>
                <Switch checked={draft.logsEnabled} onCheckedChange={v => update({ logsEnabled: v })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('level')}</Label>
                <div className="flex gap-1.5">
                  {(['error','warn','info'] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => update({ logLevel: lvl })}
                      className={cn(
                        'px-3 py-1 rounded text-[10px] border transition-all',
                        draft.logLevel === lvl ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border hover:border-primary/30'
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={downloadLogs}>
                  <Download className="w-3 h-3 mr-1" /> {t('download')}
                </Button>
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => { clearLogs(); toast(t('logsCleared')); }}>
                  <Trash2 className="w-3 h-3 mr-1" /> {t('clear')}
                </Button>
              </div>

              {logs.length > 0 && (
                <ScrollArea className="h-40 border rounded-md p-2">
                  {logs.slice(0, 50).map(entry => (
                    <div key={entry.id} className="flex gap-2 items-start py-0.5 border-b border-border/30 last:border-0">
                      <span className={cn(
                        'text-[9px] font-mono shrink-0 w-10 text-center rounded px-1',
                        entry.level === 'error' ? 'text-destructive bg-destructive/10' :
                        entry.level === 'warn' ? 'text-warning bg-warning/10' :
                        'text-muted-foreground bg-muted'
                      )}>
                        {entry.level}
                      </span>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {new Date(entry.ts).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] truncate">{entry.message}</span>
                    </div>
                  ))}
                </ScrollArea>
              )}

              <p className="text-[10px] text-muted-foreground">
                {t('clientSideLogs')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
