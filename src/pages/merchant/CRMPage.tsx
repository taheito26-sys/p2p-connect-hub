import { useMemo, useState } from 'react';
import { createDemoState } from '@/lib/tracker-demo-data';
import { fmtU, fmtDate } from '@/lib/tracker-helpers';
import { useTheme } from '@/lib/theme-context';
import { useT } from '@/lib/i18n';
import '@/styles/tracker.css';

export default function CRMPage() {
  const { settings } = useTheme();
  const t = useT();
  const { state } = useMemo(() => createDemoState({
    lowStockThreshold: settings.lowStockThreshold,
    priceAlertThreshold: settings.priceAlertThreshold,
  }), [settings.lowStockThreshold, settings.priceAlertThreshold]);
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers');
  const [search, setSearch] = useState('');

  const customers = state.customers;
  const filteredCustomers = !search
    ? customers
    : customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const supplierMap = new Map<string, { name: string; batchCount: number; totalUSDT: number; lastDate: number }>();
  for (const b of state.batches) {
    const src = b.source.trim();
    if (!src) continue;
    const existing = supplierMap.get(src);
    if (existing) {
      existing.batchCount++;
      existing.totalUSDT += b.initialUSDT;
      existing.lastDate = Math.max(existing.lastDate, b.ts);
    } else {
      supplierMap.set(src, { name: src, batchCount: 1, totalUSDT: b.initialUSDT, lastDate: b.ts });
    }
  }
  const suppliers = Array.from(supplierMap.values()).sort((a, b) => b.lastDate - a.lastDate);
  const filteredSuppliers = !search
    ? suppliers
    : suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const customerStats = (cId: string) => {
    const trades = state.trades.filter(tr => !tr.voided && tr.customerId === cId);
    const totalUSDT = trades.reduce((s, tr) => s + tr.amountUSDT, 0);
    const totalQAR = trades.reduce((s, tr) => s + tr.amountUSDT * tr.sellPriceQAR, 0);
    return { trades: trades.length, totalUSDT, totalQAR };
  };

  return (
    <div className="tracker-root" dir={t.isRTL ? 'rtl' : 'ltr'} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
      {/* Tab toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`btn ${tab === 'customers' ? '' : 'secondary'}`}
            onClick={() => setTab('customers')}
          >
            👥 {t('customers')} ({customers.length})
          </button>
          <button
            className={`btn ${tab === 'suppliers' ? '' : 'secondary'}`}
            onClick={() => setTab('suppliers')}
          >
            📦 {t('suppliers')} ({suppliers.length})
          </button>
        </div>
        <div className="inputBox" style={{ maxWidth: 260, padding: '6px 10px' }}>
          <input
            placeholder={tab === 'customers' ? t('searchCustomers') : t('searchSuppliers')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── CUSTOMERS TAB ── */}
      {tab === 'customers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t('customers')}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('buyerManagement')}</div>
            </div>
            <button className="btn">{t('addCustomer')}</button>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="empty">
              <div className="empty-t">{t('noCustomersFound')}</div>
              <div className="empty-s">{t('addFirstBuyer')}</div>
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('phone')}</th>
                    <th>{t('tier')}</th>
                    <th className="r">{t('dailyLimit')}</th>
                    <th className="r">{t('trades')}</th>
                    <th className="r">{t('totalUsdt')}</th>
                    <th className="r">{t('totalQar')}</th>
                    <th>{t('notes')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(c => {
                    const s = customerStats(c.id);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td className="mono">{c.phone || '—'}</td>
                        <td>
                          <span className={`pill ${c.tier === 'A' ? 'good' : c.tier === 'B' ? 'warn' : ''}`}>
                            {c.tier}
                          </span>
                        </td>
                        <td className="mono r">{fmtU(c.dailyLimitUSDT, 0)}</td>
                        <td className="mono r">{s.trades}</td>
                        <td className="mono r">{fmtU(s.totalUSDT, 0)}</td>
                        <td className="mono r">{fmtU(s.totalQAR, 0)}</td>
                        <td style={{ fontSize: 10, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="rowBtn">{t('edit')}</button>
                            <button className="rowBtn">{t('history')}</button>
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

      {/* ── SUPPLIERS TAB ── */}
      {tab === 'suppliers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t('suppliers')}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('autoTrackedFromBatches')}</div>
            </div>
            <button className="btn">{t('addSupplier')}</button>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="empty">
              <div className="empty-t">{t('noSuppliersFound')}</div>
              <div className="empty-s">{t('addBatchesToTrack')}</div>
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('supplier')}</th>
                    <th className="r">{t('batches')}</th>
                    <th className="r">{t('totalUsdt')}</th>
                    <th>{t('lastPurchase')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map(s => (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td className="mono r">{s.batchCount}</td>
                      <td className="mono r">{fmtU(s.totalUSDT, 0)}</td>
                      <td className="mono">{fmtDate(s.lastDate)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="rowBtn">{t('viewBatches')}</button>
                          <button className="rowBtn">{t('edit')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
