import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeRefresh } from '@/hooks/use-realtime';
import { DEAL_TYPE_CONFIGS } from '@/lib/deal-engine';
import {
  Loader2, Search, UserPlus, Check, X, RotateCcw, Mail, Users,
  ExternalLink, CheckSquare, MessageCircle, AlertCircle, Briefcase,
  DollarSign, ArrowRight, Clock, Send, ChevronLeft, Filter,
  ArrowUpRight, Circle, Zap, Bell, Hash, LayoutGrid, List,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantSearchResult, MerchantInvite, MerchantRelationship, MerchantApproval, MerchantMessage, MerchantDeal } from '@/types/domain';

/* ─── Status color maps ─── */
const inviteStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-500 border-red-500/30',
  withdrawn: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};
const relStatusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  restricted: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-500 border-red-500/30',
  terminated: 'bg-muted text-muted-foreground',
};
const dealStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  due: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  settled: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  closed: 'bg-muted text-muted-foreground',
  overdue: 'bg-red-500/15 text-red-500 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground',
};
const approvalStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-500 border-red-500/30',
};

/* ─── Types ─── */
interface ConversationSummary {
  relationshipId: string;
  counterpartyName: string;
  counterpartyMerchantId: string;
  status: string;
  lastMessage: MerchantMessage | null;
  unreadCount: number;
  messages: MerchantMessage[];
}

type MainView = 'activity' | 'chat' | 'deals';
type ActivityFilter = 'all' | 'invites' | 'approvals';

/* ─── Helpers ─── */
function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return 'now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
  if (diffMs < 604800000) return `${Math.floor(diffMs / 86400000)}d`;
  return d.toLocaleDateString();
}

/* ═══════════════════════════════════════════════════════════
   NETWORK PAGE — Unified Command Center
   ═══════════════════════════════════════════════════════════ */
