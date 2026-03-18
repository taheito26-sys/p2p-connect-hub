import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeRefresh } from '@/hooks/use-realtime';
import { DEAL_TYPE_CONFIGS } from '@/lib/deal-engine';
import {
  Loader2, Search, UserPlus, Check, X, RotateCcw, Mail, Users,
  CheckSquare, MessageCircle, AlertCircle, Briefcase,
  DollarSign, ArrowRight, ArrowUpRight, Send, Filter, Bell,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantSearchResult, MerchantInvite, MerchantRelationship, MerchantApproval, MerchantDeal } from '@/types/domain';

/* ─── Helpers ─── */
function dealStatusStyle(status: string) {
  switch (status) {
    case 'active': return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30';
    case 'due': return 'bg-amber-500/10 text-amber-600 border border-amber-500/30';
    case 'overdue': return 'bg-red-500/10 text-red-500 border border-red-500/30';
    case 'settled': return 'bg-blue-500/10 text-blue-600 border border-blue-500/30';
    default: return 'bg-muted text-muted-foreground border border-border';
  }
}

type DealFilter = 'all' | 'active' | 'due' | 'overdue' | 'settled';

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Deals Dashboard (no sidebar)
   Merchants = navigable chips → click opens workspace
   Deals = full-width table, the primary content
   Invitations/Approvals = bell dropdown (rare events)
   ═══════════════════════════════════════════════════════════ */
