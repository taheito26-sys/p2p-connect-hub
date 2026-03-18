import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeRefresh } from '@/hooks/use-realtime';
import { DEAL_TYPE_CONFIGS } from '@/lib/deal-engine';
import {
  Loader2, Search, UserPlus, Check, X, RotateCcw, Mail, Users,
  ExternalLink, CheckSquare, MessageCircle, AlertCircle, Briefcase,
  DollarSign, ArrowRight, Clock, Send, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantSearchResult, MerchantInvite, MerchantRelationship, MerchantApproval, MerchantMessage, MerchantDeal } from '@/types/domain';

const inviteStatusColors: Record<string, string> = {
  pending: 'bg-destructive/15 text-destructive border-destructive/30',
  accepted: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};
const relStatusColors: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  restricted: 'bg-warning/15 text-warning border-warning/30',
  suspended: 'bg-destructive/15 text-destructive border-destructive/30',
  terminated: 'bg-muted text-muted-foreground',
};
const approvalStatusColors: Record<string, string> = {
  pending: 'bg-destructive/15 text-destructive border-destructive/30',
  approved: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};
const dealStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-success/15 text-success border-success/30',
  due: 'bg-warning/15 text-warning border-warning/30',
  settled: 'bg-primary/15 text-primary border-primary/30',
  closed: 'bg-secondary text-secondary-foreground',
  overdue: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground',
};

interface ConversationSummary {
  relationshipId: string;
  counterpartyName: string;
  counterpartyMerchantId: string;
  status: string;
  lastMessage: MerchantMessage | null;
  unreadCount: number;
  messages: MerchantMessage[];
}

