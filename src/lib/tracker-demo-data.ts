// Demo data matching the TRACKER_CLOUDFLARE- repo state model
import { uid, type TrackerState, type Batch, type Trade, type Customer, computeFIFO, type DerivedState } from './tracker-helpers';

const now = Date.now();
const DAY = 86400000;

function makeBatches(): Batch[] {
  return [
    { id: uid(), ts: now - 14 * DAY, source: 'Al-Wakra Exchange', note: '', buyPriceQAR: 3.72, initialUSDT: 25000, revisions: [] },
    { id: uid(), ts: now - 10 * DAY, source: 'Souq Trader', note: 'Bulk buy', buyPriceQAR: 3.74, initialUSDT: 15000, revisions: [] },
    { id: uid(), ts: now - 7 * DAY, source: 'Binance P2P', note: '', buyPriceQAR: 3.73, initialUSDT: 20000, revisions: [] },
    { id: uid(), ts: now - 3 * DAY, source: 'Al-Wakra Exchange', note: 'Weekly restock', buyPriceQAR: 3.75, initialUSDT: 30000, revisions: [] },
    { id: uid(), ts: now - 1 * DAY, source: 'Doha OTC', note: '', buyPriceQAR: 3.76, initialUSDT: 10000, revisions: [] },
  ];
}

function makeTrades(batches: Batch[]): Trade[] {
  const customers = makeCust();
  return [
    { id: uid(), ts: now - 13 * DAY, inputMode: 'USDT', amountUSDT: 5000, sellPriceQAR: 3.78, feeQAR: 12, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[0].id },
    { id: uid(), ts: now - 12 * DAY, inputMode: 'USDT', amountUSDT: 3000, sellPriceQAR: 3.79, feeQAR: 8, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[1].id },
    { id: uid(), ts: now - 11 * DAY, inputMode: 'USDT', amountUSDT: 8000, sellPriceQAR: 3.77, feeQAR: 20, note: 'Bulk', voided: false, usesStock: true, revisions: [], customerId: customers[2].id },
    { id: uid(), ts: now - 9 * DAY, inputMode: 'USDT', amountUSDT: 2000, sellPriceQAR: 3.80, feeQAR: 5, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[0].id },
    { id: uid(), ts: now - 8 * DAY, inputMode: 'USDT', amountUSDT: 6000, sellPriceQAR: 3.78, feeQAR: 15, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[3].id },
    { id: uid(), ts: now - 6 * DAY, inputMode: 'USDT', amountUSDT: 4500, sellPriceQAR: 3.79, feeQAR: 10, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[1].id },
    { id: uid(), ts: now - 5 * DAY, inputMode: 'USDT', amountUSDT: 7000, sellPriceQAR: 3.81, feeQAR: 18, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[2].id },
    { id: uid(), ts: now - 4 * DAY, inputMode: 'USDT', amountUSDT: 3500, sellPriceQAR: 3.77, feeQAR: 9, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[4].id },
    { id: uid(), ts: now - 2 * DAY, inputMode: 'USDT', amountUSDT: 5500, sellPriceQAR: 3.82, feeQAR: 14, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[0].id },
    { id: uid(), ts: now - 1 * DAY, inputMode: 'USDT', amountUSDT: 2500, sellPriceQAR: 3.80, feeQAR: 7, note: '', voided: false, usesStock: true, revisions: [], customerId: customers[3].id },
    { id: uid(), ts: now - 0.5 * DAY, inputMode: 'USDT', amountUSDT: 4000, sellPriceQAR: 3.83, feeQAR: 10, note: 'Premium', voided: false, usesStock: true, revisions: [], customerId: customers[1].id },
  ];
}

function makeCust(): Customer[] {
  return [
    { id: uid(), name: 'Ahmed Al-Thani', phone: '+974 5511 2233', tier: 'A', dailyLimitUSDT: 50000, notes: 'VIP trader', createdAt: now - 30 * DAY },
    { id: uid(), name: 'Mohammed', phone: '+974 5544 6677', tier: 'B', dailyLimitUSDT: 20000, notes: '', createdAt: now - 20 * DAY },
    { id: uid(), name: 'Khalid Enterprises', phone: '+974 5588 9900', tier: 'A', dailyLimitUSDT: 100000, notes: 'Corporate', createdAt: now - 25 * DAY },
    { id: uid(), name: 'Fatima', phone: '+974 5522 3344', tier: 'C', dailyLimitUSDT: 10000, notes: '', createdAt: now - 15 * DAY },
    { id: uid(), name: 'Rashid Trading', phone: '', tier: 'B', dailyLimitUSDT: 30000, notes: 'Wholesale', createdAt: now - 10 * DAY },
  ];
}

type DemoOverrides = Partial<TrackerState['settings']> & {
  range?: TrackerState['range'];
  currency?: TrackerState['currency'];
};

export function createDemoState(overrides?: DemoOverrides): { state: TrackerState; derived: DerivedState } {
  const batches = makeBatches();
  const customers = makeCust();
  const trades = makeTrades(batches);

  const state: TrackerState = {
    currency: overrides?.currency ?? 'QAR',
    range: overrides?.range ?? '7d',
    batches,
    trades,
    customers,
    cashQAR: 45000,
    cashOwner: 'Main Account',
    settings: {
      lowStockThreshold: overrides?.lowStockThreshold ?? 5000,
      priceAlertThreshold: overrides?.priceAlertThreshold ?? 2,
    },
    cal: { year: new Date().getFullYear(), month: new Date().getMonth(), selectedDay: null },
  };

  const derived = computeFIFO(batches, trades);
  return { state, derived };
}
