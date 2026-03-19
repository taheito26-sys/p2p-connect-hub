// Exact helper functions from the TRACKER_CLOUDFLARE- repo

export function num(v: any, def = 0): number {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

export function fmtU(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, dp),
  });
}

export function fmtQ(v: number): string {
  const x = num(v, 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' QAR';
}

export function fmtQRaw(v: number): string {
  const x = num(v, 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtP(n: number): string {
  const x = num(n, 0);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 });
}

export function fmtPct(n: number): string {
  if (!Number.isFinite(num(n))) return '—';
  const v = num(n);
  return (v >= 0 ? '+' : '') + Math.trunc(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) + '%';
}

export function fmtDur(ms: number): string {
  if (!ms || ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return d + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  return m + 'm';
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

export function fmtQWithUnit(qarAmount: number, currency = 'QAR', wacop: number | null = null): string {
  const q = num(qarAmount);
  if (!Number.isFinite(q)) return '—';
  if (currency === 'USDT' && wacop && wacop > 0) {
    return fmtU(q / wacop) + ' USDT';
  }
  return fmtQRaw(q) + ' QAR';
}

export function esc(s: any): string {
  return String(s || '');
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Types matching the repo state model ──

export interface Batch {
  id: string;
  ts: number;
  source: string;
  note: string;
  buyPriceQAR: number;
  initialUSDT: number;
  revisions: any[];
}

export type LinkedTradeStatus = 'pending_approval' | 'approved' | 'rejected' | 'cancellation_pending' | 'cancelled';

export interface Trade {
  id: string;
  ts: number;
  inputMode: 'USDT' | 'QAR';
  amountUSDT: number;
  sellPriceQAR: number;
  feeQAR: number;
  note: string;
  voided: boolean;
  usesStock: boolean;
  revisions: any[];
  customerId: string;
  /** Linked merchant deal ID (if this is a merchant order — legacy, kept for old data) */
  linkedDealId?: string;
  /** Linked relationship ID (if this is a merchant order) */
  linkedRelId?: string;
  /** Linked merchant user/profile ID (counterparty) */
  linkedMerchantId?: string;
  // ── Trade-centric agreement fields ──
  /** Agreement family: profit_share or sales_deal */
  agreementFamily?: 'profit_share' | 'sales_deal';
  /** Agreement template ID used */
  agreementTemplateId?: string;
  /** Partner share percentage */
  partnerPct?: number;
  /** Merchant share percentage */
  merchantPct?: number;
  /** Approval status for merchant-linked trades */
  approvalStatus?: LinkedTradeStatus;
  /** Who requested cancellation (user_id), if cancellation_pending */
  cancellationRequestedBy?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  tier: string;
  dailyLimitUSDT: number;
  notes: string;
  createdAt: number;
}

export interface DerivedBatch {
  id: string;
  buyPriceQAR: number;
  initialUSDT: number;
  remainingUSDT: number;
}

export interface TradeCalcResult {
  ok: boolean;
  netQAR: number;
  avgBuyQAR: number;
  margin: number;
  ppu: number;
  slices: { batchId: string; qty: number; cost: number }[];
}

export interface TrackerState {
  currency: 'QAR' | 'USDT';
  range: string;
  batches: Batch[];
  trades: Trade[];
  customers: Customer[];
  cashQAR: number;
  cashOwner: string;
  settings: { lowStockThreshold: number; priceAlertThreshold: number };
  cal: { year: number; month: number; selectedDay: number | null };
}

export interface DerivedState {
  batches: DerivedBatch[];
  tradeCalc: Map<string, TradeCalcResult>;
}

// ── FIFO computation ──

export function computeFIFO(batches: Batch[], trades: Trade[]): DerivedState {
  const sortedBatches = [...batches].sort((a, b) => a.ts - b.ts);
  const remaining = new Map<string, number>();
  for (const b of sortedBatches) remaining.set(b.id, b.initialUSDT);

  const tradeCalc = new Map<string, TradeCalcResult>();
  const sortedTrades = [...trades].filter(t => !t.voided && t.usesStock).sort((a, b) => a.ts - b.ts);

  for (const t of sortedTrades) {
    let qtyLeft = t.amountUSDT;
    const slices: { batchId: string; qty: number; cost: number }[] = [];
    let totalCost = 0;

    for (const b of sortedBatches) {
      if (qtyLeft <= 0) break;
      const rem = remaining.get(b.id) || 0;
      if (rem <= 0) continue;
      const allocated = Math.min(rem, qtyLeft);
      slices.push({ batchId: b.id, qty: allocated, cost: allocated * b.buyPriceQAR });
      totalCost += allocated * b.buyPriceQAR;
      remaining.set(b.id, rem - allocated);
      qtyLeft -= allocated;
    }

    const rev = t.amountUSDT * t.sellPriceQAR;
    const netQAR = rev - totalCost - t.feeQAR;
    const avgBuyQAR = t.amountUSDT > 0 ? totalCost / t.amountUSDT : 0;
    const margin = rev > 0 ? (netQAR / rev) * 100 : 0;

    tradeCalc.set(t.id, {
      ok: slices.length > 0 || !t.usesStock,
      netQAR,
      avgBuyQAR,
      margin,
      ppu: rev > 0 ? netQAR / t.amountUSDT : 0,
      slices,
    });
  }

  // Non-stock trades
  for (const t of trades.filter(t => !t.voided && !t.usesStock)) {
    const rev = t.amountUSDT * t.sellPriceQAR;
    tradeCalc.set(t.id, {
      ok: true,
      netQAR: rev - t.feeQAR,
      avgBuyQAR: 0,
      margin: 100,
      ppu: rev > 0 ? (rev - t.feeQAR) / t.amountUSDT : 0,
      slices: [],
    });
  }

  const derivedBatches: DerivedBatch[] = sortedBatches.map(b => ({
    id: b.id,
    buyPriceQAR: b.buyPriceQAR,
    initialUSDT: b.initialUSDT,
    remainingUSDT: Math.max(0, remaining.get(b.id) || 0),
  }));

  return { batches: derivedBatches, tradeCalc };
}

export function totalStock(derived: DerivedState): number {
  return derived.batches.reduce((s, b) => s + Math.max(0, b.remainingUSDT), 0);
}

export function stockCostQAR(derived: DerivedState): number {
  return derived.batches.reduce((s, b) => s + Math.max(0, b.remainingUSDT) * b.buyPriceQAR, 0);
}

export function getWACOP(derived: DerivedState): number | null {
  const a = derived.batches.filter(b => b.remainingUSDT > 0);
  if (!a.length) return null;
  const tv = a.reduce((s, b) => s + b.remainingUSDT * b.buyPriceQAR, 0);
  const ta = a.reduce((s, b) => s + b.remainingUSDT, 0);
  return ta > 0 ? tv / ta : null;
}

export function inRange(ts: number, range: string): boolean {
  const now = Date.now();
  if (range === 'all') return true;
  if (range === 'today') return ts >= startOfDay(now);
  if (range === '7d') return ts >= now - 7 * 864e5;
  if (range === '30d') return ts >= now - 30 * 864e5;
  return true;
}

export function kpiFor(state: TrackerState, derived: DerivedState, range: string) {
  const trades = state.trades.filter(t => !t.voided && inRange(t.ts, range));
  let rev = 0, net = 0, qty = 0, fee = 0;
  for (const t of trades) {
    const c = derived.tradeCalc.get(t.id);
    rev += t.amountUSDT * t.sellPriceQAR;
    qty += t.amountUSDT;
    fee += t.feeQAR;
    if (c?.ok) net += c.netQAR;
  }
  const margins = trades
    .map(t => { const c = derived.tradeCalc.get(t.id); return c?.ok ? c.margin : null; })
    .filter((x): x is number => x !== null);
  const avgMgn = margins.length ? margins.reduce((s, v) => s + v, 0) / margins.length : 0;
  return { rev, net, qty, fee, count: trades.length, avgMgn };
}

export function rangeLabel(range: string): string {
  if (range === 'today') return 'Today';
  if (range === '7d') return '7 Days';
  if (range === '30d') return '30 Days';
  if (range === 'all') return 'All Time';
  return range;
}

export function batchCycleTime(state: TrackerState, derived: DerivedState, id: string): number | null {
  const b = state.batches.find(x => x.id === id);
  if (!b) return null;
  const cs = state.trades.filter(t => {
    const c = derived.tradeCalc.get(t.id);
    return c?.ok && c.slices.some(s => s.batchId === id);
  });
  return cs.length ? Math.max(...cs.map(t => t.ts)) - b.ts : null;
}
