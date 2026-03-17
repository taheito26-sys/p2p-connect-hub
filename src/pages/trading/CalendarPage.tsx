import { useMemo, useState } from 'react';
import { createDemoState } from '@/lib/tracker-demo-data';
import {
  fmtQ, fmtU, fmtP, fmtPct, fmtQWithUnit,
} from '@/lib/tracker-helpers';
import { useTheme } from '@/lib/theme-context';
import { useT } from '@/lib/i18n';
import '@/styles/tracker.css';

export default function CalendarPage() {
  const { settings } = useTheme();
  const t = useT();
  const { state, derived } = useMemo(() => createDemoState({
    lowStockThreshold: settings.lowStockThreshold,
    priceAlertThreshold: settings.priceAlertThreshold,
  }), [settings.lowStockThreshold, settings.priceAlertThreshold]);
  const [cal, setCal] = useState(state.cal);

  const mnKeys = ['january','february','march','april','may','june','july','august','september','october','november','december'] as const;
  const dnKeys = ['sun','mon','tue','wed','thu','fri','sat'] as const;
  const mn = mnKeys.map(k => t(k));
  const dn = dnKeys.map(k => t(k));

  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth(), curD = now.getDate();
  const { year, month, selectedDay } = cal;
  const daysInM = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // Build month data
  const mData: Record<number, { profit: number; trades: number; volumeQAR: number; wins: number; losses: number; marginSum: number; tradeList: any[] }> = {};
  for (let d = 1; d <= daysInM; d++) mData[d] = { profit: 0, trades: 0, volumeQAR: 0, wins: 0, losses: 0, marginSum: 0, tradeList: [] };

  for (const tr of state.trades.filter(tr => !tr.voided)) {
    const dt = new Date(tr.ts);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      const c = derived.tradeCalc.get(tr.id);
      const d2 = dt.getDate();
      if (c?.ok) {
        const rev = tr.amountUSDT * tr.sellPriceQAR;
        mData[d2].profit += c.netQAR;
        mData[d2].volumeQAR += rev;
        mData[d2].trades++;
        mData[d2].marginSum += Number.isFinite(c.margin) ? c.margin : 0;
        if (c.netQAR >= 0) {
          mData[d2].wins++;
        } else {
          mData[d2].losses++;
        }
        mData[d2].tradeList.push({ ...tr, net: c.netQAR, margin: c.margin, avgBuy: c.avgBuyQAR, rev });
      }
    }
  }

  const totalP = Object.values(mData).reduce((s, d) => s + d.profit, 0);
  const totalT = Object.values(mData).reduce((s, d) => s + d.trades, 0);
  const totalV = Object.values(mData).reduce((s, d) => s + d.volumeQAR, 0);
  const wins = Object.values(mData).reduce((s, d) => s + d.wins, 0);
  const tradeDays = Object.values(mData).filter(d => d.trades > 0).length;
  const bestDay = Object.entries(mData).filter(([, d]) => d.trades > 0).sort((a, b) => b[1].profit - a[1].profit)[0];
  const worstDay = Object.entries(mData).filter(([, d]) => d.trades > 0).sort((a, b) => a[1].profit - b[1].profit)[0];
  const avgMargin = totalT ? Object.values(mData).reduce((s, d) => s + d.marginSum, 0) / totalT : 0;
  const winRate = totalT ? (wins / totalT) : 0;

  const selData = selectedDay ? mData[selectedDay] : null;

  const prevMonth = () => {
    let y = year, m = month - 1;
    if (m < 0) { m = 11; y--; }
    setCal({ year: y, month: m, selectedDay: null });
  };
  const nextMonth = () => {
    let y = year, m = month + 1;
    if (m > 11) { m = 0; y++; }
    setCal({ year: y, month: m, selectedDay: null });
  };
  const goToday = () => setCal({ year: now.getFullYear(), month: now.getMonth(), selectedDay: null });
  const selectDay = (d: number) => setCal(prev => ({ ...prev, selectedDay: prev.selectedDay === d ? null : d }));

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
      {/* Stats */}
      <div className="cal-stats">
        <div className="cal-stat">
          <div className="kpi-lbl">{t('monthlyProfit')}</div>
          <div className={`kpi-val ${totalP >= 0 ? 'good' : 'bad'}`}>{(totalP >= 0 ? '+' : '') + fmtQ(totalP)}</div>
        </div>
        <div className="cal-stat">
          <div className="kpi-lbl">{t('totalTrades')}</div>
          <div className="kpi-val">{totalT}</div>
        </div>
        <div className="cal-stat">
          <div className="kpi-lbl">{t('tradingDays')}</div>
          <div className="kpi-val">
            {tradeDays}
            {bestDay && <span className="cycle-badge" style={{ marginLeft: 4 }}>{t('best')}: {mn[month].slice(0, 3)} {bestDay[0]}</span>}
            {worstDay && <span className="cycle-badge" style={{ marginLeft: 4 }}>{t('worst')}: {mn[month].slice(0, 3)} {worstDay[0]}</span>}
          </div>
        </div>
        <div className="cal-stat">
          <div className="kpi-lbl">{t('monthlyVolume')}</div>
          <div className="kpi-val">{fmtQWithUnit(totalV)}</div>
        </div>
        <div className="cal-stat">
          <div className="kpi-lbl">{t('winRate')}</div>
          <div className="kpi-val">{(winRate * 100).toFixed(0)}%</div>
        </div>
        <div className="cal-stat">
          <div className="kpi-lbl">{t('avgMargin')}</div>
          <div className="kpi-val">{fmtPct(avgMargin)}</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="panel">
        <div className="panel-head">
          <h2>{mn[month]} {year}</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn secondary" onClick={prevMonth}>{t('prev')}</button>
            <button className="btn secondary" onClick={goToday}>{t('today')}</button>
            <button className="btn secondary" onClick={nextMonth}>{t('next')}</button>
          </div>
        </div>
        <div className="panel-body">
          <div className="cal-grid">
            {dn.map(d => <div key={d} className="cal-hdr">{d}</div>)}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e-${i}`} className="cal-day empty-day" />
            ))}
            {Array.from({ length: daysInM }, (_, i) => {
              const d = i + 1;
              const data = mData[d];
              const hasP = data.profit > 0;
              const hasL = data.profit < 0;
              const isTdy = d === curD && year === curY && month === curM;
              const isSel = d === selectedDay;

              return (
                <div
                  key={d}
                  className={`cal-day${hasP ? ' has-profit' : hasL ? ' has-loss' : ''}${isTdy ? ' today' : ''}${isSel ? ' selected' : ''}`}
                  onClick={() => selectDay(d)}
                >
                  <div className="cal-num">{d}</div>
                  {data.trades > 0 && (
                    <>
                      <div className={`cal-profit ${hasP ? 'good' : 'bad'}`}>
                        {(data.profit >= 0 ? '+' : '') + fmtQ(data.profit)}
                      </div>
                      <div className="cal-count">{data.trades}t</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && selData && selData.trades > 0 && (
        <div className="cal-detail">
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
            📅 {mn[month]} {selectedDay}, {year} — {selData.trades} {t('trades')} · Vol {fmtQWithUnit(selData.volumeQAR)} · {t('net')} {(selData.profit >= 0 ? '+' : '') + fmtQ(selData.profit)} · {t('winRate')} {(selData.trades ? ((selData.wins / selData.trades) * 100).toFixed(0) : '0')}%
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t('time')}</th>
                  <th className="r">{t('qty')}</th>
                  <th className="r">{t('avgBuy')}</th>
                  <th className="r">{t('sell')}</th>
                  <th className="r">{t('volume')}</th>
                  <th className="r">{t('net')}</th>
                  <th className="r">{t('margin')}</th>
                </tr>
              </thead>
              <tbody>
                {selData.tradeList.map((tr: any) => (
                  <tr key={tr.id}>
                    <td className="mono">{new Date(tr.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="mono r">{fmtU(tr.amountUSDT)}</td>
                    <td className="mono r" style={{ color: 'var(--bad)' }}>{fmtP(tr.avgBuy)}</td>
                    <td className="mono r" style={{ color: 'var(--good)' }}>{fmtP(tr.sellPriceQAR)}</td>
                    <td className="mono r">{fmtQ(tr.rev)}</td>
                    <td className="mono r" style={{ color: tr.net >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>
                      {(tr.net >= 0 ? '+' : '') + fmtQ(tr.net)}
                    </td>
                    <td className="mono r" style={{ color: tr.margin >= 1 ? 'var(--good)' : tr.margin < 0 ? 'var(--bad)' : 'var(--warn)' }}>
                      {fmtPct(tr.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {selectedDay && selData && selData.trades === 0 && (
        <div className="cal-detail">
          <div className="muted" style={{ fontSize: 11, padding: '8px 0' }}>
            {t('noTradesOnDay')} {mn[month]} {selectedDay}. <button className="rowBtn">{t('logATrade')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
