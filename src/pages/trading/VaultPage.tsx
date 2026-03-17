import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Camera, Cloud, CloudOff, Download, Upload, Trash2, RefreshCw, Pin, Eye, FileJson, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react';
import {
  clearTrackerStorage,
  findTrackerStorageKey,
  getCurrentTrackerState,
  loadAutoBackupFromStorage,
  loadCloudUrlFromStorage,
  normalizeImportedTrackerState,
  saveAutoBackupToStorage,
  saveCloudUrlToStorage,
} from '@/lib/tracker-backup';

/* ── IDB Vault (Ring 1) ── */
interface Snapshot {
  id: string;
  ts: number;
  label: string;
  sizeKB: number;
  checksum: string;
  tradeCount: number;
  batchCount: number;
  state: Record<string, unknown>;
}

function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).toUpperCase();
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open('p2p_tracker_vault', 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata', { keyPath: 'key' });
    };
    req.onsuccess = (e) => res((e.target as IDBOpenDBRequest).result);
    req.onerror = () => rej(new Error('IndexedDB not available'));
  });
}

async function idbList(): Promise<Snapshot[]> {
  const db = await openIDB();
  return new Promise((res) => {
    const tx = db.transaction('snapshots', 'readonly');
    const req = tx.objectStore('snapshots').getAll();
    req.onsuccess = () => {
      const snaps = (req.result || []).sort((a: Snapshot, b: Snapshot) => b.ts - a.ts);
      res(snaps);
    };
    req.onerror = () => res([]);
  });
}

async function idbSave(state: Record<string, unknown>, label: string): Promise<void> {
  const db = await openIDB();
  const str = JSON.stringify(state || {});
  const snap: Snapshot = {
    id: 'snap_' + Date.now(),
    ts: Date.now(),
    label: label || 'Manual',
    sizeKB: Math.max(1, Math.ceil(str.length / 1024)),
    checksum: fnv1a(str),
    tradeCount: Array.isArray((state as any)?.trades) ? (state as any).trades.length : 0,
    batchCount: Array.isArray((state as any)?.batches) ? (state as any).batches.length : 0,
    state,
  };
  return new Promise((res, rej) => {
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put(snap);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(new Error('Failed to save'));
  });
}

async function idbGet(id: string): Promise<Snapshot | null> {
  const db = await openIDB();
  return new Promise((res) => {
    const tx = db.transaction('snapshots', 'readonly');
    const req = tx.objectStore('snapshots').get(id);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => res(null);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej();
  });
}

