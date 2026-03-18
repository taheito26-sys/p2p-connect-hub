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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { DEAL_TYPE_CONFIGS, calculateOutstanding } from '@/lib/deal-engine';
import { useRealtimeRefresh } from '@/hooks/use-realtime';
import {
  Loader2, Send, Users, Briefcase, DollarSign, CheckSquare, Shield,
  Plus, ArrowRight, Lock, ArrowLeft, Check, X, AlertTriangle, Clock,
} from 'lucide-react';
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
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

  const handleActivateDeal = async (dealId: string) => {
    try { await api.deals.update(dealId, { status: 'active' }); toast.success(t('dealActivated')); await reload(); }
    catch (err: any) { toast.error(err.message); }
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
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="deals" className="gap-1">
              {t('dealsLabel')} {relDeals.length > 0 && <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">{relDeals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1">
              {t('messagesLabel')} {unreadMsgs.length > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">{unreadMsgs.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1">
              {t('approvalsLabel')} {pendingApprovals.length > 0 && <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0">{pendingApprovals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="audit">{t('auditLabel')}</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass">
                <CardHeader><CardTitle className="text-sm font-display">{t('relationshipDetails')}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('type')}</span><span className="capitalize">{rel.relationship_type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('yourRole')}</span><span className="capitalize">{rel.my_role}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('sharedFields')}</span><span>{rel.shared_fields?.join(', ') || t('all')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('created')}</span><span>{new Date(rel.created_at).toLocaleDateString()}</span></div>
                  {rel.approval_policy && Object.keys(rel.approval_policy).length > 0 && (
                    <>
                      <div className="border-t border-border pt-2 mt-2">
                        <p className="text-xs font-mono uppercase text-muted-foreground mb-1">{t('approvalPolicy')}</p>
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

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-sm font-display flex items-center justify-between">
                    {t('activeDeals')}
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setCreateDealOpen(true)}>
                      <Plus className="w-3 h-3 mr-1" /> {t('newDeal')}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeDeals.length === 0 && <p className="text-sm text-muted-foreground">{t('noActiveDealsShort')}</p>}
                  {activeDeals.slice(0, 5).map(deal => {
                    const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                    const outstandingVal = calculateOutstanding(deal);
                    return (
                      <div key={deal.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{cfg?.icon || '📋'}</span>
                          <div>
                            <p className="font-medium text-xs">{deal.title}</p>
                            <p className="text-[10px] text-muted-foreground">{cfg?.label} • {deal.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs font-bold">${deal.amount.toLocaleString()}</p>
                          {outstandingVal.outstanding > 0 && (
                            <p className="text-[10px] text-warning">{t('outstanding')}: ${outstandingVal.outstanding.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card className="glass">
              <CardHeader><CardTitle className="text-sm font-display">{t('recentActivity')}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {auditLogs.slice(0, 8).map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                    <Badge variant="outline" className="text-[9px] font-mono">{log.entity_type}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(log.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                {auditLogs.length === 0 && <p className="text-sm text-muted-foreground">{t('noActivityYet')}</p>}
              </CardContent>
            </Card>
          </TabsContent>

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
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleActivateDeal(deal.id)}>
                              <ArrowRight className="w-3 h-3 mr-1" /> {t('activate')}
                            </Button>
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
              <CardContent className="p-0">
                <div className="h-80 overflow-y-auto p-4 space-y-3">
                  {msgs.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{t('noMessagesYet')}</p>}
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

          {/* AUDIT */}
          <TabsContent value="audit" className="mt-4 space-y-2">
            {auditLogs.length === 0 && (
              <Card className="glass"><CardContent className="py-8 text-center text-muted-foreground">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>{t('noAuditEvents')}</p>
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
    </div>
  );
}
