// ─── P2P Demo Data Generator ─────────────────────────────────────
// Generates realistic USDT price history matching
// the source repo's Binance P2P scraper output format.
// Supports Qatar (QAR), UAE (AED), Egypt (EGP) markets.

import type { P2PSnapshot, P2PHistoryPoint, P2POffer } from '@/types/domain';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const HISTORY_DAYS = 15;
const HISTORY_POINTS = (60 / 5) * 24 * HISTORY_DAYS;

const NICKS_QA = [
  'NEWTECHD...', 'Issasalim', 'يو-خيد', 'GuinueineBoy',
  'ENG_ABDULLA', 'TAMIM_A7MED', 'EXCHANGE-R...', 'm7md1912',
  'HectorSrk', 'CRYPTOknightt16', 'AL-ISHFA -CRYP...', 'SMAK5',
  'QatarOTC', 'AhmedTrader', 'GulfExchange', 'DohaP2P',
];

const NICKS_AE = [
  'DubaiOTC', 'UAE_Exchange', 'CryptoAbuDhabi', 'SharjahTrader',
  'GulfP2P', 'AjmanCrypto', 'EmiratesOTC', 'DXBTrader',
  'AlAinExchange', 'FujairahP2P', 'RAKTrader', 'UAEKnight',
];

const NICKS_EG = [
  'CairoOTC', 'NileTrader', 'EgyptP2P', 'AlexExchange',
  'GizaCrypto', 'MasrTrader', 'CairoKnight', 'NileCrypto',
  'PyramidOTC', 'SuezTrader', 'LuxorP2P', 'AssiutExchange',
];

const METHODS_QA = [
  'Bank Transfer', 'Qatar National Bank QNB', 'Cash app', 'M Pay',
  'CB Pay', 'Cashpack', 'Qatar Islamic Bank QIB', 'Vodafone Cash',
];

const METHODS_AE = [
  'Bank Transfer', 'Emirates NBD', 'ADCB', 'FAB',
  'Cash in Person', 'Mashreq Bank', 'DIB', 'RAKBANK',
];

const METHODS_EG = [
  'Bank Transfer', 'CIB', 'Banque Misr', 'National Bank of Egypt',
  'Vodafone Cash', 'Orange Cash', 'InstaPay', 'Fawry',
];

interface MarketConfig {
  nicks: string[];
  methods: string[];
  baseSell: number;
  baseBuy: number;
  minSell: number;
  maxSell: number;
  seed: number;
}