function downloadBlob(content: string, filename: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function getCurrentState(): Record<string, unknown> {
  return getCurrentTrackerState(localStorage);
}

async function clearTrackerVaultDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('p2p_tracker_vault');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/* ── Cloud version (Ring 2) type ── */
interface CloudVersion {
  versionId: string;
  label: string;
  exportedAt: string;
  bytes: number;
  pinned: boolean;
  trigger?: string;
  note?: string;
  checksum?: string;
}

export default function VaultPage() {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [snapDesc, setSnapDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [cloudUrl, setCloudUrl] = useState(() => loadCloudUrlFromStorage(localStorage));
  const [cloudConnected, setCloudConnected] = useState(false);
  const [cloudVersions, setCloudVersions] = useState<CloudVersion[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => loadAutoBackupFromStorage(localStorage));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadSnaps = useCallback(async () => {
    try {
      const list = await idbList();
      setSnaps(list);
    } catch {
      setSnaps([]);
    }
  }, []);

  useEffect(() => { loadSnaps(); }, [loadSnaps]);

  useEffect(() => {
    setCloudConnected(!!cloudUrl && cloudUrl.startsWith('https'));
  }, [cloudUrl]);

  const takeSnapshot = async () => {
    if (!snapDesc.trim()) {
      toast.error('Add a description for the snapshot');
      return;
    }
    setLoading(true);
    try {
      const state = getCurrentState();
      await idbSave(state, snapDesc.trim());
      setSnapDesc('');
      toast.success('📸 Snapshot saved');
      await loadSnaps();
    } catch (e: any) {
      toast.error('Failed: ' + (e.message || 'error'));
    } finally {
      setLoading(false);
    }
  };

  const restoreSnap = async (id: string) => {
    if (!confirm('Restore this local snapshot? Current data will be overwritten.')) return;
    const snap = await idbGet(id);
    if (!snap?.state) { toast.error('Snapshot not found'); return; }
    try {
      const sk = findTrackerStorageKey(localStorage);
      localStorage.setItem(sk, JSON.stringify(snap.state));
      toast.success('✓ Restored from local snapshot');
      window.location.reload();
    } catch (e: any) {
      toast.error('Restore failed: ' + e.message);
    }
  };

  const exportSnap = async (id: string) => {
    const snap = await idbGet(id);
    if (!snap?.state) { toast.error('Snapshot not found'); return; }
    const label = (snap.label || 'snapshot').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const d = new Date(snap.ts);
    const fname = `snapshot-${d.toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${label}.json`;
    downloadBlob(JSON.stringify(snap.state, null, 2), fname);
    toast.success('Exported snapshot');
  };

  const deleteSnap = async (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    await idbDelete(id);
    toast('Snapshot deleted');
    await loadSnaps();
  };

  const saveCloudUrl = () => {
    if (!cloudUrl.trim()) { toast.error('Paste your Web App URL first'); return; }
    saveCloudUrlToStorage(localStorage, cloudUrl.trim());
    toast.success('✓ URL saved');
  };

  const handleAutoBackupToggle = (v: boolean) => {
    setAutoBackup(v);
    saveAutoBackupToStorage(localStorage, v);
    toast(v ? 'Auto-backup ON' : 'Auto-backup OFF');
  };

  // Data export helpers
  const exportJSON = () => {
    const state = getCurrentState();
    const fname = `p2p-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    downloadBlob(JSON.stringify(state, null, 2), fname);
    toast.success('JSON exported');
  };

  const exportCSV = () => {
    const state = getCurrentState() as any;
    const trades = state.trades || [];
    if (!trades.length) { toast.error('No trades to export'); return; }
    const headers = ['id', 'ts', 'amountUSDT', 'sellPriceQAR', 'feeQAR', 'note', 'voided'];
    const rows = trades.map((t: any) => headers.map(h => JSON.stringify(t[h] ?? '')).join(','));
    downloadBlob([headers.join(','), ...rows].join('\n'), `trades-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    toast.success('CSV exported');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const normalized = normalizeImportedTrackerState(data);
        if (!confirm('Import this data? It will replace your current state.')) return;
        const sk = findTrackerStorageKey(localStorage);
        localStorage.setItem(sk, JSON.stringify(normalized));
        toast.success('Data imported — reloading…');
        setTimeout(() => window.location.reload(), 500);
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const clearAll = async () => {
    if (!confirm('⚠ Clear ALL data? This cannot be undone unless you have a backup.')) return;
    clearTrackerStorage(localStorage);
    await clearTrackerVaultDb();
    toast.success('Data cleared — reloading…');
    setTimeout(() => window.location.reload(), 500);
  };

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  return (
    <div className="tracker-page">
      <PageHeader title="Vault" description="Backup · Restore · Cloud · Drive sync" />

      <div className="p-6 space-y-4 max-w-6xl">
        {/* Ring 1 + Ring 2 side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Ring 1: Local IndexedDB ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">💾 Ring 1 — Local Snapshots</CardTitle>
                <Badge variant="outline" className="text-[10px]">IndexedDB</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Automatic local snapshots every 10 saves. Survives browser cache clears. No internet required.
              </p>

              <div className="space-y-2">
                <Label className="text-xs">Description *</Label>
                <Input
                  value={snapDesc}
                  onChange={e => setSnapDesc(e.target.value)}
                  placeholder="Why are you taking this snapshot?"
                />
              </div>

              <Button onClick={takeSnapshot} disabled={loading} size="sm">
                <Camera className="w-3 h-3 mr-1" /> Take Snapshot Now
              </Button>

              {/* Snapshot list */}
              <div className="space-y-0 border-t pt-3">
                {snaps.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No local snapshots yet. They are created every 10 saves automatically.</p>
                ) : (
                  snaps.slice(0, 8).map(s => (
                    <div key={s.id} className="flex justify-between items-start gap-2 py-2 border-b border-border/50">
                      <div className="min-w-0">
                        <div className="flex gap-2 items-baseline">
                          <span className="text-[11px] font-bold whitespace-nowrap">{fmtDate(s.ts)}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{s.label || '—'}</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {s.tradeCount} trades · {s.batchCount} batches · {s.sizeKB} KB · ✓ {(s.checksum || '—').slice(0, 8)}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2" onClick={() => restoreSnap(s.id)}>Restore</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2" onClick={() => exportSnap(s.id)}>Export</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2 text-destructive" onClick={() => deleteSnap(s.id)}>Del</Button>
                      </div>
                    </div>
                  ))
                )}
                {snaps.length > 8 && (
                  <p className="text-[10px] text-muted-foreground pt-2">+{snaps.length - 8} more older snapshots</p>
                )}
              </div>

              {/* Recovery */}
              <div className="border-t pt-3">
                <Label className="text-xs mb-2 block">Recovery Mode</Label>
                <p className="text-[10px] text-muted-foreground">
                  {snaps.length} snapshots{snaps.length > 0 ? ` · Latest: ${new Date(snaps[0].ts).toLocaleTimeString()}` : ''}
                </p>
                <Button variant="outline" size="sm" className="mt-2 text-[10px]" onClick={loadSnaps}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Ring 2: Cloud Vault ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">☁ Ring 2 — Cloud Vault</CardTitle>
                <Badge variant={cloudConnected ? 'default' : 'destructive'} className="text-[10px]">
                  {cloudConnected ? <><Cloud className="w-3 h-3 mr-1" /> Connected</> : <><CloudOff className="w-3 h-3 mr-1" /> No URL</>}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Versioned cloud backups via Google Drive. Up to 30 versions + pinned permanent backups.
              </p>

              <div className="flex gap-2">
                <Input
                  value={cloudUrl}
                  onChange={e => setCloudUrl(e.target.value)}
                  placeholder="Apps Script Web App URL"
                  className="flex-1 text-[11px]"
                />
                <Button variant="outline" size="sm" onClick={saveCloudUrl}>Save URL</Button>
              </div>

              <div className="flex gap-2">
                <Input placeholder="Backup label (optional)" className="flex-1 text-[11px]" />
                <Button size="sm" disabled={!cloudConnected}>
                  <Cloud className="w-3 h-3 mr-1" /> Backup Now
                </Button>
              </div>

              {/* Version list placeholder */}
              <div className="max-h-60 overflow-y-auto border-t pt-3">
                {!cloudConnected ? (
                  <p className="text-[10px] text-muted-foreground">Cloud not configured. Set up the Apps Script URL above.</p>
                ) : cloudVersions.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No cloud versions found. Click Backup Now to create one.</p>
                ) : (
                  cloudVersions.map((v, i) => (
                    <div key={v.versionId} className="flex justify-between items-start py-2 border-b border-border/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold">{v.label || `Version ${cloudVersions.length - i}`}</span>
                          {v.pinned && <Pin className="w-3 h-3 text-primary" />}
                          {v.checksum && <span className="text-[9px] text-green-500">✓</span>}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {v.exportedAt ? new Date(v.exportedAt).toLocaleString() : '—'} · {v.bytes ? (v.bytes / 1024).toFixed(1) + 'KB' : ''}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2">Restore</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2">Extract</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2"><Eye className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-[10px]" disabled={!cloudConnected}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
                <Button variant="outline" size="sm" className="text-[10px]">🔍 Scan Files</Button>
                <label>
                  <Button variant="outline" size="sm" className="text-[10px] cursor-pointer" asChild>
                    <span>📂 Import File</span>
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".json" className="hidden" />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cloud Backup Setup + Data Export/Import */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Cloud Backup Setup ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">☁ Cloud Backup Setup</CardTitle>
                <Badge variant={cloudConnected ? 'default' : 'secondary'} className="text-[10px]">
                  {cloudConnected ? '✓ Connected' : '⚠ No URL set'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Backup to <strong>your Google Drive</strong>. Setup is one-time, then versions are managed from this Vault.
              </p>

              <div className="rounded-md bg-muted/50 border p-3">
                <div className="text-[10px] font-bold text-primary mb-2">🚀 Setup (once only)</div>
                <div className="text-[10px] text-muted-foreground leading-loose space-y-1">
                  <p><strong>1.</strong> Open <a href="https://script.google.com/home/start" target="_blank" rel="noopener" className="text-primary underline">script.google.com</a> → <strong>New Project</strong></p>
                  <p><strong>2.</strong> Delete everything, paste the code below, click Save (💾)</p>
                  <p><strong>3.</strong> Click <strong>Deploy → New Deployment → Web App</strong></p>
                  <p><strong>4.</strong> Set <strong>"Who has access" = Anyone</strong> → Deploy</p>
                  <p><strong>5.</strong> Authorize → Copy the Web App URL → Paste in Vault</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Apps Script Code</Label>
                <Textarea
                  readOnly
                  rows={4}
                  className="font-mono text-[9px] resize-none"
                  value={`// Taheito Cloud Auth + Storage (Apps Script Web App)\n// Deploy as Web App → Execute as: Me → Anyone\n// Full code available in the repo docs/cloud-setup.md`}
                />
                <Button variant="outline" size="sm" className="w-full text-[10px]" onClick={() => {
                  navigator.clipboard.writeText('See repo docs for full Apps Script code').then(() => toast.success('Code copied!'));
                }}>📋 Copy Code</Button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs">Auto-backup after every change</Label>
                <Switch checked={autoBackup} onCheckedChange={handleAutoBackupToggle} />
              </div>
            </CardContent>
          </Card>

          {/* ── Data Export & Import ── */}
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">📦 Data Export & Import</CardTitle>
                <Badge variant="outline" className="text-[10px]">JSON · Excel · CSV</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Export your data for offline backup, Excel analysis, or transfer between devices.
              </p>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => toast('Excel export — coming soon')}>
                  <FileSpreadsheet className="w-3 h-3 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportJSON}>
                  <FileJson className="w-3 h-3 mr-1" /> JSON
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <FileText className="w-3 h-3 mr-1" /> CSV
                </Button>
              </div>

              <label className="block">
                <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                  <span><Upload className="w-3 h-3 mr-1" /> Import JSON</span>
                </Button>
                <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
              </label>

              <div className="border-t pt-3">
                <Button variant="destructive" size="sm" onClick={clearAll}>
                  <AlertTriangle className="w-3 h-3 mr-1" /> Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
