import { useState, useEffect, useMemo, useCallback } from 'react';
import { p2p } from '@/lib/api';
import { getDemoMode } from '@/lib/demo-mode';
import { generateP2PHistory, computeDailySummaries } from '@/lib/p2p-demo-data';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { P2PSnapshot, P2PHistoryPoint, P2POffer } from '@/types/domain';
import '@/styles/tracker.css';

type CalcMode = 'sell' | 'buy' | 'target';
type MarketId = 'qatar' | 'uae' | 'egypt';

const MARKETS: { id: MarketId; label: string; labelAr: string; currency: string; pair: string }[] = [
  { id: 'qatar', label: 'Qatar', labelAr: 'قطر', currency: 'QAR', pair: 'USDT/QAR' },
  { id: 'uae', label: 'UAE', labelAr: 'الإمارات', currency: 'AED', pair: 'USDT/AED' },
  { id: 'egypt', label: 'Egypt', labelAr: 'مصر', currency: 'EGP', pair: 'USDT/EGP' },
];

export default function P2PTrackerPage() {
  const t = useT();
  const [market, setMarket] = useState<MarketId>('qatar');
  const [snapshot, setSnapshot] = useState<P2PSnapshot | null>(null);
  const [history, setHistory] = useState<P2PHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRange, setHistoryRange] = useState<'7d' | '15d'>('7d');

  // Position Advisor state
  const [avPrice, setAvPrice] = useState(3.7375);
  const [targetMargin] = useState(2); // 2%

  // Calculator
  const [calcMode, setCalcMode] = useState<CalcMode>('sell');
  const [calcAmount, setCalcAmount] = useState('1000');
  const [calcRate, setCalcRate] = useState('');

  const currentMarket = MARKETS.find(m => m.id === market) || MARKETS[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (getDemoMode() || market !== 'qatar') {
        // Demo mode for all markets; live API only supports Qatar currently
        const demo = generateP2PHistory(market);
        setSnapshot(demo.snapshot);
        setHistory(demo.history);
        setLastUpdate(new Date().toISOString());
      } else {
        try {
          const [s, h] = await Promise.all([p2p.latest(market), p2p.history(market)]);
          setSnapshot(s);
          setHistory(Array.isArray(h) ? h : []);
          setLastUpdate(new Date().toISOString());
        } catch {
          // Fallback to demo data if API fails
          const demo = generateP2PHistory(market);
          setSnapshot(demo.snapshot);
          setHistory(demo.history);
          setLastUpdate(new Date().toISOString());
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load P2P data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  // Today's summary from history
  const todaySummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPts = history.filter(h => new Date(h.ts).toISOString().slice(0, 10) === todayStr);
    if (!todayPts.length) return null;
    return {
      highSell: Math.max(...todayPts.map(p => p.sellAvg ?? 0)),
      lowSell: Math.min(...todayPts.filter(p => p.sellAvg != null).map(p => p.sellAvg!)),
      highBuy: Math.max(...todayPts.map(p => p.buyAvg ?? 0)),
      lowBuy: Math.min(...todayPts.filter(p => p.buyAvg != null).map(p => p.buyAvg!)),
      polls: todayPts.length,
    };
  }, [history]);

  const last24hHistory = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return history.filter(h => h.ts >= cutoff);
  }, [history]);

  const priceBarData = useMemo(() => {
    const maxPoints = 80;
    const step = Math.max(1, Math.floor(last24hHistory.length / maxPoints));
    return last24hHistory.filter((_, i) => i % step === 0 || i === last24hHistory.length - 1);
  }, [last24hHistory]);

  const dailySummaries = useMemo(() => computeDailySummaries(history), [history]);

  const filteredSummaries = useMemo(() => {
    const days = historyRange === '15d' ? 15 : 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return dailySummaries.filter(d => d.date >= cutoff);
  }, [dailySummaries, historyRange]);

  const targetPrice = useMemo(() => avPrice * (1 + targetMargin / 100), [avPrice, targetMargin]);
  const sellAvg = snapshot?.sellAvg ?? 0;
  const buyAvg = snapshot?.buyAvg ?? 0;
  const isBelowTarget = sellAvg < targetPrice;
  const gap = targetPrice - sellAvg;
  const isGoodRestock = buyAvg < avPrice;

  const userStock = 8545.83;
  const userCash = 25000;

  const profitIfSold = useMemo(() => {
    if (!snapshot?.sellAvg) return null;
    const revenue = userStock * snapshot.sellAvg;
    const cost = userStock * avPrice;
    return Math.round(revenue - cost);
  }, [snapshot, avPrice]);

  const calcResult = useMemo(() => {
    const amt = parseFloat(calcAmount) || 0;
    const rate = parseFloat(calcRate) || (calcMode === 'sell' ? sellAvg : buyAvg);
    if (!amt || !rate) return null;
    if (calcMode === 'sell') return { qar: amt * rate, usdt: amt, rate };
    if (calcMode === 'buy') return { qar: amt * rate, usdt: amt, rate };
    return { qar: amt * rate, usdt: amt, rate };
  }, [calcAmount, calcRate, calcMode, sellAvg, buyAvg]);

  useEffect(() => {
    if (snapshot) {
      if (calcMode === 'sell' && !calcRate) setCalcRate(snapshot.sellAvg?.toFixed(2) || '');
      if (calcMode === 'buy' && !calcRate) setCalcRate(snapshot.buyAvg?.toFixed(2) || '');
    }
  }, [snapshot, calcMode, calcRate]);

  const sellChange = useMemo(() => {
    if (last24hHistory.length < 2) return 0;
    const prev = last24hHistory[last24hHistory.length - 2];
    const curr = last24hHistory[last24hHistory.length - 1];
    return Math.round(((curr.sellAvg ?? 0) - (prev.sellAvg ?? 0)) * 1000) / 1000;
  }, [last24hHistory]);

  const buyChange = useMemo(() => {
    if (last24hHistory.length < 2) return 0;
    const prev = last24hHistory[last24hHistory.length - 2];
    const curr = last24hHistory[last24hHistory.length - 1];
    return Math.round(((curr.buyAvg ?? 0) - (prev.buyAvg ?? 0)) * 1000) / 1000;
  }, [last24hHistory]);

  const fitsStock = (o: P2POffer) => o.min <= userStock * o.price && o.max >= o.min;
  const fitsCash = (o: P2POffer) => o.min <= userCash;

  if (loading && !snapshot) {
    return (
      <div className="tracker-root" style={{ padding: 10 }}>
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <div className="empty-t">{t.lang === 'ar' ? 'جاري تحميل بيانات P2P…' : 'Loading P2P data…'}</div>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const ccy = currentMarket.currency;

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 10 }}>
      {/* ── Status Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {/* Market selector */}
        <div className="tracker-seg" style={{ marginRight: 4 }}>
          {MARKETS.map(m => (
            <button
              key={m.id}
              className={market === m.id ? 'active' : ''}
              onClick={() => { setMarket(m.id); setCalcRate(''); }}
            >
              {t.isRTL ? m.labelAr : m.label}
            </button>
          ))}
        </div>

        <button className="btn" onClick={load} disabled={loading} style={{ gap: 6 }}>
          <span>🔄</span> {t.lang === 'ar' ? 'تحديث' : 'Refresh'}
        </button>
        {lastUpdate && (
          <span className="muted" style={{ fontSize: 11 }}>
            {t.lang === 'ar' ? 'آخر تحديث' : 'Updated'} {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}
        <span className="pill good" style={{ cursor: 'pointer' }} onClick={() => setAutoRefresh(!autoRefresh)}>
          ● {autoRefresh ? (t.lang === 'ar' ? 'المراقبة نشطة' : 'Backend · 24h monitoring active') : (t.lang === 'ar' ? 'مراقبة 24 ساعة' : 'Backend · 24h monitoring')}
        </span>
        {snapshot.spread != null && snapshot.spreadPct != null && (
          <span className="pill warn">
            {t.lang === 'ar' ? 'الفارق' : 'Spread'} {snapshot.spread.toFixed(3)} ({snapshot.spreadPct.toFixed(2)}%)
          </span>
        )}
        {isBelowTarget && (
          <span className="pill bad">⚠ {t.lang === 'ar' ? 'أقل من الهدف' : 'Below target'}</span>
        )}
        <span className="pill" style={{ fontWeight: 700 }}>{currentMarket.pair}</span>
      </div>

      {/* ── 6 KPI Cards ── */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: 10 }}>
        <div className="kpi-card">
          <div className="kpi-lbl">{t.lang === 'ar' ? 'أفضل بيع' : 'BEST SELL'}</div>
          <div className="kpi-val" style={{ color: 'var(--bad)' }}>{snapshot.bestSell?.toFixed(2) || '—'}</div>
          <div className="kpi-sub">{t.lang === 'ar' ? `أعلى عرض ${ccy}` : `Top offer ${ccy}`}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">{t.lang === 'ar' ? 'متوسط البيع (أعلى 5)' : 'SELL AVG (TOP 5)'}</div>
          <div className="kpi-val" style={{ color: 'var(--bad)' }}>{snapshot.sellAvg?.toFixed(2) || '—'}</div>
          <div className="kpi-sub" style={{ color: 'var(--bad)' }}>
            {snapshot.sellAvg && avPrice ? `+${((snapshot.sellAvg / avPrice - 1) * 100).toFixed(2)}% ${t.lang === 'ar' ? 'مقابل متوسط السعر' : 'vs Av Price'}` : ''}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">{t.lang === 'ar' ? 'أفضل شراء' : 'BEST RESTOCK'}</div>
          <div className="kpi-val" style={{ color: 'var(--good)' }}>{snapshot.bestBuy?.toFixed(2) || '—'}</div>
          <div className="kpi-sub" style={{ color: 'var(--good)' }}>
            {snapshot.bestBuy && snapshot.bestBuy < avPrice ? (t.lang === 'ar' ? '✓ أقل من متوسط السعر' : '✓ Below Av Price') : ''}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">{t.lang === 'ar' ? 'الربح إذا بعت الآن' : 'PROFIT IF SOLD NOW'}</div>
          <div className="kpi-val" style={{ color: profitIfSold && profitIfSold > 0 ? 'var(--good)' : 'var(--bad)' }}>
            {profitIfSold != null ? `${profitIfSold > 0 ? '+' : ''}${profitIfSold} ${ccy}` : '—'}
          </div>
          <div className="kpi-sub">{userStock.toLocaleString()} USDT @ {t.lang === 'ar' ? 'السوق' : 'market'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">{t.lang === 'ar' ? 'أعلى بيع اليوم' : 'TODAY HIGH SELL'}</div>
          <div className="kpi-val">{todaySummary?.highSell.toFixed(2) || '—'}</div>
          <div className="kpi-sub">
            {t.lang === 'ar' ? 'أدنى' : 'Low'} {todaySummary?.lowSell?.toFixed(3) || '—'} · {todaySummary?.polls || 0} {t.lang === 'ar' ? 'استطلاع' : 'polls'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">{t.lang === 'ar' ? 'أدنى شراء اليوم' : 'TODAY LOW BUY'}</div>
          <div className="kpi-val" style={{ color: 'var(--good)' }}>{todaySummary?.lowBuy?.toFixed(2) || '—'}</div>
          <div className="kpi-sub">{t.lang === 'ar' ? 'أعلى' : 'High'} {todaySummary?.highBuy?.toFixed(2) || '—'}</div>
        </div>
      </div>

      {/* ── Price History + Position Advisor (2 col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* Price History — 24h only */}
        <div className="panel">
          <div className="panel-head">
            <h2>📊 {t.lang === 'ar' ? 'سجل الأسعار' : 'Price History'}</h2>
            <span className="pill">{last24hHistory.length} {t.lang === 'ar' ? 'نقطة' : 'pts'} · 24h</span>
          </div>
          <div className="panel-body">
            {/* SELL AVG bars — RED for sell */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                {t.lang === 'ar' ? 'متوسط البيع' : 'SELL AVG'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: 28 }}>
                  {priceBarData.map((pt, i) => {
                    const minS = Math.min(...priceBarData.map(p => p.sellAvg ?? 3.7));
                    const maxS = Math.max(...priceBarData.map(p => p.sellAvg ?? 3.85));
                    const range = maxS - minS || 0.01;
                    const h = 6 + ((pt.sellAvg ?? minS) - minS) / range * 22;
                    return <div key={i} style={{ flex: 1, minWidth: 2, height: h, background: 'var(--bad)', borderRadius: 1, opacity: 0.8 }} />;
                  })}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bad)', minWidth: 40, textAlign: 'right' }}>
                  {snapshot.sellAvg?.toFixed(1)}
                </span>
              </div>
            </div>
            {/* BUY AVG bars — GREEN for buy */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                {t.lang === 'ar' ? 'متوسط الشراء' : 'BUY AVG'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: 28 }}>
                  {priceBarData.map((pt, i) => {
                    const minB = Math.min(...priceBarData.map(p => p.buyAvg ?? 3.7));
                    const maxB = Math.max(...priceBarData.map(p => p.buyAvg ?? 3.78));
                    const range = maxB - minB || 0.01;
                    const h = 6 + ((pt.buyAvg ?? minB) - minB) / range * 22;
                    return <div key={i} style={{ flex: 1, minWidth: 2, height: h, background: 'var(--good)', borderRadius: 1, opacity: 0.8 }} />;
                  })}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--good)', minWidth: 40, textAlign: 'right' }}>
                  {snapshot.buyAvg?.toFixed(3)}
                </span>
              </div>
            </div>
            {/* Change badges */}
            <div style={{ display: 'flex', gap: 6 }}>
              <span className={`pill ${sellChange >= 0 ? 'bad' : 'good'}`}>
                {t.lang === 'ar' ? 'بيع' : 'Sell'} {sellChange >= 0 ? '+' : ''}{sellChange.toFixed(3)}
              </span>
              <span className={`pill ${buyChange <= 0 ? 'good' : 'bad'}`}>
                {t.lang === 'ar' ? 'شراء' : 'Buy'} {buyChange >= 0 ? '+' : ''}{buyChange.toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* Position Advisor */}
        <div className="panel">
          <div className="panel-head">
            <h2>🎯 {t.lang === 'ar' ? 'مستشار المركز' : 'Position Advisor'}</h2>
            <button className="btn" style={{ fontSize: 10, padding: '3px 10px' }}>{t.lang === 'ar' ? 'مراقبة' : 'Monitor'}</button>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ fontSize: 11 }}>{t.lang === 'ar' ? 'متوسط سعرك' : 'Your Av Price'}</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{avPrice.toFixed(4)} {ccy}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ fontSize: 11 }}>{t.lang === 'ar' ? `الهدف (هامش ${targetMargin}%)` : `Target (${targetMargin}% margin)`}</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--good)' }}>{targetPrice.toFixed(5)} {ccy}</span>
            </div>

            {isBelowTarget && (
              <div style={{ padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)', background: 'color-mix(in srgb, var(--warn) 8%, transparent)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--warn)' }}>⚠ {t.lang === 'ar' ? 'انتظر — أقل من الهدف' : 'Hold — below target'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.lang === 'ar' ? 'الفجوة' : 'Gap'}: {gap.toFixed(5)} · {t.lang === 'ar' ? 'تحتاج' : 'need'} {targetPrice.toFixed(5)}</div>
              </div>
            )}
            {!isBelowTarget && (
              <div style={{ padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)', background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--good)' }}>✓ {t.lang === 'ar' ? 'فوق الهدف — فرصة بيع' : 'Above target — sell opportunity'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.lang === 'ar' ? 'متوسط البيع' : 'Sell avg'} {sellAvg.toFixed(3)} &gt; {t.lang === 'ar' ? 'الهدف' : 'target'} {targetPrice.toFixed(5)}</div>
              </div>
            )}
            {isGoodRestock && (
              <div style={{ padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)', background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--good)' }}>✓ {t.lang === 'ar' ? 'فرصة تعبئة جيدة' : 'Good restock opportunity'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.lang === 'ar' ? 'متوسط الشراء' : 'Buy avg'} {buyAvg.toFixed(3)} &lt; {t.lang === 'ar' ? 'متوسط السعر — يحسن قاعدة التكلفة' : 'Av Price — improves cost base'}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <button className="btn" style={{ justifyContent: 'center' }} onClick={() => { setCalcMode('sell'); setCalcRate(sellAvg.toFixed(2)); }}>
                {t.lang === 'ar' ? 'تطبيق سعر البيع' : 'Apply Sell Rate'}
              </button>
              <button className="btn secondary" style={{ justifyContent: 'center' }} onClick={() => { setCalcMode('buy'); setCalcRate(buyAvg.toFixed(2)); }}>
                {t.lang === 'ar' ? 'تطبيق سعر الشراء' : 'Apply Buy Rate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sell Offers + Restock Offers (2 col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* Sell Offers — RED color theme */}
        <div className="panel">
          <div className="panel-head">
            <h2 style={{ color: 'var(--bad)' }}>↑ {t.lang === 'ar' ? 'عروض البيع' : 'Sell Offers'}</h2>
            <span className="pill bad">{t.lang === 'ar' ? 'الأعلى أولاً · ✓ يناسب مخزونك' : 'Highest first · ✓ fits your stock'}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.lang === 'ar' ? 'التاجر' : 'TRADER'}</th>
                    <th>{t.lang === 'ar' ? 'السعر' : 'PRICE'}</th>
                    <th>{t.lang === 'ar' ? 'الحد الأدنى' : 'MIN'}</th>
                    <th>{t.lang === 'ar' ? 'الحد الأقصى' : 'MAX'}</th>
                    <th>{t.lang === 'ar' ? 'الطرق' : 'METHODS'}</th>
                    <th>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.sellOffers?.slice(0, 10).map((o, i) => {
                    const maxPrice = snapshot.sellOffers?.[0]?.price || 1;
                    const depthPct = Math.min(100, (o.price / maxPrice) * 100);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, fontSize: 11 }}>
                          {i === 0 && '★ '}{o.nick}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, color: 'var(--bad)', fontSize: 12 }}>{o.price.toFixed(2)}</span>
                            <div style={{ width: 50, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                              <div style={{ width: `${depthPct}%`, height: '100%', background: 'var(--bad)', borderRadius: 3 }} />
                            </div>
                          </div>
                        </td>
                        <td className="mono r">{o.min.toLocaleString()}</td>
                        <td className="mono r">{o.max.toLocaleString()}</td>
                        <td style={{ fontSize: 10 }}>{o.methods.slice(0, 2).join('  ')}</td>
                        <td style={{ textAlign: 'center' }}>
                          {fitsStock(o) ? <span className="good">✓</span> : <span className="muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Restock Offers — GREEN color theme */}
        <div className="panel">
          <div className="panel-head">
            <h2 style={{ color: 'var(--good)' }}>↓ {t.lang === 'ar' ? 'عروض الشراء' : 'Restock Offers'}</h2>
            <span className="pill good">{t.lang === 'ar' ? 'الأرخص أولاً · ✓ يناسب رصيدك' : 'Cheapest first · ✓ fits your cash'}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.lang === 'ar' ? 'التاجر' : 'TRADER'}</th>
                    <th>{t.lang === 'ar' ? 'السعر' : 'PRICE'}</th>
                    <th>{t.lang === 'ar' ? 'الحد الأدنى' : 'MIN'}</th>
                    <th>{t.lang === 'ar' ? 'الحد الأقصى' : 'MAX'}</th>
                    <th>{t.lang === 'ar' ? 'الطرق' : 'METHODS'}</th>
                    <th>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.buyOffers?.slice(0, 10).map((o, i) => {
                    const minPrice = snapshot.buyOffers?.[0]?.price || 1;
                    const maxP = snapshot.buyOffers?.[snapshot.buyOffers.length - 1]?.price || 1;
                    const range = maxP - minPrice || 0.01;
                    const depthPct = Math.min(100, ((o.price - minPrice) / range) * 100);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, fontSize: 11 }}>
                          {i === 0 && '★ '}{o.nick}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, color: 'var(--good)', fontSize: 12 }}>{o.price.toFixed(2)}</span>
                            <div style={{ width: 50, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                              <div style={{ width: `${100 - depthPct}%`, height: '100%', background: 'var(--good)', borderRadius: 3 }} />
                            </div>
                          </div>
                        </td>
                        <td className="mono r">{o.min.toLocaleString()}</td>
                        <td className="mono r">{o.max.toLocaleString()}</td>
                        <td style={{ fontSize: 10 }}>{o.methods.slice(0, 2).join('  ')}</td>
                        <td style={{ textAlign: 'center' }}>
                          {fitsCash(o) ? <span className="good">✓</span> : <span className="muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Calculator ── */}
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="panel-head">
          <h2>🧮 {t.lang === 'ar' ? 'الآلة الحاسبة' : 'Calculator'}</h2>
          <div className="modeToggle">
            <button className={calcMode === 'sell' ? 'active' : ''} onClick={() => { setCalcMode('sell'); setCalcRate(sellAvg.toFixed(2)); }}>{t.lang === 'ar' ? 'بيع' : 'Sell'}</button>
            <button className={calcMode === 'buy' ? 'active' : ''} onClick={() => { setCalcMode('buy'); setCalcRate(buyAvg.toFixed(2)); }}>{t.lang === 'ar' ? 'شراء' : 'Buy'}</button>
            <button className={calcMode === 'target' ? 'active' : ''} onClick={() => { setCalcMode('target'); setCalcRate(targetPrice.toFixed(4)); }}>{t.lang === 'ar' ? 'مستهدف' : 'Target'}</button>
          </div>
        </div>
        <div className="panel-body">
          <div className="g2tight" style={{ marginBottom: 8 }}>
            <div className="field2">
              <span className="lbl">{t.lang === 'ar' ? 'المبلغ (USDT)' : 'Amount (USDT)'}</span>
              <div className="inputBox">
                <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} placeholder="1000" />
              </div>
            </div>
            <div className="field2">
              <span className="lbl">{t.lang === 'ar' ? `السعر (${ccy})` : `Rate (${ccy})`}</span>
              <div className="inputBox">
                <input type="number" step="0.001" value={calcRate} onChange={e => setCalcRate(e.target.value)} placeholder="3.80" />
              </div>
            </div>
          </div>
          {calcResult && (
            <div className="bannerRow">
              <span className="bLbl">{calcMode === 'buy' ? (t.lang === 'ar' ? 'التكلفة' : 'Cost') : (t.lang === 'ar' ? 'الإيراد' : 'Revenue')}</span>
              <span className="bVal">{calcResult.qar.toFixed(2)} {ccy}</span>
              <span className="bSpacer" />
              <span className="bPill">@ {calcResult.rate.toFixed(3)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Historical Averages (collapsible) ── */}
      <div className="panel">
        <div className="panel-head" style={{ cursor: 'pointer' }} onClick={() => setShowHistory(!showHistory)}>
          <h2>📅 {t.lang === 'ar' ? 'المتوسطات التاريخية' : 'Historical Averages'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showHistory && (
              <div className="tracker-seg">
                <button className={historyRange === '7d' ? 'active' : ''} onClick={e => { e.stopPropagation(); setHistoryRange('7d'); }}>7D</button>
                <button className={historyRange === '15d' ? 'active' : ''} onClick={e => { e.stopPropagation(); setHistoryRange('15d'); }}>15D</button>
              </div>
            )}
            <span className="pill">{showHistory ? '▼' : '▶'} {filteredSummaries.length} {t.lang === 'ar' ? 'يوم' : 'days'}</span>
          </div>
        </div>
        {showHistory && (
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.lang === 'ar' ? 'التاريخ' : 'DATE'}</th>
                    <th>{t.lang === 'ar' ? 'أعلى بيع' : 'SELL HIGH'}</th>
                    <th>{t.lang === 'ar' ? 'أدنى بيع' : 'SELL LOW'}</th>
                    <th>{t.lang === 'ar' ? 'متوسط بيع' : 'SELL AVG'}</th>
                    <th>{t.lang === 'ar' ? 'أعلى شراء' : 'BUY HIGH'}</th>
                    <th>{t.lang === 'ar' ? 'أدنى شراء' : 'BUY LOW'}</th>
                    <th>{t.lang === 'ar' ? 'متوسط شراء' : 'BUY AVG'}</th>
                    <th>{t.lang === 'ar' ? 'الفارق' : 'SPREAD'}</th>
                    <th>{t.lang === 'ar' ? 'استطلاعات' : 'POLLS'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map(d => {
                    const avgSell = (d.highSell + (d.lowSell ?? d.highSell)) / 2;
                    const avgBuy = (d.highBuy + (d.lowBuy ?? d.highBuy)) / 2;
                    const spread = avgSell - avgBuy;
                    return (
                      <tr key={d.date}>
                        <td className="mono">{d.date}</td>
                        <td className="mono r bad">{d.highSell.toFixed(3)}</td>
                        <td className="mono r" style={{ color: 'color-mix(in srgb, var(--bad) 60%, var(--muted))' }}>{d.lowSell?.toFixed(3) ?? '—'}</td>
                        <td className="mono r bad" style={{ fontWeight: 800 }}>{avgSell.toFixed(3)}</td>
                        <td className="mono r good">{d.highBuy.toFixed(3)}</td>
                        <td className="mono r" style={{ color: 'color-mix(in srgb, var(--good) 60%, var(--muted))' }}>{d.lowBuy?.toFixed(3) ?? '—'}</td>
                        <td className="mono r good" style={{ fontWeight: 800 }}>{avgBuy.toFixed(3)}</td>
                        <td className="mono r warn">{spread.toFixed(3)}</td>
                        <td className="mono r muted">{d.polls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
