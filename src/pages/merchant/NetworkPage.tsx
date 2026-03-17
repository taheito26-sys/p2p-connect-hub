import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Search, UserPlus, Check, X, RotateCcw, Mail, Users,
  ExternalLink, CheckSquare, MessageSquare, ArrowLeft, AlertCircle, Clock, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantSearchResult, MerchantInvite, MerchantRelationship, MerchantApproval, MerchantMessage } from '@/types/domain';

interface ConversationSummary {
  relationshipId: string;
  counterpartyName: string;
  counterpartyMerchantId: string;
  status: string;
  lastMessage: MerchantMessage | null;
  unreadCount: number;
}

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

export default function NetworkPage() {
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MerchantSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [inbox, setInbox] = useState<MerchantInvite[]>([]);
  const [sent, setSent] = useState<MerchantInvite[]>([]);
  const [rels, setRels] = useState<MerchantRelationship[]>([]);
  const [aprInbox, setAprInbox] = useState<MerchantApproval[]>([]);
  const [aprSent, setAprSent] = useState<MerchantApproval[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<MerchantSearchResult | null>(null);
  const [inviteForm, setInviteForm] = useState({ purpose: '', role: 'partner', message: '' });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [
        { invites: inInbox },
        { invites: outSent },
        { relationships },
        { approvals: aprIn },
        { approvals: aprOut }
      ] = await Promise.all([
        api.invites.inbox(),
        api.invites.sent(),
        api.relationships.list(),
        api.approvals.inbox(),
        api.approvals.sent()
      ]);

      setInbox(inInbox);
      setSent(outSent);
      setRels(relationships);
      setAprInbox(aprIn);
      setAprSent(aprOut);

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
    } catch (err) {
      toast.error('Failed to load network data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

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
        requested_role: inviteForm.role as any,
        message: inviteForm.message,
      });
      toast.success(`Invite sent to ${inviteTarget.display_name}`);
      setInviteDialogOpen(false);
      await reload();
    } catch (err: any) {
      toast.error(err.message);
    }
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
    try { await api.approvals.approve(id); toast.success('Approved — business data updated'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleRejectApproval = async (id: string) => {
    try { await api.approvals.reject(id); toast.success('Rejected — no data changed'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const pendingInvites = inbox.filter(i => i.status === 'pending').length;
  const pendingApprovals = aprInbox.filter(a => a.status === 'pending').length;
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);

  return (
    <div>
      <PageHeader title="Network" description="Manage contacts, approvals, and communications" />
      <div className="p-6 space-y-6">
        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Invitations Card */}
          <Card className={`${pendingInvites > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-4 h-4" /> Pending Invitations
                  </p>
                  <p className="text-2xl font-bold mt-1">{pendingInvites}</p>
                  {pendingInvites > 0 && <p className="text-xs text-muted-foreground mt-1">Action needed</p>}
                </div>
                {pendingInvites > 0 && <AlertCircle className="w-5 h-5 text-warning mt-1" />}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals Card */}
          <Card className={`${pendingApprovals > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckSquare className="w-4 h-4" /> Pending Approvals
                  </p>
                  <p className="text-2xl font-bold mt-1">{pendingApprovals}</p>
                  {pendingApprovals > 0 && <p className="text-xs text-muted-foreground mt-1">Action needed</p>}
                </div>
                {pendingApprovals > 0 && <AlertCircle className="w-5 h-5 text-warning mt-1" />}
              </div>
            </CardContent>
          </Card>

          {/* Unread Messages Card */}
          <Card className={`${totalUnread > 0 ? 'border-primary/50 bg-primary/5' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" /> Unread Messages
                  </p>
                  <p className="text-2xl font-bold mt-1">{totalUnread}</p>
                  {totalUnread > 0 && <p className="text-xs text-muted-foreground mt-1">New messages</p>}
                </div>
                {totalUnread > 0 && <MessageCircle className="w-5 h-5 text-primary mt-1" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs - Simplified to 3 */}
        <Tabs defaultValue="contacts">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" /> Contacts</TabsTrigger>
            <TabsTrigger value="activity">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Activity
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Approvals
            </TabsTrigger>
          </TabsList>

          {/* CONTACTS - Directory + Relationships */}
          <TabsContent value="contacts" className="mt-4 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by Merchant ID, nickname, or name..." value={query} onChange={e => setQuery(e.target.value)} className="pl-10" />
              </div>
              <Button type="submit">Search</Button>
            </form>
            {searched && results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No merchants found matching "{query}"</p>
              </div>
            )}
            {results.map(r => (
              <Card key={r.id} className="glass hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.display_name}</p>
                      <Badge variant="outline" className="font-mono text-xs">{r.merchant_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-mono text-primary">{r.merchant_id}</span>
                      <span className="text-xs text-muted-foreground">@{r.nickname}</span>
                      {r.region && <span className="text-xs text-muted-foreground">{r.region}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openInviteDialog(r)}>
                    <UserPlus className="w-3.5 h-3.5" /> Invite
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ACTIVITY - Messages + Invitations */}
          <TabsContent value="activity" className="mt-4">
            <Tabs defaultValue="messages">
              <TabsList>
                <TabsTrigger value="messages">Messages ({conversations.length})</TabsTrigger>
                <TabsTrigger value="invitations">Invitations ({inbox.length + sent.length})</TabsTrigger>
              </TabsList>

              {/* Messages Sub-tab */}
              <TabsContent value="messages" className="mt-3 space-y-3">
                {conversations.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-xs mt-1">Messages appear once you have active relationships.</p>
                  </div>
                )}
                {conversations.map(convo => (
                  <Link key={convo.relationshipId} to={`/network/relationships/${convo.relationshipId}`}>
                    <Card className="glass hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{convo.counterpartyName}</p>
                              <Badge variant="outline" className="text-[10px] font-mono shrink-0">{convo.counterpartyMerchantId}</Badge>
                              {convo.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shrink-0">{convo.unreadCount}</Badge>}
                            </div>
                            {convo.lastMessage ? (
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {convo.lastMessage.message_type === 'system' ? '📋 ' : ''}
                                {convo.lastMessage.sender_user_id === userId ? 'You: ' : ''}
                                {convo.lastMessage.body}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic mt-0.5">No messages yet</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          {convo.lastMessage && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(convo.lastMessage.created_at).toLocaleDateString()}
                            </span>
                          )}
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </TabsContent>

              {/* Invitations Sub-tab */}
              <TabsContent value="invitations" className="mt-3 space-y-3">
                <Tabs defaultValue="inv-inbox">
                  <TabsList className="mb-3">
                    <TabsTrigger value="inv-inbox">Inbox ({inbox.length})</TabsTrigger>
                    <TabsTrigger value="inv-sent">Sent ({sent.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="inv-inbox" className="space-y-3">
                    {inbox.length === 0 && <div className="text-center py-12 text-muted-foreground"><Mail className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No invitations in your inbox</p></div>}
                    {inbox.map(inv => (
                      <Card key={inv.id} className="glass">
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{inv.from_display_name}</p>
                              <Badge className={inviteStatusColors[inv.status]}>{inv.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{inv.purpose && <span>{inv.purpose} • </span>}Role: {inv.requested_role} • From: @{inv.from_nickname}</p>
                            {inv.message && <p className="text-sm mt-2 text-muted-foreground italic">"{inv.message}"</p>}
                          </div>
                          {inv.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleAccept(inv.id)} className="gap-1"><Check className="w-3.5 h-3.5" /> Accept</Button>
                              <Button size="sm" variant="outline" onClick={() => handleReject(inv.id)} className="gap-1"><X className="w-3.5 h-3.5" /> Reject</Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="inv-sent" className="space-y-3">
                    {sent.length === 0 && <div className="text-center py-12 text-muted-foreground"><Mail className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No sent invitations</p></div>}
                    {sent.map(inv => (
                      <Card key={inv.id} className="glass">
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">To: {inv.to_display_name || inv.to_merchant_id}</p>
                              <Badge className={inviteStatusColors[inv.status]}>{inv.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{inv.purpose || 'General collaboration'}</p>
                          </div>
                          {inv.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => handleWithdraw(inv.id)} className="gap-1"><RotateCcw className="w-3.5 h-3.5" /> Withdraw</Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* CONTACTS continued - Relationships search + list */}
          <div className="mt-4 space-y-4">
            <Tabs defaultValue="rel-search">
              <TabsList>
                <TabsTrigger value="rel-search">Find & Invite</TabsTrigger>
                <TabsTrigger value="rel-list">My Relationships ({rels.length})</TabsTrigger>
              </TabsList>

              {/* Find & Invite Sub-tab */}
              <TabsContent value="rel-search" className="mt-3 space-y-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by Merchant ID, nickname, or name..." value={query} onChange={e => setQuery(e.target.value)} className="pl-10" />
                  </div>
                  <Button type="submit">Search</Button>
                </form>
                {searched && results.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No merchants found matching "{query}"</p>
                  </div>
                )}
                {results.map(r => (
                  <Card key={r.id} className="glass hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{r.display_name}</p>
                          <Badge variant="outline" className="font-mono text-xs">{r.merchant_type}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-mono text-primary">{r.merchant_id}</span>
                          <span className="text-xs text-muted-foreground">@{r.nickname}</span>
                          {r.region && <span className="text-xs text-muted-foreground">{r.region}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openInviteDialog(r)}>
                        <UserPlus className="w-3.5 h-3.5" /> Invite
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* My Relationships Sub-tab */}
              <TabsContent value="rel-list" className="mt-3 space-y-3">
                {rels.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No relationships yet</p><p className="text-xs mt-1">Accept an invite or send one from "Find & Invite" tab.</p>
                  </div>
                )}
                {rels.map(rel => (
                  <Link key={rel.id} to={`/network/relationships/${rel.id}`}>
                    <Card className="glass hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{rel.counterparty?.display_name || 'Unknown'}</p>
                            <Badge className={relStatusColors[rel.status]}>{rel.status}</Badge>
                            <Badge variant="outline" className="font-mono text-xs">{rel.relationship_type}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>ID: {rel.counterparty?.merchant_id}</span>
                            <span>Role: {rel.my_role}</span>
                            {rel.summary && (
                              <>
                                <span>{rel.summary.totalDeals} deals</span>
                                <span>Exposure: ${rel.summary.activeExposure.toLocaleString()}</span>
                                {rel.summary.pendingApprovals > 0 && (
                                  <Badge className="bg-warning text-warning-foreground text-[10px]">{rel.summary.pendingApprovals} pending</Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="mt-4">
            <Tabs defaultValue="apr-inbox">
              <TabsList>
                <TabsTrigger value="apr-inbox">To Review ({aprInbox.filter(a => a.status === 'pending').length})</TabsTrigger>
                <TabsTrigger value="apr-sent">Submitted ({aprSent.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="apr-inbox" className="mt-3 space-y-3">
                {aprInbox.length === 0 && <div className="text-center py-12 text-muted-foreground"><CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No approvals to review</p></div>}
                {aprInbox.map(a => (
                  <Card key={a.id} className="glass">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{a.type.replace(/_/g, ' ')}</p>
                          <Badge className={approvalStatusColors[a.status]}>{a.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Target: {a.target_entity_type} • Submitted: {new Date(a.submitted_at).toLocaleDateString()}
                          {a.resolution_note && ` • ${a.resolution_note}`}
                        </p>
                        {a.proposed_payload && Object.keys(a.proposed_payload).length > 0 && (
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {Object.entries(a.proposed_payload).map(([k, v]) => (
                              <span key={k} className="mr-3">{k}: <span className="text-foreground">{String(v)}</span></span>
                            ))}
                          </div>
                        )}
                      </div>
                      {a.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1"><Check className="w-3.5 h-3.5" /> Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectApproval(a.id)} className="gap-1"><X className="w-3.5 h-3.5" /> Reject</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent value="apr-sent" className="mt-3 space-y-3">
                {aprSent.length === 0 && <div className="text-center py-12 text-muted-foreground"><CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No submitted approvals</p></div>}
                {aprSent.map(a => (
                  <Card key={a.id} className="glass">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{a.type.replace(/_/g, ' ')}</p>
                        <Badge className={approvalStatusColors[a.status]}>{a.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {new Date(a.submitted_at).toLocaleDateString()}
                        {a.resolved_at && ` • Resolved: ${new Date(a.resolved_at).toLocaleDateString()}`}
                        {a.resolution_note && ` • ${a.resolution_note}`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
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
