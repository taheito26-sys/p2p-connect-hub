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
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { MerchantRelationship, MerchantDeal } from '@/types/domain';
import '@/styles/tracker.css';

type TabKey = 'myOrders' | 'incoming' | 'outgoing';

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
  const [editFee, setEditFee] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');

  // ─── Merchant Deal Linking ────────────────────────────────────────
  const [relationships, setRelationships] = useState<MerchantRelationship[]>([]);
  const [linkedRelId, setLinkedRelId] = useState('');
  const [linkedDealId, setLinkedDealId] = useState('');
  const [relDeals, setRelDeals] = useState<MerchantDeal[]>([]);
  const [allMerchantDeals, setAllMerchantDeals] = useState<MerchantDeal[]>([]);
  const [allocationPreview, setAllocationPreview] = useState<{ counterpartyAmount: number; merchantAmount: number; counterpartyName: string; dealTitle: string } | null>(null);
  const [merchantOrderEnabled, setMerchantOrderEnabled] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [adjustingDealId, setAdjustingDealId] = useState<string | null>(null);
  const [adjustShareValue, setAdjustShareValue] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // ─── Sub-tab state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('myOrders');
  // For incoming/outgoing form: track if we're in deal-select phase or order-form phase
  const [formDealId, setFormDealId] = useState('');
  const [formRelId, setFormRelId] = useState('');

  const reloadMerchantData = useCallback(async () => {
    try {
      const [relationshipsRes, dealsRes] = await Promise.all([
        api.relationships.list(),
        api.deals.list(),
      ]);
      setRelationships(relationshipsRes.relationships);
      setAllMerchantDeals(dealsRes.deals);
    } catch {
      // keep tracker usable even if merchant data refresh fails
    }
  }, []);

  useEffect(() => {
    reloadMerchantData();
  }, [reloadMerchantData]);

  useEffect(() => {
    if (!linkedRelId) { setRelDeals([]); setLinkedDealId(''); return; }
    api.deals.list(linkedRelId).then(r => setRelDeals(r.deals)).catch(() => {});
  }, [linkedRelId]);

  useEffect(() => {
    if (!linkedDealId || !saleAmount) { setAllocationPreview(null); return; }
    // Look in relDeals first (relationship-scoped), fall back to allMerchantDeals (for card-based selection)
    const deal = relDeals.find(d => d.id === linkedDealId) || allMerchantDeals.find(d => d.id === linkedDealId);
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

  // ─── Reset form & merchant state when switching tabs ────────────
  useEffect(() => {
    setSaleAmount('');
    setSaleMessage('');
    setLinkedRelId('');
    setLinkedDealId('');
    setAllocationPreview(null);
    setFormDealId('');
    setFormRelId('');
    if (activeTab === 'incoming' || activeTab === 'outgoing') {
      setMerchantOrderEnabled(true);
    } else {
      setMerchantOrderEnabled(false);
    }
  }, [activeTab]);

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

  const merchantDealsForPanel = useMemo(() => allMerchantDeals, [allMerchantDeals]);
  const creatorMerchantDeals = useMemo(
    () => merchantDealsForPanel.filter(d => d.created_by === userId),
    [merchantDealsForPanel, userId],
  );
  const partnerMerchantDeals = useMemo(
    () => merchantDealsForPanel.filter(d => d.created_by !== userId),
    [merchantDealsForPanel, userId],
  );

  const merchantLinkedTrades = useMemo(
    () => allTrades.filter(tr => !!(tr.linkedDealId || tr.linkedRelId)),
    [allTrades],
  );

  // ─── Tab-specific derived data ───────────────────────────────────
  const selfTrades = useMemo(
    () => filtered.filter(tr => !tr.linkedDealId && !tr.linkedRelId),
    [filtered],
  );

  const partnerDealIds = useMemo(
    () => new Set(partnerMerchantDeals.map(d => d.id)),
    [partnerMerchantDeals],
  );
  const creatorDealIds = useMemo(
    () => new Set(creatorMerchantDeals.map(d => d.id)),
    [creatorMerchantDeals],
  );

  const incomingTrades = useMemo(
    () => allTrades.filter(tr => tr.linkedDealId && partnerDealIds.has(tr.linkedDealId)),
    [allTrades, partnerDealIds],
  );
  const outgoingTrades = useMemo(
    () => allTrades.filter(tr => tr.linkedDealId && creatorDealIds.has(tr.linkedDealId)),
    [allTrades, creatorDealIds],
  );

  // KPI helpers
  const tabKpi = useMemo(() => {
    const calc = (trades: typeof allTrades) => {
      const vol = trades.reduce((s, tr) => s + tr.amountUSDT * tr.sellPriceQAR, 0);
      const net = trades.reduce((s, tr) => {
        const c = derived.tradeCalc.get(tr.id);
        return s + (c?.ok ? c.netQAR : 0);
      }, 0);
      const qty = trades.reduce((s, tr) => s + tr.amountUSDT, 0);
      return { vol, net, qty, count: trades.length };
    };
    return {
      myOrders: calc(selfTrades),
      incoming: calc(incomingTrades),
      outgoing: calc(outgoingTrades),
    };
  }, [selfTrades, incomingTrades, outgoingTrades, derived]);

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
    if (merchantOrderEnabled && !linkedRelId) { setSaleMessage(`${t('fixFields')} ${t('relationship')}`); return; }
    if (merchantOrderEnabled && !linkedDealId) { setSaleMessage(`${t('fixFields')} ${t('deal')}`); return; }

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
    setMerchantOrderEnabled(false);
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
    const tr = state.trades.find(x => x.id === id);
    if (!tr) return;
    const cn = state.customers.find(c => c.id === tr.customerId)?.name || '';
    setEditingTradeId(id);
    setEditDate(toInputFromTs(tr.ts));
    setEditQty(String(tr.amountUSDT));
    setEditSell(String(tr.sellPriceQAR));
    setEditBuyer(cn);
    setEditUsesStock(tr.usesStock);
    setEditFee(String(tr.feeQAR ?? 0));
    setEditNote(tr.note ?? '');
    setEditCustomerId(tr.customerId ?? '');
  };

  const saveTradeEdit = () => {
    if (!editingTradeId) return;
    const ts = new Date(editDate).getTime();
    const qty = Number(editQty);
    const sell = Number(editSell);
    const fee = Number(editFee) || 0;
    if (!Number.isFinite(ts) || !(qty > 0) || !(sell > 0)) return;
    const nextTrades = state.trades.map(tr => {
      if (tr.id !== editingTradeId) return tr;
      return {
        ...tr, ts, amountUSDT: qty, sellPriceQAR: sell, feeQAR: fee, note: editNote,
        customerId: editCustomerId, usesStock: editUsesStock,
        revisions: [{ at: Date.now(), before: { ts: tr.ts, amountUSDT: tr.amountUSDT, sellPriceQAR: tr.sellPriceQAR, customerId: tr.customerId, usesStock: tr.usesStock, feeQAR: tr.feeQAR, note: tr.note } }, ...tr.revisions].slice(0, 20),
      };
    });
    applyState({ ...state, trades: nextTrades });
    setEditingTradeId(null);
  };

  const deleteTrade = () => {
    if (!editingTradeId) return;
    applyState({ ...state, trades: state.trades.filter(t => t.id !== editingTradeId) });
    setEditingTradeId(null);
  };

  const getDealSharePct = (deal: MerchantDeal): number | null => {
    if (deal.deal_type === 'arbitrage') return (deal.metadata?.counterparty_share_pct as number) ?? null;
    if (deal.deal_type === 'partnership') return (deal.metadata?.partner_ratio as number) ?? null;
    if (deal.deal_type === 'capital_placement') return (deal.metadata?.pool_owner_share_pct as number) ?? null;
    return null;
  };

  const openAdjustDeal = (dealId: string) => {
    const deal = allMerchantDeals.find(d => d.id === dealId);
    if (!deal) return;
    const sharePct = getDealSharePct(deal);
    setAdjustShareValue(sharePct != null ? String(sharePct) : '');
    setAdjustingDealId(dealId);
  };

  const saveAdjustDeal = async () => {
    if (!adjustingDealId) return;
    const deal = allMerchantDeals.find(d => d.id === adjustingDealId);
    if (!deal) return;
    const newPct = Number(adjustShareValue);
    if (!(newPct >= 0) || !(newPct <= 100)) return;
    setAdjustSaving(true);
    try {
      const updatedMetadata = { ...deal.metadata };
      if (deal.deal_type === 'arbitrage') {
        updatedMetadata.counterparty_share_pct = newPct;
        updatedMetadata.merchant_share_pct = 100 - newPct;
      } else if (deal.deal_type === 'partnership') {
        updatedMetadata.partner_ratio = newPct;
        updatedMetadata.merchant_ratio = 100 - newPct;
      } else if (deal.deal_type === 'capital_placement') {
        updatedMetadata.pool_owner_share_pct = newPct;
      }
      await api.deals.update(adjustingDealId, { metadata: updatedMetadata });
      await reloadMerchantData();
      toast.success(t('saveChanges'));
      setAdjustingDealId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdjustSaving(false);
    }
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

      {/* ═══════════════════════════ TAB NAVIGATION BAR ═══════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{t('trades')}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('fifoCostBasisMargin')}</div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4, minWidth: 0, flexWrap: 'wrap' }}>
          {([
            { key: 'myOrders' as TabKey, label: t('myOrders'), icon: '👤', count: tabKpi.myOrders.count, accent: 'var(--t1)' },
            { key: 'incoming' as TabKey, label: t('incomingOrders'), icon: '📥', count: tabKpi.incoming.count, accent: 'var(--brand)' },
            { key: 'outgoing' as TabKey, label: t('outgoingOrders'), icon: '📤', count: tabKpi.outgoing.count, accent: 'var(--good)' },
          ]).map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 8,
                  border: active ? `1px solid color-mix(in srgb, ${tab.accent} 55%, transparent)` : '1px solid var(--line)',
                  background: active ? `color-mix(in srgb, ${tab.accent} 13%, var(--panel))` : 'var(--panel)',
                  color: active ? tab.accent : 'var(--muted)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${tab.accent} 12%, transparent), 0 2px 6px rgba(0,0,0,.15)` : 'none',
                  transition: 'all .13s ease',
                }}
              >
                <span style={{ fontSize: 13 }}>{tab.icon}</span>
                <span>{tab.label}</span>
                <span style={{ background: active ? tab.accent : 'var(--muted2)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 9, fontWeight: 900, minWidth: 18, textAlign: 'center', transition: 'all .13s' }}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span className="pill">{rLabel}</span>
          <button className="btn secondary" onClick={exportCsv}>CSV</button>
        </div>
      </div>

      {/* ═══════════════════════════ MY ORDERS TAB ═══════════════════════════ */}
      {activeTab === 'myOrders' && (
        <div className="twoColPage">
          {/* LEFT: Self-orders table */}
          <div>
            {selfTrades.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Orders', value: String(tabKpi.myOrders.count), c: 'var(--t1)' },
                  { label: 'Qty USDT', value: fmtU(tabKpi.myOrders.qty), c: 'var(--text)' },
                  { label: t('totalVolQar'), value: fmtQ(tabKpi.myOrders.vol), c: 'var(--text)' },
                  { label: t('netPnl'), value: (tabKpi.myOrders.net >= 0 ? '+' : '') + fmtQ(tabKpi.myOrders.net), c: tabKpi.myOrders.net >= 0 ? 'var(--good)' : 'var(--bad)' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 13px', minWidth: 88 }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{k.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--lt-font-mono)', color: k.c }}>{k.value}</div>
                  </div>
                ))}
              </div>
            )}

            {selfTrades.length === 0 ? (
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
                      <th>{t('date')}</th><th>{t('buyer')}</th><th>{t('type')}</th>
                      <th className="r">{t('qty')}</th><th className="r">{t('avgBuy')}</th>
                      <th className="r">{t('sell')}</th><th className="r">{t('volume')}</th>
                      <th className="r">{t('net')}</th><th>{t('margin')}</th><th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selfTrades.map(tr => {
                      const c = derived.tradeCalc.get(tr.id);
                      const ok = !!c?.ok;
                      const rev = tr.amountUSDT * tr.sellPriceQAR;
                      const net = ok ? c!.netQAR : NaN;
                      const margin = ok && rev > 0 ? c!.netQAR / rev : NaN;
                      const pct = Number.isFinite(margin) ? Math.min(1, Math.abs(margin) / 0.05) : 0;
                      const cn = state.customers.find(x => x.id === tr.customerId)?.name || '';
                      return (
                        <React.Fragment key={tr.id}>
                          <tr>
                            <td>
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(tr.ts)}</span>
                                {!ok && <span className="pill bad" style={{ fontSize: 9 }}>!</span>}
                              </div>
                            </td>
                            <td>{cn ? <span className="tradeBuyerChip" title={cn} style={{ maxWidth: 130 }}>{cn}</span> : <span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span>}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                                {t('orderTypeSelf')}
                              </span>
                            </td>
                            <td className="mono r">{fmtU(tr.amountUSDT)}</td>
                            <td className="mono r">{ok ? fmtP(c!.avgBuyQAR) : '—'}</td>
                            <td className="mono r">{fmtP(tr.sellPriceQAR)}</td>
                            <td className="mono r">{fmtQ(rev)}</td>
                            <td className="mono r" style={{ color: Number.isFinite(net) ? (net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)', fontWeight: 700 }}>
                              {Number.isFinite(net) ? (net >= 0 ? '+' : '') + fmtQ(net) : '—'}
                            </td>
                            <td>
                              <div className={`prog ${Number.isFinite(margin) && margin < 0 ? 'neg' : ''}`} style={{ maxWidth: 90 }}><span style={{ width: `${(pct * 100).toFixed(0)}%` }} /></div>
                              <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>{Number.isFinite(margin) ? `${(margin * 100).toFixed(2)}% ${t('marginLabel')}` : '—'}</div>
                            </td>
                            <td>
                              <div className="actionsRow">
                                <button className="rowBtn" onClick={() => setDetailsOpen(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}>{detailsOpen[tr.id] ? t('hideDetails') : t('details')}</button>
                                <button className="rowBtn" onClick={() => openEdit(tr.id)}>{t('edit')}</button>
                              </div>
                            </td>
                          </tr>
                          {detailsOpen[tr.id] && <tr><td colSpan={10} style={{ padding: 0 }}>{renderDetail(tr, c)}</td></tr>}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: Standard New Sale Form */}
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
                      <div className="modeToggle">{['A','B','C','D'].map(tier => (<button key={tier} type="button" className={newBuyerTier===tier?'active':''} onClick={() => setNewBuyerTier(tier)}>{tier}</button>))}</div>
                    </div>
                    <div className="formActions"><button className="btn secondary" onClick={() => setAddBuyerOpen(false)}>{t('cancel')}</button><button className="btn" onClick={addBuyerFromModal}>{t('addBuyerTitle')}</button></div>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, cursor: 'pointer', color: 'var(--muted)' }}>
                  <input type="checkbox" checked={useStock} onChange={e => setUseStock(e.target.checked)} style={{ accentColor: 'var(--brand)' }} /> {t('useFifoStock')}
                </label>
                {/* Optional Merchant Order Linking */}
                <div className="previewBox" style={{ marginTop: 6, borderColor: merchantOrderEnabled ? 'var(--brand)' : undefined }}>
                  <div className="pt" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t('merchantOrder')}<span style={{ fontSize: 9, color: 'var(--muted)' }}>{t('optional')}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, cursor: 'pointer', color: 'var(--muted)', marginBottom: merchantOrderEnabled ? 8 : 0 }}>
                    <input type="checkbox" checked={merchantOrderEnabled} onChange={e => { const v = e.target.checked; setMerchantOrderEnabled(v); if (!v) { setLinkedRelId(''); setLinkedDealId(''); setAllocationPreview(null); } }} style={{ accentColor: 'var(--brand)' }} /> {t('addSaleAsMerchantOrder')}
                  </label>
                  {merchantOrderEnabled && (
                    <>
                      <div className="field2" style={{ marginBottom: 4 }}>
                        <div className="lbl">{t('relationship')}</div>
                        <select value={linkedRelId} onChange={e => { setLinkedRelId(e.target.value); setLinkedDealId(''); }} style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}>
                          <option value="">{t('noneSelected')}</option>
                          {relationships.map(r => <option key={r.id} value={r.id}>{r.counterparty?.display_name || r.id} ({r.relationship_type})</option>)}
                        </select>
                      </div>
                      {linkedRelId && (
                        <>
                          <div className="field2" style={{ marginBottom: 4 }}>
                            <div className="lbl">{t('deal')}</div>
                            <select value={linkedDealId} onChange={e => setLinkedDealId(e.target.value)} style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}>
                              <option value="">{t('selectDeal')}</option>
                              {relDeals.map(d => { const cfg = DEAL_TYPE_CONFIGS[d.deal_type]; return <option key={d.id} value={d.id}>{cfg?.icon} {d.title} (${d.amount.toLocaleString()} {d.currency})</option>; })}
                            </select>
                            {relDeals.length === 0 && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{t('noLinkedDeals')}</div>}
                          </div>
                          <div className="formActions" style={{ justifyContent: 'flex-start' }}>
                            <button className="btn secondary" type="button" onClick={() => setCreateDealOpen(true)}>{t('createMerchantDealFromOrder')}</button>
                          </div>
                        </>
                      )}
                    </>
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
      )}

      {/* ═══════════════════════════ INCOMING ORDERS TAB ═══════════════════════════ */}
      {activeTab === 'incoming' && (() => {
        const thStyle = (right?: boolean): React.CSSProperties => ({
          padding: '7px 10px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase',
          fontWeight: 800, letterSpacing: '.3px', whiteSpace: 'nowrap', textAlign: right ? 'right' : 'left',
        });
        const tdStyle = (right?: boolean): React.CSSProperties => ({
          padding: '8px 10px', fontSize: 11, textAlign: right ? 'right' : 'left',
          borderTop: '1px solid color-mix(in srgb, var(--line) 55%, transparent)',
        });
        const renderMarginCell = (margin: number) => {
          const pct = Number.isFinite(margin) ? Math.min(1, Math.abs(margin) / 0.05) : 0;
          return Number.isFinite(margin) ? (
            <td style={tdStyle()}>
              <div className={`prog ${margin < 0 ? 'neg' : ''}`} style={{ maxWidth: 70 }}><span style={{ width: `${(pct * 100).toFixed(0)}%` }} /></div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{(margin * 100).toFixed(2)}%</div>
            </td>
          ) : <td style={tdStyle()}><span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span></td>;
        };

        const selectedInDeal = formDealId ? allMerchantDeals.find(d => d.id === formDealId) : null;
        const selectedInRel = formRelId ? relationships.find(r => r.id === formRelId) : null;

        return (
          <div className="twoColPage">
            {/* LEFT: Incoming orders grouped table */}
            <div>
              {/* KPI bar */}
              {incomingTrades.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Deals', value: String(partnerMerchantDeals.length), c: 'var(--brand)' },
                    { label: 'Orders', value: String(tabKpi.incoming.count), c: 'var(--brand)' },
                    { label: 'Qty USDT', value: fmtU(tabKpi.incoming.qty), c: 'var(--text)' },
                    { label: t('totalVolQar'), value: fmtQ(tabKpi.incoming.vol), c: 'var(--text)' },
                    { label: t('netPnl'), value: (tabKpi.incoming.net >= 0 ? '+' : '') + fmtQ(tabKpi.incoming.net), c: tabKpi.incoming.net >= 0 ? 'var(--good)' : 'var(--bad)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: 'color-mix(in srgb, var(--brand) 6%, var(--card-bg))', border: '1px solid color-mix(in srgb, var(--brand) 18%, var(--line))', borderRadius: 8, padding: '7px 13px', minWidth: 80 }}>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{k.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--lt-font-mono)', color: k.c }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {partnerMerchantDeals.length === 0 ? (
                <div className="empty">
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
                  <div className="empty-t">{t('noIncomingDealsYet')}</div>
                  <div className="empty-s">{t('noIncomingDealsHint')}</div>
                  <button className="btn secondary" style={{ marginTop: 10, fontSize: 11 }} onClick={() => navigate('/network')}>{t('goToNetwork')}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {partnerMerchantDeals.map(deal => {
                    const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                    const rel = relationships.find(r => r.id === deal.relationship_id);
                    const dealTrades = incomingTrades.filter(tr => tr.linkedDealId === deal.id);
                    const sharePct = getDealSharePct(deal);
                    const workspacePath = rel ? `/network/relationships/${rel.id}` : '/network';
                    const counterpartyName = rel?.counterparty?.display_name || '—';
                    const dealVol = dealTrades.reduce((s, tr) => s + tr.amountUSDT * tr.sellPriceQAR, 0);
                    const dealNet = dealTrades.reduce((s, tr) => { const c = derived.tradeCalc.get(tr.id); return s + (c?.ok ? c.netQAR : 0); }, 0);
                    return (
                      <div key={deal.id} style={{ border: '1px solid color-mix(in srgb, var(--brand) 22%, var(--line))', borderRadius: 10, overflow: 'hidden' }}>
                        {/* Deal header */}
                        <div style={{ padding: '8px 12px', background: 'color-mix(in srgb, var(--brand) 8%, var(--card-bg))', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15 }}>{cfg?.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>{deal.title}</div>
                            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{counterpartyName} · {deal.amount.toLocaleString()} {deal.currency} {sharePct != null ? `· ${sharePct}% ${t('partnerShare')}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {dealTrades.length > 0 && <span className="pill" style={{ fontSize: 9, color: 'var(--brand)' }}>{dealTrades.length} {t('ordersLinked')}</span>}
                            {dealTrades.length > 0 && dealVol > 0 && <span className="pill" style={{ fontSize: 9 }}>{fmtQ(dealVol)}</span>}
                            {dealTrades.length > 0 && <span className="pill" style={{ fontSize: 9, color: dealNet >= 0 ? 'var(--good)' : 'var(--bad)' }}>{dealNet >= 0 ? '+' : ''}{fmtQ(dealNet)}</span>}
                            {cfg?.hasCounterpartyShare && <button className="rowBtn" onClick={() => openAdjustDeal(deal.id)}>{t('adjustShare')}</button>}
                            <button className="rowBtn" onClick={() => navigate(workspacePath)}>{t('viewInWorkspace')}</button>
                          </div>
                        </div>
                        {/* Trades table for this deal */}
                        {dealTrades.length === 0 ? (
                          <div style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 11, fontStyle: 'italic' }}>
                            {t('noLinkedOrders')} · {t('amount')}: {deal.amount.toLocaleString()} {deal.currency}
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: 'color-mix(in srgb, var(--bg) 80%, black 20%)' }}>
                                  <th style={thStyle()}>{t('date')}</th>
                                  <th style={thStyle()}>{t('buyer')}</th>
                                  <th style={thStyle(true)}>{t('qty')}</th>
                                  <th style={thStyle(true)}>{t('sell')}</th>
                                  <th style={thStyle(true)}>{t('volume')}</th>
                                  <th style={thStyle(true)}>{t('net')}</th>
                                  <th style={thStyle()}>{t('margin')}</th>
                                  <th style={thStyle()}>{t('actions')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dealTrades.map(tr => {
                                  const c = derived.tradeCalc.get(tr.id);
                                  const ok = !!c?.ok;
                                  const rev = tr.amountUSDT * tr.sellPriceQAR;
                                  const net = ok ? c!.netQAR : NaN;
                                  const margin = ok && rev > 0 ? c!.netQAR / rev : NaN;
                                  const cn = state.customers.find(x => x.id === tr.customerId)?.name || counterpartyName;
                                  return (
                                    <React.Fragment key={tr.id}>
                                      <tr style={{ background: 'color-mix(in srgb, var(--brand) 3%, transparent)' }}>
                                        <td style={tdStyle()}>
                                          <span className="mono">{fmtDate(tr.ts)}</span>
                                        </td>
                                        <td style={tdStyle()}>{cn ? <span className="tradeBuyerChip" title={cn} style={{ maxWidth: 120 }}>{cn}</span> : <span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span>}</td>
                                        <td className="mono" style={tdStyle(true)}>{fmtU(tr.amountUSDT)}</td>
                                        <td className="mono" style={tdStyle(true)}>{fmtP(tr.sellPriceQAR)}</td>
                                        <td className="mono" style={tdStyle(true)}>{fmtQ(rev)}</td>
                                        <td className="mono" style={{ ...tdStyle(true), color: Number.isFinite(net) ? (net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)', fontWeight: 700 }}>
                                          {Number.isFinite(net) ? `${net >= 0 ? '+' : ''}${fmtQ(net)}` : '—'}
                                        </td>
                                        {renderMarginCell(margin)}
                                        <td style={tdStyle()}>
                                          <div className="actionsRow">
                                            <button className="rowBtn" onClick={() => setDetailsOpen(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}>{detailsOpen[tr.id] ? t('hideDetails') : t('details')}</button>
                                            <button className="rowBtn" onClick={() => openEdit(tr.id)}>{t('edit')}</button>
                                          </div>
                                        </td>
                                      </tr>
                                      {detailsOpen[tr.id] && <tr><td colSpan={8} style={{ padding: 0 }}>{renderDetail(tr, c)}</td></tr>}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Incoming order form — deal card selector → order form */}
            <div>
              <div className="formPanel salePanel" style={{ borderColor: 'color-mix(in srgb, var(--brand) 30%, var(--line))' }}>
                <div className="hdr" style={{ color: 'var(--brand)', background: 'color-mix(in srgb, var(--brand) 8%, transparent)' }}>
                  📥 {t('logIncomingOrder')}
                </div>
                <div className="inner">
                  {partnerMerchantDeals.length === 0 ? (
                    <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📥</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('noIncomingDealsYet')}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>{t('noIncomingDealsHint')}</div>
                      <button className="btn secondary" style={{ fontSize: 11 }} onClick={() => navigate('/network')}>{t('goToNetwork')}</button>
                    </div>
                  ) : !formDealId ? (
                    /* PHASE 1: Deal card selector */
                    <>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Select a deal to log an order:</div>
                      {partnerMerchantDeals.map(deal => {
                        const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                        const rel = relationships.find(r => r.id === deal.relationship_id);
                        const sharePct = getDealSharePct(deal);
                        const tradeCount = incomingTrades.filter(t => t.linkedDealId === deal.id).length;
                        const counterpartyName = rel?.counterparty?.display_name || '—';
                        return (
                          <button
                            key={deal.id}
                            type="button"
                            onClick={() => { setFormDealId(deal.id); setFormRelId(deal.relationship_id); setLinkedDealId(deal.id); setLinkedRelId(deal.relationship_id); }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                              border: '1px solid color-mix(in srgb, var(--brand) 22%, var(--line))',
                              background: 'color-mix(in srgb, var(--brand) 5%, var(--card-bg))',
                              cursor: 'pointer', transition: 'all .12s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--brand) 10%, var(--card-bg))'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--brand) 22%, var(--line))'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--brand) 5%, var(--card-bg))'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 14 }}>{cfg?.icon}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', flex: 1 }}>{deal.title}</span>
                              {sharePct != null && <span className="pill" style={{ fontSize: 8, color: 'var(--brand)' }}>{sharePct}%</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap' }}>
                              <span>🤝 {counterpartyName}</span>
                              <span>{deal.amount.toLocaleString()} {deal.currency}</span>
                              {tradeCount > 0 && <span style={{ color: 'var(--good)' }}>✓ {tradeCount} orders</span>}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    /* PHASE 2: Order form for selected incoming deal */
                    <>
                      <button
                        type="button"
                        onClick={() => { setFormDealId(''); setFormRelId(''); setLinkedDealId(''); setLinkedRelId(''); setAllocationPreview(null); setSaleAmount(''); setSaleMessage(''); }}
                        style={{ fontSize: 10, color: 'var(--brand)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', marginBottom: 6, fontWeight: 600 }}
                      >
                        {t('backToDeals')}
                      </button>

                      {/* Selected deal context box */}
                      {selectedInDeal && (() => {
                        const cfg = DEAL_TYPE_CONFIGS[selectedInDeal.deal_type];
                        const sharePct = getDealSharePct(selectedInDeal);
                        return (
                          <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 22%, transparent)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span>{cfg?.icon}</span>
                              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--brand)' }}>{selectedInDeal.title}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: 'var(--muted)' }}>
                              <span>{t('dealPartner')}: <strong style={{ color: 'var(--text)' }}>{selectedInRel?.counterparty?.display_name || '—'}</strong></span>
                              <span>{t('amount')}: <strong style={{ color: 'var(--t1)' }}>{selectedInDeal.amount.toLocaleString()} {selectedInDeal.currency}</strong></span>
                              {sharePct != null && <span>Share: <strong style={{ color: 'var(--brand)' }}>{sharePct}%</strong></span>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Order inputs */}
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{t('orderDetails')}</div>
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
                            <button className="sideAction" type="button" onClick={() => setBuyerMenuOpen(v => !v)}>⌄</button>
                            <button className="sideAction" type="button" onClick={() => { setNewBuyerName(buyerName); setAddBuyerOpen(v => !v); }}>+</button>
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
                            <div className="modeToggle">{['A','B','C','D'].map(tier => <button key={tier} type="button" className={newBuyerTier===tier?'active':''} onClick={() => setNewBuyerTier(tier)}>{tier}</button>)}</div>
                          </div>
                          <div className="formActions"><button className="btn secondary" onClick={() => setAddBuyerOpen(false)}>{t('cancel')}</button><button className="btn" onClick={addBuyerFromModal}>{t('addBuyerTitle')}</button></div>
                        </div>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, cursor: 'pointer', color: 'var(--muted)' }}>
                        <input type="checkbox" checked={useStock} onChange={e => setUseStock(e.target.checked)} style={{ accentColor: 'var(--brand)' }} /> {t('useFifoStock')}
                      </label>
                      {/* Allocation preview */}
                      {allocationPreview && (
                        <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', borderRadius: 6, padding: '8px 10px', marginTop: 4, border: '1px solid color-mix(in srgb, var(--brand) 22%, transparent)' }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 4 }}>{t('allocationPreview')}</div>
                          <div className="prev-row"><span className="muted">{allocationPreview.counterpartyName} (Partner):</span><strong style={{ color: 'var(--bad)', fontSize: 10 }}>{fmtQ(allocationPreview.counterpartyAmount)}</strong></div>
                          <div className="prev-row"><span className="muted">{t('yourShare')}:</span><strong style={{ color: 'var(--good)', fontSize: 10 }}>{fmtQ(allocationPreview.merchantAmount)}</strong></div>
                          <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{t('autoApprovalNote')}</div>
                        </div>
                      )}
                      {/* Live preview */}
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
                      <div className="formActions">
                        <button className="btn" style={{ background: 'var(--brand)' }} onClick={addTrade}>📥 {t('logIncomingOrder')}</button>
                      </div>
                      <div className={`msg ${saleMessage.includes(t('fixFields')) ? 'bad' : ''}`}>{saleMessage}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════ OUTGOING ORDERS TAB ═══════════════════════════ */}
      {activeTab === 'outgoing' && (() => {
        const thStyle = (right?: boolean): React.CSSProperties => ({
          padding: '7px 10px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase',
          fontWeight: 800, letterSpacing: '.3px', whiteSpace: 'nowrap', textAlign: right ? 'right' : 'left',
        });
        const tdStyle = (right?: boolean): React.CSSProperties => ({
          padding: '8px 10px', fontSize: 11, textAlign: right ? 'right' : 'left',
          borderTop: '1px solid color-mix(in srgb, var(--line) 55%, transparent)',
        });
        const renderMarginCell = (margin: number) => {
          const pct = Number.isFinite(margin) ? Math.min(1, Math.abs(margin) / 0.05) : 0;
          return Number.isFinite(margin) ? (
            <td style={tdStyle()}>
              <div className={`prog ${margin < 0 ? 'neg' : ''}`} style={{ maxWidth: 70 }}><span style={{ width: `${(pct * 100).toFixed(0)}%` }} /></div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{(margin * 100).toFixed(2)}%</div>
            </td>
          ) : <td style={tdStyle()}><span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span></td>;
        };

        const selectedOutDeal = formDealId ? allMerchantDeals.find(d => d.id === formDealId) : null;
        const selectedOutRel = formRelId ? relationships.find(r => r.id === formRelId) : null;

        return (
          <div className="twoColPage">
            {/* LEFT: Outgoing orders grouped table */}
            <div>
              {/* KPI bar */}
              {outgoingTrades.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Deals', value: String(creatorMerchantDeals.length), c: 'var(--good)' },
                    { label: 'Orders', value: String(tabKpi.outgoing.count), c: 'var(--good)' },
                    { label: 'Qty USDT', value: fmtU(tabKpi.outgoing.qty), c: 'var(--text)' },
                    { label: t('totalVolQar'), value: fmtQ(tabKpi.outgoing.vol), c: 'var(--text)' },
                    { label: t('netPnl'), value: (tabKpi.outgoing.net >= 0 ? '+' : '') + fmtQ(tabKpi.outgoing.net), c: tabKpi.outgoing.net >= 0 ? 'var(--good)' : 'var(--bad)' },
                  ].map(k => (
                    <div key={k.label} style={{ background: 'color-mix(in srgb, var(--good) 6%, var(--card-bg))', border: '1px solid color-mix(in srgb, var(--good) 18%, var(--line))', borderRadius: 8, padding: '7px 13px', minWidth: 80 }}>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>{k.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--lt-font-mono)', color: k.c }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {creatorMerchantDeals.length === 0 ? (
                <div className="empty">
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
                  <div className="empty-t">{t('noOutgoingDealsYet')}</div>
                  <div className="empty-s">{t('noOutgoingDealsHint')}</div>
                  <button className="btn secondary" style={{ marginTop: 10, fontSize: 11 }} onClick={() => navigate('/network')}>{t('goToNetwork')}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {creatorMerchantDeals.map(deal => {
                    const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                    const rel = relationships.find(r => r.id === deal.relationship_id);
                    const dealTrades = outgoingTrades.filter(tr => tr.linkedDealId === deal.id);
                    const sharePct = getDealSharePct(deal);
                    const workspacePath = rel ? `/network/relationships/${rel.id}` : '/network';
                    const counterpartyName = rel?.counterparty?.display_name || '—';
                    const dealVol = dealTrades.reduce((s, tr) => s + tr.amountUSDT * tr.sellPriceQAR, 0);
                    const dealNet = dealTrades.reduce((s, tr) => { const c = derived.tradeCalc.get(tr.id); return s + (c?.ok ? c.netQAR : 0); }, 0);
                    return (
                      <div key={deal.id} style={{ border: '1px solid color-mix(in srgb, var(--good) 22%, var(--line))', borderRadius: 10, overflow: 'hidden' }}>
                        {/* Deal header */}
                        <div style={{ padding: '8px 12px', background: 'color-mix(in srgb, var(--good) 8%, var(--card-bg))', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15 }}>{cfg?.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--good)' }}>{deal.title}</div>
                            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{counterpartyName} · {deal.amount.toLocaleString()} {deal.currency}{sharePct != null ? ` · ${sharePct}% ${t('partnerShare')}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {dealTrades.length > 0 && <span className="pill" style={{ fontSize: 9, color: 'var(--good)' }}>{dealTrades.length} {t('ordersLinked')}</span>}
                            {dealVol > 0 && <span className="pill" style={{ fontSize: 9 }}>{fmtQ(dealVol)}</span>}
                            {dealTrades.length > 0 && <span className="pill" style={{ fontSize: 9, color: dealNet >= 0 ? 'var(--good)' : 'var(--bad)' }}>{dealNet >= 0 ? '+' : ''}{fmtQ(dealNet)}</span>}
                            {cfg?.hasCounterpartyShare && <button className="rowBtn" onClick={() => openAdjustDeal(deal.id)}>{t('adjustShare')}</button>}
                            <button className="rowBtn" onClick={() => navigate(workspacePath)}>{t('viewInWorkspace')}</button>
                          </div>
                        </div>
                        {/* Trades table */}
                        {dealTrades.length === 0 ? (
                          <div style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 11, fontStyle: 'italic' }}>
                            {t('noLinkedOrders')} · {t('amount')}: {deal.amount.toLocaleString()} {deal.currency}
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: 'color-mix(in srgb, var(--bg) 80%, black 20%)' }}>
                                  <th style={thStyle()}>{t('date')}</th>
                                  <th style={thStyle()}>{t('buyer')}</th>
                                  <th style={thStyle(true)}>{t('qty')}</th>
                                  <th style={thStyle(true)}>{t('avgBuy')}</th>
                                  <th style={thStyle(true)}>{t('sell')}</th>
                                  <th style={thStyle(true)}>{t('volume')}</th>
                                  <th style={thStyle(true)}>{t('net')}</th>
                                  <th style={thStyle()}>{t('margin')}</th>
                                  <th style={thStyle()}>{t('actions')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dealTrades.map(tr => {
                                  const c = derived.tradeCalc.get(tr.id);
                                  const ok = !!c?.ok;
                                  const rev = tr.amountUSDT * tr.sellPriceQAR;
                                  const net = ok ? c!.netQAR : NaN;
                                  const margin = ok && rev > 0 ? c!.netQAR / rev : NaN;
                                  const cn = state.customers.find(x => x.id === tr.customerId)?.name || counterpartyName;
                                  return (
                                    <React.Fragment key={tr.id}>
                                      <tr style={{ background: 'color-mix(in srgb, var(--good) 3%, transparent)' }}>
                                        <td style={tdStyle()}><span className="mono">{fmtDate(tr.ts)}</span></td>
                                        <td style={tdStyle()}>{cn ? <span className="tradeBuyerChip" title={cn} style={{ maxWidth: 120 }}>{cn}</span> : <span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span>}</td>
                                        <td className="mono" style={tdStyle(true)}>{fmtU(tr.amountUSDT)}</td>
                                        <td className="mono" style={tdStyle(true)}>{ok ? fmtP(c!.avgBuyQAR) : '—'}</td>
                                        <td className="mono" style={tdStyle(true)}>{fmtP(tr.sellPriceQAR)}</td>
                                        <td className="mono" style={tdStyle(true)}>{fmtQ(rev)}</td>
                                        <td className="mono" style={{ ...tdStyle(true), color: Number.isFinite(net) ? (net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)', fontWeight: 700 }}>
                                          {Number.isFinite(net) ? `${net >= 0 ? '+' : ''}${fmtQ(net)}` : '—'}
                                        </td>
                                        {renderMarginCell(margin)}
                                        <td style={tdStyle()}>
                                          <div className="actionsRow">
                                            <button className="rowBtn" onClick={() => setDetailsOpen(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}>{detailsOpen[tr.id] ? t('hideDetails') : t('details')}</button>
                                            <button className="rowBtn" onClick={() => openEdit(tr.id)}>{t('edit')}</button>
                                          </div>
                                        </td>
                                      </tr>
                                      {detailsOpen[tr.id] && <tr><td colSpan={9} style={{ padding: 0 }}>{renderDetail(tr, c)}</td></tr>}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Outgoing order form — deal card selector → order form */}
            <div>
              <div className="formPanel salePanel" style={{ borderColor: 'color-mix(in srgb, var(--good) 30%, var(--line))' }}>
                <div className="hdr" style={{ color: 'var(--good)', background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                  📤 {t('logOutgoingOrder')}
                </div>
                <div className="inner">
                  {!formDealId ? (
                    /* PHASE 1: Deal card selector + create deal */
                    <>
                      {creatorMerchantDeals.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Select a deal to log an order:</div>
                          {creatorMerchantDeals.map(deal => {
                            const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                            const rel = relationships.find(r => r.id === deal.relationship_id);
                            const sharePct = getDealSharePct(deal);
                            const tradeCount = outgoingTrades.filter(t => t.linkedDealId === deal.id).length;
                            const counterpartyName = rel?.counterparty?.display_name || '—';
                            return (
                              <button
                                key={deal.id}
                                type="button"
                                onClick={() => { setFormDealId(deal.id); setFormRelId(deal.relationship_id); setLinkedDealId(deal.id); setLinkedRelId(deal.relationship_id); }}
                                style={{
                                  width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                                  border: '1px solid color-mix(in srgb, var(--good) 22%, var(--line))',
                                  background: 'color-mix(in srgb, var(--good) 5%, var(--card-bg))',
                                  cursor: 'pointer', transition: 'all .12s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--good)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--good) 10%, var(--card-bg))'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--good) 22%, var(--line))'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--good) 5%, var(--card-bg))'; }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 14 }}>{cfg?.icon}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--good)', flex: 1 }}>{deal.title}</span>
                                  {sharePct != null && <span className="pill" style={{ fontSize: 8, color: 'var(--good)' }}>{sharePct}%</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap' }}>
                                  <span>🤝 {counterpartyName}</span>
                                  <span>{deal.amount.toLocaleString()} {deal.currency}</span>
                                  {tradeCount > 0 && <span style={{ color: 'var(--good)' }}>✓ {tradeCount} orders</span>}
                                </div>
                              </button>
                            );
                          })}
                          <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0', fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', paddingTop: 8 }}>{t('orSelectRelForDeal')}</div>
                        </>
                      )}
                      {creatorMerchantDeals.length === 0 && (
                        <div style={{ padding: '12px 4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>📤</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('noOutgoingDealsYet')}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>{t('noOutgoingDealsHint')}</div>
                        </div>
                      )}
                      {/* Create new deal section */}
                      {relationships.length > 0 ? (
                        <>
                          <div className="field2" style={{ marginBottom: 4 }}>
                            <div className="lbl">{t('relationship')}</div>
                            <select value={linkedRelId} onChange={e => { setLinkedRelId(e.target.value); setLinkedDealId(''); }} style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}>
                              <option value="">{t('noneSelected')}</option>
                              {relationships.map(r => <option key={r.id} value={r.id}>{r.counterparty?.display_name || r.id} ({r.relationship_type})</option>)}
                            </select>
                          </div>
                          {linkedRelId && (
                            <button
                              className="btn secondary"
                              type="button"
                              style={{ width: '100%', justifyContent: 'center', color: 'var(--good)', borderColor: 'color-mix(in srgb, var(--good) 35%, var(--line))' }}
                              onClick={() => setCreateDealOpen(true)}
                            >
                              {t('createNewDeal')}
                            </button>
                          )}
                        </>
                      ) : (
                        <button className="btn secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={() => navigate('/network')}>{t('goToNetwork')}</button>
                      )}
                    </>
                  ) : (
                    /* PHASE 2: Order form for selected outgoing deal */
                    <>
                      <button
                        type="button"
                        onClick={() => { setFormDealId(''); setFormRelId(''); setLinkedDealId(''); setLinkedRelId(''); setAllocationPreview(null); setSaleAmount(''); setSaleMessage(''); }}
                        style={{ fontSize: 10, color: 'var(--good)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', marginBottom: 6, fontWeight: 600 }}
                      >
                        {t('backToDeals')}
                      </button>

                      {/* Selected deal context box */}
                      {selectedOutDeal && (() => {
                        const cfg = DEAL_TYPE_CONFIGS[selectedOutDeal.deal_type];
                        const sharePct = getDealSharePct(selectedOutDeal);
                        return (
                          <div style={{ background: 'color-mix(in srgb, var(--good) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--good) 22%, transparent)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span>{cfg?.icon}</span>
                              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--good)' }}>{selectedOutDeal.title}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: 'var(--muted)' }}>
                              <span>{t('dealPartner')}: <strong style={{ color: 'var(--text)' }}>{selectedOutRel?.counterparty?.display_name || '—'}</strong></span>
                              <span>{t('amount')}: <strong style={{ color: 'var(--t1)' }}>{selectedOutDeal.amount.toLocaleString()} {selectedOutDeal.currency}</strong></span>
                              {sharePct != null && <span>Share: <strong style={{ color: 'var(--good)' }}>{sharePct}%</strong></span>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Order inputs */}
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{t('orderDetails')}</div>
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
                            <button className="sideAction" type="button" onClick={() => setBuyerMenuOpen(v => !v)}>⌄</button>
                            <button className="sideAction" type="button" onClick={() => { setNewBuyerName(buyerName); setAddBuyerOpen(v => !v); }}>+</button>
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
                            <div className="modeToggle">{['A','B','C','D'].map(tier => <button key={tier} type="button" className={newBuyerTier===tier?'active':''} onClick={() => setNewBuyerTier(tier)}>{tier}</button>)}</div>
                          </div>
                          <div className="formActions"><button className="btn secondary" onClick={() => setAddBuyerOpen(false)}>{t('cancel')}</button><button className="btn" onClick={addBuyerFromModal}>{t('addBuyerTitle')}</button></div>
                        </div>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, cursor: 'pointer', color: 'var(--muted)' }}>
                        <input type="checkbox" checked={useStock} onChange={e => setUseStock(e.target.checked)} style={{ accentColor: 'var(--good)' }} /> {t('useFifoStock')}
                      </label>
                      {/* Allocation preview */}
                      {allocationPreview && (
                        <div style={{ background: 'color-mix(in srgb, var(--good) 8%, transparent)', borderRadius: 6, padding: '8px 10px', marginTop: 4, border: '1px solid color-mix(in srgb, var(--good) 22%, transparent)' }}>
                          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--good)', marginBottom: 4 }}>{t('allocationPreview')}</div>
                          <div className="prev-row"><span className="muted">{allocationPreview.counterpartyName} (Partner):</span><strong style={{ color: 'var(--bad)', fontSize: 10 }}>{fmtQ(allocationPreview.counterpartyAmount)}</strong></div>
                          <div className="prev-row"><span className="muted">{t('yourShare')}:</span><strong style={{ color: 'var(--good)', fontSize: 10 }}>{fmtQ(allocationPreview.merchantAmount)}</strong></div>
                          <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{t('autoApprovalNote')}</div>
                        </div>
                      )}
                      {/* Live preview */}
                      <div className="previewBox">
                        <div className="pt">{t('livePreview')}</div>
                        {!salePreview ? <div className="muted" style={{ fontSize: 11 }}>{t('enterDetails')}</div> : (
                          <>
                            {Number.isFinite(salePreview.avgBuy) && <div className="prev-row"><span className="muted">{t('avgBuy')}</span><strong style={{ color: 'var(--bad)' }}>{fmtP(salePreview.avgBuy)} QAR</strong></div>}
                            <div className="prev-row"><span className="muted">{t('qty')}</span><strong>{fmtU(salePreview.qty)} USDT</strong></div>
                            <div className="prev-row"><span className="muted">{t('revenue')}</span><strong>{fmtQ(salePreview.revenue)}</strong></div>
                            <div className="prev-row"><span className="muted">{t('costFifo')}</span><strong>{Number.isFinite(salePreview.cost) ? fmtQ(salePreview.cost) : '—'}</strong></div>
                            <div className="prev-row" style={{ borderTop: '1px solid color-mix(in srgb,var(--good) 20%,transparent)', paddingTop: 5 }}>
                              <span className="muted">{t('net')}</span>
                              <strong style={{ color: Number.isFinite(salePreview.net) ? (salePreview.net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)' }}>
                                {Number.isFinite(salePreview.net) ? `${salePreview.net >= 0 ? '+' : ''}${fmtQ(salePreview.net)}` : '—'}
                              </strong>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="formActions">
                        <button className="btn" style={{ background: 'var(--good)', color: '#000' }} onClick={addTrade}>📤 {t('logOutgoingOrder')}</button>
                      </div>
                      <div className={`msg ${saleMessage.includes(t('fixFields')) ? 'bad' : ''}`}>{saleMessage}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════ EDIT TRADE DIALOG ═══════════════════════════ */}
      {(() => {
        const editingTrade = editingTradeId ? state.trades.find(x => x.id === editingTradeId) : null;
        const editCalc = editingTradeId ? derived.tradeCalc.get(editingTradeId) : null;
        const currentVolume = editingTrade ? editingTrade.amountUSDT * editingTrade.sellPriceQAR : 0;
        const currentNet = editCalc?.ok ? editCalc.netQAR : null;
        return (
          <Dialog open={!!editingTradeId} onOpenChange={open => !open && setEditingTradeId(null)}>
            <DialogContent className="tracker-root" style={{ maxWidth: 500, background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--good) 25%, var(--line))', borderRadius: 12, padding: 24, gap: 0 }}>
              <DialogHeader style={{ marginBottom: 14 }}>
                <DialogTitle style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('correctTradeTitle')}</DialogTitle>
              </DialogHeader>
              <div style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 28%, transparent)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--warn)', marginBottom: 14, lineHeight: 1.5 }}>
                {t('editInPlaceWarning')}
              </div>
              {editingTrade && (
                <div style={{ background: 'color-mix(in srgb, var(--good) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--good) 25%, transparent)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--good)', marginBottom: 8 }}>{t('currentStatsLabel')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>Volume</span>
                    <strong style={{ fontFamily: 'var(--lt-font-mono)', fontSize: 13, color: 'var(--text)' }}>{fmtQ(currentVolume)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>Net</span>
                    <strong style={{ fontFamily: 'var(--lt-font-mono)', fontSize: 13, color: currentNet != null ? (currentNet >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)' }}>
                      {currentNet != null ? `${currentNet >= 0 ? '+' : ''}${fmtQ(currentNet)}` : '—'}
                    </strong>
                  </div>
                </div>
              )}
              <div className="field2" style={{ marginBottom: 10 }}>
                <div className="lbl">{t('dateTime')}</div>
                <div className="inputBox" style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="field2" style={{ marginBottom: 10 }}>
                <div className="lbl">{t('buyerLabel')}</div>
                <div style={{ position: 'relative' }}>
                  <select value={editCustomerId} onChange={e => setEditCustomerId(e.target.value)} style={{ width: '100%', padding: '8px 32px 8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--input-bg)', color: 'var(--text)', appearance: 'none', cursor: 'pointer', outline: 'none' }}>
                    <option value="">{t('noCustomerSelected')}</option>
                    {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
              <div className="g2tight" style={{ marginBottom: 10 }}>
                <div className="field2">
                  <div className="lbl">{t('qtyUsdt')}</div>
                  <div className="inputBox"><input inputMode="decimal" value={editQty} onChange={e => setEditQty(e.target.value)} /></div>
                </div>
                <div className="field2">
                  <div className="lbl">{t('sellPriceQar')}</div>
                  <div className="inputBox"><input inputMode="decimal" value={editSell} onChange={e => setEditSell(e.target.value)} /></div>
                </div>
              </div>
              <div className="g2tight" style={{ marginBottom: 10 }}>
                <div className="field2">
                  <div className="lbl">{t('feeQarLabel')}</div>
                  <div className="inputBox"><input inputMode="decimal" value={editFee} onChange={e => setEditFee(e.target.value)} /></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6, gap: 10 }}>
                  <input type="checkbox" id="editUsesStockChk" checked={editUsesStock} onChange={e => setEditUsesStock(e.target.checked)} style={{ accentColor: 'var(--good)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0, marginBottom: 2 }} />
                  <label htmlFor="editUsesStockChk" style={{ cursor: 'pointer', lineHeight: 1.3 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{t('useFifoStock')}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{t('deductFromInventory')}</div>
                  </label>
                </div>
              </div>
              <div className="field2" style={{ marginBottom: 16 }}>
                <div className="lbl">{t('note')}</div>
                <div className="inputBox" style={{ padding: 0 }}>
                  <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2} style={{ width: '100%', padding: '7px 10px', resize: 'none', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <DialogFooter style={{ gap: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={deleteTrade} style={{ padding: '7px 12px', borderRadius: 6, background: 'color-mix(in srgb, var(--bad) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--bad) 30%, transparent)', color: 'var(--bad)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>{t('delete')}</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn secondary" style={{ minWidth: 80 }} onClick={() => setEditingTradeId(null)}>{t('cancel')}</button>
                  <button onClick={saveTradeEdit} style={{ minWidth: 130, padding: '9px 18px', borderRadius: 6, background: 'var(--good)', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>{t('saveCorrection')}</button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ═══════════════════════════ ADJUST SHARE DIALOG ═══════════════════════════ */}
      {(() => {
        const adjustDeal = adjustingDealId ? allMerchantDeals.find(d => d.id === adjustingDealId) : null;
        const adjustCfg = adjustDeal ? DEAL_TYPE_CONFIGS[adjustDeal.deal_type] : null;
        const adjustRel = adjustDeal ? relationships.find(r => r.id === adjustDeal.relationship_id) : null;
        const newPct = Number(adjustShareValue);
        const yourPct = 100 - newPct;
        const valid = adjustShareValue !== '' && newPct >= 0 && newPct <= 100;
        return (
          <Dialog open={!!adjustingDealId} onOpenChange={open => !open && setAdjustingDealId(null)}>
            <DialogContent className="tracker-root" style={{ maxWidth: 420, background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--brand) 25%, var(--line))', borderRadius: 12, padding: 24, gap: 0 }}>
              <DialogHeader style={{ marginBottom: 16 }}>
                <DialogTitle style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('adjustShareTitle')}</DialogTitle>
              </DialogHeader>
              {adjustDeal && (
                <>
                  <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span>{adjustCfg?.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{adjustDeal.title}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--muted)' }}>
                      <span>{t('counterpartyLabel')}: <strong style={{ color: 'var(--text)' }}>{adjustRel?.counterparty?.display_name || '—'}</strong></span>
                      <span>{t('amount')}: <strong style={{ color: 'var(--t1)' }}>{adjustDeal.amount.toLocaleString()} {adjustDeal.currency}</strong></span>
                    </div>
                  </div>
                  <div className="field2" style={{ marginBottom: 12 }}>
                    <div className="lbl">{t('sharePctLabel')} — {adjustRel?.counterparty?.display_name || t('counterpartyLabel')}</div>
                    <div className="inputBox">
                      <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={adjustShareValue} onChange={e => setAdjustShareValue(e.target.value)} style={{ width: '100%' }} placeholder="e.g. 30" />
                    </div>
                  </div>
                  {adjustShareValue !== '' && Number.isFinite(newPct) && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                      <div style={{ flex: 1, padding: '10px 12px', borderRadius: 6, background: 'color-mix(in srgb, var(--bad) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--bad) 22%, transparent)' }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>{adjustRel?.counterparty?.display_name || t('counterpartyLabel')}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--bad)', fontFamily: 'var(--lt-font-mono)' }}>{newPct.toFixed(1)}%</div>
                      </div>
                      <div style={{ flex: 1, padding: '10px 12px', borderRadius: 6, background: 'color-mix(in srgb, var(--good) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--good) 22%, transparent)' }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>{t('yourShare')}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--good)', fontFamily: 'var(--lt-font-mono)' }}>{Number.isFinite(yourPct) ? yourPct.toFixed(1) : '—'}%</div>
                      </div>
                    </div>
                  )}
                  <DialogFooter style={{ gap: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <button className="btn secondary" onClick={() => setAdjustingDealId(null)}>{t('cancel')}</button>
                    <button disabled={!valid || adjustSaving} onClick={saveAdjustDeal} style={{ padding: '9px 18px', borderRadius: 6, background: valid ? 'var(--brand)' : 'var(--muted2)', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: valid ? 'pointer' : 'not-allowed', opacity: adjustSaving ? 0.7 : 1 }}>
                      {adjustSaving ? '…' : t('saveAdjustment')}
                    </button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ═══════════════════════════ CREATE DEAL DIALOG ═══════════════════════════ */}
      {linkedRelId && (
        <CreateDealDialog
          open={createDealOpen}
          onOpenChange={setCreateDealOpen}
          relationshipId={linkedRelId}
          counterpartyName={relationships.find(r => r.id === linkedRelId)?.counterparty?.display_name || ''}
          onCreated={async () => {
            await reloadMerchantData();
            const dealsRes = await api.deals.list(linkedRelId);
            setRelDeals(dealsRes.deals);
          }}
          customers={state.customers}
          suppliers={[...new Set(state.batches.map(b => b.source.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
          trackerState={state}
          onStateChange={applyState}
          reserveTrackerTradeOnCreate={false}
          prefillAmount={saleAmount || undefined}
          prefillCurrency={saleMode === 'QAR' ? 'QAR' : 'USDT'}
          prefillCustomerId={buyerId || undefined}
          prefillCustomerName={buyerName || undefined}
        />
      )}
    </div>
  );
}
