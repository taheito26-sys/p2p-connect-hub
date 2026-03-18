import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDemoState } from '@/lib/tracker-demo-data';
import {
  fmtU, fmtP, fmtQ, fmtDate, getWACOP, inRange, rangeLabel, fmtDur, computeFIFO, uid,
  type TrackerState, type Trade, type Customer, type TradeCalcResult,
} from '@/lib/tracker-helpers';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import * as api from '@/lib/api';
import { DEAL_TYPE_CONFIGS, calculateAllocation } from '@/lib/deal-engine';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { MerchantRelationship, MerchantDeal } from '@/types/domain';
import '@/styles/tracker.css';

const nowInput = () => new Date().toISOString().slice(0, 16);
const normalizeName = (v: string) => v.trim().toLowerCase();
function toInputFromTs(ts: number) { return new Date(ts).toISOString().slice(0, 16); }

export default function OrdersPage() {
  const { settings } = useTheme();
  const { userId } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const initial = useMemo(() => createDemoState({
    lowStockThreshold: settings.lowStockThreshold,
    priceAlertThreshold: settings.priceAlertThreshold,
    range: settings.range,
    currency: settings.currency,
  }), []);

  const [state, setState] = useState<TrackerState>(initial.state);
  const [derived, setDerived] = useState(initial.derived);

  const [saleDate, setSaleDate] = useState(nowInput());
  const [saleMode, setSaleMode] = useState<'USDT' | 'QAR'>('USDT');
  const [saleAmount, setSaleAmount] = useState('');
  const [saleSell, setSaleSell] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [useStock, setUseStock] = useState(true);
  const [saleMessage, setSaleMessage] = useState('');

  const [buyerMenuOpen, setBuyerMenuOpen] = useState(false);
  const [addBuyerOpen, setAddBuyerOpen] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newBuyerPhone, setNewBuyerPhone] = useState('');
  const [newBuyerTier, setNewBuyerTier] = useState('C');

  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editSell, setEditSell] = useState('');
  const [editBuyer, setEditBuyer] = useState('');
  const [editUsesStock, setEditUsesStock] = useState(true);

  // ─── Merchant Deal Linking ────────────────────────────────────────
  const [relationships, setRelationships] = useState<MerchantRelationship[]>([]);
  const [linkedRelId, setLinkedRelId] = useState('');
  const [linkedDealId, setLinkedDealId] = useState('');
  const [relDeals, setRelDeals] = useState<MerchantDeal[]>([]);
  const [allMerchantDeals, setAllMerchantDeals] = useState<MerchantDeal[]>([]);
  const [allocationPreview, setAllocationPreview] = useState<{ counterpartyAmount: number; merchantAmount: number; counterpartyName: string; dealTitle: string } | null>(null);

  useEffect(() => {
    api.relationships.list().then(r => setRelationships(r.relationships)).catch(() => {});
    api.deals.list().then(r => setAllMerchantDeals(r.deals)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!linkedRelId) { setRelDeals([]); setLinkedDealId(''); return; }
    api.deals.list(linkedRelId).then(r => setRelDeals(r.deals.filter(d => ['active', 'due'].includes(d.status)))).catch(() => {});
  }, [linkedRelId]);

  useEffect(() => {
    if (!linkedDealId || !saleAmount) { setAllocationPreview(null); return; }
    const deal = relDeals.find(d => d.id === linkedDealId);
    const rel = relationships.find(r => r.id === linkedRelId);
    if (!deal || !rel) { setAllocationPreview(null); return; }
    const raw = Number(saleAmount);
    const sell = Number(saleSell);
    const orderAmount = saleMode === 'USDT' ? raw * sell : raw;
    const alloc = calculateAllocation(deal, orderAmount, 'QAR');
    if (alloc) {
      setAllocationPreview({ ...alloc, counterpartyName: rel.counterparty?.display_name || t('buyer'), dealTitle: deal.title });
    } else { setAllocationPreview(null); }
  }, [linkedDealId, saleAmount, saleSell, saleMode, relDeals, relationships, linkedRelId]);

  const applyState = (next: TrackerState) => {
    setState(next);
    setDerived(computeFIFO(next.batches, next.trades));
  };

  useEffect(() => {
    const next: TrackerState = { ...state, range: settings.range, currency: settings.currency,
      settings: { ...state.settings, lowStockThreshold: settings.lowStockThreshold, priceAlertThreshold: settings.priceAlertThreshold }
    };
    applyState(next);
  }, [settings.range, settings.currency, settings.lowStockThreshold, settings.priceAlertThreshold]);

  const wacop = getWACOP(derived);
  useEffect(() => { if (!saleSell && wacop) setSaleSell(fmtP(wacop)); }, [wacop, saleSell]);

  const rLabel = rangeLabel(state.range);
  const query = (settings.searchQuery || '').trim().toLowerCase();

  const allTrades = useMemo(() => [...state.trades].sort((a, b) => b.ts - a.ts), [state.trades]);
  const list = useMemo(() => allTrades.filter(t => inRange(t.ts, state.range)), [allTrades, state.range]);
  const filtered = useMemo(() => {
    if (!query) return list;
    return list.filter(t => {
      const c = state.customers.find(x => x.id === t.customerId);
      return [fmtDate(t.ts), String(t.amountUSDT), String(t.sellPriceQAR), c?.name || ''].join(' ').toLowerCase().includes(query);
    });
  }, [list, query, state.customers]);

  const merchantDealsForPanel = useMemo(
    () => allMerchantDeals.filter(d => ['active', 'due', 'overdue', 'draft'].includes(d.status)),
    [allMerchantDeals],
  );
  const creatorMerchantDeals = useMemo(
    () => merchantDealsForPanel.filter(d => d.created_by === userId),
    [merchantDealsForPanel, userId],
  );
  const partnerMerchantDeals = useMemo(
    () => merchantDealsForPanel.filter(d => d.created_by !== userId),
    [merchantDealsForPanel, userId],
  );

  const filteredCustomers = useMemo(() => {
    const q = normalizeName(buyerName);
    if (!q) return state.customers;
    return state.customers.filter(c => normalizeName(c.name).includes(q) || c.phone.includes(buyerName));
  }, [buyerName, state.customers]);

  const salePreview = useMemo(() => {
    const sell = Number(saleSell);
    const raw = Number(saleAmount);
    const ts = new Date(saleDate).getTime();
    let amountUSDT = saleMode === 'USDT' ? raw : sell > 0 ? raw / sell : 0;
    if (!(amountUSDT > 0) || !(sell > 0) || !Number.isFinite(ts)) return null;
    const tmpTrade: Trade = { id: '__preview__', ts, inputMode: saleMode, amountUSDT, sellPriceQAR: sell, feeQAR: 0, note: '', voided: false, usesStock: true, revisions: [], customerId: '' };
    const calc = computeFIFO(state.batches, [...state.trades, tmpTrade]).tradeCalc.get('__preview__');
    const rev = amountUSDT * sell;
    const cost = calc?.slices.reduce((s, x) => s + x.cost, 0) || 0;
    const net = calc?.ok ? rev - cost : NaN;
    return { qty: amountUSDT, revenue: rev, avgBuy: calc?.ok ? calc.avgBuyQAR : NaN, cost: calc?.ok ? cost : NaN, net };
  }, [saleAmount, saleDate, saleMode, saleSell, state.batches, state.trades]);

  const ensureCustomer = (name: string, phone = '', tier = 'C') => {
    const nm = name.trim();
    if (!nm) return { id: '', customers: state.customers };
    const existing = state.customers.find(c => normalizeName(c.name) === normalizeName(nm));
    if (existing) return { id: existing.id, customers: state.customers };
    const nextCustomer: Customer = { id: uid(), name: nm, phone, tier, dailyLimitUSDT: 0, notes: '', createdAt: Date.now() };
    return { id: nextCustomer.id, customers: [...state.customers, nextCustomer] };
  };

  const addBuyerFromModal = () => {
    if (!newBuyerName.trim()) return;
    const created = ensureCustomer(newBuyerName, newBuyerPhone, newBuyerTier);
    if (!created.id) return;
    applyState({ ...state, customers: created.customers });
    setBuyerName(newBuyerName.trim());
    setBuyerId(created.id);
    setBuyerMenuOpen(false);
    setAddBuyerOpen(false);
    setNewBuyerName(''); setNewBuyerPhone(''); setNewBuyerTier('C');
  };

  const addTrade = async () => {
    const ts = new Date(saleDate).getTime();
    const sell = Number(saleSell);
    const raw = Number(saleAmount);
    let amountUSDT = saleMode === 'USDT' ? raw : sell > 0 ? raw / sell : 0;
    const errs: string[] = [];
    if (!Number.isFinite(ts)) errs.push(t('date'));
    if (!(sell > 0)) errs.push(t('sellPriceLabel'));
    if (!(raw > 0)) errs.push(t('quantity'));
    if (!(amountUSDT > 0)) errs.push(t('amountUsdt'));
    if (!buyerName.trim()) errs.push(t('buyerNameRequired'));
    if (errs.length) { setSaleMessage(`${t('fixFields')} ${errs.join(', ')}`); return; }

    let nextCustomers = state.customers;
    let customerId = buyerId;
    if (buyerName.trim()) {
      const ensured = ensureCustomer(buyerName);
      customerId = ensured.id;
      nextCustomers = ensured.customers;
    } else { customerId = ''; }

    const trade: Trade = {
      id: uid(), ts, inputMode: saleMode, amountUSDT, sellPriceQAR: sell, feeQAR: 0, note: '', voided: false, usesStock: useStock, revisions: [], customerId,
      linkedDealId: linkedDealId || undefined,
      linkedRelId: linkedRelId || undefined,
    };
    const next: TrackerState = { ...state, customers: nextCustomers, trades: [...state.trades, trade], range: inRange(ts, state.range) ? state.range : 'all' };
    applyState(next);

    if (linkedDealId && allocationPreview) {
      try {
        const revenue = amountUSDT * sell;
        await api.deals.recordProfit(linkedDealId, {
          amount: allocationPreview.counterpartyAmount,
          period_key: new Date().toISOString().substring(0, 7),
          note: `Auto-allocation from sell order: ${fmtU(amountUSDT)} USDT @ ${fmtP(sell)} QAR. Total: ${fmtQ(revenue)}. ${allocationPreview.counterpartyName}'s share: ${fmtQ(allocationPreview.counterpartyAmount)}.`,
        });
        toast.success(t('tradeLogged'));
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      setSaleMessage(t('tradeLogged'));
    }

    setSaleAmount('');
    setLinkedRelId('');
    setLinkedDealId('');
    setAllocationPreview(null);
  };

  const exportCsv = () => {
    const rows = filtered.map(t => {
      const c = derived.tradeCalc.get(t.id);
      const revenue = t.amountUSDT * t.sellPriceQAR;
      const cost = c?.slices.reduce((s, x) => s + x.cost, 0) || 0;
      const net = c?.ok ? revenue - cost : NaN;
      return [new Date(t.ts).toISOString(), t.amountUSDT, t.sellPriceQAR, revenue, Number.isFinite(cost) ? cost : '', Number.isFinite(net) ? net : ''].join(',');
    });
    const csv = `Date,Qty USDT,Sell QAR,Revenue QAR,Cost QAR,Net QAR\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const openEdit = (id: string) => {
    const t = state.trades.find(x => x.id === id);
    if (!t) return;
    const cn = state.customers.find(c => c.id === t.customerId)?.name || '';
    setEditingTradeId(id); setEditDate(toInputFromTs(t.ts)); setEditQty(String(t.amountUSDT)); setEditSell(String(t.sellPriceQAR)); setEditBuyer(cn); setEditUsesStock(t.usesStock);
  };

  const saveTradeEdit = () => {
    if (!editingTradeId) return;
    const ts = new Date(editDate).getTime();
    const qty = Number(editQty); const sell = Number(editSell);
    if (!Number.isFinite(ts) || !(qty > 0) || !(sell > 0) || !editBuyer.trim()) return;
    let nextCustomers = state.customers; let customerId = '';
    if (editBuyer.trim()) { const ensured = ensureCustomer(editBuyer); nextCustomers = ensured.customers; customerId = ensured.id; }
    const nextTrades = state.trades.map(t => {
      if (t.id !== editingTradeId) return t;
      return { ...t, ts, amountUSDT: qty, sellPriceQAR: sell, customerId, usesStock: editUsesStock,
        revisions: [{ at: Date.now(), before: { ts: t.ts, amountUSDT: t.amountUSDT, sellPriceQAR: t.sellPriceQAR, customerId: t.customerId, usesStock: t.usesStock } }, ...t.revisions].slice(0, 20),
      };
    });
    applyState({ ...state, customers: nextCustomers, trades: nextTrades });
    setEditingTradeId(null);
  };

  const deleteTrade = () => {
    if (!editingTradeId) return;
    applyState({ ...state, trades: state.trades.filter(t => t.id !== editingTradeId) });
    setEditingTradeId(null);
  };

  const renderDetail = (tr: Trade, c?: TradeCalcResult) => {
    const ok = !!c?.ok;
    const revenue = tr.amountUSDT * tr.sellPriceQAR;
    const cost = c?.slices.reduce((s, sl) => s + sl.cost, 0) || 0;
    const net = ok ? revenue - cost - tr.feeQAR : NaN;
    const slicesWithBatch = (c?.slices || []).map(sl => {
      const b = state.batches.find(x => x.id === sl.batchId);
      return { ...sl, source: b?.source || '—', price: b?.buyPriceQAR || 0, ts: b?.ts || tr.ts, pct: b && b.initialUSDT > 0 ? (sl.qty / b.initialUSDT) * 100 : 0 };
    });
    const cycleMs = slicesWithBatch.length ? tr.ts - Math.min(...slicesWithBatch.map(s => s.ts)) : null;
    return (
      <div className="tradeDetail">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          <span className="pill">{new Date(tr.ts).toLocaleString()}</span>
          {ok && <span className="pill">{t('avgBuy')} {fmtP(c!.avgBuyQAR)}</span>}
          <span className="pill">{t('revenue')} {fmtQ(revenue)}</span>
          <span className="pill">{t('fee')} {fmtQ(tr.feeQAR)}</span>
          {ok && <span className="pill">{t('cost')} {fmtQ(cost)}</span>}
          <span className={`pill ${Number.isFinite(net) ? (net >= 0 ? 'good' : 'bad') : ''}`}>{t('net')} {Number.isFinite(net) ? `${net >= 0 ? '+' : ''}${fmtQ(net)}` : '—'}</span>
          {cycleMs !== null && <span className="cycle-badge">{t('cycle')} {fmtDur(cycleMs)}</span>}
        </div>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{t('fifoSlices')}</div>
        {ok && slicesWithBatch.length ? slicesWithBatch.map(sl => (
          <div key={`${tr.id}-${sl.batchId}-${sl.qty}`} className="muted" style={{ fontSize: 10, margin: '2px 0' }}>
            {sl.source} · <span className="mono">{fmtU(sl.qty)}</span> @ <span className="mono">{fmtP(sl.price)}</span> <span className="cycle-badge">{sl.pct.toFixed(1)}{t('ofBatch')}</span>
          </div>
        )) : <div className="msg">{t('noSlices')}</div>}
      </div>
    );
  };

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
      <div className="twoColPage">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t('trades')}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('fifoCostBasisMargin')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="pill">{rLabel}</span>
              <button className="btn secondary" onClick={exportCsv}>CSV</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4h10M7 8h10M7 12h10M7 16h10M7 20h10" /></svg>
              <div className="empty-t">{t('noTradesYet')}</div>
              <div className="empty-s">{t('addBatchThenSale')}</div>
            </div>
          ) : (
            <div className="tableWrap ledgerWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('date')}</th><th>{t('buyer')}</th><th className="r">{t('qty')}</th><th className="r">{t('avgBuy')}</th><th className="r">{t('sell')}</th><th className="r">{t('volume')}</th><th className="r">{t('net')}</th><th>{t('margin')}</th><th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tr => {
                    const c = derived.tradeCalc.get(tr.id);
                    const ok = !!c?.ok;
                    const rev = tr.amountUSDT * tr.sellPriceQAR;
                    const net = ok ? c!.netQAR : NaN;
                    const margin = ok && rev > 0 ? c!.netQAR / rev : NaN;
                    const pct = Number.isFinite(margin) ? Math.min(1, Math.abs(margin) / 0.05) : 0;
                    const cn = state.customers.find(x => x.id === tr.customerId)?.name || '';
                    const isMerchantOrder = !!(tr.linkedDealId || tr.linkedRelId);
                    const linkedDeal = isMerchantOrder ? allMerchantDeals.find(d => d.id === tr.linkedDealId) : null;
                    const linkedRel = isMerchantOrder ? relationships.find(r => r.id === tr.linkedRelId) : null;
                    const dealCfg = linkedDeal ? DEAL_TYPE_CONFIGS[linkedDeal.deal_type] : null;
                    const dealCustomerName = linkedDeal?.metadata?.customer_name as string | undefined;
                    const dealSupplierName = linkedDeal?.metadata?.supplier_name as string | undefined;
                    return (
                      <React.Fragment key={tr.id}>
                        <tr style={isMerchantOrder ? { background: 'color-mix(in srgb, var(--brand) 4%, transparent)' } : undefined}>
                        <td>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
                            <span className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(tr.ts)}</span>
                            {!ok && <span className="pill bad" style={{ fontSize: 9 }}>!</span>}
                            {isMerchantOrder && (
                              <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--brand) 20%, transparent)', color: 'var(--brand)', fontWeight: 700, letterSpacing: '.3px' }}>
                                {t('merchantOrder')}
                              </span>
                            )}
                          </div>
                          {isMerchantOrder && linkedDeal && (
                            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600 }}>{dealCfg?.icon} {linkedDeal.title}</span>
                              {linkedRel?.counterparty?.display_name && (
                                <span className="pill" style={{ fontSize: 8 }}>🤝 {linkedRel.counterparty.display_name}</span>
                              )}
                              {dealCfg?.hasCounterpartyShare && (
                                <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }}>
                                  {t('capitalShared')}
                                </span>
                              )}
                              {dealCustomerName && <span style={{ fontSize: 8 }}>👤 {dealCustomerName}</span>}
                              {dealSupplierName && <span style={{ fontSize: 8 }}>📦 {dealSupplierName}</span>}
                            </div>
                          )}
                        </td>
                        <td>{cn ? <span className="tradeBuyerChip" title={cn} style={{ maxWidth: 130 }}>{cn}</span> : <span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span>}</td>
                        <td className="mono r">{fmtU(tr.amountUSDT)}</td>
                        <td className="mono r">{ok ? fmtP(c!.avgBuyQAR) : '—'}</td>
                        <td className="mono r">{fmtP(tr.sellPriceQAR)}</td>
                        <td className="mono r">{fmtQ(rev)}</td>
                        <td className="mono r" style={{ color: Number.isFinite(net) ? (net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)', fontWeight: 700 }}>{Number.isFinite(net) ? (net >= 0 ? '+' : '') + fmtQ(net) : '—'}</td>
                        <td>
                          <div className={`prog ${Number.isFinite(margin) && margin < 0 ? 'neg' : ''}`} style={{ maxWidth: 90 }}><span style={{ width: `${(pct * 100).toFixed(0)}%` }} /></div>
                          <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>{Number.isFinite(margin) ? `${(margin * 100).toFixed(2)}% ${t('marginLabel')}` : '—'}</div>
                        </td>
                        <td>
                          <div className="actionsRow">
                            <button className="rowBtn" onClick={() => setDetailsOpen(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}>
                              {detailsOpen[tr.id] ? t('hideDetails') : t('details')}
                            </button>
                            <button className="rowBtn" onClick={() => openEdit(tr.id)}>{t('edit')}</button>
                          </div>
                        </td>
                      </tr>
                      {detailsOpen[tr.id] && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0 }}>
                            {renderDetail(tr, c)}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── MERCHANT DEALS CONTEXT PANEL ─── */}
          {allMerchantDeals.length > 0 && (
            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-head">
                <h2>🤝 {t('merchantDealsInOrders')}</h2>
                <span className="pill">{allMerchantDeals.filter(d => ['active', 'due'].includes(d.status)).length} {t('activeDeals')}</span>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {partnerMerchantDeals.length > 0 && (
                  <div style={{ background: 'color-mix(in srgb, var(--brand) 5%, var(--bg))', border: '1px solid color-mix(in srgb, var(--brand) 15%, var(--line))', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'color-mix(in srgb, var(--bg) 85%, black 15%)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('date')}</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('merchantLabel')}</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('type')}</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Status</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('amount')}</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>P&amp;L</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>ROI</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>{t('actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partnerMerchantDeals.map(deal => {
                          const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                          const rel = relationships.find(r => r.id === deal.relationship_id);
                          const roi = deal.realized_pnl != null && deal.amount > 0 ? (deal.realized_pnl / deal.amount) * 100 : null;
                          const workspacePath = rel ? `/network/relationships/${rel.id}` : '/deals';
                          return (
                            <tr key={deal.id} style={{ borderTop: '1px solid color-mix(in srgb, var(--line) 85%, transparent)' }}>
                              <td style={{ padding: '10px', fontSize: 11 }}>{deal.issue_date}</td>
                              <td style={{ padding: '10px', fontSize: 11, fontWeight: 700 }}>{rel?.counterparty?.display_name || '—'}</td>
                              <td style={{ padding: '10px', fontSize: 11 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{cfg?.icon}</span>
                                  <span>{cfg?.label || deal.deal_type}</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px', fontSize: 11 }}><span className="pill" style={{ fontSize: 8 }}>{deal.status}</span></td>
                              <td style={{ padding: '10px', fontSize: 11, textAlign: 'right', fontWeight: 700 }}>${deal.amount.toLocaleString()} {deal.currency}</td>
                              <td style={{ padding: '10px', fontSize: 11, textAlign: 'right', color: deal.realized_pnl != null ? (deal.realized_pnl >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)' }}>
                                {deal.realized_pnl != null ? `${deal.realized_pnl >= 0 ? '+' : ''}${fmtQ(deal.realized_pnl)}` : '—'}
                              </td>
                              <td style={{ padding: '10px', fontSize: 11, textAlign: 'right', color: roi != null ? (roi >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)' }}>
                                {roi != null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : '—'}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>
                                <button className="rowBtn" type="button" onClick={() => navigate(workspacePath)}>
                                  {t('viewInWorkspace')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {creatorMerchantDeals.map(deal => {
                  const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                  const rel = relationships.find(r => r.id === deal.relationship_id);
                  const linkedOrderCount = state.trades.filter(tr => tr.linkedDealId === deal.id).length;
                  const custName = deal.metadata?.customer_name as string | undefined;
                  const suppName = deal.metadata?.supplier_name as string | undefined;
                  return (
                    <div key={deal.id} style={{ background: 'color-mix(in srgb, var(--brand) 5%, var(--bg))', border: '1px solid color-mix(in srgb, var(--brand) 15%, var(--line))', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span>{cfg?.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 11 }}>{deal.title}</span>
                        <span className="pill" style={{ fontSize: 8 }}>{deal.status}</span>
                        {cfg?.hasCounterpartyShare && (
                          <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }}>
                            {t('capitalShared')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 9, color: 'var(--muted)' }}>
                        <span>{t('amount')}: <strong style={{ color: 'var(--t1)' }}>${deal.amount.toLocaleString()} {deal.currency}</strong></span>
                        {rel?.counterparty?.display_name && <span>{t('counterpartyLabel')}: <strong style={{ color: 'var(--t1)' }}>{rel.counterparty.display_name}</strong></span>}
                        {custName && <span>👤 {custName}</span>}
                        {suppName && <span>📦 {suppName}</span>}
                        <span>{t('orders')}: <strong style={{ color: 'var(--t1)' }}>{linkedOrderCount}</strong></span>
                      </div>
                    </div>
                  );
                })}
                {merchantDealsForPanel.length === 0 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>{t('noMerchantDeals')}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="formPanel salePanel">
            <div className="hdr">{t('newSale')}</div>
            <div className="inner">
              {wacop && (
                <div className="bannerRow">
                  <span className="bLbl">{t('avPrice')}</span><span className="bVal">{fmtP(wacop)}</span><span className="bSpacer" /><span className="bPill">FIFO</span>
                </div>
              )}

              <div className="field2">
                <div className="lbl">{t('dateTime')}</div>
                <div className="inputBox"><input type="datetime-local" value={saleDate} onChange={e => setSaleDate(e.target.value)} /></div>
              </div>

              <div className="field2">
                <div className="lbl">{t('inputMode')}</div>
                <div className="modeToggle">
                  <button className={saleMode === 'USDT' ? 'active' : ''} type="button" onClick={() => setSaleMode('USDT')}>💲 USDT</button>
                  <button className={saleMode === 'QAR' ? 'active' : ''} type="button" onClick={() => setSaleMode('QAR')}>📦 QAR</button>
                </div>
              </div>

              <div className="g2tight">
                <div className="field2">
                  <div className="lbl">{saleMode === 'USDT' ? t('quantity') : t('amountQar')}</div>
                  <div className="inputBox"><input inputMode="decimal" placeholder="0.00" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} /></div>
                </div>
                <div className="field2">
                  <div className="lbl">{t('sellPriceLabel')}</div>
                  <div className="inputBox"><input inputMode="decimal" placeholder={wacop ? fmtP(wacop) : '0.00'} value={saleSell} onChange={e => setSaleSell(e.target.value)} /></div>
                </div>
              </div>

              <div className="field2">
                <div className="lbl">{t('buyerName')}</div>
                <div className="lookupShell">
                  <div className="inputBox lookupBox" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input placeholder={t('searchOrTypeBuyer')} style={{ flex: 1, paddingRight: 0 }} autoComplete="off" value={buyerName}
                      onFocus={() => setBuyerMenuOpen(true)}
                      onChange={e => { setBuyerName(e.target.value); setBuyerId(''); setBuyerMenuOpen(true); }}
                    />
                    <button className="sideAction" title={t('buyer')} type="button" onClick={() => setBuyerMenuOpen(v => !v)}>⌄</button>
                    <button className="sideAction" title={t('addBuyerTitle')} type="button" onClick={() => { setNewBuyerName(buyerName); setAddBuyerOpen(v => !v); }}>+</button>
                  </div>
                  {buyerMenuOpen && (
                    <div className="lookupMenu">
                      {filteredCustomers.length ? filteredCustomers.map(c => (
                        <button key={c.id} className="lookupItem" type="button" onClick={() => { setBuyerName(c.name); setBuyerId(c.id); setBuyerMenuOpen(false); }}>
                          <span>{c.name}</span><span className="lookupMeta">{c.phone || c.tier}</span>
                        </button>
                      )) : <div className="lookupItem" style={{ cursor: 'default' }}><span>{t('noBuyersYet')}</span></div>}
                    </div>
                  )}
                </div>
              </div>

              {addBuyerOpen && (
                <div className="previewBox" style={{ marginTop: 2 }}>
                  <div className="pt">{t('addBuyerTitle')}</div>
                  <div className="g2tight" style={{ marginBottom: 6 }}>
                    <div className="field2"><div className="lbl">{t('name')}</div><div className="inputBox"><input value={newBuyerName} onChange={e => setNewBuyerName(e.target.value)} placeholder={t('buyerNamePlaceholder')} /></div></div>
                    <div className="field2"><div className="lbl">{t('phone')}</div><div className="inputBox"><input value={newBuyerPhone} onChange={e => setNewBuyerPhone(e.target.value)} placeholder="+974 ..." /></div></div>
                  </div>
                  <div className="field2">
                    <div className="lbl">{t('tier')}</div>
                    <div className="modeToggle">{['A', 'B', 'C', 'D'].map(tier => (<button key={tier} type="button" className={newBuyerTier === tier ? 'active' : ''} onClick={() => setNewBuyerTier(tier)}>{tier}</button>))}</div>
                  </div>
                  <div className="formActions"><button className="btn secondary" onClick={() => setAddBuyerOpen(false)}>{t('cancel')}</button><button className="btn" onClick={addBuyerFromModal}>{t('addBuyerTitle')}</button></div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, cursor: 'pointer', color: 'var(--muted)' }}>
                <input type="checkbox" checked={useStock} onChange={e => setUseStock(e.target.checked)} style={{ accentColor: 'var(--brand)' }} /> {t('useFifoStock')}
              </label>

              {/* ─── MERCHANT DEAL LINKING ─── */}
              <div className="previewBox" style={{ marginTop: 6, borderColor: linkedDealId ? 'var(--brand)' : undefined }}>
                <div className="pt" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t('linkToMerchantDeal')}
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>{t('optional')}</span>
                </div>
                <div className="field2" style={{ marginBottom: 4 }}>
                  <div className="lbl">{t('relationship')}</div>
                  <select
                    value={linkedRelId}
                    onChange={e => { setLinkedRelId(e.target.value); setLinkedDealId(''); }}
                    style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}
                  >
                    <option value="">{t('noneSelected')}</option>
                    {relationships.map(r => (
                      <option key={r.id} value={r.id}>{r.counterparty?.display_name || r.id} ({r.relationship_type})</option>
                    ))}
                  </select>
                </div>
                {linkedRelId && (
                  <div className="field2" style={{ marginBottom: 4 }}>
                    <div className="lbl">{t('deal')}</div>
                    <select
                      value={linkedDealId}
                      onChange={e => setLinkedDealId(e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}
                    >
                      <option value="">{t('selectDeal')}</option>
                      {relDeals.map(d => {
                        const cfg = DEAL_TYPE_CONFIGS[d.deal_type];
                        return <option key={d.id} value={d.id}>{cfg?.icon} {d.title} (${d.amount.toLocaleString()} {d.currency})</option>;
                      })}
                    </select>
                    {relDeals.length === 0 && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{t('noActiveDeals')}</div>}
                  </div>
                )}
                {allocationPreview && (
                  <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', borderRadius: 4, padding: '6px 8px', marginTop: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 3 }}>{t('allocationPreview')}</div>
                    <div className="prev-row"><span className="muted">{t('deal')}</span><strong style={{ fontSize: 10 }}>{allocationPreview.dealTitle}</strong></div>
                    <div className="prev-row"><span className="muted">{allocationPreview.counterpartyName}{t('counterpartyShare')}</span><strong style={{ color: 'var(--bad)', fontSize: 10 }}>{fmtQ(allocationPreview.counterpartyAmount)}</strong></div>
                    <div className="prev-row"><span className="muted">{t('yourShare')}</span><strong style={{ color: 'var(--good)', fontSize: 10 }}>{fmtQ(allocationPreview.merchantAmount)}</strong></div>
                    <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{t('autoApprovalNote')}</div>
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="previewBox">
                <div className="pt">{t('livePreview')}</div>
                {!salePreview ? <div className="muted" style={{ fontSize: 11 }}>{t('enterDetails')}</div> : (
                  <>
                    {Number.isFinite(salePreview.avgBuy) && <div className="prev-row"><span className="muted">{t('avgBuy')}</span><strong style={{ color: 'var(--bad)' }}>{fmtP(salePreview.avgBuy)} QAR</strong></div>}
                    <div className="prev-row"><span className="muted">{t('qty')}</span><strong>{fmtU(salePreview.qty)} USDT</strong></div>
                    <div className="prev-row"><span className="muted">{t('revenue')}</span><strong>{fmtQ(salePreview.revenue)}</strong></div>
                    <div className="prev-row"><span className="muted">{t('costFifo')}</span><strong>{Number.isFinite(salePreview.cost) ? fmtQ(salePreview.cost) : '—'}</strong></div>
                    <div className="prev-row" style={{ borderTop: '1px solid color-mix(in srgb,var(--brand) 20%,transparent)', paddingTop: 5 }}>
                      <span className="muted">{t('net')}</span>
                      <strong style={{ color: Number.isFinite(salePreview.net) ? (salePreview.net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)' }}>
                        {Number.isFinite(salePreview.net) ? `${salePreview.net >= 0 ? '+' : ''}${fmtQ(salePreview.net)}` : '—'}
                      </strong>
                    </div>
                  </>
                )}
              </div>

              <div className="formActions"><button className="btn" onClick={addTrade}>{t('addTrade')}</button></div>
              <div className={`msg ${saleMessage.includes(t('fixFields')) ? 'bad' : ''}`}>{saleMessage}</div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!editingTradeId} onOpenChange={open => !open && setEditingTradeId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('editTrade')}</DialogTitle></DialogHeader>
          <div className="field2" style={{ marginTop: 4 }}><div className="lbl">{t('dateTime')}</div><div className="inputBox"><input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} /></div></div>
          <div className="g2tight" style={{ marginTop: 8 }}>
            <div className="field2"><div className="lbl">{t('quantityUsdt')}</div><div className="inputBox"><input inputMode="decimal" value={editQty} onChange={e => setEditQty(e.target.value)} /></div></div>
            <div className="field2"><div className="lbl">{t('sellPriceQar')}</div><div className="inputBox"><input inputMode="decimal" value={editSell} onChange={e => setEditSell(e.target.value)} /></div></div>
          </div>
          <div className="field2" style={{ marginTop: 8 }}><div className="lbl">{t('buyerLabel')}</div><div className="inputBox"><input value={editBuyer} onChange={e => setEditBuyer(e.target.value)} placeholder={t('buyerNamePlaceholder')} /></div></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
            <input type="checkbox" checked={editUsesStock} onChange={e => setEditUsesStock(e.target.checked)} style={{ accentColor: 'var(--brand)' }} /> {t('useFifoStock')}
          </label>
          <DialogFooter>
            <button className="btn secondary" onClick={deleteTrade}>{t('delete')}</button>
            <button className="btn" onClick={saveTradeEdit}>{t('saveChanges')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
