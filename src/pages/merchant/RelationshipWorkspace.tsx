import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { createDemoState } from '@/lib/tracker-demo-data';
import { useTheme } from '@/lib/theme-context';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { StatCard } from '@/components/layout/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { DEAL_TYPE_CONFIGS, calculateOutstanding } from '@/lib/deal-engine';
import { useRealtimeRefresh } from '@/hooks/use-realtime';
import {
  Loader2, Send, Users, Briefcase, DollarSign, CheckSquare,
  Plus, ArrowLeft, Check, X, AlertTriangle, Clock, MoreVertical, MailCheck, MailOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantRelationship, MerchantMessage, MerchantDeal, MerchantApproval } from '@/types/domain';

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
  const { settings } = useTheme();
  const navigate = useNavigate();
  const t = useT();

  // Load shared customer/supplier data from TrackerState
  const sharedData = useMemo(() => createDemoState({
    lowStockThreshold: settings.lowStockThreshold,
    priceAlertThreshold: settings.priceAlertThreshold,
  }), [settings.lowStockThreshold, settings.priceAlertThreshold]);

  const [trackerState, setTrackerState] = useState(sharedData.state);

  const sharedCustomers = trackerState.customers;
  const sharedSuppliers = useMemo(() => {
    const names = trackerState.batches.map(b => b.source.trim()).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [trackerState.batches]);

  const [rel, setRel] = useState<MerchantRelationship | null>(null);
  const [msgs, setMsgs] = useState<MerchantMessage[]>([]);
  const [relDeals, setRelDeals] = useState<MerchantDeal[]>([]);
  const [relApprovals, setRelApprovals] = useState<MerchantApproval[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [activeTab, setActiveTab] = useState('deals');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settleDealId, setSettleDealId] = useState('');
  const [settlementForm, setSettlementForm] = useState({ amount: '', profit: '', period_key: '', note: '' });

  const [rejectDealOpen, setRejectDealOpen] = useState(false);
  const [rejectDealId, setRejectDealId] = useState('');
  const [rejectDealData, setRejectDealData] = useState<MerchantDeal | null>(null);
  const [rejectForm, setRejectForm] = useState({ suggested_share_pct: '', suggested_amount: '', note: '' });

  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [
        { relationship },
        { messages },
        { deals: relDealsData },
        { approvals: inbox },
        { approvals: sent }
      ] = await Promise.all([
        api.relationships.get(id),
        api.messages.list(id),
        api.deals.list(id),
        api.approvals.inbox(),
        api.approvals.sent()
      ]);

      setRel(relationship);
      setMsgs(messages);
      setRelDeals(relDealsData);
      setRelApprovals([...inbox, ...sent].filter(a => a.relationship_id === id));
    } catch (err: any) {
      toast.error(t('failedLoadWorkspace'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);
  useRealtimeRefresh(reload, ['new_message', 'approval_update', 'deal_update']);

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

  const handleAcceptDeal = async (dealId: string) => {
    try { await api.deals.update(dealId, { status: 'active' }); toast.success('Deal accepted and activated'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const openRejectDeal = (deal: MerchantDeal) => {
    setRejectDealId(deal.id);
    setRejectDealData(deal);
    setRejectForm({
      suggested_share_pct: deal.metadata?.counterparty_share_pct ? String(deal.metadata.counterparty_share_pct) : '',
      suggested_amount: String(deal.amount || ''),
      note: '',
    });
    setRejectDealOpen(true);
  };

  const handleRejectDeal = async () => {
    try {
      const note = [
        rejectForm.note,
        rejectForm.suggested_amount ? `Suggested amount: $${rejectForm.suggested_amount}` : '',
        rejectForm.suggested_share_pct ? `Suggested profit share: ${rejectForm.suggested_share_pct}%` : '',
      ].filter(Boolean).join(' | ');
      await api.deals.update(rejectDealId, { status: 'cancelled' });
      // Send counter-proposal as a message so counterparty sees suggested changes
      if (id && note) {
        await api.messages.send(id, `⚠️ Deal rejected with counter-proposal:\n${note}`, 'system');
      }
      toast.success('Deal rejected — counter-proposal sent to counterparty');
      setRejectDealOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const openSettlement = (dealId: string) => {
    setSettleDealId(dealId);
    setSettlementForm({ amount: '', profit: '', period_key: new Date().toISOString().substring(0, 7), note: '' });
    setSettlementOpen(true);
  };

  const handleSubmitSettlement = async () => {
    if (!settlementForm.amount) return;
    try {
      // 1. Submit settlement (capital return)
      await api.deals.submitSettlement(settleDealId, { amount: parseFloat(settlementForm.amount), note: settlementForm.note });

      // 2. Record profit if provided
      if (settlementForm.profit && parseFloat(settlementForm.profit) > 0) {
        await api.deals.recordProfit(settleDealId, {
          amount: parseFloat(settlementForm.profit),
          period_key: settlementForm.period_key,
          note: settlementForm.note,
        });
      }

      // 3. Auto-close the deal
      await api.deals.close(settleDealId, { note: 'Auto-closed on settlement submission' });

      toast.success('Settlement submitted — deal will close once counterparty approves');
      setSettlementOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApprove = async (approvalId: string) => {
    try { await api.approvals.approve(approvalId); toast.success(t('approvedMutation')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleReject = async (approvalId: string) => {
    try { await api.approvals.reject(approvalId); toast.success(t('rejectedNoMutation')); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleMarkRead = async (messageId: string) => {
    const target = msgs.find(msg => msg.id === messageId);
    if (!target || target.is_read) return;

    const previousMsgs = msgs;
    setMsgs(current => current.map(msg => msg.id === messageId ? { ...msg, is_read: true } : msg));

    try {
      await api.messages.markRead(messageId);
    } catch (err: any) {
      setMsgs(previousMsgs);
      toast.error(err.message || t('failedLoadMessages'));
    }
  };

  const handleMarkUnread = (messageId: string) => {
    setMsgs(current => current.map(msg => msg.id === messageId ? { ...msg, is_read: false } : msg));
  };

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!rel) return <div className="p-6 text-center text-muted-foreground">{t('relationshipNotFound')}</div>;

  const statusColors: Record<string, string> = {
    active: 'bg-success text-success-foreground',
    restricted: 'bg-warning text-warning-foreground',
    suspended: 'bg-destructive text-destructive-foreground',
  };

  const pendingApprovals = relApprovals.filter(a => a.status === 'pending');
  const unreadMsgs = msgs.filter(m => !m.is_read && m.sender_user_id !== userId);
  const activeDeals = relDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));
  const counterpartyName = rel.counterparty?.display_name || t('workspace');

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <Breadcrumbs counterpartyName={counterpartyName} />

      <div className="px-6 pt-3 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/network')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-bold">{counterpartyName}</h1>
              <Badge className={statusColors[rel.status] || 'bg-muted text-muted-foreground'}>{rel.status}</Badge>
              <Badge variant="outline" className="text-xs font-mono">{rel.counterparty?.merchant_id}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{rel.my_role}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rel.relationship_type} {t('relationship_rel')} • {t('created')} {new Date(rel.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label={t('dealsLabel')} value={rel.summary?.totalDeals || 0} icon={Briefcase} />
          <StatCard label={t('activeExposure')} value={`$${(rel.summary?.activeExposure || 0).toLocaleString()}`} icon={DollarSign} />
          <StatCard label={t('realizedProfit')} value={`$${(rel.summary?.realizedProfit || 0).toLocaleString()}`} icon={Users} />
          <StatCard label={t('pendingApprovalsLabel')} value={pendingApprovals.length} icon={CheckSquare} />
          <StatCard label={t('unreadMessages')} value={unreadMsgs.length} icon={Send} />
        </div>

        {/* Action Alerts */}
        {(pendingApprovals.length > 0 || activeDeals.some(d => d.status === 'overdue')) && (
          <div className="space-y-2">
            {pendingApprovals.length > 0 && (
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                  <span className="text-sm">{pendingApprovals.length} {t('approvalNeedAttention')}</span>
                  <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => setActiveTab('approvals')}>{t('review')}</Button>
                </CardContent>
              </Card>
            )}
            {activeDeals.filter(d => d.status === 'overdue').map(d => (
              <Card key={d.id} className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-sm">"{d.title}" {t('dealOverdue')} — {t('due')} {d.due_date}</span>
                  <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => openSettlement(d.id)}>{t('settle')}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="deals" className="gap-1">
              {t('dealsLabel')} {relDeals.length > 0 && <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{relDeals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1">
              {t('messagesLabel')} {unreadMsgs.length > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">{unreadMsgs.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1">
              {t('approvalsLabel')} {pendingApprovals.length > 0 && <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">{pendingApprovals.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* DEALS */}
          <TabsContent value="deals" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateDealOpen(true)} className="gap-1"><Plus className="w-3.5 h-3.5" /> {t('newDeal')}</Button>
            </div>
            {relDeals.length === 0 && <p className="text-center text-muted-foreground py-8">{t('noDealsYet')}</p>}
            {relDeals.map(deal => {
              const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
              const outstandingVal = calculateOutstanding(deal);
              return (
                <Card key={deal.id} className="glass">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{cfg?.icon || '📋'}</span>
                          <p className="font-medium">{deal.title}</p>
                          <Badge variant="outline" className="text-xs">{cfg?.label || deal.deal_type}</Badge>
                          <Badge className={dealStatusColors[deal.status] || 'bg-muted text-muted-foreground'}>{deal.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{t('issued')}: {deal.issue_date}</span>
                          {deal.due_date && <span>{t('due')}: {deal.due_date}</span>}
                          {deal.expected_return != null && <span>{t('expected')}: ${deal.expected_return.toLocaleString()}</span>}
                          {deal.realized_pnl != null && deal.realized_pnl !== 0 && <span className="text-success">P&L: ${deal.realized_pnl.toLocaleString()}</span>}
                          {outstandingVal.outstanding > 0 && outstandingVal.isOverdue && (
                            <Badge className="bg-destructive text-destructive-foreground text-[10px]">{t('overdue').toUpperCase()}</Badge>
                          )}
                        </div>
                        {deal.metadata && (deal.metadata.counterparty_share_pct || deal.metadata.partner_ratio || deal.metadata.pool_owner_share_pct) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            {deal.metadata.counterparty_share_pct && <span>{t('cpShare')}: {String(deal.metadata.counterparty_share_pct)}%</span>}
                            {deal.metadata.partner_ratio && <span>{t('partnerLabel')}: {String(deal.metadata.partner_ratio)}%</span>}
                            {deal.metadata.pool_owner_share_pct && <span>{t('poolOwner')}: {String(deal.metadata.pool_owner_share_pct)}%</span>}
                          </div>
                        )}
                        {(deal.metadata?.customer_name || deal.metadata?.supplier_name) && (
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {deal.metadata?.customer_name && <span>👤 {t('dealLinkedCustomer')}: <strong className="text-foreground">{String(deal.metadata.customer_name)}</strong></span>}
                            {deal.metadata?.supplier_name && <span>📦 {t('dealLinkedSupplier')}: <strong className="text-foreground">{String(deal.metadata.supplier_name)}</strong></span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-display font-bold text-lg">${deal.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{deal.currency}</p>
                        <div className="flex gap-1 justify-end flex-wrap">
                          {deal.status === 'draft' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="text-xs h-7 border-success/50 text-success hover:bg-success/10" onClick={() => handleAcceptDeal(deal.id)}>
                                <Check className="w-3 h-3 mr-1" /> Accept
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => openRejectDeal(deal)}>
                                <X className="w-3 h-3 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                          {['active', 'due', 'overdue'].includes(deal.status) && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openSettlement(deal.id)}>
                                    <DollarSign className="w-3 h-3 mr-1" /> {t('settle')}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                                  <p className="font-semibold mb-0.5">Settle & Close</p>
                                  <p className="text-muted-foreground">Return capital, record profit, and submit for counterparty approval. Deal closes automatically once approved.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="mt-4">
            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
                <div>
                  <CardTitle className="text-sm font-display">{t('messagesLabel')}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {unreadMsgs.length > 0 ? `${unreadMsgs.length} ${t('unread').toLowerCase()}` : t('noMessagesShort')}
                  </p>
                </div>
                {unreadMsgs.length > 0 && <Badge className="bg-primary text-primary-foreground">{unreadMsgs.length}</Badge>}
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-80 overflow-y-auto p-4 space-y-3">
                  {msgs.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{t('noMessagesYet')}</p>}
                  {msgs.map(msg => {
                    const isSystem = msg.message_type === 'system';
                    const isOwn = msg.sender_user_id === userId;

                    return (
                      <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${
                          isSystem ? 'bg-muted text-muted-foreground text-center w-full text-xs italic'
                            : isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {!isSystem && (
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <p className="text-[10px] font-mono opacity-70">{msg.sender_name || msg.sender_merchant_id}</p>
                              <div className="flex items-center gap-2">
                                {!msg.is_read && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{t('unread')}</Badge>}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={`h-6 w-6 shrink-0 ${isOwn ? 'text-primary-foreground hover:bg-primary-foreground/10' : 'text-muted-foreground hover:bg-background/80'}`}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                                    {msg.is_read ? (
                                      <DropdownMenuItem onClick={() => handleMarkUnread(msg.id)}><MailOpen className="mr-2 h-3.5 w-3.5" />Mark as unread</DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleMarkRead(msg.id)}><MailCheck className="mr-2 h-3.5 w-3.5" />Mark as read</DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          )}
                          <p>{msg.body}</p>
                          <p className="text-[10px] opacity-50 mt-0.5">{new Date(msg.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t p-3 flex gap-2">
                  <Input placeholder={t('typeMessage')} value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} />
                  <Button onClick={sendMsg} size="icon"><Send className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="mt-4 space-y-3">
            {relApprovals.length === 0 && <p className="text-center text-muted-foreground py-8">{t('noApprovals')}</p>}
            {relApprovals.map(a => {
              // Find the linked deal for context
              const linkedDeal = a.target_entity_type === 'deal' ? relDeals.find(d => d.id === a.target_entity_id) : null;
              const dealCfg = linkedDeal ? DEAL_TYPE_CONFIGS[linkedDeal.deal_type] : null;
              const payload = a.proposed_payload || {};

              return (
                <Card key={a.id} className={`glass ${a.status === 'pending' ? 'border-warning/40' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium capitalize">{a.type.replace(/_/g, ' ')}</p>
                        <Badge className={approvalStatusColors[a.status] || 'bg-muted text-muted-foreground'}>{a.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(a.submitted_at).toLocaleDateString()}</span>
                      </div>
                      {a.status === 'pending' && a.reviewer_user_id === userId && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1"><Check className="w-3.5 h-3.5" /> {t('approve')}</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(a.id)} className="gap-1"><X className="w-3.5 h-3.5" /> {t('reject')}</Button>
                        </div>
                      )}
                    </div>

                    {/* Linked deal context */}
                    {linkedDeal && (
                      <div className="rounded-md bg-muted/40 border border-border/50 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span>{dealCfg?.icon || '📋'}</span>
                          <span className="font-medium">{linkedDeal.title}</span>
                          <Badge variant="outline" className="text-[10px]">{dealCfg?.label || linkedDeal.deal_type}</Badge>
                          <Badge className={`text-[10px] ${dealStatusColors[linkedDeal.status] || 'bg-muted text-muted-foreground'}`}>{linkedDeal.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Amount:</span>{' '}
                            <span className="font-mono font-semibold">${linkedDeal.amount.toLocaleString()} {linkedDeal.currency}</span>
                          </div>
                          {linkedDeal.issue_date && (
                            <div>
                              <span className="text-muted-foreground">{t('issued')}:</span>{' '}
                              <span>{linkedDeal.issue_date}</span>
                            </div>
                          )}
                          {linkedDeal.due_date && (
                            <div>
                              <span className="text-muted-foreground">{t('due')}:</span>{' '}
                              <span>{linkedDeal.due_date}</span>
                            </div>
                          )}
                          {linkedDeal.metadata?.counterparty_share_pct && (
                            <div>
                              <span className="text-muted-foreground">{t('cpShare')}:</span>{' '}
                              <span>{String(linkedDeal.metadata.counterparty_share_pct)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Proposed payload details */}
                    {Object.keys(payload).length > 0 && (
                      <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
                        <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5 tracking-wider">Proposed Changes</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                          {Object.entries(payload).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1.5">
                              <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}:</span>
                              <span className="font-medium text-foreground">{typeof v === 'number' ? `$${v.toLocaleString()}` : String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {a.resolution_note && (
                      <p className="text-xs text-muted-foreground italic">Note: {a.resolution_note}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

        </Tabs>
      </div>

      <CreateDealDialog
        open={createDealOpen}
        onOpenChange={setCreateDealOpen}
        relationshipId={id!}
        counterpartyName={counterpartyName}
        onCreated={reload}
        customers={sharedCustomers}
        suppliers={sharedSuppliers}
        trackerState={trackerState}
        onStateChange={setTrackerState}
      />

      {/* Settle & Close Dialog */}
      <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle & Close Deal</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Submit the capital return and profit. Once the counterparty approves, the deal closes automatically.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('amountUsdtLabel')} *</Label>
              <Input type="number" placeholder="8000" value={settlementForm.amount} onChange={e => setSettlementForm(f => ({ ...f, amount: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">Capital amount being returned to the counterparty</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profit Earned</Label>
                <Input type="number" placeholder="900" value={settlementForm.profit} onChange={e => setSettlementForm(f => ({ ...f, profit: e.target.value }))} />
                <p className="text-[11px] text-muted-foreground">Profit amount (optional)</p>
              </div>
              <div className="space-y-2">
                <Label>{t('period')}</Label>
                <Input type="month" value={settlementForm.period_key} onChange={e => setSettlementForm(f => ({ ...f, period_key: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('noteOptional')}</Label>
              <Textarea placeholder="Final settlement note..." value={settlementForm.note} onChange={e => setSettlementForm(f => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
            <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <span>This will submit the settlement, record profit (if provided), and request deal closure. The counterparty must approve for the deal to finalize.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlementOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSubmitSettlement}>{t('submitForApproval')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Deal Dialog with Counter-Proposal */}
      <Dialog open={rejectDealOpen} onOpenChange={setRejectDealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="w-4 h-4 text-destructive" /> Reject Deal
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Reject this deal and suggest changes. Your counter-proposal will be sent to the counterparty.
            </p>
          </DialogHeader>
          {rejectDealData && (
            <div className="space-y-4 py-2">
              {/* Current deal summary */}
              <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Deal Terms</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{rejectDealData.deal_type?.replace(/_/g, ' ')}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono">${rejectDealData.amount?.toLocaleString()}</span></div>
                  {rejectDealData.metadata?.counterparty_share_pct && (
                    <div><span className="text-muted-foreground">Profit Share:</span> <span>{String(rejectDealData.metadata.counterparty_share_pct)}%</span></div>
                  )}
                  {rejectDealData.metadata?.partner_ratio && (
                    <div><span className="text-muted-foreground">Partner Ratio:</span> <span>{String(rejectDealData.metadata.partner_ratio)}%</span></div>
                  )}
                </div>
              </div>

              {/* Counter-proposal fields */}
              <div className="space-y-2">
                <Label>Suggested Amount ($)</Label>
                <Input type="number" placeholder={String(rejectDealData.amount || '')} value={rejectForm.suggested_amount} onChange={e => setRejectForm(f => ({ ...f, suggested_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Suggested Profit Share (%)</Label>
                <Input type="number" min="0" max="100" placeholder={rejectDealData.metadata?.counterparty_share_pct ? String(rejectDealData.metadata.counterparty_share_pct) : '50'} value={rejectForm.suggested_share_pct} onChange={e => setRejectForm(f => ({ ...f, suggested_share_pct: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Reason / Note</Label>
                <Textarea placeholder="Explain why you're rejecting and what terms you'd prefer..." value={rejectForm.note} onChange={e => setRejectForm(f => ({ ...f, note: e.target.value }))} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDealOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectDeal}>Reject & Send Proposal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
