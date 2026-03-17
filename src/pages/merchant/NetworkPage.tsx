import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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

      // Load conversations
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
      toast.error('Failed to load network data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime refresh
  useRealtimeRefresh(reload, ['new_message', 'new_invite', 'invite_update', 'approval_update']);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length < 2) { toast.error('Enter at least 2 characters'); return; }
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
        purpose: inviteForm.purpose || 'General collaboration',
        requested_role: inviteForm.role,
        message: inviteForm.message,
      });
      toast.success(`Invite sent to ${inviteTarget.display_name}`);
      setInviteDialogOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAccept = async (id: string) => {
    try { await api.invites.accept(id); toast.success('Invite accepted — relationship created!'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleReject = async (id: string) => {
    try { await api.invites.reject(id); toast.success('Invite rejected'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleWithdraw = async (id: string) => {
    try { await api.invites.withdraw(id); toast.success('Invite withdrawn'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleApprove = async (id: string) => {
    try { await api.approvals.approve(id); toast.success('Approved'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleRejectApproval = async (id: string) => {
    try { await api.approvals.reject(id); toast.success('Rejected'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const pendingInvites = inbox.filter(i => i.status === 'pending').length;
  const pendingApprovals = aprInbox.filter(a => a.status === 'pending').length;
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);
  const overdueDeals = allDeals.filter(d => d.status === 'overdue');
  const activeDeals = allDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <Breadcrumbs />

      {/* Header */}
      <div className="px-6 pt-3 pb-4 border-b border-border">
        <h1 className="text-xl font-display font-bold">Network</h1>
        <p className="text-xs text-muted-foreground">Manage relationships, deals, approvals, and communications</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Command Center: Action-needed cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className={`${pendingInvites > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Invitations</p>
              <p className="text-xl font-bold mt-1">{pendingInvites}</p>
              {pendingInvites > 0 && <p className="text-[10px] text-warning font-medium">Action needed</p>}
            </CardContent>
          </Card>

          <Card className={`${pendingApprovals > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><CheckSquare className="w-3 h-3" /> Approvals</p>
              <p className="text-xl font-bold mt-1">{pendingApprovals}</p>
              {pendingApprovals > 0 && <p className="text-[10px] text-warning font-medium">Action needed</p>}
            </CardContent>
          </Card>

          <Card className={`${totalUnread > 0 ? 'border-primary/50 bg-primary/5' : ''}`}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Unread</p>
              <p className="text-xl font-bold mt-1">{totalUnread}</p>
              {totalUnread > 0 && <p className="text-[10px] text-primary font-medium">New messages</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" /> Active Deals</p>
              <p className="text-xl font-bold mt-1">{activeDeals.length}</p>
              {overdueDeals.length > 0 && <p className="text-[10px] text-destructive font-medium">{overdueDeals.length} overdue</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Relationships</p>
              <p className="text-xl font-bold mt-1">{rels.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Relationships - Primary Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground">Relationships</h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Find merchant..." value={query} onChange={e => setQuery(e.target.value)} className="pl-8 h-8 text-xs w-48" />
              </div>
              <Button type="submit" size="sm" className="h-8 text-xs">Search</Button>
            </form>
          </div>

          {/* Search Results */}
          {searched && results.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-muted-foreground">Search results:</p>
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
                      <UserPlus className="w-3 h-3" /> Invite
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Relationship Cards */}
          {rels.length === 0 && !searched && (
            <Card className="glass"><CardContent className="py-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No relationships yet</p>
              <p className="text-xs mt-1">Search for a merchant above to start collaborating.</p>
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
                            <span>Role: {rel.my_role}</span>
                            <span>{rel.relationship_type}</span>
                            {rel.summary && (
                              <>
                                <span>{rel.summary.totalDeals} deals</span>
                                <span>Exposure: ${rel.summary.activeExposure.toLocaleString()}</span>
                                {rel.summary.pendingApprovals > 0 && (
                                  <Badge className="bg-warning text-warning-foreground text-[10px] px-1 py-0">{rel.summary.pendingApprovals} pending</Badge>
                                )}
                              </>
                            )}
                          </div>
                          {convo?.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {convo.lastMessage.sender_user_id === userId ? 'You: ' : ''}{convo.lastMessage.body}
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

        {/* Activity Section: Invitations + Approvals */}
        <Tabs defaultValue="invitations">
          <TabsList>
            <TabsTrigger value="invitations" className="gap-1">
              Invitations {pendingInvites > 0 && <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">{pendingInvites}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1">
              Approvals {pendingApprovals > 0 && <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">{pendingApprovals}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invitations" className="mt-3 space-y-2">
            {/* Pending first */}
            {inbox.filter(i => i.status === 'pending').map(inv => (
              <Card key={inv.id} className="border-warning/30 bg-warning/5">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{inv.from_display_name}</p>
                      <Badge className={inviteStatusColors[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{inv.purpose} • Role: {inv.requested_role} • @{inv.from_nickname}</p>
                    {inv.message && <p className="text-xs text-muted-foreground italic mt-1">"{inv.message}"</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(inv.id)} className="gap-1 h-7 text-xs"><Check className="w-3 h-3" /> Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(inv.id)} className="gap-1 h-7 text-xs"><X className="w-3 h-3" /> Reject</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Non-pending */}
            {[...inbox.filter(i => i.status !== 'pending'), ...sent].map(inv => (
              <Card key={inv.id} className="glass">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{inv.from_display_name || `To: ${inv.to_display_name || inv.to_merchant_id}`}</p>
                      <Badge className={inviteStatusColors[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{inv.purpose || 'General collaboration'}</p>
                  </div>
                  {inv.status === 'pending' && (inv as any).to_merchant_id && (
                    <Button size="sm" variant="outline" onClick={() => handleWithdraw(inv.id)} className="gap-1 h-7 text-xs"><RotateCcw className="w-3 h-3" /> Withdraw</Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {inbox.length + sent.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No invitations</div>
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
                    <p className="text-[10px] text-muted-foreground">Target: {a.target_entity_type} • {new Date(a.submitted_at).toLocaleDateString()}</p>
                    {a.proposed_payload && Object.keys(a.proposed_payload).length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {Object.entries(a.proposed_payload).map(([k, v]) => (
                          <span key={k} className="mr-2">{k}: <span className="text-foreground">{String(v)}</span></span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1 h-7 text-xs"><Check className="w-3 h-3" /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectApproval(a.id)} className="gap-1 h-7 text-xs"><X className="w-3 h-3" /> Reject</Button>
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
              <div className="text-center py-8 text-muted-foreground text-sm">No approvals</div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invite to {inviteTarget?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Input placeholder="e.g. Lending Partnership" value={inviteForm.purpose} onChange={e => setInviteForm(f => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Requested Role</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="lender">Lender</SelectItem>
                  <SelectItem value="borrower">Borrower</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea placeholder="Add a note..." value={inviteForm.message} onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendInvite}>Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