export default function NetworkPage() {
  const { userId } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  /* ─── State ─── */
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MerchantSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [inbox, setInbox] = useState<MerchantInvite[]>([]);
  const [sent, setSent] = useState<MerchantInvite[]>([]);
  const [rels, setRels] = useState<MerchantRelationship[]>([]);
  const [aprInbox, setAprInbox] = useState<MerchantApproval[]>([]);
  const [allDeals, setAllDeals] = useState<MerchantDeal[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<MerchantSearchResult | null>(null);
  const [inviteForm, setInviteForm] = useState({ purpose: '', role: 'partner', message: '' });
  const [loading, setLoading] = useState(true);

  // View state
  const [mainView, setMainView] = useState<MainView>('activity');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ─── Data loading ─── */
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

      const convoPromises = relationships.map(async (rel) => {
        const { messages } = await api.messages.list(rel.id);
        const unread = messages.filter(m => !m.is_read && m.sender_user_id !== userId).length;
        return {
          relationshipId: rel.id,
          counterpartyName: rel.counterparty?.display_name || 'Unknown',
          counterpartyMerchantId: rel.counterparty?.merchant_id || '',
          status: rel.status,
          lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
          unreadCount: unread,
          messages,
        };
      });
      const convos = await Promise.all(convoPromises);
      convos.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return tb - ta;
      });
      setConversations(convos);
    } catch {
      toast.error(t('failedLoadNetwork'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  useRealtimeRefresh(reload, ['new_message', 'new_invite', 'invite_update', 'approval_update']);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeConvoId, conversations]);

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

  const openInviteDialog = (merchant: MerchantSearchResult) => {
    setInviteTarget(merchant);
    setInviteForm({ purpose: '', role: 'partner', message: '' });
    setInviteDialogOpen(true);
  };

  const handleSendInvite = async () => {
    if (!inviteTarget) return;
    try {
      await api.invites.send({
        to_merchant_id: inviteTarget.merchant_id,
        purpose: inviteForm.purpose || t('generalCollaboration'),
        requested_role: inviteForm.role,
        message: inviteForm.message,
      });
      toast.success(`${t('inviteSentTo')} ${inviteTarget.display_name}`);
      setInviteDialogOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAccept = async (id: string) => {
    try { await api.invites.accept(id); toast.success(t('inviteAccepted')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleReject = async (id: string) => {
    try { await api.invites.reject(id); toast.success(t('inviteRejected')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleWithdraw = async (id: string) => {
    try { await api.invites.withdraw(id); toast.success(t('inviteWithdrawn')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleApprove = async (id: string) => {
    try { await api.approvals.approve(id); toast.success(t('approved')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleRejectApproval = async (id: string) => {
    try { await api.approvals.reject(id); toast.success(t('rejected')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const markConvoRead = useCallback(async (relId: string) => {
    const convo = conversations.find(c => c.relationshipId === relId);
    if (!convo || convo.unreadCount === 0) return;
    try {
      const unreadMsgs = convo.messages.filter(m => !m.is_read && m.sender_user_id !== userId);
      await Promise.all(unreadMsgs.map(m => api.messages.markRead(m.id)));
      setConversations(prev => prev.map(c =>
        c.relationshipId === relId
          ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, is_read: true })) }
          : c
      ));
    } catch {}
  }, [conversations, userId]);

  const handleSelectConvo = useCallback((relId: string) => {
    setActiveConvoId(relId);
    setMainView('chat');
    markConvoRead(relId);
  }, [markConvoRead]);

  const sendMsg = async () => {
    if (!msgInput.trim() || !activeConvoId) return;
    try {
      await api.messages.send(activeConvoId, msgInput.trim());
      setMsgInput('');
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  /* ─── Derived data ─── */
  const pendingInvites = inbox.filter(i => i.status === 'pending');
  const pendingApprovals = aprInbox.filter(a => a.status === 'pending');
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);
  const overdueDeals = allDeals.filter(d => d.status === 'overdue');
  const activeDeals = allDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));
  const activeConvo = conversations.find(c => c.relationshipId === activeConvoId);

  const totalAlerts = pendingInvites.length + pendingApprovals.length + overdueDeals.length;

  /* ─── Loading ─── */
  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <Loader2 className="absolute -top-1 -right-1 w-4 h-4 animate-spin text-primary" />
        </div>
        <p className="text-xs text-muted-foreground">{t('networkTitle')}</p>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'} className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* ─── Top bar: Search + Stats + Quick actions ─── */}
      <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">{t('networkTitle')}</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{rels.length} {t('relationships')}</p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Inline stat pills */}
          <div className="hidden md:flex items-center gap-1.5">
            {totalAlerts > 0 && (
              <button
                onClick={() => setMainView('activity')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
              >
                <Bell className="w-3 h-3" />
                {totalAlerts} {t('actionNeeded')}
              </button>
            )}
            {totalUnread > 0 && (
              <button
                onClick={() => {
                  setMainView('chat');
                  const firstUnread = conversations.find(c => c.unreadCount > 0);
                  if (firstUnread) handleSelectConvo(firstUnread.relationshipId);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-medium hover:bg-blue-500/20 transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                {totalUnread} {t('unread')}
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px]">
              <Briefcase className="w-3 h-3" />
              {activeDeals.length} {t('activeDeals')}
            </div>
          </div>

          {/* Search trigger */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('findMerchant')}
              value={query}
              onChange={e => { setQuery(e.target.value); if (!e.target.value) { setSearched(false); setSearchOpen(false); } }}
              className="pl-8 h-8 text-xs w-44 md:w-56 rounded-lg"
            />
          </form>
        </div>

        {/* Search results dropdown */}
        {searched && searchOpen && results.length > 0 && (
          <div className="absolute right-4 top-14 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{results.length} {t('searchResults')}</p>
              <button onClick={() => { setSearchOpen(false); setSearched(false); setQuery(''); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
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
      </div>

      {/* ─── Main workspace: Sidebar + Content ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ LEFT SIDEBAR: Relationships + Conversations ═══ */}
        <aside className={`shrink-0 border-r border-border bg-muted/20 flex flex-col overflow-hidden transition-all duration-200 ${
          sidebarCollapsed ? 'w-0 md:w-14' : 'w-full md:w-72 lg:w-80'
        } ${mainView === 'chat' && activeConvoId ? 'hidden md:flex' : 'flex'}`}>

          {/* Sidebar header with view switcher */}
          <div className="shrink-0 px-3 py-2.5 border-b border-border/60 flex items-center gap-1.5">
            <button
              onClick={() => setMainView('activity')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mainView === 'activity' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span className="hidden md:inline">{t('invitations')}</span>
              {totalAlerts > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{totalAlerts}</span>}
            </button>
            <button
              onClick={() => setMainView('chat')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mainView === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <MessageCircle className="w-3 h-3" />
              <span className="hidden md:inline">{t('inbox')}</span>
              {totalUnread > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">{totalUnread}</span>}
            </button>
            <button
              onClick={() => setMainView('deals')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mainView === 'deals' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span className="hidden md:inline">{t('dealsLabel')}</span>
            </button>
          </div>

          {/* Sidebar content — always shows relationships + conversations */}
          <div className="flex-1 overflow-y-auto">
            {/* Relationships list */}
            <div className="px-2 pt-2 pb-1">
              <p className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{t('relationships')}</p>
            </div>

            {rels.length === 0 ? (
              <div className="text-center py-6 px-4">
                <Users className="w-6 h-6 mx-auto mb-2 opacity-30 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('noRelationshipsYet')}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t('searchToCollaborate')}</p>
              </div>
            ) : (
              <div className="px-2 space-y-0.5">
                {rels.map(rel => {
                  const convo = conversations.find(c => c.relationshipId === rel.id);
                  const isActive = activeConvoId === rel.id;
                  return (
                    <button
                      key={rel.id}
                      className={`w-full text-left rounded-lg px-2.5 py-2.5 transition-all group ${
                        isActive
                          ? 'bg-accent ring-1 ring-primary/20'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleSelectConvo(rel.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                          }`}>
                            {(rel.counterparty?.display_name || '?').charAt(0).toUpperCase()}
                          </div>
                          {/* Online/status dot */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                            rel.status === 'active' ? 'bg-emerald-500' : rel.status === 'restricted' ? 'bg-amber-500' : 'bg-muted-foreground'
                          }`} />
                          {/* Unread badge */}
                          {convo && convo.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">
                              {convo.unreadCount}
                            </div>
                          )}
                        </div>

                        {/* Name + details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-sm truncate ${convo?.unreadCount ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                              {rel.counterparty?.display_name || 'Unknown'}
                            </p>
                            {convo?.lastMessage && (
                              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(convo.lastMessage.created_at)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 rounded">{rel.my_role}</Badge>
                            {rel.summary && rel.summary.totalDeals > 0 && (
                              <span className="text-[10px] text-muted-foreground">{rel.summary.totalDeals} deals</span>
                            )}
                          </div>
                          {convo?.lastMessage && (
                            <p className={`text-[11px] truncate mt-0.5 ${convo.unreadCount ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {convo.lastMessage.sender_user_id === userId ? `${t('you')}: ` : ''}{convo.lastMessage.body}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">

          {/* ════════ ACTIVITY VIEW ════════ */}
          {mainView === 'activity' && (
            <div className="flex-1 overflow-y-auto">
              {/* Activity filter bar */}
              <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border/50 px-4 py-2 flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                {(['all', 'invites', 'approvals'] as ActivityFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setActivityFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activityFilter === f
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {f === 'all' ? t('invitations') + ' & ' + t('approvals') : f === 'invites' ? t('invitations') : t('approvals')}
                    {f === 'invites' && pendingInvites.length > 0 && (
                      <span className="ml-1 text-[9px] text-red-500">({pendingInvites.length})</span>
                    )}
                    {f === 'approvals' && pendingApprovals.length > 0 && (
                      <span className="ml-1 text-[9px] text-red-500">({pendingApprovals.length})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-3">
                {/* ── Pending Invites ── */}
                {(activityFilter === 'all' || activityFilter === 'invites') && pendingInvites.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {t('invitations')} — {t('actionNeeded')}
                    </p>
                    {pendingInvites.map(inv => (
                      <Card key={inv.id} className="border-amber-500/20 bg-amber-500/5 overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-stretch">
                            <div className="w-1 bg-amber-500 shrink-0" />
                            <div className="flex-1 flex items-center justify-between p-3 gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{inv.from_display_name}</p>
                                    <p className="text-[10px] text-muted-foreground">{inv.purpose} · {t('role')}: {inv.requested_role} · @{inv.from_nickname}</p>
                                  </div>
                                </div>
                                {inv.message && <p className="text-xs text-muted-foreground italic mt-1.5 ml-9">"{inv.message}"</p>}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" onClick={() => handleAccept(inv.id)} className="gap-1 h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                                  <Check className="w-3 h-3" /> {t('accept')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleReject(inv.id)} className="gap-1 h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* ── Pending Approvals ── */}
                {(activityFilter === 'all' || activityFilter === 'approvals') && pendingApprovals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <CheckSquare className="w-3 h-3" /> {t('approvals')} — {t('actionNeeded')}
                    </p>
                    {pendingApprovals.map(a => (
                      <Card key={a.id} className="border-amber-500/20 bg-amber-500/5 overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-stretch">
                            <div className="w-1 bg-amber-500 shrink-0" />
                            <div className="flex-1 flex items-center justify-between p-3 gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium capitalize">{a.type.replace(/_/g, ' ')}</p>
                                    <p className="text-[10px] text-muted-foreground">{t('target')}: {a.target_entity_type} · {new Date(a.submitted_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                {a.proposed_payload && Object.keys(a.proposed_payload).length > 0 && (
                                  <div className="mt-1.5 ml-9 flex flex-wrap gap-1.5">
                                    {Object.entries(a.proposed_payload).map(([k, v]) => (
                                      <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{k}: <span className="font-medium text-foreground">{String(v)}</span></span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1 h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
                                  <Check className="w-3 h-3" /> {t('approve')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleRejectApproval(a.id)} className="gap-1 h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* ── History (non-pending invites + sent + resolved approvals) ── */}
                {(activityFilter === 'all' || activityFilter === 'invites') && (
                  <>
                    {[...inbox.filter(i => i.status !== 'pending'), ...sent].length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2">{t('invitations')} — History</p>
                        {[...inbox.filter(i => i.status !== 'pending'), ...sent].map(inv => (
                          <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <p className="text-xs truncate">{inv.from_display_name || `${t('sent')}: ${inv.to_display_name || inv.to_merchant_id}`}</p>
                              <Badge variant="outline" className={`text-[9px] shrink-0 ${inviteStatusColors[inv.status]}`}>{inv.status}</Badge>
                            </div>
                            {inv.status === 'pending' && (inv as any).to_merchant_id && (
                              <Button size="sm" variant="ghost" onClick={() => handleWithdraw(inv.id)} className="gap-1 h-6 text-[10px] text-muted-foreground">
                                <RotateCcw className="w-3 h-3" /> {t('withdraw')}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {(activityFilter === 'all' || activityFilter === 'approvals') && (
                  <>
                    {aprInbox.filter(a => a.status !== 'pending').length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2">{t('approvals')} — History</p>
                        {aprInbox.filter(a => a.status !== 'pending').map(a => (
                          <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <p className="text-xs capitalize truncate">{a.type.replace(/_/g, ' ')}</p>
                              <Badge variant="outline" className={`text-[9px] shrink-0 ${approvalStatusColors[a.status]}`}>{a.status}</Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(a.submitted_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Empty state */}
                {pendingInvites.length === 0 && pendingApprovals.length === 0 &&
                  inbox.length + sent.length === 0 && aprInbox.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('noInvitations')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('searchToCollaborate')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ CHAT VIEW ════════ */}
          {mainView === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {!activeConvoId || !activeConvo ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('selectConversation')}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-border bg-muted/20">
                    <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-7 w-7" onClick={() => setActiveConvoId(null)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{activeConvo.counterpartyName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activeConvo.counterpartyName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{activeConvo.counterpartyMerchantId}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs h-7 rounded-lg gap-1" onClick={() => navigate(`/network/relationships/${activeConvoId}`)}>
                      {t('viewInWorkspace')} <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                    {activeConvo.messages.length === 0 && (
                      <p className="text-center text-muted-foreground text-xs py-8">{t('noMessagesYet')}</p>
                    )}
                    {activeConvo.messages.map(msg => {
                      const isOwn = msg.sender_user_id === userId;
                      const isSystem = msg.message_type === 'system';
                      return (
                        <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] px-3.5 py-2 text-sm ${
                            isSystem
                              ? 'bg-muted text-muted-foreground text-center w-full text-[11px] italic rounded-lg'
                              : isOwn
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                                : 'bg-muted rounded-2xl rounded-bl-md'
                          }`}>
                            {!isSystem && !isOwn && (
                              <p className="text-[10px] font-medium opacity-60 mb-0.5">{msg.sender_name || msg.sender_merchant_id}</p>
                            )}
                            <p className="leading-relaxed">{msg.body}</p>
                            <p className={`text-[9px] mt-1 ${isOwn ? 'text-primary-foreground/40' : 'text-muted-foreground/60'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message input */}
                  <div className="shrink-0 border-t border-border p-3">
                    <div className="flex gap-2 items-center bg-muted/40 rounded-xl px-3 py-1">
                      <Input
                        placeholder={t('typeMessage')}
                        value={msgInput}
                        onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMsg()}
                        className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 h-9 text-sm"
                      />
                      <Button onClick={sendMsg} size="icon" className="shrink-0 rounded-full h-8 w-8">
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════ DEALS VIEW ════════ */}
          {mainView === 'deals' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {/* Deals summary strip */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-bold leading-tight">{activeDeals.length}</p>
                      <p className="text-[10px] text-muted-foreground">{t('activeDeals')}</p>
                    </div>
                  </div>
                  {overdueDeals.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="text-lg font-bold leading-tight text-red-500">{overdueDeals.length}</p>
                        <p className="text-[10px] text-red-500">{t('overdue')}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-bold leading-tight">
                        ${allDeals.reduce((s, d) => s + d.amount, 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Total Volume</p>
                    </div>
                  </div>
                </div>

                {allDeals.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <Briefcase className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('noDeals')}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {allDeals.map(deal => {
                      const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                      const custName = deal.metadata?.customer_name as string | undefined;
                      const suppName = deal.metadata?.supplier_name as string | undefined;
                      const volume = deal.amount * (deal.expected_return || 1);
                      const net = deal.realized_pnl ?? 0;
                      const margin = volume > 0 ? (net / volume) * 100 : 0;
                      return (
                        <div
                          key={deal.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            const rel = rels.find(r => r.id === deal.relationship_id);
                            if (rel) navigate(`/network/relationships/${rel.id}`);
                          }}
                        >
                          {/* Deal type icon */}
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${
                            deal.status === 'overdue' ? 'bg-red-500/15' : deal.status === 'active' ? 'bg-emerald-500/10' : 'bg-muted'
                          }`}>
                            {cfg?.icon || '📋'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{cfg?.label || deal.deal_type}</p>
                              <Badge variant="outline" className={`text-[9px] shrink-0 ${dealStatusColors[deal.status]}`}>{deal.status}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {custName && <span>👤 {custName}</span>}
                              {custName && suppName && <span> → </span>}
                              {suppName && <span>📦 {suppName}</span>}
                              {!custName && !suppName && <span>{deal.issue_date || new Date(deal.created_at).toLocaleDateString()}</span>}
                            </p>
                          </div>

                          {/* Amount + P&L */}
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold font-mono">${deal.amount.toLocaleString()}</p>
                            {net !== 0 ? (
                              <p className={`text-[11px] font-mono font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {net >= 0 ? '+' : ''}${net.toLocaleString()} ({margin.toFixed(1)}%)
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Vol: ${volume.toLocaleString()}</p>
                            )}
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── Invite Dialog ─── */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-primary" />
              </div>
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
            <Button onClick={handleSendInvite} className="rounded-lg gap-1.5">
              <Send className="w-3.5 h-3.5" /> {t('sendInvite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
