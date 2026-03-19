import { useState, useEffect, useCallback } from 'react';
import { deals as dealsApi, relationships as relationshipsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';
import { getAgreementFamilyLabel, getDealShares } from '@/lib/deal-templates';
import { isSupportedDealType } from '@/types/domain';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MerchantDeal, MerchantRelationship } from '@/types/domain';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-success text-success-foreground',
  due: 'bg-warning text-warning-foreground',
  settled: 'bg-primary text-primary-foreground',
  closed: 'bg-secondary text-secondary-foreground',
  overdue: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function DealsPage() {
  const { userId } = useAuth();
  const t = useT();
  const [allDeals, setAllDeals] = useState<MerchantDeal[]>([]);
  const [relationships, setRelationships] = useState<MerchantRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingDeal, setEditingDeal] = useState<MerchantDeal | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');

  // Delete confirm
  const [deleteDealId, setDeleteDealId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [dealsRes, relationshipsRes] = await Promise.all([
        dealsApi.list(),
        relationshipsApi.list(),
      ]);
      setAllDeals(dealsRes.deals);
      setRelationships(relationshipsRes.relationships);
    } catch (err: any) {
      toast.error(t('failedLoadDeals'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { reload(); }, [reload]);

  const openEdit = (deal: MerchantDeal) => {
    setEditingDeal(deal);
    setEditTitle(deal.title || '');
    setEditAmount(String(deal.amount || 0));
    setEditStatus(deal.status || 'draft');
    setEditNote(String((deal.metadata as any)?.note || ''));
  };

  const saveEdit = async () => {
    if (!editingDeal) return;
    const amount = Number(editAmount);
    if (!(amount > 0)) { toast.error(t('fixFields') + ' ' + t('amountLabel')); return; }
    try {
      const existingMeta = (editingDeal.metadata || {}) as Record<string, unknown>;
      await dealsApi.update(editingDeal.id, {
        title: editTitle,
        amount,
        status: editStatus as any,
        metadata: { ...existingMeta, note: editNote },
      });
      await reload();
      setEditingDeal(null);
      toast.success(t('saveCorrection'));
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmDelete = async () => {
    if (!deleteDealId) return;
    try {
      await dealsApi.update(deleteDealId, { status: 'cancelled' });
      await reload();
      setDeleteDealId(null);
      setEditingDeal(null);
      toast.success(t('dealCancelled'));
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('dealsLabel')} description={t('allDealsAcross')} />
      <div className="p-6">
        {allDeals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('noDeals')}</p>
            <p className="text-xs mt-1">{t('createDealsFromWorkspace')}</p>
          </div>
        )}

        {allDeals.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('deal')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('merchant')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('dates')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('amountLabel')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">P&L</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {allDeals.map(deal => {
                  const relationship = relationships.find(rel => rel.id === deal.relationship_id);
                  const isDealCreator = deal.created_by === userId;
                  const { label: familyLabel, icon: familyIcon } = getAgreementFamilyLabel(deal.deal_type, t.lang);
                  const { partnerPct } = getDealShares(deal);
                  const isLegacy = !isSupportedDealType(deal.deal_type);
                  const merchantName = relationship?.counterparty?.display_name || '—';
                  const customerName = String((deal.metadata as any)?.customer_name || '');
                  const isCancelled = deal.status === 'cancelled';

                  return (
                    <tr key={deal.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{familyIcon}</span>
                          <div>
                            <p className="font-medium text-sm">{deal.title || familyLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {familyLabel}
                              {customerName && ` · ${customerName}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${statusColors[deal.status] || statusColors.draft}`}>{deal.status}</Badge>
                        {isLegacy && <Badge variant="secondary" className="text-xs ml-1">{t('legacyAgreement')}</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {merchantName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{merchantName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {deal.issue_date && <span>{deal.issue_date}</span>}
                        {deal.due_date && <span className="ml-1">→ {deal.due_date}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold">${deal.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{deal.currency}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deal.realized_pnl != null ? (
                          <span className={`font-bold ${deal.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {deal.realized_pnl >= 0 ? '+' : ''}${deal.realized_pnl.toLocaleString()}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(deal)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
                          >
                            {t('edit')}
                          </button>
                          {!isCancelled && (
                            <button
                              onClick={() => setDeleteDealId(deal.id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              {t('delete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── EDIT DEAL DIALOG ─── */}
      <Dialog open={!!editingDeal} onOpenChange={open => !open && setEditingDeal(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{t('correctTradeTitle')}</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            {t('editInPlaceWarning')}
          </div>

          {editingDeal && (
            <div className="rounded-lg border border-green-500/25 bg-green-500/5 p-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-green-600 mb-2">{t('currentStatsLabel')}</div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">{t('amountLabel')}</span>
                <strong className="font-mono text-sm">${editingDeal.amount.toLocaleString()}</strong>
              </div>
              {editingDeal.realized_pnl != null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">P&L</span>
                  <strong className={`font-mono text-sm ${editingDeal.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {editingDeal.realized_pnl >= 0 ? '+' : ''}${editingDeal.realized_pnl.toLocaleString()}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('dealTitleLabel')}</label>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('amountLabel')}</label>
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('status')}</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="settled">Settled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('note')}</label>
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 flex-row justify-between items-center">
            <button
              onClick={() => editingDeal && setDeleteDealId(editingDeal.id)}
              className="px-3 py-2 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold hover:bg-destructive/10 transition-colors"
            >
              {t('delete')}
            </button>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setEditingDeal(null)}
                className="px-4 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                {t('saveCorrection')}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION DIALOG ─── */}
      <Dialog open={!!deleteDealId} onOpenChange={open => !open && setDeleteDealId(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{t('confirmDeleteDeal')}</DialogTitle>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {t('deleteDealWarning')}
          </div>
          <DialogFooter className="mt-4 flex-row justify-end gap-2">
            <button
              onClick={() => setDeleteDealId(null)}
              className="px-4 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors"
            >
              {t('delete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
