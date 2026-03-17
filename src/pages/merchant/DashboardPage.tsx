import { useMemo } from 'react';
import { createDemoState } from '@/lib/tracker-demo-data';
import {
  fmtQWithUnit, fmtU, fmtQ, fmtPct, fmtP,
  kpiFor, totalStock, stockCostQAR, getWACOP,
  rangeLabel, num,
} from '@/lib/tracker-helpers';
import { useTheme } from '@/lib/theme-context';
import { useT } from '@/lib/i18n';
import '@/styles/tracker.css';

export default function DashboardPage() {
  const { settings } = useTheme();
  const t = useT();
  const { state, derived } = useMemo(() => createDemoState({
    lowStockThreshold: settings.lowStockThreshold,
    priceAlertThreshold: settings.priceAlertThreshold,
  }), [settings.lowStockThreshold, settings.priceAlertThreshold]);

  const d1 = kpiFor(state, derived, 'today');
  const d7 = kpiFor(state, derived, '7d');
  const dR = kpiFor(state, derived, state.range);
  const stk = totalStock(derived);
  const stCost = stockCostQAR(derived);
  const wacop = getWACOP(derived);
  const rLabel = rangeLabel(state.range);

  const allTrades = state.trades.filter(t => !t.voided);
  const allMargins = allTrades.map(t => {
    const c = derived.tradeCalc.get(t.id);
    return c?.ok ? c.margin : null;
  }).filter((x): x is number => x !== null);
  const avgM = allMargins.length ? allMargins.reduce((s, v) => s + v, 0) / allMargins.length : 0;

  const LOW = num(state.settings?.lowStockThreshold, 5000);
  const isLow = stk <= 0 || (LOW > 0 && stk < LOW);

  const p2pSellAvg: number | null = 3.82;

  const badgeStyle = (condition: string) => {
    const color = condition === 'good' ? 'var(--good)' : condition === 'bad' ? 'var(--bad)' : 'var(--warn)';
    return {
      color,
      borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
    };
  };

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
      {/* KPI Bands */}
      <div className="kpi-band-grid">
        <div className="kpi-band">
          <div className="kpi-band-title">{t('tradingVolume')}</div>
          <div className="kpi-band-cols">
            <div>
              <div className="kpi-period">{t('oneDay')}</div>
              <div className="kpi-cell-val t1v">{fmtQWithUnit(d1.rev)}</div>
              <div className="kpi-cell-sub">{d1.count} {t('trades')} · {fmtU(d1.qty, 0)} USDT</div>
            </div>
            <div>
              <div className="kpi-period">{t('sevenDays')}</div>
              <div className="kpi-cell-val t1v">{fmtQWithUnit(d7.rev)}</div>
              <div className="kpi-cell-sub">{d7.count} {t('trades')} · {fmtU(d7.qty, 0)} USDT</div>
            </div>
          </div>
        </div>
        <div className="kpi-band">
          <div className="kpi-band-title">{t('netProfit')}</div>
          <div className="kpi-band-cols">
            <div>
              <div className="kpi-period">{t('oneDay')}</div>
              <div className={`kpi-cell-val ${d1.net >= 0 ? 'good' : 'bad'}`}>{fmtQWithUnit(d1.net)}</div>
              <div className="kpi-cell-sub">{t('fees')} {fmtQWithUnit(d1.fee)}</div>
            </div>
            <div>
              <div className="kpi-period">{t('sevenDays')}</div>
              <div className={`kpi-cell-val ${d7.net >= 0 ? 'good' : 'bad'}`}>{fmtQWithUnit(d7.net)}</div>
              <div className="kpi-cell-sub">{t('fees')} {fmtQWithUnit(d7.fee)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="kpis">
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={badgeStyle(dR.net >= 0 ? 'good' : 'bad')}>{rLabel}</span>
          </div>
          <div className="kpi-lbl">{t('netProfitLabel')}</div>
          <div className={`kpi-val ${dR.net >= 0 ? 'good' : 'bad'}`}>{fmtQWithUnit(dR.net)}</div>
          <div className="kpi-sub">{dR.count} {t('trades')} · {fmtQ(dR.rev)} rev</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={badgeStyle(avgM >= 1 ? 'good' : avgM >= 0 ? 'warn' : 'bad')}>{allTrades.length} {t('trades')}</span>
          </div>
          <div className="kpi-lbl">{t('avgMargin')}</div>
          <div className={`kpi-val ${avgM >= 1 ? 'good' : avgM >= 0 ? 'warn' : 'bad'}`}>{fmtPct(avgM)}</div>
          <div className="kpi-sub">{dR.count} in range · avg {fmtPct(dR.avgMgn)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={badgeStyle(isLow ? 'bad' : 'good')}>{isLow ? t('low') : t('ok')}</span>
          </div>
          <div className="kpi-lbl">{t('availableUsdt')}</div>
          <div className={`kpi-val ${isLow ? 'bad' : 'good'}`} style={isLow ? { animation: 'tracker-blink 1.5s infinite' } : undefined}>{fmtU(stk, 0)}</div>
          <div className="kpi-sub">{t('liquidUsdt')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={{ color: 'var(--brand)', borderColor: 'color-mix(in srgb,var(--brand) 30%,transparent)', background: 'var(--brand3)' }}>{t('avPrice')}</span>
          </div>
          <div className="kpi-lbl">{t('avPriceSpread')}</div>
          <div className="kpi-val" style={{ fontSize: 16, color: 'var(--t2)' }}>{wacop ? fmtP(wacop) + ' QAR' : t('noStock')}</div>
          <div className="kpi-sub">
            {(() => {
              const sp = wacop && p2pSellAvg ? ((p2pSellAvg - wacop) / wacop * 100).toFixed(2) : null;
              return sp !== null
                ? <span className={Number(sp) >= 0 ? 'good' : 'bad'} style={{ fontWeight: 700 }}>{Number(sp) >= 0 ? '+' : ''}{sp}% vs P2P</span>
                : t('sellAboveAvPrice');
            })()}
          </div>
        </div>
      </div>

      {/* KPI Cards Row 2 — Cash Position */}
      <div className="kpis" style={{ marginTop: 0 }}>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={{ color: 'var(--warn)', borderColor: 'color-mix(in srgb,var(--warn) 30%,transparent)', background: 'color-mix(in srgb,var(--warn) 10%,transparent)' }}>{t('cash')}</span>
          </div>
          <div className="kpi-lbl">{t('cashAvailable')}</div>
          <div className="kpi-val" style={{ color: 'var(--warn)' }}>{fmtQWithUnit(num(state.cashQAR, 0))}</div>
          <div className="kpi-sub" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="rowBtn" style={{ fontSize: 9, padding: '3px 8px' }}>{t('manageCash')}</button>
            <span className="muted" style={{ fontSize: 10 }}>{state.cashOwner ? `${t('owner')}: ${state.cashOwner}` : `${t('owner')}: —`}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={{ color: 'var(--t5)', borderColor: 'color-mix(in srgb,var(--t5) 30%,transparent)', background: 'color-mix(in srgb,var(--t5) 10%,transparent)' }}>{wacop ? '@' + t('avPrice') : '—'}</span>
          </div>
          <div className="kpi-lbl">{t('buyingPower')}</div>
          <div className="kpi-val" style={{ color: 'var(--t5)' }}>
            {wacop && num(state.cashQAR, 0) > 0 ? fmtU(num(state.cashQAR, 0) / wacop, 0) + ' USDT' : t('setCash')}
          </div>
          <div className="kpi-sub">{wacop ? '@ ' + fmtP(wacop) + ' QAR' : t('addBatchesFirst')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge good" style={{ color: 'var(--good)', borderColor: 'color-mix(in srgb,var(--good) 30%,transparent)', background: 'color-mix(in srgb,var(--good) 10%,transparent)' }}>{t('net')}</span>
          </div>
          <div className="kpi-lbl">{t('netPosition')}</div>
          <div className="kpi-val good">{fmtQWithUnit(stCost + num(state.cashQAR, 0))}</div>
          <div className="kpi-sub">{t('stock')} {fmtQWithUnit(stCost)} + {t('cash')} {fmtQWithUnit(num(state.cashQAR, 0))}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-badge" style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}>{state.batches.length} {t('batch')}</span>
          </div>
          <div className="kpi-lbl">{t('stockCostEst')}</div>
          <div className="kpi-val" style={{ fontSize: 17 }}>{fmtQWithUnit(stCost)}</div>
          <div className="kpi-sub">{t('avPrice')} {wacop ? fmtP(wacop) + ' QAR' : '—'}</div>
        </div>
      </div>

      {/* Bottom panels */}
      <div className="dash-bottom">
        <div className="panel">
          <div className="panel-head"><h2>{t('profitRevenueTrend')}</h2><span className="pill">{t('last14Trades')}</span></div>
          <div className="panel-body" style={{ height: 190, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="muted" style={{ fontSize: 11 }}>{t('chartRendersLive')}</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>{t('periodStats')}</h2><span className="pill">{rLabel}</span></div>
          <div className="panel-body">
            <div className="prev-row"><span className="muted">{t('volume')}</span><strong className="mono t1v">{fmtQWithUnit(dR.rev)}</strong></div>
            <div className="prev-row"><span className="muted">{t('cost')}</span><strong className="mono">{fmtQWithUnit(dR.rev - dR.net - dR.fee)}</strong></div>
            <div className="prev-row"><span className="muted">{t('fees')}</span><strong className="mono">{fmtQWithUnit(dR.fee)}</strong></div>
            <div className="prev-row"><span className="muted">{t('netProfitLabel')}</span><strong className={`mono ${dR.net >= 0 ? 'good' : 'bad'}`}>{fmtQWithUnit(dR.net)}</strong></div>
            <div className="prev-row"><span className="muted">{t('avgMargin')}</span><strong className="mono" style={{ color: 'var(--t3)' }}>{fmtPct(dR.avgMgn)}</strong></div>
            <div className="prev-row"><span className="muted">{t('trades')}</span><strong className="mono">{dR.count}</strong></div>
          </div>
        </div>
      </div>

      {/* Chart panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="panel">
          <div className="panel-head"><h2>{t('netProfitPerTrade')}</h2><span className="pill muted">{t('allTime')}</span></div>
          <div className="panel-body" style={{ height: 170, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="muted" style={{ fontSize: 11 }}>{t('chartRendersLive')}</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>{t('dailyVolumeProfit')}</h2><span className="pill muted">{t('byDay')}</span></div>
          <div className="panel-body" style={{ height: 170, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="muted" style={{ fontSize: 11 }}>{t('chartRendersLive')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
