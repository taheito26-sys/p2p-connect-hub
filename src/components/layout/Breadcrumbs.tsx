import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface Crumb {
  label: string;
  path?: string;
}

function pathToCrumbs(pathname: string, counterpartyName?: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Home', path: '/dashboard' }];

  if (pathname.startsWith('/network')) {
    crumbs.push({ label: 'Network', path: '/network' });

    if (pathname.includes('/relationships/')) {
      crumbs.push({ label: counterpartyName || 'Workspace' });
    }
  } else if (pathname.startsWith('/trading')) {
    crumbs.push({ label: 'Trading' });
    if (pathname.includes('/orders')) crumbs.push({ label: 'Orders' });
    if (pathname.includes('/stock')) crumbs.push({ label: 'Stock' });
    if (pathname.includes('/calendar')) crumbs.push({ label: 'Calendar' });
    if (pathname.includes('/p2p')) crumbs.push({ label: 'P2P Tracker' });
  } else if (pathname === '/deals') {
    crumbs.push({ label: 'Deals' });
  } else if (pathname === '/analytics') {
    crumbs.push({ label: 'Analytics' });
  } else if (pathname === '/vault') {
    crumbs.push({ label: 'Vault' });
  } else if (pathname === '/audit') {
    crumbs.push({ label: 'Audit' });
  } else if (pathname === '/settings') {
    crumbs.push({ label: 'Settings' });
  } else if (pathname === '/notifications') {
    crumbs.push({ label: 'Notifications' });
  } else if (pathname === '/crm') {
    crumbs.push({ label: 'CRM' });
  }

  return crumbs;
}

interface Props {
  counterpartyName?: string;
}

export function Breadcrumbs({ counterpartyName }: Props) {
  const location = useLocation();
  const crumbs = pathToCrumbs(location.pathname, counterpartyName);

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground px-6 pt-3 pb-1">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3" />}
          {crumb.path && i < crumbs.length - 1 ? (
            <Link to={crumb.path} className="hover:text-foreground transition-colors">
              {i === 0 ? <Home className="w-3 h-3" /> : crumb.label}
            </Link>
          ) : (
            <span className={i === crumbs.length - 1 ? 'text-foreground font-medium' : ''}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