export default function NetworkPage() {
  const { userId } = useAuth();
  const t = useT();
  const navigate = useNavigate();
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

  // Inbox state
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvoId, conversations]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length < 2) { toast.error(t('enterMin2Chars')); return; }
    try {
      const res = await api.merchant.search(query);
      setResults(res.results);
      setSearched(true);
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

  const sendMsg = async () => {
    if (!msgInput.trim() || !activeConvoId) return;
    try {
      await api.messages.send(activeConvoId, msgInput.trim());
      setMsgInput('');
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const pendingInvites = inbox.filter(i => i.status === 'pending').length;
  const pendingApprovals = aprInbox.filter(a => a.status === 'pending').length;
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);
  const overdueDeals = allDeals.filter(d => d.status === 'overdue');
  const activeDeals = allDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));
  const activeConvo = conversations.find(c => c.relationshipId === activeConvoId);

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <Breadcrumbs />

      <div className="px-6 pt-3 pb-4 border-b border-border">
        <h1 className="text-xl font-display font-bold">{t('networkTitle')}</h1>
        <p className="text-xs text-muted-foreground">{t('networkDesc')}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Command Center KPIs (clickable, color-coded) ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${pendingInvites > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}
            onClick={() => navigate('/invitations')}
          >
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {t('invitations')}</p>
              <p className={`text-xl font-bold mt-1 ${pendingInvites > 0 ? 'text-destructive' : ''}`}>{pendingInvites}</p>
              {pendingInvites > 0 && <p className="text-[10px] text-destructive font-medium">{t('actionNeeded')}</p>}
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${pendingApprovals > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}
            onClick={() => navigate('/approvals')}
          >
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><CheckSquare className="w-3 h-3" /> {t('approvals')}</p>
              <p className={`text-xl font-bold mt-1 ${pendingApprovals > 0 ? 'text-destructive' : ''}`}>{pendingApprovals}</p>
              {pendingApprovals > 0 && <p className="text-[10px] text-destructive font-medium">{t('actionNeeded')}</p>}
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${totalUnread > 0 ? 'border-primary/40 bg-primary/5' : ''}`}
            onClick={() => {
              const firstUnread = conversations.find(c => c.unreadCount > 0);
              if (firstUnread) setActiveConvoId(firstUnread.relationshipId);
            }}
          >
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {t('unread')}</p>
              <p className={`text-xl font-bold mt-1 ${totalUnread > 0 ? 'text-primary' : ''}`}>{totalUnread}</p>
              {totalUnread > 0 && <p className="text-[10px] text-primary font-medium">{t('newMessages')}</p>}
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => navigate('/deals')}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" /> {t('activeDeals')}</p>
              <p className="text-xl font-bold mt-1">{activeDeals.length}</p>
              {overdueDeals.length > 0 && <p className="text-[10px] text-destructive font-medium">{overdueDeals.length} {t('overdue')}</p>}
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => navigate('/relationships')}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {t('relationships')}</p>
              <p className="text-xl font-bold mt-1">{rels.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Relationships */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground">{t('relationships')}</h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder={t('findMerchant')} value={query} onChange={e => setQuery(e.target.value)} className="pl-8 h-8 text-xs w-48" />
              </div>
              <Button type="submit" size="sm" className="h-8 text-xs">{t('search')}</Button>
            </form>
          </div>

          {searched && results.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-muted-foreground">{t('searchResults')}</p>
              {results.map(r => (
                <Card key={r.id} className="glass hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{r.display_name}</p>
                        <Badge variant="outline" className="font-mono text-[10px]">{r.merchant_id}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">@{r.nickname} • {r.region}</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => openInviteDialog(r)}>
                      <UserPlus className="w-3 h-3" /> {t('invite')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {rels.length === 0 && !searched && (
            <Card className="glass"><CardContent className="py-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{t('noRelationshipsYet')}</p>
              <p className="text-xs mt-1">{t('searchToCollaborate')}</p>
            </CardContent></Card>
          )}
          <div className="space-y-2">
            {rels.map(rel => {
              const convo = conversations.find(c => c.relationshipId === rel.id);
              return (
                <Link key={rel.id} to={`/network/relationships/${rel.id}`}>
                  <Card className="glass hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{rel.counterparty?.display_name || 'Unknown'}</p>
                            <Badge className={relStatusColors[rel.status]}>{rel.status}</Badge>
                            <Badge variant="outline" className="font-mono text-[10px]">{rel.counterparty?.merchant_id}</Badge>
                            {convo && convo.unreadCount > 0 && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">{convo.unreadCount}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{t('role')}: {rel.my_role}</span>
                            <span>{rel.relationship_type}</span>
                            {rel.summary && (
                              <>
                                <span>{rel.summary.totalDeals} {t('dealsLabel')}</span>
                                <span>{t('exposure')}: ${rel.summary.activeExposure.toLocaleString()}</span>
                                {rel.summary.pendingApprovals > 0 && (
                                  <Badge className="bg-destructive/15 text-destructive text-[10px] px-1 py-0">{rel.summary.pendingApprovals} {t('pending')}</Badge>
                                )}
                              </>
                            )}
                          </div>
                          {convo?.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {convo.lastMessage.sender_user_id === userId ? `${t('you')}: ` : ''}{convo.lastMessage.body}
                            </p>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Activity: Invitations + Approvals + Deals */}
        <Tabs defaultValue="invitations">
          <TabsList className="flex-wrap">
            <TabsTrigger value="invitations" className="gap-1">
              {t('invitations')} {pendingInvites > 0 && <Badge className="bg-destructive/15 text-destructive text-[10px] px-1.5 py-0">{pendingInvites}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1">
              {t('approvals')} {pendingApprovals > 0 && <Badge className="bg-destructive/15 text-destructive text-[10px] px-1.5 py-0">{pendingApprovals}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-1">
              {t('dealsLabel')} {activeDeals.length > 0 && <Badge className="bg-primary/15 text-primary text-[10px] px-1.5 py-0">{activeDeals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {t('inbox')}
              {totalUnread > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">{totalUnread}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invitations" className="mt-3 space-y-2">
            {inbox.filter(i => i.status === 'pending').map(inv => (
              <Card key={inv.id} className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{inv.from_display_name}</p>
                      <Badge className={inviteStatusColors[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{inv.purpose} • {t('role')}: {inv.requested_role} • @{inv.from_nickname}</p>
                    {inv.message && <p className="text-xs text-muted-foreground italic mt-1">"{inv.message}"</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(inv.id)} className="gap-1 h-7 text-xs bg-success hover:bg-success/90 text-success-foreground"><Check className="w-3 h-3" /> {t('accept')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(inv.id)} className="gap-1 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"><X className="w-3 h-3" /> {t('reject')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {[...inbox.filter(i => i.status !== 'pending'), ...sent].map(inv => (
              <Card key={inv.id} className="glass">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{inv.from_display_name || `${t('sent')}: ${inv.to_display_name || inv.to_merchant_id}`}</p>
                      <Badge className={inviteStatusColors[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{inv.purpose || t('generalCollaboration')}</p>
                  </div>
                  {inv.status === 'pending' && (inv as any).to_merchant_id && (
                    <Button size="sm" variant="outline" onClick={() => handleWithdraw(inv.id)} className="gap-1 h-7 text-xs"><RotateCcw className="w-3 h-3" /> {t('withdraw')}</Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {inbox.length + sent.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">{t('noInvitations')}</div>
            )}
          </TabsContent>

          <TabsContent value="approvals" className="mt-3 space-y-2">
            {aprInbox.filter(a => a.status === 'pending').map(a => (
              <Card key={a.id} className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm capitalize">{a.type.replace(/_/g, ' ')}</p>
                      <Badge className={approvalStatusColors[a.status]}>{a.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t('target')}: {a.target_entity_type} • {new Date(a.submitted_at).toLocaleDateString()}</p>
                    {a.proposed_payload && Object.keys(a.proposed_payload).length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {Object.entries(a.proposed_payload).map(([k, v]) => (
                          <span key={k} className="mr-2">{k}: <span className="text-foreground">{String(v)}</span></span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1 h-7 text-xs bg-success hover:bg-success/90 text-success-foreground"><Check className="w-3 h-3" /> {t('approve')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectApproval(a.id)} className="gap-1 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"><X className="w-3 h-3" /> {t('reject')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {aprInbox.filter(a => a.status !== 'pending').map(a => (
              <Card key={a.id} className="glass">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm capitalize">{a.type.replace(/_/g, ' ')}</p>
                    <Badge className={approvalStatusColors[a.status]}>{a.status}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{new Date(a.submitted_at).toLocaleDateString()}{a.resolution_note && ` • ${a.resolution_note}`}</p>
                </CardContent>
              </Card>
            ))}
            {aprInbox.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">{t('noApprovals')}</div>
            )}
          </TabsContent>

          {/* ── Deals Tab with table view ── */}
          <TabsContent value="deals" className="mt-3">
            {allDeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">{t('noDeals')}</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{t('date')}</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{t('type')}</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{t('buyer')}</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{t('supplier')}</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">{t('amount')}</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{t('status')}</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">P&L</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDeals.map(deal => {
                      const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                      const custName = deal.metadata?.customer_name as string | undefined;
                      const suppName = deal.metadata?.supplier_name as string | undefined;
                      return (
                        <tr key={deal.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">{deal.issue_date}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{cfg?.icon || '📋'}</span>
                              <span className="text-xs font-medium">{cfg?.label || deal.deal_type}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs">{custName ? <span className="font-medium">👤 {custName}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs">{suppName ? <span className="font-medium">📦 {suppName}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-mono font-bold">${deal.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            <Badge className={`text-[10px] ${dealStatusColors[deal.status]}`}>{deal.status}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right font-mono">
                            {deal.realized_pnl != null && deal.realized_pnl !== 0 ? (
                              <span className={deal.realized_pnl >= 0 ? 'text-success font-bold' : 'text-destructive font-bold'}>
                                {deal.realized_pnl >= 0 ? '+' : ''}${deal.realized_pnl.toLocaleString()}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-6 px-2"
                              onClick={() => {
                                const rel = rels.find(r => r.id === deal.relationship_id);
                                if (rel) navigate(`/network/relationships/${rel.id}`);
                              }}
                            >
                              {t('viewInWorkspace')} →
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Inbox Tab ── */}
          <TabsContent value="inbox" className="mt-3">
            <Card className="glass overflow-hidden">
              <CardContent className="p-0">
                <div className="flex" style={{ minHeight: 380 }}>
                  {/* Conversation list */}
                  <div className={`border-r border-border overflow-y-auto ${activeConvoId ? 'hidden md:block' : ''}`} style={{ width: 300, minWidth: 260 }}>
                    {conversations.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm px-4">
                        <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <p>{t('noConversations')}</p>
                      </div>
                    )}
                    {conversations.map(convo => (
                      <button
                        key={convo.relationshipId}
                        className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors flex items-center gap-3 ${activeConvoId === convo.relationshipId ? 'bg-accent' : ''}`}
                        onClick={() => setActiveConvoId(convo.relationshipId)}
                      >
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          {convo.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center" style={{ width: 18, height: 18 }}>
                              {convo.unreadCount}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-medium text-sm truncate ${convo.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{convo.counterpartyName}</p>
                            {convo.lastMessage && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                {(() => {
                                  const d = new Date(convo.lastMessage.created_at);
                                  const now = new Date();
                                  const diffMs = now.getTime() - d.getTime();
                                  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
                                  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
                                  return d.toLocaleDateString();
                                })()}
                              </span>
                            )}
                          </div>
                          {convo.lastMessage ? (
                            <p className={`text-xs truncate mt-0.5 ${convo.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {convo.lastMessage.sender_user_id === userId ? `${t('you')}: ` : ''}{convo.lastMessage.body}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{t('noMessagesShort')}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Message pane */}
                  <div className={`flex-1 flex flex-col ${!activeConvoId ? 'hidden md:flex' : 'flex'}`}>
                    {!activeConvoId ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                        <div className="text-center">
                          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>{t('selectConversation')}</p>
                        </div>
                      </div>
                    ) : activeConvo ? (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
                          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setActiveConvoId(null)}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{activeConvo.counterpartyName}</p>
                            <p className="text-[10px] text-muted-foreground">{activeConvo.counterpartyMerchantId}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/network/relationships/${activeConvoId}`)}>
                            <ExternalLink className="w-3 h-3 mr-1" /> {t('viewInWorkspace')}
                          </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 300 }}>
                          {activeConvo.messages.length === 0 && (
                            <p className="text-center text-muted-foreground text-sm py-4">{t('noMessagesYet')}</p>
                          )}
                          {activeConvo.messages.map(msg => {
                            const isOwn = msg.sender_user_id === userId;
                            const isSystem = msg.message_type === 'system';
                            return (
                              <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                                  isSystem ? 'bg-muted text-muted-foreground text-center w-full text-xs italic rounded-lg'
                                    : isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-secondary text-secondary-foreground rounded-bl-md'
                                }`}>
                                  {!isSystem && !isOwn && <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.sender_name || msg.sender_merchant_id}</p>}
                                  <p>{msg.body}</p>
                                  <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>

                        <div className="border-t border-border p-3 flex gap-2 items-center">
                          <Input
                            placeholder={t('typeMessage')}
                            value={msgInput}
                            onChange={e => setMsgInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMsg()}
                            className="flex-1"
                          />
                          <Button onClick={sendMsg} size="icon" className="shrink-0 rounded-full">
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sendInviteTo')} {inviteTarget?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('purpose')}</Label>
              <Input placeholder={t('purposePlaceholder')} value={inviteForm.purpose} onChange={e => setInviteForm(f => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('requestedRole')}</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">{t('partner')}</SelectItem>
                  <SelectItem value="lender">{t('lender')}</SelectItem>
                  <SelectItem value="borrower">{t('borrower')}</SelectItem>
                  <SelectItem value="operator">{t('operator')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('messageOptional')}</Label>
              <Textarea placeholder={t('addANote')} value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSendInvite}>{t('sendInvite')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
