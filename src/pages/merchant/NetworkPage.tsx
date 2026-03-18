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
    <div dir={t.isRTL ? 'rtl' : 'ltr'} className="flex flex-col h-[calc(100vh-3.5rem)] border border-border/50 rounded-xl overflow-hidden bg-card mx-1 my-1">

      {/* ─── Top bar ─── */}
      <div className="shrink-0 flex items-center gap-2.5 px-3.5 h-12 border-b border-border bg-card">
        {/* Logo */}
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Users className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <div className="shrink-0">
          <h1 className="text-[13px] font-medium leading-tight">{t('networkTitle')}</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{rels.length} {t('relationships')}</p>
        </div>

        <div className="flex-1" />

        {/* Stat pills */}
        {totalAlerts > 0 && (
          <button
            onClick={() => setMainView('activity')}
            className="flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
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
            className="flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            {totalUnread} {t('unread')}
          </button>
        )}
        <span className="flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-secondary text-muted-foreground">
          <Briefcase className="w-3 h-3" />
          {activeDeals.length} {t('activeDeals')}
        </span>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-lg border border-border bg-secondary text-[12px] text-muted-foreground min-w-[160px]">
            <Search className="w-[13px] h-[13px] opacity-50 shrink-0" />
            <input
              placeholder={t('findMerchant')}
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

      {/* ─── Workspace ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ LEFT SIDEBAR ═══ */}
        <aside className={`shrink-0 border-r border-border bg-secondary flex flex-col overflow-hidden transition-all duration-200 ${
          sidebarCollapsed ? 'w-0 md:w-14' : 'w-full md:w-[260px]'
        } ${mainView === 'chat' && activeConvoId ? 'hidden md:flex' : 'flex'}`}>

          {/* View switcher nav */}
          <div className="shrink-0 flex items-center gap-1 px-2.5 py-2 border-b border-border">
            <button
              onClick={() => setMainView('activity')}
              className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-lg text-[11px] font-medium transition-colors ${
                mainView === 'activity' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="w-3 h-3" />
              {t('invitations')}
              {totalAlerts > 0 && <span className="w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-medium flex items-center justify-center ml-0.5">{totalAlerts}</span>}
            </button>
            <button
              onClick={() => setMainView('chat')}
              className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-lg text-[11px] font-medium transition-colors ${
                mainView === 'chat' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageCircle className="w-3 h-3" />
              {t('inbox')}
              {totalUnread > 0 && <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-medium flex items-center justify-center ml-0.5">{totalUnread}</span>}
            </button>
            <button
              onClick={() => setMainView('deals')}
              className={`flex items-center gap-[5px] px-2.5 py-[5px] rounded-lg text-[11px] font-medium transition-colors ${
                mainView === 'deals' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              {t('dealsLabel')}
            </button>
          </div>

          {/* Relationships label */}
          <div className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium px-3.5 pt-2.5 pb-1.5">
            {t('relationships')}
          </div>

          {/* Relationships list */}
          <div className="flex-1 overflow-y-auto">
            {rels.length === 0 ? (
              <div className="text-center py-6 px-4">
                <Users className="w-6 h-6 mx-auto mb-2 opacity-30 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('noRelationshipsYet')}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t('searchToCollaborate')}</p>
              </div>
            ) : (
              <div>
                {rels.map(rel => {
                  const convo = conversations.find(c => c.relationshipId === rel.id);
                  const isActive = activeConvoId === rel.id;
                  return (
                    <button
                      key={rel.id}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-b border-border transition-colors ${
                        isActive ? 'bg-card' : 'hover:bg-card'
                      }`}
                      onClick={() => handleSelectConvo(rel.id)}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-medium ${
                          isActive ? 'bg-foreground text-background' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {(rel.counterparty?.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                        {/* Status dot */}
                        <div className={`absolute -bottom-[1px] -right-[1px] w-2.5 h-2.5 rounded-full border-2 border-secondary ${
                          rel.status === 'active' ? 'bg-emerald-500' : rel.status === 'restricted' ? 'bg-amber-500' : 'bg-muted-foreground'
                        }`} />
                        {/* Unread badge */}
                        {convo && convo.unreadCount > 0 && (
                          <div className="absolute -top-[3px] -right-[3px] min-w-[15px] h-[15px] rounded-full bg-blue-600 text-white text-[9px] font-medium flex items-center justify-center px-0.5">
                            {convo.unreadCount}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[13px] font-medium">
                          <span className="truncate">{rel.counterparty?.display_name || 'Unknown'}</span>
                          {convo?.lastMessage && (
                            <span className="text-[11px] text-muted-foreground font-normal shrink-0">{timeAgo(convo.lastMessage.created_at)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-px rounded border border-border bg-card text-muted-foreground">{rel.my_role}</span>
                          {rel.summary && rel.summary.totalDeals > 0 && (
                            <span className="text-[11px] text-muted-foreground">{rel.summary.totalDeals} deals</span>
                          )}
                        </div>
                        {convo?.lastMessage ? (
                          <p className={`text-[12px] truncate mt-0.5 ${convo.unreadCount ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {convo.lastMessage.sender_user_id === userId ? `${t('you')}: ` : ''}{convo.lastMessage.body}
                          </p>
                        ) : (
                          <p className="text-[12px] text-muted-foreground italic truncate mt-0.5">{t('noMessagesYet')}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 flex flex-col overflow-hidden bg-card">

          {/* ════════ ACTIVITY VIEW ════════ */}
          {mainView === 'activity' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filter bar */}
              <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 border-b border-border sticky top-0 z-10 bg-card">
                <Filter className="w-[13px] h-[13px] text-muted-foreground shrink-0" />
                {(['all', 'invites', 'approvals'] as ActivityFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setActivityFilter(f)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                      activityFilter === f
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f === 'all' ? t('invitations') + ' & ' + t('approvals') : f === 'invites' ? t('invitations') : t('approvals')}
                    {f === 'invites' && pendingInvites.length > 0 && ` (${pendingInvites.length})`}
                    {f === 'approvals' && pendingApprovals.length > 0 && ` (${pendingApprovals.length})`}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                {/* Pending Invites */}
                {(activityFilter === 'all' || activityFilter === 'invites') && pendingInvites.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium flex items-center gap-1.5 mb-2">
                      <Mail className="w-3 h-3" /> {t('invitations')} — {t('actionNeeded')}
                    </p>
                    <div className="space-y-2">
                      {pendingInvites.map(inv => (
                        <div key={inv.id} className="flex rounded-lg overflow-hidden border border-amber-500/30">
                          <div className="w-[3px] bg-amber-600 shrink-0" />
                          <div className="flex-1 bg-amber-500/10 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-600/15 flex items-center justify-center shrink-0">
                                  <Mail className="w-3.5 h-3.5 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium truncate">{inv.from_display_name}</p>
                                  <p className="text-[11px] text-muted-foreground">{inv.purpose} · {t('role')}: {inv.requested_role} · @{inv.from_nickname}</p>
                                </div>
                              </div>
                              <div className="flex gap-[5px] shrink-0">
                                <button onClick={() => handleAccept(inv.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                                  <Check className="w-3 h-3" /> {t('accept')}
                                </button>
                                <button onClick={() => handleReject(inv.id)} className="flex items-center px-2 py-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {inv.message && (
                              <p className="text-[12px] text-muted-foreground italic mt-1 ml-[38px]">"{inv.message}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Approvals */}
                {(activityFilter === 'all' || activityFilter === 'approvals') && pendingApprovals.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium flex items-center gap-1.5 mb-2">
                      <CheckSquare className="w-3 h-3" /> {t('approvals')} — {t('actionNeeded')}
                    </p>
                    <div className="space-y-2">
                      {pendingApprovals.map(a => (
                        <div key={a.id} className="flex rounded-lg overflow-hidden border border-amber-500/30">
                          <div className="w-[3px] bg-amber-600 shrink-0" />
                          <div className="flex-1 bg-amber-500/10 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-600/15 flex items-center justify-center shrink-0">
                                  <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium capitalize">{a.type.replace(/_/g, ' ')}</p>
                                  <p className="text-[11px] text-muted-foreground">{t('target')}: {a.target_entity_type} · {new Date(a.submitted_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="flex gap-[5px] shrink-0">
                                <button onClick={() => handleApprove(a.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                                  <Check className="w-3 h-3" /> {t('approve')}
                                </button>
                                <button onClick={() => handleRejectApproval(a.id)} className="flex items-center px-2 py-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {a.proposed_payload && Object.keys(a.proposed_payload).length > 0 && (
                              <div className="mt-2 ml-[38px] flex flex-wrap gap-2">
                                {Object.entries(a.proposed_payload).map(([k, v]) => (
                                  <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-secondary">{k}: <span className="font-medium text-foreground">{String(v)}</span></span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* History — invites */}
                {(activityFilter === 'all' || activityFilter === 'invites') && (
                  <>
                    {[...inbox.filter(i => i.status !== 'pending'), ...sent].length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium mb-2">{t('invitations')} — History</p>
                        <div className="space-y-1">
                          {[...inbox.filter(i => i.status !== 'pending'), ...sent].map(inv => (
                            <div key={inv.id} className="flex items-center justify-between px-3 py-[7px] rounded-lg bg-secondary text-[12px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <Mail className="w-[13px] h-[13px] text-muted-foreground shrink-0" />
                                <span className="truncate">{inv.from_display_name || `${t('sent')}: ${inv.to_display_name || inv.to_merchant_id}`}</span>
                                <span className={`text-[10px] px-2 py-px rounded font-medium shrink-0 ${
                                  inv.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                                  inv.status === 'withdrawn' ? 'bg-secondary text-muted-foreground border border-border' :
                                  inviteStatusColors[inv.status]
                                }`}>{inv.status}</span>
                              </div>
                              {inv.status === 'pending' && (inv as any).to_merchant_id && (
                                <button onClick={() => handleWithdraw(inv.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                                  <RotateCcw className="w-3 h-3" /> {t('withdraw')}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* History — approvals */}
                {(activityFilter === 'all' || activityFilter === 'approvals') && (
                  <>
                    {aprInbox.filter(a => a.status !== 'pending').length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.8px] text-muted-foreground font-medium mb-2">{t('approvals')} — History</p>
                        <div className="space-y-1">
                          {aprInbox.filter(a => a.status !== 'pending').map(a => (
                            <div key={a.id} className="flex items-center justify-between px-3 py-[7px] rounded-lg bg-secondary text-[12px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckSquare className="w-[13px] h-[13px] text-muted-foreground shrink-0" />
                                <span className="capitalize truncate">{a.type.replace(/_/g, ' ')}</span>
                                <span className={`text-[10px] px-2 py-px rounded font-medium shrink-0 ${
                                  a.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                                  approvalStatusColors[a.status]
                                }`}>{a.status}</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {new Date(a.submitted_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Empty state */}
                {pendingInvites.length === 0 && pendingApprovals.length === 0 &&
                  inbox.length + sent.length === 0 && aprInbox.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
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
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('selectConversation')}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="shrink-0 flex items-center gap-2.5 px-3.5 h-11 border-b border-border">
                    <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-7 w-7" onClick={() => setActiveConvoId(null)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <span className="text-[12px] font-medium text-blue-600 dark:text-blue-400">{activeConvo.counterpartyName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{activeConvo.counterpartyName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{activeConvo.counterpartyMerchantId}</p>
                    </div>
                    <div className="flex-1" />
                    <button
                      onClick={() => navigate(`/network/relationships/${activeConvoId}`)}
                      className="flex items-center gap-1 text-[12px] text-muted-foreground hover:bg-secondary px-2 py-1 rounded-md transition-colors"
                    >
                      {t('viewInWorkspace')} <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-2">
                    {activeConvo.messages.length === 0 && (
                      <p className="text-center text-muted-foreground text-xs py-8">{t('noMessagesYet')}</p>
                    )}
                    {activeConvo.messages.map(msg => {
                      const isOwn = msg.sender_user_id === userId;
                      const isSystem = msg.message_type === 'system';
                      return (
                        <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[72%] px-3.5 py-2 text-[13px] leading-[1.5] ${
                            isSystem
                              ? 'bg-secondary text-muted-foreground text-center text-[11px] italic rounded-lg px-3.5 py-1 max-w-full'
                              : isOwn
                                ? 'bg-foreground text-background rounded-[14px_14px_4px_14px]'
                                : 'bg-secondary rounded-[14px_14px_14px_4px]'
                          }`}>
                            {!isSystem && !isOwn && (
                              <p className="text-[11px] text-muted-foreground mb-0.5">{msg.sender_name || msg.sender_merchant_id}</p>
                            )}
                            <p>{msg.body}</p>
                            <p className={`text-[10px] mt-[3px] ${isOwn ? 'opacity-[0.45]' : 'text-muted-foreground'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat input */}
                  <div className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 border-t border-border">
                    <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-full bg-secondary text-[13px] text-muted-foreground">
                      <input
                        placeholder={t('typeMessage')}
                        value={msgInput}
                        onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMsg()}
                        className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground text-[13px]"
                      />
                    </div>
                    <button
                      onClick={sendMsg}
                      className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════ DEALS VIEW ════════ */}
          {mainView === 'deals' && (
            <div className="flex-1 overflow-y-auto p-3.5">
              {/* Summary strip */}
              <div className="flex gap-2.5 mb-4">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium leading-none">{activeDeals.length}</p>
                    <p className="text-[11px] text-muted-foreground">{t('activeDeals')}</p>
                  </div>
                </div>
                {overdueDeals.length > 0 && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-destructive/10">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <div>
                      <p className="text-lg font-medium leading-none text-destructive">{overdueDeals.length}</p>
                      <p className="text-[11px] text-destructive">{t('overdue')}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium leading-none">
                      ${allDeals.reduce((s, d) => s + d.amount, 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Total Volume</p>
                  </div>
                </div>
              </div>

              {allDeals.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('noDeals')}</p>
                </div>
              ) : (
                <div className="space-y-0.5">
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
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] hover:bg-secondary transition-colors cursor-pointer group"
                        onClick={() => {
                          const rel = rels.find(r => r.id === deal.relationship_id);
                          if (rel) navigate(`/network/relationships/${rel.id}`);
                        }}
                      >
                        {/* Deal icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${
                          deal.status === 'overdue' ? 'bg-destructive/10' :
                          ['active', 'due'].includes(deal.status) ? 'bg-emerald-500/10' : 'bg-secondary'
                        }`}>
                          {cfg?.icon || '📋'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[13px] font-medium">
                            <span className="truncate">{cfg?.label || deal.deal_type}</span>
                            <span className={`text-[10px] px-2 py-px rounded font-medium shrink-0 ${
                              deal.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                              deal.status === 'due' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' :
                              deal.status === 'overdue' ? 'bg-destructive/10 text-destructive border border-destructive/30' :
                              deal.status === 'settled' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30' :
                              'bg-secondary text-muted-foreground border border-border'
                            }`}>{deal.status}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-px">
                            {custName && <span>👤 {custName}</span>}
                            {custName && suppName && <span> → </span>}
                            {suppName && <span>📦 {suppName}</span>}
                            {!custName && !suppName && <span>{deal.issue_date || new Date(deal.created_at).toLocaleDateString()}</span>}
                          </p>
                        </div>

                        {/* Amount + P&L */}
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-medium font-mono">${deal.amount.toLocaleString()}</p>
                          {net !== 0 ? (
                            <p className={`text-[11px] font-mono font-medium ${net >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              {net >= 0 ? '+' : ''}${net.toLocaleString()} ({margin.toFixed(1)}%)
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground font-mono">Vol: ${volume.toLocaleString()}</p>
                          )}
                        </div>

                        {/* Arrow (visible on hover) */}
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ─── Invite Dialog ─── */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-blue-600" />
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
