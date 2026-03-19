import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDemoState } from '@/lib/tracker-demo-data';
import {
  fmtU, fmtP, fmtQ, fmtDate, getWACOP, inRange, rangeLabel, fmtDur, computeFIFO, uid,
  type TrackerState, type Trade, type Customer, type TradeCalcResult, type LinkedTradeStatus,
} from '@/lib/tracker-helpers';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import * as api from '@/lib/api';
import { DEAL_TYPE_CONFIGS, calculateAllocation } from '@/lib/deal-engine';
import { AGREEMENT_TEMPLATES, getTemplateRatioLabel, getAgreementFamilyLabel, getDealShares, type AgreementTemplate } from '@/lib/deal-templates';
import { isSupportedDealType } from '@/types/domain';
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
  const [editFee, setEditFee] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');

  // ─── Merchant-Linked Trade (Trade-Centric) ────────────────────────
  const [relationships, setRelationships] = useState<MerchantRelationship[]>([]);
  const [allMerchantDeals, setAllMerchantDeals] = useState<MerchantDeal[]>([]);
  const [merchantOrderEnabled, setMerchantOrderEnabled] = useState(false);
  const [linkedRelId, setLinkedRelId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'incoming' | 'outgoing'>('my');

  // Cancellation request dialog
  const [cancelTradeId, setCancelTradeId] = useState<string | null>(null);

  const reloadMerchantData = useCallback(async () => {
    try {
      const [relationshipsRes, dealsRes] = await Promise.all([
        api.relationships.list(),
        api.deals.list(),
      ]);
      setRelationships(relationshipsRes.relationships);
      setAllMerchantDeals(dealsRes.deals);
    } catch {
      // keep tracker usable
    }
  }, []);

  useEffect(() => { reloadMerchantData(); }, [reloadMerchantData]);

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

  // Merchant-linked trades (new trade-centric model)
  const merchantLinkedTrades = useMemo(
    () => allTrades.filter(tr => !!(tr.agreementFamily || tr.linkedDealId || tr.linkedRelId)),
    [allTrades],
  );

  // Outgoing: trades I created that are merchant-linked
  const outgoingTrades = useMemo(
    () => merchantLinkedTrades, // In local state, all trades are created by this user
    [merchantLinkedTrades],
  );

  // Incoming: deals created by partners (from API data)
  const partnerMerchantDeals = useMemo(
    () => allMerchantDeals.filter(d => d.created_by !== userId),
    [allMerchantDeals, userId],
  );
  const creatorMerchantDeals = useMemo(
    () => allMerchantDeals.filter(d => d.created_by === userId),
    [allMerchantDeals, userId],
  );

  const filteredCustomers = useMemo(() => {
    const q = normalizeName(buyerName);
    if (!q) return state.customers;
    return state.customers.filter(c => normalizeName(c.name).includes(q) || c.phone.includes(buyerName));
  }, [buyerName, state.customers]);

  // Sale preview computation
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

  // Allocation preview for selected template
  const allocationPreview = useMemo(() => {
    if (!selectedTemplateId || !salePreview) return null;
    const tmpl = AGREEMENT_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!tmpl) return null;
    const partnerPct = tmpl.defaults.counterparty_share_pct ?? tmpl.defaults.partner_ratio ?? 0;
    const merchantPct = 100 - partnerPct;
    const rel = relationships.find(r => r.id === linkedRelId);

    if (tmpl.family === 'profit_share') {
      // Profit Share: based on net profit
      const base = Number.isFinite(salePreview.net) ? salePreview.net : 0;
      const partnerAmount = (base * partnerPct) / 100;
      const merchantAmount = base - partnerAmount;
      return {
        partnerPct, merchantPct, partnerAmount, merchantAmount,
        base, baseLabel: 'net_profit' as const,
        revenue: salePreview.revenue,
        fifoCost: Number.isFinite(salePreview.cost) ? salePreview.cost : null,
        counterpartyName: rel?.counterparty?.display_name || t('partner'),
      };
    } else {
      // Sales Deal: based on order amount
      const base = salePreview.revenue;
      const partnerAmount = (base * partnerPct) / 100;
      const merchantAmount = base - partnerAmount;
      return {
        partnerPct, merchantPct, partnerAmount, merchantAmount,
        base, baseLabel: 'sale_economics' as const,
        revenue: salePreview.revenue,
        fifoCost: Number.isFinite(salePreview.cost) ? salePreview.cost : null,
        counterpartyName: rel?.counterparty?.display_name || t('partner'),
      };
    }
  }, [selectedTemplateId, salePreview, linkedRelId, relationships, t]);

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

  // ─── ADD TRADE (Trade-Centric) ────────────────────────────────────
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

    // Merchant-linked validation
    if (merchantOrderEnabled && !linkedRelId) { setSaleMessage(`${t('fixFields')} ${t('relationship')}`); return; }
    if (merchantOrderEnabled && !selectedTemplateId) { setSaleMessage(`${t('fixFields')} ${t('agreementTypeRequired')}`); return; }

    let nextCustomers = state.customers;
    let customerId = buyerId;
    if (buyerName.trim()) {
      const ensured = ensureCustomer(buyerName);
      customerId = ensured.id;
      nextCustomers = ensured.customers;
    } else { customerId = ''; }

    // Build trade with agreement fields if merchant-linked
    const tmpl = selectedTemplateId ? AGREEMENT_TEMPLATES.find(t => t.id === selectedTemplateId) : null;
    const trade: Trade = {
      id: uid(), ts, inputMode: saleMode, amountUSDT, sellPriceQAR: sell, feeQAR: 0, note: '', voided: false, usesStock: useStock, revisions: [], customerId,
      linkedRelId: merchantOrderEnabled ? linkedRelId || undefined : undefined,
      agreementFamily: tmpl?.family,
      agreementTemplateId: tmpl?.id,
      partnerPct: tmpl ? (tmpl.defaults.counterparty_share_pct ?? tmpl.defaults.partner_ratio) : undefined,
      merchantPct: tmpl ? (tmpl.defaults.merchant_share_pct ?? tmpl.defaults.merchant_ratio) : undefined,
      approvalStatus: merchantOrderEnabled ? 'pending_approval' : undefined,
    };

    const next: TrackerState = { ...state, customers: nextCustomers, trades: [...state.trades, trade], range: inRange(ts, state.range) ? state.range : 'all' };
    applyState(next);

    if (merchantOrderEnabled && tmpl) {
      // Also create a backend deal record for the counterparty to see
      try {
        const customerName = buyerName.trim() || t('buyer');
        const currency = saleMode === 'QAR' ? 'QAR' : 'USDT';
        const amount = Number(saleAmount) || 0;
        const metadata: Record<string, unknown> = {
          agreement_family: tmpl.family,
          template_id: tmpl.id,
          customer_name: customerName,
          supplier_name: 'System',
          local_trade_id: trade.id,
        };
        if (tmpl.dealType === 'partnership') {
          metadata.partner_ratio = tmpl.defaults.partner_ratio;
          metadata.merchant_ratio = tmpl.defaults.merchant_ratio;
        } else {
          metadata.counterparty_share_pct = tmpl.defaults.counterparty_share_pct;
          metadata.merchant_share_pct = tmpl.defaults.merchant_share_pct;
        }
        metadata.settlement_period = tmpl.defaults.settlement_period;

        const familyLabel = tmpl.family === 'profit_share' ? 'Profit Share' : 'Sales Deal';
        const title = `${familyLabel} · ${customerName} · ${tmpl.ratioDisplay}`;

        await api.deals.create({
          relationship_id: linkedRelId,
          deal_type: tmpl.dealType,
          title,
          amount,
          currency,
          metadata,
        });
        toast.success(t('tradeSentForApproval'));
      } catch (err: any) {
        toast.error(err.message || t('failedCreateDeal'));
      }
    } else {
      setSaleMessage(t('tradeLogged'));
    }

    // Reset form
    setSaleAmount('');
    setMerchantOrderEnabled(false);
    setLinkedRelId('');
    setSelectedTemplateId(null);
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
    // Block editing approved merchant-linked trades
    if (tr.approvalStatus === 'approved') {
      toast.error(t('cannotEditApprovedTrade'));
      return;
    }
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
    const tr = state.trades.find(x => x.id === editingTradeId);
    if (tr?.approvalStatus === 'approved') {
      toast.error(t('cannotDeleteApprovedTrade'));
      return;
    }
    applyState({ ...state, trades: state.trades.filter(t => t.id !== editingTradeId) });
    setEditingTradeId(null);
  };

  // ─── Cancel / Cancellation Request ────────────────────────────────
  const handleCancelTrade = (tradeId: string) => {
    const tr = state.trades.find(x => x.id === tradeId);
    if (!tr) return;

    if (tr.approvalStatus === 'pending_approval') {
      // Creator can cancel directly before approval
      const nextTrades = state.trades.map(t =>
        t.id === tradeId ? { ...t, approvalStatus: 'cancelled' as LinkedTradeStatus } : t
      );
      applyState({ ...state, trades: nextTrades });
      toast.success(t('tradeCancelled'));
    } else if (tr.approvalStatus === 'approved') {
      // After approval, need cancellation request
      setCancelTradeId(tradeId);
    }
  };

  const submitCancellationRequest = () => {
    if (!cancelTradeId) return;
    const nextTrades = state.trades.map(t =>
      t.id === cancelTradeId ? { ...t, approvalStatus: 'cancellation_pending' as LinkedTradeStatus, cancellationRequestedBy: userId || '' } : t
    );
    applyState({ ...state, trades: nextTrades });
    setCancelTradeId(null);
    toast.success(t('cancellationRequestSent'));
  };

  // Approve an incoming partner trade (from the incoming tab)
  const approveIncomingTrade = (tradeId: string) => {
    const nextTrades = state.trades.map(t =>
      t.id === tradeId ? { ...t, approvalStatus: 'approved' as LinkedTradeStatus } : t
    );
    applyState({ ...state, trades: nextTrades });
    toast.success(t('tradeApproved'));
  };

  const rejectIncomingTrade = (tradeId: string) => {
    const nextTrades = state.trades.map(t =>
      t.id === tradeId ? { ...t, approvalStatus: 'rejected' as LinkedTradeStatus } : t
    );
    applyState({ ...state, trades: nextTrades });
    toast.success(t('tradeRejected'));
  };

  const approveCancellation = (tradeId: string) => {
    const nextTrades = state.trades.map(t =>
      t.id === tradeId ? { ...t, approvalStatus: 'cancelled' as LinkedTradeStatus } : t
    );
    applyState({ ...state, trades: nextTrades });
    toast.success(t('tradeCancelled'));
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
        {/* Show partner allocation for merchant-linked trades */}
        {tr.agreementFamily && tr.partnerPct != null && ok && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ padding: '4px 8px', borderRadius: 4, background: 'color-mix(in srgb, var(--good) 10%, transparent)', fontSize: 10 }}>
              📊 {t('merchantNetProfit')}: <strong style={{ color: 'var(--good)' }}>
                {tr.agreementFamily === 'profit_share'
                  ? fmtQ(Number.isFinite(net) ? net * (tr.merchantPct! / 100) : 0)
                  : fmtQ(revenue * (tr.merchantPct! / 100))
                }
              </strong>
            </div>
            <div style={{ padding: '4px 8px', borderRadius: 4, background: 'color-mix(in srgb, var(--bad) 10%, transparent)', fontSize: 10 }}>
              🤝 {t('partnerNetProfit')}: <strong style={{ color: 'var(--bad)' }}>
                {tr.agreementFamily === 'profit_share'
                  ? fmtQ(Number.isFinite(net) ? net * (tr.partnerPct! / 100) : 0)
                  : fmtQ(revenue * (tr.partnerPct! / 100))
                }
              </strong>
            </div>
          </div>
        )}
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{t('fifoSlices')}</div>
        {ok && slicesWithBatch.length ? slicesWithBatch.map(sl => (
          <div key={`${tr.id}-${sl.batchId}-${sl.qty}`} className="muted" style={{ fontSize: 10, margin: '2px 0' }}>
            {sl.source} · <span className="mono">{fmtU(sl.qty)}</span> @ <span className="mono">{fmtP(sl.price)}</span> <span className="cycle-badge">{sl.pct.toFixed(1)}{t('ofBatch')}</span>
          </div>
        )) : <div className="msg">{t('noSlices')}</div>}
      </div>
    );
  };

  // ─── Helper styles for tables ───
  const thStyle = (right?: boolean): React.CSSProperties => ({
    padding: '7px 10px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase',
    fontWeight: 800, letterSpacing: '.3px', whiteSpace: 'nowrap',
    textAlign: right ? 'right' : 'left',
  });
  const tdStyle = (right?: boolean): React.CSSProperties => ({
    padding: '9px 10px', fontSize: 11,
    textAlign: right ? 'right' : 'left',
    borderTop: '1px solid color-mix(in srgb, var(--line) 55%, transparent)',
  });
  const renderMargin = (margin: number) => {
    const pct = Number.isFinite(margin) ? Math.min(1, Math.abs(margin) / 0.05) : 0;
    return Number.isFinite(margin) ? (
      <td style={tdStyle()}>
        <div className={`prog ${margin < 0 ? 'neg' : ''}`} style={{ maxWidth: 70 }}><span style={{ width: `${(pct * 100).toFixed(0)}%` }} /></div>
        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{(margin * 100).toFixed(2)}%</div>
      </td>
    ) : <td style={tdStyle()}><span style={{ color: 'var(--muted)', fontSize: 9 }}>—</span></td>;
  };

  const getApprovalStatusBadge = (status?: LinkedTradeStatus) => {
    if (!status) return null;
    const colors: Record<LinkedTradeStatus, { bg: string; color: string; label: string }> = {
      pending_approval: { bg: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', label: t('pendingApprovalStatus') },
      approved: { bg: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)', label: t('approvedStatus') },
      rejected: { bg: 'color-mix(in srgb, var(--bad) 15%, transparent)', color: 'var(--bad)', label: t('rejectedStatus') },
      cancellation_pending: { bg: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', label: t('cancellationPendingStatus') },
      cancelled: { bg: 'color-mix(in srgb, var(--muted) 15%, transparent)', color: 'var(--muted)', label: t('cancelledStatus') },
    };
    const s = colors[status];
    return <span className="pill" style={{ fontSize: 8, background: s.bg, color: s.color, fontWeight: 700 }}>{s.label}</span>;
  };

  // ─── KPI computations ───
  const myKpi = useMemo(() => {
    const selfTrades = filtered.filter(tr => !tr.agreementFamily && !tr.linkedDealId && !tr.linkedRelId);
    let qty = 0, vol = 0, netVal = 0;
    for (const tr of selfTrades) {
      const c = derived.tradeCalc.get(tr.id);
      qty += tr.amountUSDT;
      vol += tr.amountUSDT * tr.sellPriceQAR;
      if (c?.ok) netVal += c.netQAR;
    }
    return { count: selfTrades.length, qty, vol, net: netVal };
  }, [filtered, derived]);

  const outKpi = useMemo(() => {
    let qty = 0, vol = 0, netVal = 0;
    for (const tr of outgoingTrades) {
      const c = derived.tradeCalc.get(tr.id);
      qty += tr.amountUSDT;
      vol += tr.amountUSDT * tr.sellPriceQAR;
      if (c?.ok) netVal += c.netQAR;
    }
    return { count: outgoingTrades.length, qty, vol, net: netVal };
  }, [outgoingTrades, derived]);

  const inKpi = useMemo(() => {
    let vol = 0, netVal = 0;
    for (const deal of partnerMerchantDeals) {
      vol += deal.amount;
      if (deal.realized_pnl != null) netVal += deal.realized_pnl;
    }
    return { count: partnerMerchantDeals.length, vol, net: netVal };
  }, [partnerMerchantDeals]);

  const renderKpiBar = (kpi: { count: number; qty?: number; vol: number; net: number }) => (
    <div style={{ display: 'flex', gap: 16, padding: '8px 12px', background: 'color-mix(in srgb, var(--brand) 5%, transparent)', borderRadius: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      <div><div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px' }}>{t('count').toUpperCase()}</div><div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{kpi.count}</div></div>
      {kpi.qty != null && <div><div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px' }}>USDT {t('qty').toUpperCase()}</div><div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{fmtU(kpi.qty)}</div></div>}
      <div><div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px' }}>{t('volume').toUpperCase()}</div><div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{fmtQ(kpi.vol)}</div></div>
      <div><div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.5px' }}>{t('net').toUpperCase()} P&L</div><div className="mono" style={{ fontSize: 13, fontWeight: 700, color: kpi.net >= 0 ? 'var(--good)' : 'var(--bad)' }}>{kpi.net >= 0 ? '+' : ''}{fmtQ(kpi.net)}</div></div>
    </div>
  );

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>

      {/* ─── TAB BAR ─── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)', marginBottom: 2 }}>
        {(['my', 'incoming', 'outgoing'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'my') {
                setMerchantOrderEnabled(true);
                setLinkedRelId('');
                setSelectedTemplateId(null);
                setSaleAmount('');
              }
            }}
            style={{
              padding: '9px 18px', fontSize: 11, fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--brand)' : 'var(--muted)',
              borderBottom: activeTab === tab ? '2px solid var(--brand)' : '2px solid transparent',
              background: 'transparent', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer',
              transition: 'all 0.15s', letterSpacing: '.2px',
            }}
          >
            {tab === 'my' ? `👤 ${t('myOrders')}` : tab === 'incoming' ? `📥 ${t('incomingOrders')}` : `📤 ${t('outgoingOrders')}`}
          </button>
        ))}
      </div>

      <div className="twoColPage">

        {/* ═══════════ LEFT PANEL ═══════════ */}
        <div>

          {/* ── MY ORDERS TAB ── */}
          {activeTab === 'my' && (
            <>
              {renderKpiBar({ count: myKpi.count, qty: myKpi.qty, vol: myKpi.vol, net: myKpi.net })}

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
                        const isMerchantLinked = !!(tr.agreementFamily || tr.linkedDealId || tr.linkedRelId);
                        const linkedRel = isMerchantLinked ? relationships.find(r => r.id === tr.linkedRelId) : null;
                        return (
                          <React.Fragment key={tr.id}>
                            <tr style={isMerchantLinked ? { background: 'color-mix(in srgb, var(--brand) 4%, transparent)' } : undefined}>
                            <td>
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
                                <span className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(tr.ts)}</span>
                                {!ok && <span className="pill bad" style={{ fontSize: 9 }}>!</span>}
                                {isMerchantLinked && (
                                  <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--brand) 20%, transparent)', color: 'var(--brand)', fontWeight: 700, letterSpacing: '.3px' }}>
                                     🤝 {t('partnerLinked')}
                                  </span>
                                )}
                                {tr.approvalStatus && getApprovalStatusBadge(tr.approvalStatus)}
                              </div>
                              {isMerchantLinked && (
                                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {linkedRel?.counterparty?.display_name && (
                                    <span className="pill" style={{ fontSize: 8 }}>🤝 {linkedRel.counterparty.display_name}</span>
                                  )}
                                  {tr.agreementFamily && (
                                    <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }}>
                                      {tr.agreementFamily === 'profit_share' ? t('netProfitSplit') : t('saleLinkedSplit')} {tr.partnerPct != null ? `${tr.partnerPct}/${tr.merchantPct}` : ''}
                                    </span>
                                  )}
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
                                {(!tr.approvalStatus || tr.approvalStatus === 'pending_approval') && (
                                  <button className="rowBtn" onClick={() => openEdit(tr.id)}>{t('edit')}</button>
                                )}
                                {tr.approvalStatus === 'pending_approval' && (
                                  <button className="rowBtn" style={{ color: 'var(--bad)' }} onClick={() => handleCancelTrade(tr.id)}>{t('cancel')}</button>
                                )}
                                {tr.approvalStatus === 'approved' && (
                                  <button className="rowBtn" style={{ color: 'var(--warn)' }} onClick={() => handleCancelTrade(tr.id)}>{t('requestCancellation')}</button>
                                )}
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
            </>
          )}

          {/* ── INCOMING ORDERS TAB ── */}
          {activeTab === 'incoming' && (
            <>
              {renderKpiBar({ count: inKpi.count, vol: inKpi.vol, net: inKpi.net })}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>📥 {t('incomingOrders')}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('partnerTradesAwaitingApproval')}</div>
                </div>
                <span className="pill">{partnerMerchantDeals.length} {t('trades')}</span>
              </div>

              {partnerMerchantDeals.length === 0 ? (
                <div className="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4h10M7 8h10M7 12h10M7 16h10M7 20h10" /></svg>
                  <div className="empty-t">{t('noIncomingTrades')}</div>
                  <div className="empty-s">{t('incomingTradesDesc')}</div>
                </div>
              ) : (
                <div className="tableWrap ledgerWrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'color-mix(in srgb, var(--bg) 80%, black 20%)' }}>
                        <th style={thStyle()}>{t('date')}</th>
                        <th style={thStyle()}>{t('partner')}</th>
                        <th style={thStyle()}>{t('agreementType')}</th>
                        <th style={thStyle(true)}>{t('amount')}</th>
                        <th style={thStyle()}>{t('status')}</th>
                        <th style={thStyle()}>{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerMerchantDeals.map(deal => {
                        const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                        const rel = relationships.find(r => r.id === deal.relationship_id);
                        const { partnerPct } = getDealShares(deal);
                        const counterpartyName = rel?.counterparty?.display_name || '—';
                        const isDraft = deal.status === 'draft';
                        const isLegacy = !isSupportedDealType(deal.deal_type);

                        return (
                          <tr key={deal.id} style={{ background: 'color-mix(in srgb, var(--brand) 3%, transparent)' }}>
                            <td style={tdStyle()}>
                              <span className="mono">{deal.created_at ? new Date(deal.created_at).toLocaleDateString() : '—'}</span>
                            </td>
                            <td style={tdStyle()}>
                              <span style={{ fontWeight: 600, fontSize: 10 }}>{counterpartyName}</span>
                            </td>
                            <td style={tdStyle()}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span>{cfg?.icon}</span>
                                <span style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 10 }}>{cfg?.label || deal.deal_type}</span>
                                {partnerPct != null && <span className="pill" style={{ fontSize: 8, color: 'var(--brand)' }}>{partnerPct}%/{100 - partnerPct}%</span>}
                                {isLegacy && <span className="pill" style={{ fontSize: 7, color: 'var(--muted)' }}>{t('legacyAgreement')}</span>}
                              </span>
                            </td>
                            <td className="mono" style={tdStyle(true)}>{deal.amount.toLocaleString()} {deal.currency}</td>
                            <td style={tdStyle()}>
                              {isDraft ? (
                                <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontWeight: 700 }}>{t('pendingApprovalStatus')}</span>
                              ) : (
                                <span className="pill" style={{ fontSize: 8, background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)', fontWeight: 700 }}>{deal.status}</span>
                              )}
                            </td>
                            <td style={tdStyle()}>
                              <div className="actionsRow">
                                {isDraft && (
                                  <>
                                    <button className="rowBtn" style={{ color: 'var(--good)', fontWeight: 700 }} onClick={async () => {
                                      try {
                                        await api.deals.update(deal.id, { status: 'active' });
                                        await reloadMerchantData();
                                        toast.success(t('tradeApproved'));
                                      } catch (err: any) { toast.error(err.message); }
                                    }}>{t('approve')}</button>
                                    <button className="rowBtn" style={{ color: 'var(--bad)' }} onClick={async () => {
                                      try {
                                        await api.deals.update(deal.id, { status: 'cancelled' });
                                        await reloadMerchantData();
                                        toast.success(t('tradeRejected'));
                                      } catch (err: any) { toast.error(err.message); }
                                    }}>{t('reject')}</button>
                                  </>
                                )}
                                {!isDraft && rel && (
                                  <button className="rowBtn" onClick={() => navigate(`/network/relationships/${rel.id}`)}>{t('viewInWorkspace')}</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── OUTGOING ORDERS TAB ── */}
          {activeTab === 'outgoing' && (
            <>
              {renderKpiBar({ count: outKpi.count, qty: outKpi.qty, vol: outKpi.vol, net: outKpi.net })}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>📤 {t('outgoingOrders')}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('yourMerchantLinkedTrades')}</div>
                </div>
                <span className="pill">{outgoingTrades.length} {t('trades')}</span>
              </div>

              {outgoingTrades.length === 0 ? (
                <div className="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4h10M7 8h10M7 12h10M7 16h10M7 20h10" /></svg>
                  <div className="empty-t">{t('noOutgoingTrades')}</div>
                  <div className="empty-s">{t('outgoingTradesDesc')}</div>
                </div>
              ) : (
                <div className="tableWrap ledgerWrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'color-mix(in srgb, var(--bg) 80%, black 20%)' }}>
                        <th style={thStyle()}>{t('date')}</th>
                        <th style={thStyle()}>{t('partner')}</th>
                        <th style={thStyle()}>{t('agreementType')}</th>
                        <th style={thStyle(true)}>{t('qty')}</th>
                        <th style={thStyle(true)}>{t('sell')}</th>
                        <th style={thStyle(true)}>{t('volume')}</th>
                        <th style={thStyle(true)}>{t('net')}</th>
                        <th style={thStyle()}>{t('status')}</th>
                        <th style={thStyle()}>{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outgoingTrades.map(tr => {
                        const c = derived.tradeCalc.get(tr.id);
                        const ok = !!c?.ok;
                        const rev = tr.amountUSDT * tr.sellPriceQAR;
                        const net = ok ? c!.netQAR : NaN;
                        const linkedRel = relationships.find(r => r.id === tr.linkedRelId);
                        const counterpartyName = linkedRel?.counterparty?.display_name || '—';
                        const familyLabel = tr.agreementFamily === 'profit_share' ? t('profitShareFamily') : tr.agreementFamily === 'sales_deal' ? t('salesDealFamily') : '—';
                        return (
                          <tr key={tr.id} style={{ background: 'color-mix(in srgb, var(--good) 3%, transparent)' }}>
                            <td style={tdStyle()}>
                              <span className="mono">{fmtDate(tr.ts)}</span>
                            </td>
                            <td style={tdStyle()}>
                              <span style={{ fontWeight: 600, fontSize: 10 }}>{counterpartyName}</span>
                            </td>
                            <td style={tdStyle()}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span>{tr.agreementFamily === 'profit_share' ? '🤝' : '📊'}</span>
                                <span style={{ color: 'var(--good)', fontWeight: 600, fontSize: 10 }}>{familyLabel}</span>
                                {tr.partnerPct != null && <span className="pill" style={{ fontSize: 8, color: 'var(--good)' }}>{tr.partnerPct}/{tr.merchantPct}</span>}
                              </span>
                            </td>
                            <td className="mono" style={tdStyle(true)}>{fmtU(tr.amountUSDT)}</td>
                            <td className="mono" style={tdStyle(true)}>{fmtP(tr.sellPriceQAR)}</td>
                            <td className="mono" style={tdStyle(true)}>{fmtQ(rev)}</td>
                            <td className="mono" style={{ ...tdStyle(true), color: Number.isFinite(net) ? (net >= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--muted)', fontWeight: 700 }}>
                              {Number.isFinite(net) ? `${net >= 0 ? '+' : ''}${fmtQ(net)}` : '—'}
                            </td>
                            <td style={tdStyle()}>
                              {getApprovalStatusBadge(tr.approvalStatus)}
                            </td>
                            <td style={tdStyle()}>
                              <div className="actionsRow">
                                {tr.approvalStatus === 'pending_approval' && (
                                  <button className="rowBtn" style={{ color: 'var(--bad)' }} onClick={() => handleCancelTrade(tr.id)}>{t('cancel')}</button>
                                )}
                                {tr.approvalStatus === 'approved' && (
                                  <button className="rowBtn" style={{ color: 'var(--warn)' }} onClick={() => handleCancelTrade(tr.id)}>{t('requestCancellation')}</button>
                                )}
                                {linkedRel && (
                                  <button className="rowBtn" onClick={() => navigate(`/network/relationships/${linkedRel.id}`)}>{t('viewInWorkspace')}</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>

        {/* ═══════════ RIGHT PANEL ═══════════ */}
        <div>

          {/* ── MY ORDERS: New Sale Form ── */}
          {activeTab === 'my' && (
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
                  <div className="lbl">{t('buyerName')} <span style={{ color: 'var(--bad)', fontWeight: 700 }}>*</span></div>
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

                {/* ─── MERCHANT-LINKED TRADE (SIMPLE FLOW) ─── */}
                <div className="previewBox" style={{ marginTop: 6, borderColor: merchantOrderEnabled ? 'var(--brand)' : undefined }}>
                  <div className="pt" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    🤝 {t('linkToPartner')}
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{t('optional')}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, cursor: 'pointer', color: 'var(--muted)', marginBottom: merchantOrderEnabled ? 8 : 0 }}>
                    <input
                      type="checkbox"
                      checked={merchantOrderEnabled}
                      onChange={e => {
                        const nextEnabled = e.target.checked;
                        setMerchantOrderEnabled(nextEnabled);
                        if (!nextEnabled) {
                          setLinkedRelId('');
                          setSelectedTemplateId(null);
                        }
                      }}
                      style={{ accentColor: 'var(--brand)' }}
                    /> {t('isThisSaleLinked')}
                  </label>
                  {merchantOrderEnabled && (
                    <>
                      {/* Step 1: Choose partner */}
                      <div className="field2" style={{ marginBottom: 6 }}>
                        <div className="lbl">{t('selectPartner')}</div>
                        <select
                          value={linkedRelId}
                          onChange={e => { setLinkedRelId(e.target.value); setSelectedTemplateId(null); }}
                          style={{ width: '100%', padding: '4px 6px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}
                        >
                          <option value="">{t('noneSelected')}</option>
                          {relationships.map(r => (
                            <option key={r.id} value={r.id}>{r.counterparty?.display_name || r.id}</option>
                          ))}
                        </select>
                      </div>
                      {/* Step 2: Choose agreement type */}
                      {linkedRelId && (
                        <div style={{ marginTop: 4 }}>
                          <div className="lbl" style={{ marginBottom: 4 }}>{t('agreementType')} <span style={{ color: 'var(--bad)', fontWeight: 700 }}>*</span></div>
                          <select
                            value={selectedTemplateId || ''}
                            onChange={e => setSelectedTemplateId(e.target.value || null)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--t1)' }}
                          >
                            <option value="">{t('selectAgreementType')}</option>
                            {AGREEMENT_TEMPLATES.map(tmpl => (
                              <option key={tmpl.id} value={tmpl.id}>
                                {tmpl.icon} {tmpl.label[t.lang]} ({tmpl.ratioDisplay})
                              </option>
                            ))}
                          </select>

                          {/* Selected template details */}
                          {selectedTemplateId && (() => {
                            const tmpl = AGREEMENT_TEMPLATES.find(t => t.id === selectedTemplateId);
                            if (!tmpl) return null;
                            const accentVar = tmpl.accent === 'brand' ? 'var(--brand)' : 'var(--good)';
                            return (
                              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: `color-mix(in srgb, ${accentVar} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${accentVar} 30%, transparent)` }}>
                                <div style={{ fontSize: 10, color: accentVar, fontWeight: 600, marginBottom: 3 }}>
                                  {getTemplateRatioLabel(tmpl, t.lang)}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1.4 }}>{tmpl.helperText[t.lang]}</div>
                                <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>
                                  {t('tradeWillBeSentForApproval')}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Allocation Preview */}
                {allocationPreview && (
                  <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, transparent)', borderRadius: 4, padding: '6px 8px', marginTop: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 3 }}>{t('estimatedAllocation')}</div>
                    <div className="prev-row"><span className="muted">{t('estSaleAmount')}</span><strong style={{ fontSize: 10 }}>{fmtQ(allocationPreview.revenue)}</strong></div>
                    {allocationPreview.fifoCost != null && <div className="prev-row"><span className="muted">{t('estFifoCost')}</span><strong style={{ fontSize: 10 }}>{fmtQ(allocationPreview.fifoCost)}</strong></div>}
                    {allocationPreview.baseLabel === 'net_profit' && (
                      <div className="prev-row"><span className="muted">{t('estNetProfit')}</span><strong style={{ fontSize: 10, color: allocationPreview.base >= 0 ? 'var(--good)' : 'var(--bad)' }}>{allocationPreview.base >= 0 ? '+' : ''}{fmtQ(allocationPreview.base)}</strong></div>
                    )}
                    <div className="prev-row" style={{ borderTop: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)', paddingTop: 4, marginTop: 2 }}>
                      <span className="muted">{t('allocationBaseLabel')}</span>
                      <strong style={{ fontSize: 9 }}>{allocationPreview.baseLabel === 'net_profit' ? t('netProfitBase') : t('saleEconomicsBase')}</strong>
                    </div>
                    <div className="prev-row"><span className="muted">{t('estPartnerShare')} ({allocationPreview.counterpartyName})</span><strong style={{ color: 'var(--bad)', fontSize: 10 }}>{fmtQ(allocationPreview.partnerAmount)}</strong></div>
                    <div className="prev-row"><span className="muted">{t('estMerchantShare')}</span><strong style={{ color: 'var(--good)', fontSize: 10 }}>{fmtQ(allocationPreview.merchantAmount)}</strong></div>
                    <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{t('tradeWillBeSentForApproval')}</div>
                  </div>
                )}

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
                      {/* Merchant net profit split when partner linked */}
                      {allocationPreview && (
                        <div style={{ borderTop: '1px solid color-mix(in srgb,var(--brand) 20%,transparent)', paddingTop: 5, marginTop: 4 }}>
                          <div className="prev-row"><span className="muted" style={{ fontWeight: 700, color: 'var(--good)' }}>📊 {t('merchantNetProfit')}</span><strong style={{ color: 'var(--good)', fontSize: 12 }}>{fmtQ(allocationPreview.merchantAmount)}</strong></div>
                          <div className="prev-row"><span className="muted" style={{ fontWeight: 700, color: 'var(--bad)' }}>🤝 {t('partnerNetProfit')}</span><strong style={{ color: 'var(--bad)', fontSize: 12 }}>{fmtQ(allocationPreview.partnerAmount)}</strong></div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="formActions"><button className="btn" onClick={addTrade}>{merchantOrderEnabled ? t('sendForApproval') : t('addTrade')}</button></div>
                <div className={`msg ${saleMessage.includes(t('fixFields')) ? 'bad' : ''}`}>{saleMessage}</div>
              </div>
            </div>
          )}

          {/* ── INCOMING: Partner trade details ── */}
          {activeTab === 'incoming' && (
            <div className="formPanel salePanel">
              <div className="hdr">📥 {t('approvalInbox')}</div>
              <div className="inner">
                {partnerMerchantDeals.length === 0 ? (
                  <div className="muted" style={{ fontSize: 11, textAlign: 'center', padding: 20 }}>{t('noIncomingTrades')}</div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
                    <p>{t('incomingTradesHelp')}</p>
                    <div style={{ marginTop: 12 }}>
                      {partnerMerchantDeals.filter(d => d.status === 'draft').map(deal => {
                        const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                        const rel = relationships.find(r => r.id === deal.relationship_id);
                        const { partnerPct } = getDealShares(deal);
                        return (
                          <div key={deal.id} className="previewBox" style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: 11 }}>{cfg?.icon} {deal.title}</span>
                                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                                  {rel?.counterparty?.display_name || '—'} · {partnerPct != null ? `${partnerPct}%/${100 - partnerPct}%` : '—'}
                                </div>
                              </div>
                              <div className="mono" style={{ fontWeight: 700, fontSize: 12 }}>{deal.amount.toLocaleString()} {deal.currency}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <button className="btn" style={{ fontSize: 10, padding: '4px 12px' }} onClick={async () => {
                                try {
                                  await api.deals.update(deal.id, { status: 'active' });
                                  await reloadMerchantData();
                                  toast.success(t('tradeApproved'));
                                } catch (err: any) { toast.error(err.message); }
                              }}>{t('approve')}</button>
                              <button className="btn secondary" style={{ fontSize: 10, padding: '4px 12px', color: 'var(--bad)' }} onClick={async () => {
                                try {
                                  await api.deals.update(deal.id, { status: 'cancelled' });
                                  await reloadMerchantData();
                                  toast.success(t('tradeRejected'));
                                } catch (err: any) { toast.error(err.message); }
                              }}>{t('reject')}</button>
                            </div>
                          </div>
                        );
                      })}
                      {partnerMerchantDeals.filter(d => d.status === 'draft').length === 0 && (
                        <div style={{ textAlign: 'center', padding: 12, color: 'var(--muted)' }}>{t('noPendingApprovals')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── OUTGOING: Summary ── */}
          {activeTab === 'outgoing' && (
            <div className="formPanel salePanel">
              <div className="hdr">📤 {t('outgoingTradesSummary')}</div>
              <div className="inner">
                <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  <p>{t('outgoingTradesHelp')}</p>
                </div>
                {outgoingTrades.filter(tr => tr.approvalStatus === 'pending_approval').length > 0 && (
                  <div className="previewBox" style={{ borderColor: 'var(--warn)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)', marginBottom: 4 }}>⏳ {t('pendingApprovalCount').replace('{n}', String(outgoingTrades.filter(tr => tr.approvalStatus === 'pending_approval').length))}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted)' }}>{t('awaitingPartnerApproval')}</div>
                  </div>
                )}
                {outgoingTrades.filter(tr => tr.approvalStatus === 'approved').length > 0 && (
                  <div className="previewBox" style={{ borderColor: 'var(--good)', marginTop: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--good)', marginBottom: 4 }}>✅ {outgoingTrades.filter(tr => tr.approvalStatus === 'approved').length} {t('approvedTrades')}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted)' }}>{t('permanentSharedRecords')}</div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ─── EDIT TRADE DIALOG ─── */}
      {(() => {
        const editingTrade = editingTradeId ? state.trades.find(x => x.id === editingTradeId) : null;
        const editCalc = editingTradeId ? derived.tradeCalc.get(editingTradeId) : null;
        const currentVolume = editingTrade ? editingTrade.amountUSDT * editingTrade.sellPriceQAR : 0;
        const currentNet = editCalc?.ok ? editCalc.netQAR : null;
        const isApproved = editingTrade?.approvalStatus === 'approved';
        return (
          <Dialog open={!!editingTradeId} onOpenChange={open => !open && setEditingTradeId(null)}>
            <DialogContent className="tracker-root" style={{ maxWidth: 500, background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--good) 25%, var(--line))', borderRadius: 12, padding: 24, gap: 0 }}>
              <DialogHeader style={{ marginBottom: 14 }}>
                <DialogTitle style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('correctTradeTitle')}</DialogTitle>
              </DialogHeader>

              {isApproved && (
                <div style={{ background: 'color-mix(in srgb, var(--bad) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--bad) 28%, transparent)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--bad)', marginBottom: 14, lineHeight: 1.5 }}>
                  {t('cannotEditApprovedTrade')}
                </div>
              )}

              {!isApproved && (
                <div style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 28%, transparent)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--warn)', marginBottom: 14, lineHeight: 1.5 }}>
                  {t('editInPlaceWarning')}
                </div>
              )}

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
                <div className="inputBox"><input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} disabled={isApproved} /></div>
              </div>

              <div className="field2" style={{ marginBottom: 10 }}>
                <div className="lbl">{t('buyerLabel')}</div>
                <select value={editCustomerId} onChange={e => setEditCustomerId(e.target.value)} disabled={isApproved}
                  style={{ width: '100%', padding: '8px 32px 8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--input-bg)', color: 'var(--text)', appearance: 'none', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="">{t('noCustomerSelected')}</option>
                  {state.customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="g2tight" style={{ marginBottom: 10 }}>
                <div className="field2">
                  <div className="lbl">{t('qtyUsdt')}</div>
                  <div className="inputBox"><input inputMode="decimal" value={editQty} onChange={e => setEditQty(e.target.value)} disabled={isApproved} /></div>
                </div>
                <div className="field2">
                  <div className="lbl">{t('sellPriceQar')}</div>
                  <div className="inputBox"><input inputMode="decimal" value={editSell} onChange={e => setEditSell(e.target.value)} disabled={isApproved} /></div>
                </div>
              </div>

              <div className="g2tight" style={{ marginBottom: 10 }}>
                <div className="field2">
                  <div className="lbl">{t('feeQarLabel')}</div>
                  <div className="inputBox"><input inputMode="decimal" value={editFee} onChange={e => setEditFee(e.target.value)} disabled={isApproved} /></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6, gap: 10 }}>
                  <input type="checkbox" id="editUsesStockChk" checked={editUsesStock} onChange={e => setEditUsesStock(e.target.checked)} disabled={isApproved} style={{ accentColor: 'var(--good)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0, marginBottom: 2 }} />
                  <label htmlFor="editUsesStockChk" style={{ cursor: 'pointer', lineHeight: 1.3 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{t('useFifoStock')}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{t('deductFromInventory')}</div>
                  </label>
                </div>
              </div>

              <div className="field2" style={{ marginBottom: 16 }}>
                <div className="lbl">{t('note')}</div>
                <div className="inputBox" style={{ padding: 0 }}>
                  <textarea
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    rows={2}
                    disabled={isApproved}
                    style={{ width: '100%', padding: '7px 10px', resize: 'none', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <DialogFooter style={{ gap: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {!isApproved && (
                  <button
                    onClick={deleteTrade}
                    style={{ padding: '7px 12px', borderRadius: 6, background: 'color-mix(in srgb, var(--bad) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--bad) 30%, transparent)', color: 'var(--bad)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                  >
                    {t('delete')}
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button className="btn secondary" style={{ minWidth: 80 }} onClick={() => setEditingTradeId(null)}>{t('cancel')}</button>
                  {!isApproved && (
                    <button
                      onClick={saveTradeEdit}
                      style={{ minWidth: 130, padding: '9px 18px', borderRadius: 6, background: 'var(--good)', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
                    >
                      {t('saveCorrection')}
                    </button>
                  )}
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ─── CANCELLATION REQUEST DIALOG ─── */}
      <Dialog open={!!cancelTradeId} onOpenChange={open => !open && setCancelTradeId(null)}>
        <DialogContent className="tracker-root" style={{ maxWidth: 420, background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--warn) 25%, var(--line))', borderRadius: 12, padding: 24, gap: 0 }}>
          <DialogHeader style={{ marginBottom: 14 }}>
            <DialogTitle style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('requestCancellationTitle')}</DialogTitle>
          </DialogHeader>
          <div style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 28%, transparent)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--warn)', marginBottom: 14, lineHeight: 1.5 }}>
            {t('cancellationRequestExplainer')}
          </div>
          <DialogFooter style={{ gap: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <button className="btn secondary" onClick={() => setCancelTradeId(null)}>{t('cancel')}</button>
            <button
              onClick={submitCancellationRequest}
              style={{ padding: '9px 18px', borderRadius: 6, background: 'var(--warn)', color: '#000', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
            >
              {t('submitCancellationRequest')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
