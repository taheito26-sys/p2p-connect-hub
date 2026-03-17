import { useState, useEffect, useMemo, useCallback } from 'react';
import { p2p } from '@/lib/api';
import { getDemoMode } from '@/lib/demo-mode';
import { generateP2PHistory, computeDailySummaries } from '@/lib/p2p-demo-data';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { P2PSnapshot, P2PHistoryPoint, P2POffer } from '@/types/domain';
import '@/styles/tracker.css';

type CalcMode = 'sell' | 'buy' | 'target';

export default function P2PTrackerPage() {
  const t = useT();
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (getDemoMode()) {
        const demo = generateP2PHistory();
        setSnapshot(demo.snapshot);
        setHistory(demo.history);
        setLastUpdate(new Date().toISOString());
      } else {
        const [s, h] = await Promise.all([p2p.latest(), p2p.history()]);
        setSnapshot(s);
        setHistory(Array.isArray(h) ? h : []);
        setLastUpdate(new Date().toISOString());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load P2P data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Price History: 24 hours only (like source repo)
  const last24hHistory = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return history.filter(h => h.ts >= cutoff);
  }, [history]);

  // Price history bars data (horizontal bars) — 24h only
  const priceBarData = useMemo(() => {
    const maxPoints = 80;
    const step = Math.max(1, Math.floor(last24hHistory.length / maxPoints));
    return last24hHistory.filter((_, i) => i % step === 0 || i === last24hHistory.length - 1);
  }, [last24hHistory]);

  // Historical daily summaries for the lookback section
  const dailySummaries = useMemo(() => computeDailySummaries(history), [history]);

  const filteredSummaries = useMemo(() => {
    const days = historyRange === '15d' ? 15 : 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return dailySummaries.filter(d => d.date >= cutoff);
  }, [dailySummaries, historyRange]);

  // Position advisor calculations
  const targetPrice = useMemo(() => avPrice * (1 + targetMargin / 100), [avPrice, targetMargin]);
  const sellAvg = snapshot?.sellAvg ?? 0;
  const buyAvg = snapshot?.buyAvg ?? 0;
  const isBelowTarget = sellAvg < targetPrice;
  const gap = targetPrice - sellAvg;
  const isGoodRestock = buyAvg < avPrice;

  // User's stock for "fits" checks (demo)
  const userStock = 8545.83;
  const userCash = 25000;

  // Profit if sold now
  const profitIfSold = useMemo(() => {
    if (!snapshot?.sellAvg) return null;
    const revenue = userStock * snapshot.sellAvg;
    const cost = userStock * avPrice;
    return Math.round(revenue - cost);
  }, [snapshot, avPrice]);

  // Calculator result
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

  // Sell/Buy change from previous point (24h)
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

  // Check if offer fits user stock/cash
  const fitsStock = (o: P2POffer) => o.min <= userStock * o.price && o.max >= o.min;
  const fitsCash = (o: P2POffer) => o.min <= userCash;

  if (loading && !snapshot) {
    return (
      <div className="tracker-root" style={{ padding: 10 }}>
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <div className="empty-t">Loading P2P data…</div>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="tracker-root" style={{ padding: 10 }}>
      {/* ── Status Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={load} disabled={loading} style={{ gap: 6 }}>
          <span>🔄</span> Refresh
        </button>
        {lastUpdate && (
          <span className="muted" style={{ fontSize: 11 }}>
            Updated {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}
        <span className="pill good" style={{ cursor: 'pointer' }} onClick={() => setAutoRefresh(!autoRefresh)}>
          ● {autoRefresh ? 'Backend · 24h monitoring active' : 'Backend · 24h monitoring'}
        </span>
        {snapshot.spread != null && snapshot.spreadPct != null && (
          <span className="pill warn">
            Spread {snapshot.spread.toFixed(3)} ({snapshot.spreadPct.toFixed(2)}%)
          </span>
        )}
        {isBelowTarget && (
          <span className="pill bad">⚠ Below target</span>
        )}
      </div>

      {/* ── 6 KPI Cards ── */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: 10 }}>
        <div className="kpi-card">
          <div className="kpi-lbl">BEST SELL</div>
          <div className="kpi-val good">{snapshot.bestSell?.toFixed(2) || '—'}</div>
          <div className="kpi-sub">Top offer QAR</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">SELL AVG (TOP 5)</div>
          <div className="kpi-val good">{snapshot.sellAvg?.toFixed(2) || '—'}</div>
          <div className="kpi-sub good">
            {snapshot.sellAvg && avPrice ? `+${((snapshot.sellAvg / avPrice - 1) * 100).toFixed(2)}% vs Av Price` : ''}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">BEST RESTOCK</div>
          <div className="kpi-val good">{snapshot.bestBuy?.toFixed(2) || '—'}</div>
          <div className="kpi-sub good">
            {snapshot.bestBuy && snapshot.bestBuy < avPrice ? '✓ Below Av Price' : ''}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">PROFIT IF SOLD NOW</div>
          <div className="kpi-val" style={{ color: profitIfSold && profitIfSold > 0 ? 'var(--good)' : 'var(--bad)' }}>
            {profitIfSold != null ? `${profitIfSold > 0 ? '+' : ''}${profitIfSold} QAR` : '—'}
          </div>
          <div className="kpi-sub">{userStock.toLocaleString()} USDT @ market</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">TODAY HIGH SELL</div>
          <div className="kpi-val">{todaySummary?.highSell.toFixed(2) || '—'}</div>
          <div className="kpi-sub">
            Low {todaySummary?.lowSell?.toFixed(3) || '—'} · {todaySummary?.polls || 0} polls
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-lbl">TODAY LOW BUY</div>
          <div className="kpi-val bad">{todaySummary?.lowBuy?.toFixed(2) || '—'}</div>
          <div className="kpi-sub">High {todaySummary?.highBuy?.toFixed(2) || '—'}</div>
        </div>
      </div>

      {/* ── Price History + Position Advisor (2 col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* Price History — 24h only */}
        <div className="panel">
          <div className="panel-head">
            <h2>📊 Price History</h2>
            <span className="pill">{last24hHistory.length} pts · 24h</span>
          </div>
          <div className="panel-body">
            {/* SELL AVG bars */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>SELL AVG</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: 28 }}>
                  {priceBarData.map((pt, i) => {
                    const minS = Math.min(...priceBarData.map(p => p.sellAvg ?? 3.7));
                    const maxS = Math.max(...priceBarData.map(p => p.sellAvg ?? 3.85));
                    const range = maxS - minS || 0.01;
                    const h = 6 + ((pt.sellAvg ?? minS) - minS) / range * 22;
                    return <div key={i} style={{ flex: 1, minWidth: 2, height: h, background: 'var(--good)', borderRadius: 1, opacity: 0.8 }} />;
                  })}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--good)', minWidth: 40, textAlign: 'right' }}>
                  {snapshot.sellAvg?.toFixed(1)}
                </span>
              </div>
            </div>
            {/* BUY AVG bars */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>BUY AVG</div>
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
              <span className={`pill ${sellChange >= 0 ? 'good' : 'bad'}`}>
                Sell {sellChange >= 0 ? '+' : ''}{sellChange.toFixed(3)}
              </span>
              <span className={`pill ${buyChange >= 0 ? 'good' : 'bad'}`}>
                Buy {buyChange >= 0 ? '+' : ''}{buyChange.toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* Position Advisor */}
        <div className="panel">
          <div className="panel-head">
            <h2>🎯 Position Advisor</h2>
            <button className="btn" style={{ fontSize: 10, padding: '3px 10px' }}>Monitor</button>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ fontSize: 11 }}>Your Av Price</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{avPrice.toFixed(4)} QAR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ fontSize: 11 }}>Target ({targetMargin}% margin)</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--good)' }}>{targetPrice.toFixed(5)} QAR</span>
            </div>

            {isBelowTarget && (
              <div style={{ padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)', background: 'color-mix(in srgb, var(--warn) 8%, transparent)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--warn)' }}>⚠ Hold — below target</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Gap: {gap.toFixed(5)} · need {targetPrice.toFixed(5)}</div>
              </div>
            )}
            {!isBelowTarget && (
              <div style={{ padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)', background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--good)' }}>✓ Above target — sell opportunity</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Sell avg {sellAvg.toFixed(3)} &gt; target {targetPrice.toFixed(5)}</div>
              </div>
            )}
            {isGoodRestock && (
              <div style={{ padding: '8px 10px', borderRadius: 'var(--lt-radius-sm)', border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)', background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--good)' }}>✓ Good restock opportunity</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Buy avg {buyAvg.toFixed(3)} &lt; Av Price — improves cost base</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <button className="btn" style={{ justifyContent: 'center' }} onClick={() => { setCalcMode('sell'); setCalcRate(sellAvg.toFixed(2)); }}>
                Apply Sell Rate
              </button>
              <button className="btn secondary" style={{ justifyContent: 'center' }} onClick={() => { setCalcMode('buy'); setCalcRate(buyAvg.toFixed(2)); }}>
                Apply Buy Rate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sell Offers + Restock Offers (2 col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* Sell Offers */}
        <div className="panel">
          <div className="panel-head">
            <h2 style={{ color: 'var(--good)' }}>↑ Sell Offers</h2>
            <span className="pill good">Highest first · ✓ fits your stock</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>TRADER</th>
                    <th>PRICE</th>
                    <th>MIN</th>
                    <th>MAX</th>
                    <th>METHODS</th>
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
                            <span style={{ fontWeight: 800, color: 'var(--good)', fontSize: 12 }}>{o.price.toFixed(2)}</span>
                            <div style={{ width: 50, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                              <div style={{ width: `${depthPct}%`, height: '100%', background: 'var(--good)', borderRadius: 3 }} />
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

        {/* Restock Offers */}
        <div className="panel">
          <div className="panel-head">
            <h2 style={{ color: 'var(--bad)' }}>↓ Restock Offers</h2>
            <span className="pill bad">Cheapest first · ✓ fits your cash</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>TRADER</th>
                    <th>PRICE</th>
                    <th>MIN</th>
                    <th>MAX</th>
                    <th>METHODS</th>
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
                            <span style={{ fontWeight: 800, color: 'var(--bad)', fontSize: 12 }}>{o.price.toFixed(2)}</span>
                            <div style={{ width: 50, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                              <div style={{ width: `${100 - depthPct}%`, height: '100%', background: 'var(--bad)', borderRadius: 3 }} />
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
          <h2>🧮 Calculator</h2>
          <div className="modeToggle">
            <button className={calcMode === 'sell' ? 'active' : ''} onClick={() => { setCalcMode('sell'); setCalcRate(sellAvg.toFixed(2)); }}>Sell</button>
            <button className={calcMode === 'buy' ? 'active' : ''} onClick={() => { setCalcMode('buy'); setCalcRate(buyAvg.toFixed(2)); }}>Buy</button>
            <button className={calcMode === 'target' ? 'active' : ''} onClick={() => { setCalcMode('target'); setCalcRate(targetPrice.toFixed(4)); }}>Target</button>
          </div>
        </div>
        <div className="panel-body">
          <div className="g2tight" style={{ marginBottom: 8 }}>
            <div className="field2">
              <span className="lbl">Amount (USDT)</span>
              <div className="inputBox">
                <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} placeholder="1000" />
              </div>
            </div>
            <div className="field2">
              <span className="lbl">Rate (QAR)</span>
              <div className="inputBox">
                <input type="number" step="0.001" value={calcRate} onChange={e => setCalcRate(e.target.value)} placeholder="3.80" />
              </div>
            </div>
          </div>
          {calcResult && (
            <div className="bannerRow">
              <span className="bLbl">{calcMode === 'buy' ? 'Cost' : 'Revenue'}</span>
              <span className="bVal">{calcResult.qar.toFixed(2)} QAR</span>
              <span className="bSpacer" />
              <span className="bPill">@ {calcResult.rate.toFixed(3)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Historical Averages (collapsible) ── */}
      <div className="panel">
        <div className="panel-head" style={{ cursor: 'pointer' }} onClick={() => setShowHistory(!showHistory)}>
          <h2>📅 Historical Averages</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showHistory && (
              <div className="tracker-seg">
                <button className={historyRange === '7d' ? 'active' : ''} onClick={e => { e.stopPropagation(); setHistoryRange('7d'); }}>7D</button>
                <button className={historyRange === '15d' ? 'active' : ''} onClick={e => { e.stopPropagation(); setHistoryRange('15d'); }}>15D</button>
              </div>
            )}
            <span className="pill">{showHistory ? '▼' : '▶'} {filteredSummaries.length} days</span>
          </div>
        </div>
        {showHistory && (
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>SELL HIGH</th>
                    <th>SELL LOW</th>
                    <th>SELL AVG</th>
                    <th>BUY HIGH</th>
                    <th>BUY LOW</th>
                    <th>BUY AVG</th>
                    <th>SPREAD</th>
                    <th>POLLS</th>
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
                        <td className="mono r good">{d.highSell.toFixed(3)}</td>
                        <td className="mono r" style={{ color: 'color-mix(in srgb, var(--good) 60%, var(--muted))' }}>{d.lowSell?.toFixed(3) ?? '—'}</td>
                        <td className="mono r good" style={{ fontWeight: 800 }}>{avgSell.toFixed(3)}</td>
                        <td className="mono r bad">{d.highBuy.toFixed(3)}</td>
                        <td className="mono r" style={{ color: 'color-mix(in srgb, var(--bad) 60%, var(--muted))' }}>{d.lowBuy?.toFixed(3) ?? '—'}</td>
                        <td className="mono r bad" style={{ fontWeight: 800 }}>{avgBuy.toFixed(3)}</td>
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
