import { useEffect, useMemo, useState } from 'react';
import { createDemoState } from '@/lib/tracker-demo-data';
import {
  fmtU,
  fmtP,
  fmtQ,
  fmtDate,
  fmtDur,
  getWACOP,
  rangeLabel,
  batchCycleTime,
  computeFIFO,
  uid,
  type TrackerState,
} from '@/lib/tracker-helpers';
import { useTheme } from '@/lib/theme-context';
import { useT } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import '@/styles/tracker.css';

const nowInput = () => new Date().toISOString().slice(0, 16);
const norm = (v: string) => v.trim().toLowerCase();

function inputFromTs(ts: number) {
  return new Date(ts).toISOString().slice(0, 16);
}

export default function StockPage() {
  const { settings, update } = useTheme();
  const t = useT();

  const initial = useMemo(() => createDemoState({
    lowStockThreshold: settings.lowStockThreshold,
    priceAlertThreshold: settings.priceAlertThreshold,
    range: settings.range,
    currency: settings.currency,
  }), []);

  const [state, setState] = useState<TrackerState>(initial.state);
  const [derived, setDerived] = useState(initial.derived);

  const [batchDate, setBatchDate] = useState(nowInput());
  const [batchMode, setBatchMode] = useState<'QAR' | 'USDT'>('QAR');
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [batchPrice, setBatchPrice] = useState('');
  const [batchAmount, setBatchAmount] = useState('');
  const [batchSupplier, setBatchSupplier] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [batchMsg, setBatchMsg] = useState('');

  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const [supplierAddOpen, setSupplierAddOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editNote, setEditNote] = useState('');

  const [manualSuppliers, setManualSuppliers] = useState<Array<{ name: string; phone?: string }>>([]);

  const applyState = (next: TrackerState) => {
    setState(next);
    setDerived(computeFIFO(next.batches, next.trades));
  };

  useEffect(() => {
    const next: TrackerState = {
      ...state,
      range: settings.range,
      currency: settings.currency,
      settings: {
        ...state.settings,
        lowStockThreshold: settings.lowStockThreshold,
        priceAlertThreshold: settings.priceAlertThreshold,
      },
    };
    applyState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.range, settings.currency, settings.lowStockThreshold, settings.priceAlertThreshold]);

  const wacop = getWACOP(derived);
  const rLabel = rangeLabel(state.range);

  const query = (settings.searchQuery || '').trim().toLowerCase();
  const supplierLookup = useMemo(() => {
    const names = [
      ...manualSuppliers.map((s) => s.name),
      ...state.batches.map((b) => b.source),
    ].filter(Boolean);
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (!query) return unique;
    return unique.filter((n) => n.toLowerCase().includes(query));
  }, [manualSuppliers, query, state.batches]);

  const perf = useMemo(() => state.batches
    .map((b) => {
      const db = derived.batches.find((x) => x.id === b.id);
      const rem = db ? Math.max(0, db.remainingUSDT) : b.initialUSDT;
      const used = b.initialUSDT - rem;
      let profit = 0;
      for (const [, c] of derived.tradeCalc) {
        if (!c.ok) continue;
        const s = c.slices.find((sl) => sl.batchId === b.id);
        if (s) profit += s.qty * c.ppu;
      }
      return { ...b, remaining: rem, used, profit };
    })
    .filter((b) => {
      if (!query) return true;
      return [fmtDate(b.ts), b.source, b.note].join(' ').toLowerCase().includes(query);
    })
    .sort((a, b) => b.ts - a.ts), [derived, query, state.batches]);

  const suppliersForPanel = useMemo(() => [
    ...new Set(state.batches.map((b) => b.source.trim()).filter(Boolean)),
  ], [state.batches]);

  const addSupplier = () => {
    if (!newSupplierName.trim()) return;
    setManualSuppliers((prev) => {
      if (prev.some((s) => norm(s.name) === norm(newSupplierName))) return prev;
      return [...prev, { name: newSupplierName.trim(), phone: newSupplierPhone.trim() }];
    });
    setBatchSupplier(newSupplierName.trim());
    setSupplierAddOpen(false);
    setSupplierMenuOpen(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
  };

  const addBatch = () => {
    const ts = new Date(batchDate).getTime();
    const px = Number(batchPrice);
    const rawAmt = Number(batchAmount);
    const source = batchSupplier.trim();

    const errs: string[] = [];
    if (!Number.isFinite(ts)) errs.push(t('date'));
    if (!(px > 0)) errs.push(t('price'));
    if (!(rawAmt > 0)) errs.push(t('volume'));
    if (!source) errs.push(t('supplier'));

    if (errs.length) {
      setBatchMsg(`${t('fixFields')} ${errs.join(', ')}`);
      return;
    }

    const volumeQAR = batchMode === 'USDT' ? rawAmt * px : rawAmt;
    const totalUSDT = volumeQAR / px;

    const next: TrackerState = {
      ...state,
      batches: [
        ...state.batches,
        {
          id: uid(),
          ts,
          source,
          note: batchNote.trim(),
          buyPriceQAR: px,
          initialUSDT: totalUSDT,
          revisions: [],
        },
      ],
    };

    applyState(next);
    setBatchAmount('');
    setBatchPrice('');
    setBatchSupplier('');
    setBatchNote('');
    setBatchMsg(t('batchAdded'));
  };

  const openEdit = (id: string) => {
    const b = state.batches.find((x) => x.id === id);
    if (!b) return;
    setEditingBatchId(id);
    setEditDate(inputFromTs(b.ts));
    setEditSource(b.source);
    setEditQty(String(b.initialUSDT));
    setEditPrice(String(b.buyPriceQAR));
    setEditNote(b.note || '');
  };

  const saveBatchEdit = () => {
    if (!editingBatchId) return;
    const ts = new Date(editDate).getTime();
    const qty = Number(editQty);
    const px = Number(editPrice);
    const src = editSource.trim();
    if (!Number.isFinite(ts) || !(qty > 0) || !(px > 0) || !src) {
      return;
    }

    const nextBatches = state.batches.map((b) => {
      if (b.id !== editingBatchId) return b;
      return {
        ...b,
        ts,
        source: src,
        note: editNote.trim(),
        initialUSDT: qty,
        buyPriceQAR: px,
        revisions: [
          { at: Date.now(), before: { ts: b.ts, source: b.source, note: b.note, initialUSDT: b.initialUSDT, buyPriceQAR: b.buyPriceQAR } },
          ...b.revisions,
        ].slice(0, 20),
      };
    });

    applyState({ ...state, batches: nextBatches });
    setEditingBatchId(null);
  };

  const deleteBatch = () => {
    if (!editingBatchId) return;
    applyState({ ...state, batches: state.batches.filter((b) => b.id !== editingBatchId) });
    setEditingBatchId(null);
  };

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
      <div className="twoColPage">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t('batches')}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('fifoProgress')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="pill">{rLabel}</span>
            </div>
          </div>

          {perf.length === 0 ? (
            <div className="empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <div className="empty-t">{t('noBatchesShort')}</div>
              <div className="empty-s">{t('addFirstPurchase')}</div>
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('source')}</th>
                    <th className="r">{t('total')}</th>
                    <th className="r">{t('buy')}</th>
                    <th className="r">{t('rem')}</th>
                    <th>{t('usage')}</th>
                    <th className="r">{t('profit')}</th>
                    <th>{t('statusEdit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.map((b) => {
                    const rem = Number.isFinite(b.remaining) ? b.remaining : b.initialUSDT;
                    const pct = b.initialUSDT > 0 ? rem / b.initialUSDT : 0;
                    const prog = Math.max(0, Math.min(100, pct * 100));
                    const ct = batchCycleTime(state, derived, b.id);
                    const st = rem <= 1e-9 ? t('depleted') : rem < b.initialUSDT ? t('partial') : t('fresh');
                    const stCls = rem <= 1e-9 ? 'bad' : rem < b.initialUSDT ? 'warn' : 'good';

                    return (
                      <tr key={b.id}>
                        <td className="mono">{fmtDate(b.ts)}</td>
                        <td>{b.source || '—'}</td>
                        <td className="mono r">{fmtU(b.initialUSDT)}</td>
                        <td className="mono r">{fmtP(b.buyPriceQAR)}</td>
                        <td className="mono r">{fmtU(rem)}</td>
                        <td>
                          <div className="prog"><span style={{ width: `${prog.toFixed(0)}%` }} /></div>
                          <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>{prog.toFixed(0)}% {t('remainingPct')}</div>
                        </td>
                        <td className="mono r" style={{ color: (b.profit || 0) >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>
                          {(b.profit || 0) >= 0 ? '+' : ''}{fmtQ(b.profit || 0)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <span className={`pill ${stCls}`}>{st}</span>
                            {ct !== null && <span className="cycle-badge">{fmtDur(ct)}</span>}
                            <button className="rowBtn" onClick={() => setDetailsOpen(prev => ({ ...prev, [b.id]: !prev[b.id] }))}>{detailsOpen[b.id] ? t('hideDetails') : t('details')}</button>
                            <button className="rowBtn" onClick={() => openEdit(b.id)}>{t('edit')}</button>
                          </div>
                        </td>
                      </tr>
                      {detailsOpen[b.id] && (
                        <tr key={`${b.id}-detail`}>
                          <td colSpan={8} style={{ padding: '8px 12px', background: 'color-mix(in srgb, var(--brand) 3%, var(--bg))' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11 }}>
                              <div><span className="muted">{t('batchDate')}:</span> <strong>{new Date(b.ts).toLocaleString()}</strong></div>
                              <div><span className="muted">{t('batchSource')}:</span> <strong>{b.source || '—'}</strong></div>
                              <div><span className="muted">{t('batchQty')}:</span> <strong>{fmtU(b.initialUSDT)} USDT</strong></div>
                              <div><span className="muted">{t('batchBuyPrice')}:</span> <strong>{fmtP(b.buyPriceQAR)} QAR</strong></div>
                              <div><span className="muted">{t('batchRemaining')}:</span> <strong>{fmtU(rem)} USDT</strong></div>
                              <div><span className="muted">{t('batchUtilization')}:</span> <strong>{(100 - prog).toFixed(0)}% {t('usage')}</strong></div>
                              <div><span className="muted">{t('cost')}:</span> <strong>{fmtQ(b.initialUSDT * b.buyPriceQAR)} QAR</strong></div>
                              {b.note && <div><span className="muted">{t('batchNotes')}:</span> <strong>{b.note}</strong></div>}
                              {ct !== null && <div><span className="muted">{t('cycleTime')}:</span> <strong>{fmtDur(ct)}</strong></div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {suppliersForPanel.length > 0 && (
            <div className="panel" style={{ marginTop: 9 }}>
              <div className="panel-head">
                <h2>📦 {t('suppliers')}</h2>
                <span className="pill">{t('autoTracked')}</span>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {suppliersForPanel.map((s) => (
                  <span key={s} className="pill" style={{ cursor: 'pointer' }} onClick={() => update({ searchQuery: s })}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="formPanel salePanel">
            <div className="hdr">{t('addBatchTitle')}</div>
            <div className="inner">
              {wacop && (
                <div className="bannerRow">
                  <span className="bLbl">{t('currentAvPrice')}</span>
                  <span className="bVal">{fmtP(wacop)}</span>
                  <span className="bSpacer" />
                  <span className="bPill">{t('avg')}</span>
                </div>
              )}
              <div className="field2">
                <div className="lbl">{t('dateTime')}</div>
                <div className="inputBox"><input type="datetime-local" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} /></div>
              </div>
              <div className="field2">
                <div className="lbl">{t('currencyMode')}</div>
                <div className="modeToggle">
                  <button className={batchMode === 'QAR' ? 'active' : ''} type="button" onClick={() => setBatchMode('QAR')}>📦 QAR</button>
                  <button className={batchMode === 'USDT' ? 'active' : ''} type="button" onClick={() => setBatchMode('USDT')}>💲 USDT</button>
                </div>
              </div>
              <div className="g2tight">
                <div className="field2">
                  <div className="lbl">{t('buyPriceQar')}</div>
                  <div className="inputBox"><input inputMode="decimal" placeholder="3.74" value={batchPrice} onChange={(e) => setBatchPrice(e.target.value)} /></div>
                </div>
                <div className="field2">
                  <div className="lbl">{batchMode === 'QAR' ? t('volumeQar') : t('amountUsdt')}</div>
                  <div className="inputBox"><input inputMode="decimal" placeholder="96,050" value={batchAmount} onChange={(e) => setBatchAmount(e.target.value)} /></div>
                </div>
              </div>
              <div className="field2" style={{ gridColumn: 'span 2' }}>
                <div className="lbl">{t('supplier')}</div>
                <div className="lookupShell">
                  <div className="inputBox lookupBox" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      placeholder={t('searchOrTypeSupplier')}
                      autoComplete="off"
                      value={batchSupplier}
                      onChange={(e) => {
                        setBatchSupplier(e.target.value);
                        setSupplierMenuOpen(true);
                      }}
                      onFocus={() => setSupplierMenuOpen(true)}
                    />
                    <button className="sideAction" type="button" title={t('showSuppliers')} onClick={() => setSupplierMenuOpen((v) => !v)}>⌄</button>
                    <button
                      className="sideAction"
                      type="button"
                      title={t('addSupplierTitle')}
                      onClick={() => {
                        setNewSupplierName(batchSupplier);
                        setSupplierAddOpen((v) => !v);
                      }}
                    >
                      +
                    </button>
                  </div>

                  {supplierMenuOpen && (
                    <div className="lookupMenu">
                      {supplierLookup.length ? supplierLookup.map((name) => (
                        <button
                          key={name}
                          className="lookupItem"
                          type="button"
                          onClick={() => {
                            setBatchSupplier(name);
                            setSupplierMenuOpen(false);
                          }}
                        >
                          <span>{name}</span>
                          <span className="lookupMeta">{t('supplier')}</span>
                        </button>
                      )) : (
                        <div className="lookupItem" style={{ cursor: 'default' }}>
                          <span>{t('noSuppliersYet')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="lookupHint">{t('supplierHint')}</div>
              </div>

              {supplierAddOpen && (
                <div className="previewBox" style={{ marginTop: 2 }}>
                  <div className="pt">{t('addSupplierTitle')}</div>
                  <div className="g2tight" style={{ marginBottom: 6 }}>
                    <div className="field2">
                      <div className="lbl">{t('name')}</div>
                      <div className="inputBox"><input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder={t('supplierName')} /></div>
                    </div>
                    <div className="field2">
                      <div className="lbl">{t('phone')}</div>
                      <div className="inputBox"><input value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder="+974 ..." /></div>
                    </div>
                  </div>
                  <div className="formActions">
                    <button className="btn secondary" onClick={() => setSupplierAddOpen(false)}>{t('cancel')}</button>
                    <button className="btn" onClick={addSupplier}>{t('addSupplierTitle')}</button>
                  </div>
                </div>
              )}

              <div className="field2">
                <div className="lbl">{t('note')}</div>
                <div className="inputBox"><input placeholder={t('optionalNote')} value={batchNote} onChange={(e) => setBatchNote(e.target.value)} /></div>
              </div>

              <div className="formActions"><button className="btn" onClick={addBatch}>{t('addBatchTitle')}</button></div>
              <div className={`msg ${batchMsg.includes(t('fixFields')) ? 'bad' : ''}`}>{batchMsg}</div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!editingBatchId} onOpenChange={(open) => !open && setEditingBatchId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editBatch')}</DialogTitle>
          </DialogHeader>

          <div className="field2" style={{ marginTop: 4 }}>
            <div className="lbl">{t('dateTime')}</div>
            <div className="inputBox"><input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
          </div>
          <div className="field2" style={{ marginTop: 8 }}>
            <div className="lbl">{t('supplier')}</div>
            <div className="inputBox"><input value={editSource} onChange={(e) => setEditSource(e.target.value)} /></div>
          </div>
          <div className="g2tight" style={{ marginTop: 8 }}>
            <div className="field2">
              <div className="lbl">{t('qtyUsdt')}</div>
              <div className="inputBox"><input inputMode="decimal" value={editQty} onChange={(e) => setEditQty(e.target.value)} /></div>
            </div>
            <div className="field2">
              <div className="lbl">{t('buyPriceQar')}</div>
              <div className="inputBox"><input inputMode="decimal" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></div>
            </div>
          </div>
          <div className="field2" style={{ marginTop: 8 }}>
            <div className="lbl">{t('note')}</div>
            <div className="inputBox"><input value={editNote} onChange={(e) => setEditNote(e.target.value)} /></div>
          </div>

          <DialogFooter>
            <button className="btn secondary" onClick={deleteBatch}>{t('delete')}</button>
            <button className="btn" onClick={saveBatchEdit}>{t('saveChanges')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
