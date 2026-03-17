import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  DollarSign, ArrowRight, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantSearchResult, MerchantInvite, MerchantRelationship, MerchantApproval, MerchantMessage, MerchantDeal } from '@/types/domain';

const inviteStatusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  accepted: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  withdrawn: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};
const relStatusColors: Record<string, string> = {
  active: 'bg-success text-success-foreground',
  restricted: 'bg-warning text-warning-foreground',
  suspended: 'bg-destructive text-destructive-foreground',
  terminated: 'bg-muted text-muted-foreground',
};
const approvalStatusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  approved: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
};

interface ConversationSummary {
  relationshipId: string;
  counterpartyName: string;
  counterpartyMerchantId: string;
  status: string;
  lastMessage: MerchantMessage | null;
  unreadCount: number;
}

export default function NetworkPage() {
  const { userId } = useAuth();
  const t = useT();
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

  const pendingInvites = inbox.filter(i => i.status === 'pending').length;
  const pendingApprovals = aprInbox.filter(a => a.status === 'pending').length;
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);
  const overdueDeals = allDeals.filter(d => d.status === 'overdue');
  const activeDeals = allDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <Breadcrumbs />

      <div className="px-6 pt-3 pb-4 border-b border-border">
        <h1 className="text-xl font-display font-bold">{t('networkTitle')}</h1>
        <p className="text-xs text-muted-foreground">{t('networkDesc')}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Command Center */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className={`${pendingInvites > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {t('invitations')}</p>
              <p className="text-xl font-bold mt-1">{pendingInvites}</p>
              {pendingInvites > 0 && <p className="text-[10px] text-warning font-medium">{t('actionNeeded')}</p>}
            </CardContent>
          </Card>

          <Card className={`${pendingApprovals > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><CheckSquare className="w-3 h-3" /> {t('approvals')}</p>
              <p className="text-xl font-bold mt-1">{pendingApprovals}</p>
              {pendingApprovals > 0 && <p className="text-[10px] text-warning font-medium">{t('actionNeeded')}</p>}
            </CardContent>
          </Card>

          <Card className={`${totalUnread > 0 ? 'border-primary/50 bg-primary/5' : ''}`}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {t('unread')}</p>
              <p className="text-xl font-bold mt-1">{totalUnread}</p>
              {totalUnread > 0 && <p className="text-[10px] text-primary font-medium">{t('newMessages')}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" /> {t('activeDeals')}</p>
              <p className="text-xl font-bold mt-1">{activeDeals.length}</p>
              {overdueDeals.length > 0 && <p className="text-[10px] text-destructive font-medium">{overdueDeals.length} {t('overdue')}</p>}
            </CardContent>
          </Card>

          <Card>
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
                                  <Badge className="bg-warning text-warning-foreground text-[10px] px-1 py-0">{rel.summary.pendingApprovals} {t('pending')}</Badge>
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

        {/* Activity: Invitations + Approvals */}
        <Tabs defaultValue="invitations">
          <TabsList>
            <TabsTrigger value="invitations" className="gap-1">
              {t('invitations')} {pendingInvites > 0 && <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">{pendingInvites}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1">
              {t('approvals')} {pendingApprovals > 0 && <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">{pendingApprovals}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invitations" className="mt-3 space-y-2">
            {inbox.filter(i => i.status === 'pending').map(inv => (
              <Card key={inv.id} className="border-warning/30 bg-warning/5">
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
                    <Button size="sm" onClick={() => handleAccept(inv.id)} className="gap-1 h-7 text-xs"><Check className="w-3 h-3" /> {t('accept')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(inv.id)} className="gap-1 h-7 text-xs"><X className="w-3 h-3" /> {t('reject')}</Button>
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
              <Card key={a.id} className="border-warning/30 bg-warning/5">
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
                    <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1 h-7 text-xs"><Check className="w-3 h-3" /> {t('approve')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectApproval(a.id)} className="gap-1 h-7 text-xs"><X className="w-3 h-3" /> {t('reject')}</Button>
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
