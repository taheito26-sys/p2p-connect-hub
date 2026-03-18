import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { createDemoState } from '@/lib/tracker-demo-data';
import { useTheme } from '@/lib/theme-context';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { DEAL_TYPE_CONFIGS, calculateOutstanding } from '@/lib/deal-engine';
import { useRealtimeRefresh } from '@/hooks/use-realtime';
import {
  Loader2, Send, Users, Briefcase, DollarSign, CheckSquare,
  Plus, ArrowLeft, Check, X, AlertTriangle, Clock, MessageCircle,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantRelationship, MerchantMessage, MerchantDeal, MerchantApproval } from '@/types/domain';

/* ─── Helpers ─── */
function dealStatusStyle(status: string) {
  switch (status) {
    case 'active': return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30';
    case 'due': return 'bg-amber-500/10 text-amber-600 border border-amber-500/30';
    case 'overdue': return 'bg-red-500/10 text-red-500 border border-red-500/30';
    case 'settled': return 'bg-blue-500/10 text-blue-600 border border-blue-500/30';
    case 'draft': return 'bg-muted text-muted-foreground border border-border';
    case 'closed': return 'bg-muted text-muted-foreground border border-border';
    default: return 'bg-muted text-muted-foreground border border-border';
  }
}

/* ═══════════════════════════════════════════════════════════
   RELATIONSHIP WORKSPACE — Flat, deals-centric
   No tabs. Deals table = main content. Approvals = alert bars.
   Chat = collapsible bottom drawer (rare usage).
   ═══════════════════════════════════════════════════════════ */