const MARKET_CONFIGS: Record<string, MarketConfig> = {
  qatar: { nicks: NICKS_QA, methods: METHODS_QA, baseSell: 3.79, baseBuy: 3.72, minSell: 3.75, maxSell: 3.85, seed: 42 },
  uae: { nicks: NICKS_AE, methods: METHODS_AE, baseSell: 3.68, baseBuy: 3.62, minSell: 3.63, maxSell: 3.73, seed: 99 },
  egypt: { nicks: NICKS_EG, methods: METHODS_EG, baseSell: 49.5, baseBuy: 48.8, minSell: 48.0, maxSell: 51.0, seed: 77 },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateOffers(rng: () => number, side: 'sell' | 'buy', basePrice: number, config: MarketConfig): P2POffer[] {
  const count = 8 + Math.floor(rng() * 5);
  const offers: P2POffer[] = [];
  const spreadFactor = basePrice > 10 ? 0.5 : 0.03;
  for (let i = 0; i < count; i++) {
    const offset = side === 'sell'
      ? basePrice + (rng() * spreadFactor - spreadFactor * 0.15)
      : basePrice - (rng() * spreadFactor - spreadFactor * 0.15);
    const price = Math.round(offset * 100) / 100;
    const methodCount = 1 + Math.floor(rng() * 3);
    const methods: string[] = [];
    for (let m = 0; m < methodCount; m++) {
      const method = config.methods[Math.floor(rng() * config.methods.length)];
      if (!methods.includes(method)) methods.push(method);
    }
    offers.push({
      price,
      min: Math.round((100 + rng() * 5000) / 10) * 10,
      max: Math.round((3000 + rng() * 75000) / 100) * 100,
      nick: config.nicks[Math.floor(rng() * config.nicks.length)],
      methods,
      available: Math.round((500 + rng() * 15000) * 100) / 100,
    });
  }
  offers.sort((a, b) => side === 'sell' ? b.price - a.price : a.price - b.price);
  return offers;
}

function computeStats(offers: P2POffer[], side: 'sell' | 'buy') {
  const top5 = offers.slice(0, 5);
  const avg = top5.length ? top5.reduce((s, o) => s + o.price, 0) / top5.length : null;
  const best = offers[0]?.price ?? null;
  const depth = top5.reduce((s, o) => {
    return side === 'sell'
      ? s + Math.min(o.max, o.available > 0 ? o.available * o.price : o.max)
      : s + Math.min(o.max / (o.price || 1), o.available > 0 ? o.available : o.max / (o.price || 1));
  }, 0);
  return { avg, best, depth };
}

export function generateP2PHistory(market: string = 'qatar'): { snapshot: P2PSnapshot; history: P2PHistoryPoint[] } {
  const config = MARKET_CONFIGS[market] || MARKET_CONFIGS.qatar;
  const rng = seededRandom(config.seed);
  const now = Date.now();
  const startTs = now - HISTORY_DAYS * 24 * 60 * 60 * 1000;

  const history: P2PHistoryPoint[] = [];
  let baseSell = config.baseSell;
  let baseBuy = config.baseBuy;
  const driftScale = baseSell > 10 ? 0.05 : 0.002;
  const noiseScale = baseSell > 10 ? 0.3 : 0.015;
  const spreadBase = baseSell > 10 ? 1.2 : 0.06;

  for (let i = 0; i < HISTORY_POINTS; i++) {
    const ts = startTs + i * POLL_INTERVAL_MS;
    const hourOfDay = new Date(ts).getHours();
    const dayFactor = Math.sin((hourOfDay - 6) * Math.PI / 12) * (baseSell > 10 ? 0.1 : 0.005);
    const noise = (rng() - 0.5) * noiseScale;
    const drift = (rng() - 0.5) * driftScale;

    baseSell = Math.max(config.minSell, Math.min(config.maxSell, baseSell + drift + dayFactor * 0.1));
    baseBuy = baseSell - spreadBase - rng() * (spreadBase * 0.3);

    const sellAvg = Math.round((baseSell + noise) * 1000) / 1000;
    const buyAvg = Math.round((baseBuy + noise * 0.8) * 1000) / 1000;
    const spread = Math.round((sellAvg - buyAvg) * 1000) / 1000;
    const spreadPct = Math.round((spread / buyAvg) * 100 * 1000) / 1000;

    history.push({ ts, sellAvg, buyAvg, spread, spreadPct });
  }

  const latest = history[history.length - 1];
  const sellOffers = generateOffers(rng, 'sell', latest.sellAvg!, config);
  const buyOffers = generateOffers(rng, 'buy', latest.buyAvg!, config);
  const sellStats = computeStats(sellOffers, 'sell');
  const buyStats = computeStats(buyOffers, 'buy');

  const spread = sellStats.avg && buyStats.avg ? sellStats.avg - buyStats.avg : null;
  const spreadPct = spread && buyStats.avg ? (spread / buyStats.avg) * 100 : null;

  const snapshot: P2PSnapshot = {
    ts: now,
    sellAvg: sellStats.avg ? Math.round(sellStats.avg * 100) / 100 : null,
    buyAvg: buyStats.avg ? Math.round(buyStats.avg * 100) / 100 : null,
    bestSell: sellStats.best,
    bestBuy: buyStats.best,
    sellDepth: Math.round(sellStats.depth),
    buyDepth: Math.round(buyStats.depth),
    spread: spread ? Math.round(spread * 1000) / 1000 : null,
    spreadPct: spreadPct ? Math.round(spreadPct * 1000) / 1000 : null,
    sellOffers,
    buyOffers,
  };

  return { snapshot, history };
}

export interface P2PDaySummary {
  date: string;
  highSell: number;
  lowSell: number | null;
  highBuy: number;
  lowBuy: number | null;
  polls: number;
}

export function computeDailySummaries(history: P2PHistoryPoint[]): P2PDaySummary[] {
  const byDate = new Map<string, P2PDaySummary>();
  for (const pt of history) {
    const date = new Date(pt.ts).toISOString().slice(0, 10);
    let day = byDate.get(date);
    if (!day) {
      day = { date, highSell: 0, lowSell: null, highBuy: 0, lowBuy: null, polls: 0 };
      byDate.set(date, day);
    }
    if (pt.sellAvg != null) {
      day.highSell = Math.max(day.highSell, pt.sellAvg);
      day.lowSell = day.lowSell === null ? pt.sellAvg : Math.min(day.lowSell, pt.sellAvg);
    }
    if (pt.buyAvg != null) {
      day.highBuy = Math.max(day.highBuy, pt.buyAvg);
      day.lowBuy = day.lowBuy === null ? pt.buyAvg : Math.min(day.lowBuy, pt.buyAvg);
    }
    day.polls++;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
