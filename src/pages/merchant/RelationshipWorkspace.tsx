import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/layout/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Send, Users, Briefcase, DollarSign, CheckSquare, Shield, MessageSquare, Check, X, Plus, ArrowRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantRelationship, MerchantMessage, MerchantDeal, MerchantApproval, AuditLog } from '@/types/domain';

const dealStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-success text-success-foreground',
  due: 'bg-warning text-warning-foreground',
  settled: 'bg-primary text-primary-foreground',
  closed: 'bg-secondary text-secondary-foreground',
  overdue: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};
const approvalStatusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  approved: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
};

export default function RelationshipWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuth();
  const [rel, setRel] = useState<MerchantRelationship | null>(null);
  const [msgs, setMsgs] = useState<MerchantMessage[]>([]);
  const [relDeals, setRelDeals] = useState<MerchantDeal[]>([]);
  const [relApprovals, setRelApprovals] = useState<MerchantApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [dealForm, setDealForm] = useState({ title: '', deal_type: 'lending', amount: '', due_date: '', expected_return: '' });
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settleDealId, setSettleDealId] = useState('');
  const [settlementForm, setSettlementForm] = useState({ amount: '', note: '' });
  const [profitOpen, setProfitOpen] = useState(false);
  const [profitDealId, setProfitDealId] = useState('');
  const [profitForm, setProfitForm] = useState({ amount: '', period_key: '', note: '' });

  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [
        { relationship },
        { messages },
        { deals: relDealsData },
        { approvals: inbox },
        { approvals: sent },
        { logs }
      ] = await Promise.all([
        api.relationships.get(id),
        api.messages.list(id),
        api.deals.list(id),
        api.approvals.inbox(),
        api.approvals.sent(),
        api.audit.relationship(id)
      ]);

      setRel(relationship);
      setMsgs(messages);
      setRelDeals(relDealsData);
      setRelApprovals([...inbox, ...sent].filter(a => a.relationship_id === id));
      setAuditLogs(logs);
    } catch (err: any) {
      toast.error('Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const sendMsg = async () => {
    if (!msgInput.trim() || !id) return;
    try {
      await api.messages.send(id, msgInput.trim());
      setMsgInput('');
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCreateDeal = async () => {
    if (!id || !dealForm.title || !dealForm.amount) return;
    try {
      await api.deals.create({
        relationship_id: id, deal_type: dealForm.deal_type as any, title: dealForm.title,
        amount: parseFloat(dealForm.amount), due_date: dealForm.due_date || undefined,
        expected_return: dealForm.expected_return ? parseFloat(dealForm.expected_return) : undefined,
      });
      toast.success(`Deal created`);
      setCreateDealOpen(false);
      setDealForm({ title: '', deal_type: 'lending', amount: '', due_date: '', expected_return: '' });
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleActivateDeal = async (dealId: string) => {
    try { 
      await api.deals.update(dealId, { status: 'active' }); 
      toast.success('Deal activated'); 
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const openSettlement = (dealId: string) => {
    setSettleDealId(dealId);
    setSettlementForm({ amount: '', note: '' });
    setSettlementOpen(true);
  };

  const handleSubmitSettlement = async () => {
    if (!settlementForm.amount) return;
    try {
      await api.deals.submitSettlement(settleDealId, {
        amount: parseFloat(settlementForm.amount), note: settlementForm.note,
      });
      toast.success('Settlement submitted for approval');
      setSettlementOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const openProfit = (dealId: string) => {
    setProfitDealId(dealId);
    setProfitForm({ amount: '', period_key: new Date().toISOString().substring(0, 7), note: '' });
    setProfitOpen(true);
  };

  const handleRecordProfit = async () => {
    if (!profitForm.amount) return;
    try {
      await api.deals.recordProfit(profitDealId, {
        amount: parseFloat(profitForm.amount), period_key: profitForm.period_key, note: profitForm.note,
      });
      toast.success('Profit recorded — pending approval');
      setProfitOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCloseDeal = async (dealId: string) => {
    try { 
      await api.deals.close(dealId); 
      toast.success('Close request submitted'); 
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApprove = async (approvalId: string) => {
    try { await api.approvals.approve(approvalId); toast.success('Approved — business data mutated'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleReject = async (approvalId: string) => {
    try { await api.approvals.reject(approvalId); toast.success('Rejected — no mutation'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!rel) return <div className="p-6 text-center text-muted-foreground">Relationship not found</div>;

  const statusColors: Record<string, string> = {
    active: 'bg-success text-success-foreground',
    restricted: 'bg-warning text-warning-foreground',
    suspended: 'bg-destructive text-destructive-foreground',
  };

  return (
    <div>
      <PageHeader title={rel.counterparty?.display_name || 'Workspace'} description={`Merchant ID: ${rel.counterparty?.merchant_id} • Role: ${rel.my_role}`}>
        <Badge className={statusColors[rel.status] || 'bg-muted text-muted-foreground'}>{rel.status}</Badge>
      </PageHeader>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Deals" value={rel.summary?.totalDeals || 0} icon={Briefcase} />
          <StatCard label="Active Exposure" value={`$${(rel.summary?.activeExposure || 0).toLocaleString()}`} icon={DollarSign} />
          <StatCard label="Realized Profit" value={`$${(rel.summary?.realizedProfit || 0).toLocaleString()}`} icon={Users} />
          <StatCard label="Pending Approvals" value={rel.summary?.pendingApprovals || 0} icon={CheckSquare} />
        </div>

        <Tabs defaultValue="messages">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="messages">Messages {msgs.filter(m => !m.is_read && m.sender_user_id !== userId).length > 0 && <Badge className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0">{msgs.filter(m => !m.is_read && m.sender_user_id !== userId).length}</Badge>}</TabsTrigger>
            <TabsTrigger value="deals">Deals ({relDeals.length})</TabsTrigger>
            <TabsTrigger value="approvals">Approvals ({relApprovals.filter(a => a.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="audit">Audit ({auditLogs.length})</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4">
            <Card className="glass">
              <CardHeader><CardTitle className="text-sm font-display">Relationship Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{rel.relationship_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Your Role</span><span className="capitalize">{rel.my_role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shared Fields</span><span>{rel.shared_fields?.join(', ') || 'All'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(rel.created_at).toLocaleDateString()}</span></div>
                {rel.approval_policy && (
                  <>
                    <div className="border-t border-border pt-2 mt-2">
                      <p className="text-xs font-mono uppercase text-muted-foreground mb-1">Approval Policy</p>
                    </div>
                    {Object.entries(rel.approval_policy).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span>{String(val)}</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="mt-4">
            <Card className="glass">
              <CardContent className="p-0">
                <div className="h-80 overflow-y-auto p-4 space-y-3">
                  {msgs.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No messages yet</p>}
                  {msgs.map(msg => (
                    <div key={msg.id} className={`flex ${msg.message_type === 'system' ? 'justify-center' : msg.sender_user_id === userId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        msg.message_type === 'system' ? 'bg-muted text-muted-foreground text-center w-full text-xs italic'
                          : msg.sender_user_id === userId ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {msg.message_type !== 'system' && <p className="text-[10px] font-mono opacity-70 mb-0.5">{msg.sender_name || msg.sender_merchant_id}</p>}
                        <p>{msg.body}</p>
                        <p className="text-[10px] opacity-50 mt-0.5">{new Date(msg.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t p-3 flex gap-2">
                  <Input placeholder="Type a message..." value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} />
                  <Button onClick={sendMsg} size="icon"><Send className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEALS */}
          <TabsContent value="deals" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateDealOpen(true)} className="gap-1"><Plus className="w-3.5 h-3.5" /> New Deal</Button>
            </div>
            {relDeals.length === 0 && <p className="text-center text-muted-foreground py-8">No deals yet — create one above</p>}
            {relDeals.map(deal => (
              <Card key={deal.id} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{deal.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{deal.deal_type}</Badge>
                        <Badge className={dealStatusColors[deal.status] || 'bg-muted text-muted-foreground'}>{deal.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>Issued: {deal.issue_date}</span>
                        {deal.due_date && <span>Due: {deal.due_date}</span>}
                        {deal.expected_return != null && <span>Expected: ${deal.expected_return.toLocaleString()}</span>}
                        {deal.realized_pnl != null && <span className="text-success">P&L: ${deal.realized_pnl.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-display font-bold text-lg">${deal.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{deal.currency}</p>
                      <div className="flex gap-1 justify-end flex-wrap">
                        {deal.status === 'draft' && (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleActivateDeal(deal.id)}>
                            <ArrowRight className="w-3 h-3 mr-1" /> Activate
                          </Button>
                        )}
                        {['active', 'due', 'overdue'].includes(deal.status) && (
                          <>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openSettlement(deal.id)}>
                              <DollarSign className="w-3 h-3 mr-1" /> Settle
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openProfit(deal.id)}>
                              <Plus className="w-3 h-3 mr-1" /> Profit
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCloseDeal(deal.id)}>
                              <Lock className="w-3 h-3 mr-1" /> Close
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="mt-4 space-y-3">
            {relApprovals.length === 0 && <p className="text-center text-muted-foreground py-8">No approvals</p>}
            {relApprovals.map(a => (
              <Card key={a.id} className="glass">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium capitalize">{a.type.replace(/_/g, ' ')}</p>
                      <Badge className={approvalStatusColors[a.status] || 'bg-muted text-muted-foreground'}>{a.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.submitted_at).toLocaleDateString()}
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
                  {a.status === 'pending' && a.reviewer_user_id === userId && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1"><Check className="w-3.5 h-3.5" /> Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(a.id)} className="gap-1"><X className="w-3.5 h-3.5" /> Reject</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit" className="mt-4 space-y-2">
            {auditLogs.length === 0 && (
              <Card className="glass"><CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No audit events yet</p>
              </CardContent></Card>
            )}
            {auditLogs.map(log => (
              <Card key={log.id} className="glass">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{log.entity_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                    {log.detail_json && Object.keys(log.detail_json).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Object.entries(log.detail_json).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Deal Dialog */}
      <Dialog open={createDealOpen} onOpenChange={setCreateDealOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Deal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="e.g. Working Capital Facility" value={dealForm.title} onChange={e => setDealForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={dealForm.deal_type} onValueChange={v => setDealForm(f => ({ ...f, deal_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lending">Lending</SelectItem>
                    <SelectItem value="arbitrage">Arbitrage</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="capital_placement">Capital Placement</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (USDT)</Label>
                <Input type="number" placeholder="10000" value={dealForm.amount} onChange={e => setDealForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date (optional)</Label>
                <Input type="date" value={dealForm.due_date} onChange={e => setDealForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expected Return</Label>
                <Input type="number" placeholder="500" value={dealForm.expected_return} onChange={e => setDealForm(f => ({ ...f, expected_return: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDealOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDeal}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement Dialog */}
      <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Settlement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (USDT)</Label>
              <Input type="number" placeholder="10150" value={settlementForm.amount} onChange={e => setSettlementForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea placeholder="Principal + return" value={settlementForm.note} onChange={e => setSettlementForm(f => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlementOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitSettlement}>Submit for Approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profit Recording Dialog */}
      <Dialog open={profitOpen} onOpenChange={setProfitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Profit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (USDT)</Label>
                <Input type="number" placeholder="500" value={profitForm.amount} onChange={e => setProfitForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Period</Label>
                <Input type="month" value={profitForm.period_key} onChange={e => setProfitForm(f => ({ ...f, period_key: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea placeholder="Monthly profit share" value={profitForm.note} onChange={e => setProfitForm(f => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfitOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordProfit}>Submit for Approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