export default function NetworkPage() {
  const { userId } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MerchantSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inbox, setInbox] = useState<MerchantInvite[]>([]);
  const [sent, setSent] = useState<MerchantInvite[]>([]);
  const [rels, setRels] = useState<MerchantRelationship[]>([]);
  const [aprInbox, setAprInbox] = useState<MerchantApproval[]>([]);
  const [allDeals, setAllDeals] = useState<MerchantDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealFilter, setDealFilter] = useState<DealFilter>('all');
  const [bellOpen, setBellOpen] = useState(false);

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<MerchantSearchResult | null>(null);
  const [inviteForm, setInviteForm] = useState({ purpose: '', role: 'partner', message: '' });

  // Unread messages per relationship (lightweight — just counts, no full message load)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    try {
      const [
        { invites: inInbox }, { invites: outSent }, { relationships }, { approvals: aprIn }, { deals }
      ] = await Promise.all([
        api.invites.inbox(), api.invites.sent(), api.relationships.list(), api.approvals.inbox(), api.deals.list()
      ]);
      setInbox(inInbox);
      setSent(outSent);
      setRels(relationships);
      setAprInbox(aprIn);
      setAllDeals(deals);

      // Lightweight unread check per relationship
      const uMap: Record<string, number> = {};
      await Promise.all(relationships.map(async (rel) => {
        try {
          const { messages } = await api.messages.list(rel.id);
          uMap[rel.id] = messages.filter(m => !m.is_read && m.sender_user_id !== userId).length;
        } catch { uMap[rel.id] = 0; }
      }));
      setUnreadMap(uMap);
    } catch {
      toast.error(t('failedLoadNetwork'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  useRealtimeRefresh(reload, ['new_message', 'new_invite', 'invite_update', 'approval_update', 'deal_update']);

  /* ─── Handlers ─── */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length < 2) { toast.error(t('enterMin2Chars')); return; }
    try {
      const res = await api.merchant.search(query);
      setResults(res.results);
      setSearched(true);
      setSearchOpen(true);
    } catch (err: any) { toast.error(err.message); }
  };
  const openInviteDialog = (m: MerchantSearchResult) => { setInviteTarget(m); setInviteForm({ purpose: '', role: 'partner', message: '' }); setInviteDialogOpen(true); };
  const handleSendInvite = async () => {
    if (!inviteTarget) return;
    try {
      await api.invites.send({ to_merchant_id: inviteTarget.merchant_id, purpose: inviteForm.purpose || t('generalCollaboration'), requested_role: inviteForm.role, message: inviteForm.message });
      toast.success(`${t('inviteSentTo')} ${inviteTarget.display_name}`);
      setInviteDialogOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };
  const handleAcceptInvite = async (id: string) => { try { await api.invites.accept(id); toast.success(t('inviteAccepted')); await reload(); } catch (err: any) { toast.error(err.message); } };
  const handleRejectInvite = async (id: string) => { try { await api.invites.reject(id); toast.success(t('inviteRejected')); await reload(); } catch (err: any) { toast.error(err.message); } };
  const handleWithdraw = async (id: string) => { try { await api.invites.withdraw(id); toast.success(t('inviteWithdrawn')); await reload(); } catch (err: any) { toast.error(err.message); } };
  const handleApproveApproval = async (id: string) => { try { await api.approvals.approve(id); toast.success(t('approved')); await reload(); } catch (err: any) { toast.error(err.message); } };
  const handleRejectApproval = async (id: string) => { try { await api.approvals.reject(id); toast.success(t('rejected')); await reload(); } catch (err: any) { toast.error(err.message); } };

  /* ─── Derived ─── */
  const pendingInvites = inbox.filter(i => i.status === 'pending');
  const pendingApprovals = aprInbox.filter(a => a.status === 'pending');
  const totalAlerts = pendingInvites.length + pendingApprovals.length;
  const totalUnread = Object.values(unreadMap).reduce((s, n) => s + n, 0);
  const overdueDeals = allDeals.filter(d => d.status === 'overdue');
  const activeDeals = allDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));

  const filteredDeals = useMemo(() => {
    if (dealFilter === 'all') return allDeals;
    return allDeals.filter(d => d.status === dealFilter);
  }, [allDeals, dealFilter]);

  const summary = useMemo(() => {
    const vol = allDeals.reduce((s, d) => s + d.amount, 0);
    const pnl = allDeals.reduce((s, d) => s + (d.realized_pnl ?? 0), 0);
    return { vol, pnl, active: activeDeals.length, overdue: overdueDeals.length };
  }, [allDeals, activeDeals, overdueDeals]);

  // Lookup: deal → relationship → counterparty name
  const relMap = useMemo(() => {
    const m: Record<string, MerchantRelationship> = {};
    rels.forEach(r => { m[r.id] = r; });
    return m;
  }, [rels]);

  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Briefcase className="w-5 h-5 text-primary" /></div>
          <Loader2 className="absolute -top-1 -right-1 w-4 h-4 animate-spin text-primary" />
        </div>
        <p className="text-xs text-muted-foreground">{t('networkTitle')}</p>
      </div>
    </div>
  );

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'} className="flex flex-col h-[calc(100vh-3.5rem)] border border-border/50 rounded-xl overflow-hidden bg-card mx-1 my-1">

      {/* ─── TOP BAR ─── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 h-12 border-b border-border bg-card">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Briefcase className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <div className="shrink-0">
          <h1 className="text-[13px] font-medium leading-tight">{t('networkTitle')}</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{rels.length} partners · {allDeals.length} deals</p>
        </div>
        <div className="flex-1" />

        {/* Merchant chips — each is a link to workspace */}
        <div className="flex items-center gap-1.5">
          {rels.map(rel => {
            const name = rel.counterparty?.display_name || 'Unknown';
            const hasUnread = (unreadMap[rel.id] || 0) > 0;
            return (
              <button
                key={rel.id}
                onClick={() => navigate(`/network/relationships/${rel.id}`)}
                className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all relative group"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[11px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-medium">{name}</span>
                <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                {hasUnread && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 border border-card" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bell — invitations + approvals */}
        <div className="relative">
          <button
            onClick={() => setBellOpen(!bellOpen)}
            className="relative w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
          >
            <Bell className="w-4 h-4" />
            {totalAlerts > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-white text-[9px] font-medium flex items-center justify-center px-0.5">{totalAlerts}</div>
            )}
          </button>

          {/* Bell dropdown */}
          {bellOpen && (
            <div className="absolute right-0 top-10 w-96 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-medium">Pending actions</p>
                <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="px-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{inv.from_display_name}</p>
                          <p className="text-[11px] text-muted-foreground">{inv.purpose} · {inv.requested_role}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { handleAcceptInvite(inv.id); setBellOpen(false); }} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"><Check className="w-3 h-3" /></button>
                        <button onClick={() => { handleRejectInvite(inv.id); setBellOpen(false); }} className="px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Group approvals by deal — show one consolidated entry per deal */}
                {(() => {
                  const dealGroups = new Map<string, MerchantApproval[]>();
                  const standalone: MerchantApproval[] = [];
                  pendingApprovals.forEach(a => {
                    const dealId = a.target_entity_type === 'deal' && a.target_entity_id ? a.target_entity_id : null;
                    if (dealId) {
                      if (!dealGroups.has(dealId)) dealGroups.set(dealId, []);
                      dealGroups.get(dealId)!.push(a);
                    } else {
                      standalone.push(a);
                    }
                  });
                  const entries: React.ReactNode[] = [];
                  dealGroups.forEach((group, dealId) => {
                    const primary = group[0];
                    const deal = allDeals.find(d => d.id === dealId);
                    const rel = deal ? rels.find(r => r.id === deal.relationship_id) : null;
                    const cfg = deal ? DEAL_TYPE_CONFIGS[deal.deal_type] : null;
                    const label = deal
                      ? `${cfg?.label || deal.deal_type} · ${rel?.counterparty?.display_name || ''}`
                      : primary.type.replace(/_/g, ' ');
                    const details = group.map(a => {
                      const t = a.type.replace(/_/g, ' ');
                      const amt = a.proposed_payload?.amount;
                      return amt != null ? `${t} · $${Number(amt).toLocaleString()}` : t;
                    });
                    entries.push(
                      <div key={`deal-${dealId}`} className="px-3 py-2.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium truncate">{label}</p>
                              {details.map((d, i) => (
                                <p key={i} className="text-[11px] text-muted-foreground">⚠ {d}</p>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={async () => { for (const a of group) await handleApproveApproval(a.id); setBellOpen(false); }} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"><Check className="w-3 h-3" /></button>
                            <button onClick={async () => { for (const a of group) await handleRejectApproval(a.id); setBellOpen(false); }} className="px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                  standalone.forEach(a => {
                    entries.push(
                      <div key={a.id} className="px-3 py-2.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium capitalize truncate">{a.type.replace(/_/g, ' ')}</p>
                              <p className="text-[11px] text-muted-foreground">{a.target_entity_type} · {new Date(a.submitted_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { handleApproveApproval(a.id); setBellOpen(false); }} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"><Check className="w-3 h-3" /></button>
                            <button onClick={() => { handleRejectApproval(a.id); setBellOpen(false); }} className="px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                  return entries;
                })()}
                {totalAlerts === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">No pending actions</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search / Add partner */}
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-border bg-secondary text-[12px] text-muted-foreground min-w-[150px]">
            <Search className="w-[13px] h-[13px] opacity-50 shrink-0" />
            <input
              placeholder="Add partner..."
              value={query}
              onChange={e => { setQuery(e.target.value); if (!e.target.value) { setSearched(false); setSearchOpen(false); } }}
              className="bg-transparent border-0 outline-none w-full text-foreground placeholder:text-muted-foreground text-[12px]"
            />
          </div>
        </form>
      </div>

      {/* Search results dropdown */}
      {searched && searchOpen && results.length > 0 && (
        <div className="absolute right-4 top-14 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{results.length} {t('searchResults')}</p>
            <button onClick={() => { setSearchOpen(false); setSearched(false); setQuery(''); }} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">@{r.nickname} · {r.region} · <span className="font-mono">{r.merchant_id}</span></p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1 h-7 text-xs rounded-lg ml-2" onClick={() => { openInviteDialog(r); setSearchOpen(false); }}>
                  <UserPlus className="w-3 h-3" /> {t('invite')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── KPI STRIP ─── */}
      <div className="shrink-0 grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-border">
        <div className="px-3 py-2 rounded-lg bg-secondary">
          <p className="text-[11px] text-muted-foreground">{t('activeDeals')}</p>
          <p className="text-xl font-medium leading-tight mt-0.5">{summary.active}</p>
        </div>
        {summary.overdue > 0 ? (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 cursor-pointer hover:bg-red-500/15 transition-colors" onClick={() => setDealFilter('overdue')}>
            <p className="text-[11px] text-red-500">{t('overdue')}</p>
            <p className="text-xl font-medium leading-tight mt-0.5 text-red-500">{summary.overdue}</p>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-secondary">
            <p className="text-[11px] text-muted-foreground">{t('overdue')}</p>
            <p className="text-xl font-medium leading-tight mt-0.5">0</p>
          </div>
        )}
        <div className="px-3 py-2 rounded-lg bg-secondary">
          <p className="text-[11px] text-muted-foreground">Volume</p>
          <p className="text-xl font-medium leading-tight mt-0.5 font-mono">${summary.vol.toLocaleString()}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-secondary">
          <p className="text-[11px] text-muted-foreground">Net P&L</p>
          <p className={`text-xl font-medium leading-tight mt-0.5 font-mono ${summary.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {summary.pnl >= 0 ? '+' : ''}${summary.pnl.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-border">
        <Filter className="w-[13px] h-[13px] text-muted-foreground shrink-0" />
        {(['all', 'active', 'due', 'overdue', 'settled'] as DealFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDealFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors capitalize ${
              dealFilter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? `All (${allDeals.length})` : `${f} (${allDeals.filter(d => d.status === f).length})`}
          </button>
        ))}
      </div>

      {/* ─── DEALS TABLE (full width, the main content) ─── */}
      <div className="flex-1 overflow-y-auto">
        {filteredDeals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('noDeals')}</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary sticky top-0 z-[1]">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Deal</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Merchant</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dates</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">P&L</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map(deal => {
                const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                const rel = relMap[deal.relationship_id];
                const cpName = rel?.counterparty?.display_name || '—';
                const net = deal.realized_pnl ?? 0;
                const isUrgent = deal.status === 'overdue' || deal.status === 'due';
                return (
                  <tr
                    key={deal.id}
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer relative group"
                    onClick={() => rel && navigate(`/network/relationships/${rel.id}`)}
                  >
                    {/* Accent bar */}
                    {deal.status === 'overdue' && <td className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 rounded-r-sm p-0" />}
                    {deal.status === 'due' && <td className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500 rounded-r-sm p-0" />}

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0 ${
                          deal.status === 'overdue' ? 'bg-red-500/10' :
                          ['active', 'due'].includes(deal.status) ? 'bg-emerald-500/10' : 'bg-secondary'
                        }`}>
                          {cfg?.icon || '📋'}
                        </div>
                        <div>
                          <p className="font-medium">{cfg?.label || deal.deal_type}</p>
                          <p className="text-[11px] text-muted-foreground">{deal.title || deal.id.slice(0, 12)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                          {cpName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{cpName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${dealStatusStyle(deal.status)}`}>{deal.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">
                      {deal.issue_date}{deal.due_date ? ` → ${deal.due_date}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">${deal.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {net !== 0 ? (
                        <span className={net >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                          {net >= 0 ? '+' : ''}${net.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── INVITE DIALOG ─── */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><UserPlus className="w-4 h-4 text-blue-600" /></div>
              {t('sendInviteTo')} {inviteTarget?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('purpose')}</Label>
              <Input placeholder={t('purposePlaceholder')} value={inviteForm.purpose} onChange={e => setInviteForm(f => ({ ...f, purpose: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('requestedRole')}</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">{t('partner')}</SelectItem>
                  <SelectItem value="lender">{t('lender')}</SelectItem>
                  <SelectItem value="borrower">{t('borrower')}</SelectItem>
                  <SelectItem value="operator">{t('operator')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('messageOptional')}</Label>
              <Textarea placeholder={t('addANote')} value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} rows={3} className="rounded-lg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="rounded-lg">{t('cancel')}</Button>
            <Button onClick={handleSendInvite} className="rounded-lg gap-1.5"><Send className="w-3.5 h-3.5" /> {t('sendInvite')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
