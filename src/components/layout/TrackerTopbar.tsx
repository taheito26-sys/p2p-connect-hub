import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, Plus, Search } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import '@/styles/tracker.css';

const RANGE_OPTIONS = [
  { id: 'today', label: '1D' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' },
] as const;

function titleFromPath(pathname: string, t: ReturnType<typeof useT>) {
  if (pathname === '/dashboard') return { title: t('dashboardTitle'), subtitle: t('dashboardSub') };
  if (pathname === '/trading/orders') return { title: t('tradesTitle'), subtitle: t('tradesSub') };
  if (pathname === '/trading/stock') return { title: t('stockTitle'), subtitle: t('stockSub') };
  if (pathname === '/trading/calendar') return { title: t('calendarTitle'), subtitle: t('calendarSub') };
  if (pathname === '/crm') return { title: t('crmTitle'), subtitle: t('crmSub') };
  if (pathname === '/vault') return { title: t('vaultTitle'), subtitle: t('vaultSub') };
  if (pathname === '/settings') return { title: t('settingsTitle'), subtitle: t('settingsSub') };
  return { title: t('trackerTitle'), subtitle: t('trackerSub') };
}

export function TrackerTopbar() {
  const { settings, update } = useTheme();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();

  const [search, setSearch] = useState(settings.searchQuery || '');

  useEffect(() => {
    setSearch(settings.searchQuery || '');
  }, [settings.searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== settings.searchQuery) {
        update({ searchQuery: search });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [search, settings.searchQuery, update]);

  const meta = useMemo(() => titleFromPath(location.pathname, t), [location.pathname, t]);

  return (
    <header className="tracker-topbar" dir={t.isRTL ? 'rtl' : 'ltr'}>
      <div className="tracker-topbar-title-wrap">
        <div className="tracker-topbar-title">{meta.title}</div>
        <div className="tracker-topbar-sub">{meta.subtitle}</div>
      </div>

      <div className="tracker-topbar-controls">
        <label className="tracker-search" aria-label={t('search')}>
          <Search className="tracker-search-icon" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
          />
        </label>

        <div className="tracker-seg" role="group" aria-label={t('dateRange')}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={cn(settings.range === opt.id && 'active')}
              onClick={() => update({ range: opt.id })}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="tracker-seg" role="group" aria-label={t('currency')}>
          <button className={cn(settings.currency === 'QAR' && 'active')} onClick={() => update({ currency: 'QAR' })} type="button">QAR</button>
          <button className={cn(settings.currency === 'USDT' && 'active')} onClick={() => update({ currency: 'USDT' })} type="button">USDT</button>
        </div>

        <div className="tracker-seg" role="group" aria-label={t('language')}>
          <button className={cn(settings.language === 'ar' && 'active')} onClick={() => update({ language: 'ar' })} type="button">{t('arabic')}</button>
          <button className={cn(settings.language === 'en' && 'active')} onClick={() => update({ language: 'en' })} type="button">{t('english')}</button>
        </div>

        <div className="tracker-alert-box">
          <Bell className="tracker-alert-icon" />
          <input
            type="number"
            step="0.5"
            min={0}
            value={settings.priceAlertThreshold}
            onChange={(e) => update({ priceAlertThreshold: Number(e.target.value) || 0 })}
          />
          <span>%</span>
        </div>

        <button className="tracker-icon-btn" type="button" title={t('diagnostics')}>
          <Activity size={14} />
        </button>

        <span className="tracker-sync">{t('synced')}</span>

        <div className="tracker-user">
          <span className="tracker-user-avatar">{(profile?.display_name || 'U').charAt(0).toUpperCase()}</span>
          <div className="tracker-user-meta">
            <strong>{profile?.display_name || t('user')}</strong>
            <small>{profile?.merchant_id ? `${t('clientId')}: ${profile.merchant_id}` : `${t('clientId')}: N/A`}</small>
          </div>
          <button
            className="rounded-full p-1.5 border border-border/60 bg-background hover:bg-muted transition-colors"
            onClick={() => signOut()}
            title="Sign out"
            type="button"
          >
            <LogOut size={14} className="text-muted-foreground" />
          </button>
        </div>

        <button className="tracker-plus" type="button" onClick={() => navigate('/trading/orders')}>
          <Plus size={16} />
        </button>
      </div>
    </header>
  );
}