export default function RelationshipWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuth();
  const { settings } = useTheme();
  const navigate = useNavigate();
  const t = useT();

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
  const [chatOpen, setChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const settlementSubmitLock = useRef(false);

  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settleDealId, setSettleDealId] = useState('');
  const [settlementForm, setSettlementForm] = useState({ amount: '', profit: '', period_key: '', note: '' });
  const [submittingSettlement, setSubmittingSettlement] = useState(false);
  const [rejectDealOpen, setRejectDealOpen] = useState(false);
  const [rejectDealId, setRejectDealId] = useState('');
  const [rejectDealData, setRejectDealData] = useState<MerchantDeal | null>(null);
  const [rejectForm, setRejectForm] = useState({ suggested_share_pct: '', suggested_amount: '', note: '' });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [
        { relationship }, { messages }, { deals: relDealsData }, { approvals: inbox }, { approvals: sent }
      ] = await Promise.all([
        api.relationships.get(id), api.messages.list(id), api.deals.list(id), api.approvals.inbox(), api.approvals.sent()
      ]);
      setRel(relationship);
      setMsgs(messages);
      setRelDeals(relDealsData);
      setRelApprovals([...inbox, ...sent].filter(a => a.relationship_id === id));
    } catch {
      toast.error(t('failedLoadWorkspace'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);
  useRealtimeRefresh(reload, ['new_message', 'approval_update', 'deal_update']);
  useEffect(() => { if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, chatOpen]);

  /* ─── Handlers ─── */
  const sendMsg = async () => {
    if (!msgInput.trim() || !id) return;
    try { await api.messages.send(id, msgInput.trim()); setMsgInput(''); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleAcceptDeal = async (dealId: string) => {
    try { await api.deals.update(dealId, { status: 'active' }); toast.success('Deal accepted'); await reload(); }
    catch (err: any) { toast.error(err.message); }
  };

  const openRejectDeal = (deal: MerchantDeal) => {
    setRejectDealId(deal.id); setRejectDealData(deal);
    setRejectForm({ suggested_share_pct: deal.metadata?.counterparty_share_pct ? String(deal.metadata.counterparty_share_pct) : '', suggested_amount: String(deal.amount || ''), note: '' });
    setRejectDealOpen(true);
  };

  const handleRejectDeal = async () => {
    try {
      const note = [rejectForm.note, rejectForm.suggested_amount ? `Suggested amount: $${rejectForm.suggested_amount}` : '', rejectForm.suggested_share_pct ? `Suggested profit share: ${rejectForm.suggested_share_pct}%` : ''].filter(Boolean).join(' | ');
      await api.deals.update(rejectDealId, { status: 'cancelled' });
      if (id && note) await api.messages.send(id, `⚠️ Deal rejected with counter-proposal:\n${note}`, 'system');
      toast.success('Deal rejected — counter-proposal sent');
      setRejectDealOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
  };

  const openSettlement = (dealId: string) => {
    setSettleDealId(dealId);
    setSettlementForm({ amount: '', profit: '', period_key: new Date().toISOString().substring(0, 7), note: '' });
    settlementSubmitLock.current = false;
    setSubmittingSettlement(false);
    setSettlementOpen(true);
  };

  const settlingDeal = relDeals.find(d => d.id === settleDealId);
  const isPartnershipSettle = settlingDeal?.deal_type === 'partnership';

  const handleSubmitSettlement = async () => {
    if (!settlementForm.amount || submittingSettlement || settlementSubmitLock.current) return;
    settlementSubmitLock.current = true;
    setSubmittingSettlement(true);
    try {
      const settleAmount = isPartnershipSettle ? 0 : parseFloat(settlementForm.amount);
      await api.deals.submitSettlement(settleDealId, { amount: settleAmount, note: settlementForm.note });
      if (settlementForm.profit && parseFloat(settlementForm.profit) > 0) {
        await api.deals.recordProfit(settleDealId, { amount: parseFloat(settlementForm.profit), period_key: settlementForm.period_key, note: settlementForm.note });
      }
      await api.deals.close(settleDealId, { note: isPartnershipSettle ? 'Profit-share deal closed — capital retained by merchant' : 'Auto-closed on settlement submission' });
      toast.success('Settlement submitted — deal will close once approved');
      setSettlementOpen(false);
      await reload();
    } catch (err: any) { toast.error(err.message); }
    finally {
      settlementSubmitLock.current = false;
      setSubmittingSettlement(false);
    }
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

  const pendingApprovals = relApprovals.filter(a => a.status === 'pending');
  const unreadMsgs = msgs.filter(m => !m.is_read && m.sender_user_id !== userId);
  const activeDeals = relDeals.filter(d => ['active', 'due', 'overdue'].includes(d.status));
  const counterpartyName = rel.counterparty?.display_name || t('workspace');

  const exposure = rel.summary?.activeExposure || 0;
  const realizedPnl = rel.summary?.realizedProfit || 0;
  const overdueCount = relDeals.filter(d => d.status === 'overdue').length;

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'} className="flex flex-col h-[calc(100vh-3.5rem)] border border-border/50 rounded-xl overflow-hidden bg-card mx-1 my-1">

      {/* ─── HEADER ─── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 h-[52px] border-b border-border bg-card">
        <button onClick={() => navigate('/network')} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-[14px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
          {counterpartyName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-medium">{counterpartyName}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
              rel.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
              rel.status === 'restricted' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' :
              'bg-muted text-muted-foreground border border-border'
            }`}>{rel.status}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{rel.my_role} · {rel.counterparty?.merchant_id} · Since {new Date(rel.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex-1" />

        {/* Chat toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors relative ${
            chatOpen ? 'bg-blue-500/10 border-blue-500/30 text-blue-600' : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Messages
          {unreadMsgs.length > 0 && !chatOpen && (
            <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-blue-500 text-white text-[9px] font-medium flex items-center justify-center px-0.5">
              {unreadMsgs.length}
            </div>
          )}
          {chatOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>

        {/* New deal */}
        <button
          onClick={() => setCreateDealOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('newDeal')}
        </button>
      </div>

      {/* ─── KPI STRIP ─── */}
      <div className="shrink-0 grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-border">
        <div className="px-3 py-2 rounded-lg bg-secondary">
          <p className="text-[11px] text-muted-foreground">{t('activeDeals')}</p>
          <p className="text-xl font-medium leading-tight mt-0.5">{activeDeals.length}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-secondary">
          <p className="text-[11px] text-muted-foreground">{t('activeExposure')}</p>
          <p className="text-xl font-medium leading-tight mt-0.5 font-mono">${exposure.toLocaleString()}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-secondary">
          <p className="text-[11px] text-muted-foreground">{t('realizedProfit')}</p>
          <p className={`text-xl font-medium leading-tight mt-0.5 font-mono ${realizedPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toLocaleString()}
          </p>
        </div>
        {overdueCount > 0 ? (
          <div className="px-3 py-2 rounded-lg bg-red-500/10">
            <p className="text-[11px] text-red-500">{t('overdue')}</p>
            <p className="text-xl font-medium leading-tight mt-0.5 text-red-500">{overdueCount}</p>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-secondary">
            <p className="text-[11px] text-muted-foreground">{t('pendingApprovalsLabel')}</p>
            <p className="text-xl font-medium leading-tight mt-0.5">{pendingApprovals.length}</p>
          </div>
        )}
      </div>

      {/* ─── APPROVAL ALERT BARS (only when pending) ─── */}
      {pendingApprovals.map(a => {
        const linkedDeal = a.target_entity_type === 'deal' ? relDeals.find(d => d.id === a.target_entity_id) : null;
        const payload = a.proposed_payload || {};
        return (
          <div key={a.id} className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[12px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              <span className="font-medium capitalize">{a.type.replace(/_/g, ' ')}</span>
              {linkedDeal && <span className="text-muted-foreground"> — {linkedDeal.title || DEAL_TYPE_CONFIGS[linkedDeal.deal_type]?.label}</span>}
              {payload.amount && <span className="text-muted-foreground"> · ${Number(payload.amount).toLocaleString()}</span>}
            </span>
            {a.reviewer_user_id === userId && (
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleApprove(a.id)} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"><Check className="w-3 h-3" /> {t('approve')}</button>
                <button onClick={() => handleReject(a.id)} className="px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        );
      })}

      {/* ─── DEALS TABLE (main content, full width) ─── */}
      <div className="flex-1 overflow-y-auto">
        {relDeals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('noDealsYet')}</p>
            <button onClick={() => setCreateDealOpen(true)} className="mt-3 text-[12px] font-medium text-blue-600 hover:underline">Create your first deal</button>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary sticky top-0 z-[1]">
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Deal</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dates</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">P&L</th>
                <th className="text-right px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {relDeals.map(deal => {
                const cfg = DEAL_TYPE_CONFIGS[deal.deal_type];
                const net = deal.realized_pnl ?? 0;
                const outstandingVal = calculateOutstanding(deal);
                return (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors relative">
                    {deal.status === 'overdue' && <td className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 rounded-r-sm p-0" />}
                    {deal.status === 'due' && <td className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500 rounded-r-sm p-0" />}

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0 ${
                          deal.status === 'overdue' ? 'bg-red-500/10' :
                          ['active', 'due'].includes(deal.status) ? 'bg-emerald-500/10' : 'bg-secondary'
                        }`}>{cfg?.icon || '📋'}</div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{cfg?.label || deal.deal_type}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{deal.title || deal.id.slice(0, 12)}</p>
                          {(deal.metadata?.customer_name || deal.metadata?.supplier_name) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {deal.metadata?.customer_name && <span>👤 {String(deal.metadata.customer_name)}</span>}
                              {deal.metadata?.customer_name && deal.metadata?.supplier_name && <span> · </span>}
                              {deal.metadata?.supplier_name && <span>📦 {String(deal.metadata.supplier_name)}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${dealStatusStyle(deal.status)}`}>{deal.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">
                      {deal.issue_date}{deal.due_date ? ` → ${deal.due_date}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <p className="font-mono font-medium">${deal.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{deal.currency}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {net !== 0 ? (
                        <span className={net >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                          {net >= 0 ? '+' : ''}${net.toLocaleString()}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        {deal.status === 'draft' && (
                          <>
                            <button onClick={() => handleAcceptDeal(deal.id)} className="px-2 py-1 rounded-md text-[11px] font-medium border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 transition-colors flex items-center gap-1"><Check className="w-3 h-3" /> Accept</button>
                            <button onClick={() => openRejectDeal(deal)} className="px-2 py-1 rounded-md text-[11px] border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"><X className="w-3 h-3" /></button>
                          </>
                        )}
                        {['active', 'due', 'overdue'].includes(deal.status) && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => openSettlement(deal.id)} className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 transition-colors flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" /> {t('settle')}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[200px] text-xs">Return capital, record profit, submit for approval.</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── CHAT DRAWER (collapsible) ─── */}
      {chatOpen && (
        <div className="shrink-0 border-t border-border flex flex-col" style={{ height: 240 }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary">
            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[12px] font-medium">Messages</span>
            {unreadMsgs.length > 0 && <span className="text-[11px] text-blue-600">· {unreadMsgs.length} unread</span>}
            <div className="flex-1" />
            <button onClick={() => setChatOpen(false)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-card transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1.5">
            {msgs.length === 0 && <p className="text-center text-muted-foreground text-xs py-4">{t('noMessagesYet')}</p>}
            {msgs.map(msg => {
              const isOwn = msg.sender_user_id === userId;
              const isSystem = msg.message_type === 'system';
              return (
                <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[72%] px-3 py-1.5 text-[12px] leading-[1.5] ${
                    isSystem ? 'bg-secondary text-muted-foreground text-center text-[11px] italic rounded-md max-w-full'
                    : isOwn ? 'bg-foreground text-background rounded-[12px_12px_3px_12px]'
                    : 'bg-secondary rounded-[12px_12px_12px_3px]'
                  }`}>
                    {!isSystem && !isOwn && <p className="text-[10px] text-muted-foreground mb-0.5">{msg.sender_name || msg.sender_merchant_id}</p>}
                    <p>{msg.body}</p>
                    <p className={`text-[9px] mt-0.5 ${isOwn ? 'opacity-40' : 'text-muted-foreground'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
            <div className="flex-1 flex items-center px-3 h-8 rounded-full bg-secondary text-[12px]">
              <input placeholder={t('typeMessage')} value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()}
                className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground text-[12px]" />
            </div>
            <button onClick={sendMsg} className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center shrink-0"><Send className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      {/* ─── DIALOGS (unchanged logic) ─── */}
      <CreateDealDialog open={createDealOpen} onOpenChange={setCreateDealOpen} relationshipId={id!} counterpartyName={counterpartyName} onCreated={reload} customers={sharedCustomers} suppliers={sharedSuppliers} trackerState={trackerState} onStateChange={setTrackerState} />

      <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle & Close Deal</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Submit the capital return and profit. Once the counterparty approves, the deal closes automatically.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isPartnershipSettle ? (
              <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400">
                Capital stays with the merchant. Only the profit earned is submitted for settlement.
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('amountUsdtLabel')} *</Label>
                <Input type="number" placeholder="8000" value={settlementForm.amount} onChange={e => setSettlementForm(f => ({ ...f, amount: e.target.value }))} />
                <p className="text-[11px] text-muted-foreground">Capital amount being returned</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Profit Earned</Label><Input type="number" placeholder="900" value={settlementForm.profit} onChange={e => setSettlementForm(f => ({ ...f, profit: e.target.value }))} /></div>
              <div className="space-y-2"><Label>{t('period')}</Label><Input type="month" value={settlementForm.period_key} onChange={e => setSettlementForm(f => ({ ...f, period_key: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>{t('noteOptional')}</Label><Textarea placeholder="Settlement note..." value={settlementForm.note} onChange={e => setSettlementForm(f => ({ ...f, note: e.target.value }))} rows={2} /></div>
            <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>This will submit the settlement, record profit, and request deal closure.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlementOpen(false)} disabled={submittingSettlement}>{t('cancel')}</Button>
            <Button onClick={handleSubmitSettlement} disabled={submittingSettlement}>
              {submittingSettlement ? 'Submitting...' : t('submitForApproval')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDealOpen} onOpenChange={setRejectDealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Reject Deal</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Reject and suggest changes.</p>
          </DialogHeader>
          {rejectDealData && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Terms</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{rejectDealData.deal_type?.replace(/_/g, ' ')}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono">${rejectDealData.amount?.toLocaleString()}</span></div>
                  {rejectDealData.metadata?.counterparty_share_pct && <div><span className="text-muted-foreground">Share:</span> {String(rejectDealData.metadata.counterparty_share_pct)}%</div>}
                </div>
              </div>
              <div className="space-y-2"><Label>Suggested Amount ($)</Label><Input type="number" placeholder={String(rejectDealData.amount || '')} value={rejectForm.suggested_amount} onChange={e => setRejectForm(f => ({ ...f, suggested_amount: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Suggested Profit Share (%)</Label><Input type="number" min="0" max="100" value={rejectForm.suggested_share_pct} onChange={e => setRejectForm(f => ({ ...f, suggested_share_pct: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Reason</Label><Textarea placeholder="Why are you rejecting?" value={rejectForm.note} onChange={e => setRejectForm(f => ({ ...f, note: e.target.value }))} rows={3} /></div>
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
