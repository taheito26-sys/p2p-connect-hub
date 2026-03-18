import { useState, useEffect, useCallback } from 'react';
import { deals as dealsApi, relationships as relationshipsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';
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
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('dealsLabel')} description={t('allDealsAcross')} />
      <div className="p-6 space-y-3">
        {allDeals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('noDeals')}</p>
            <p className="text-xs mt-1">{t('createDealsFromWorkspace')}</p>
          </div>
        )}
        {allDeals.map(deal => {
          const relationship = relationships.find(rel => rel.id === deal.relationship_id);
          const isDealCreator = deal.created_by === userId;
          const roi = deal.realized_pnl != null && deal.amount > 0 ? (deal.realized_pnl / deal.amount) * 100 : null;

          return (
            <Card key={deal.id} className="glass">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{deal.title}</p>
                    <Badge variant="outline" className="text-xs font-mono">{deal.deal_type}</Badge>
                    <Badge className={statusColors[deal.status]}>{deal.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{t('issued')}: {deal.issue_date}</span>
                    {deal.due_date && <span>{t('due')}: {deal.due_date}</span>}
                    {!isDealCreator && relationship?.counterparty?.display_name && (
                      <span>{t('merchantLabel')}: <strong className="text-foreground">{relationship.counterparty.display_name}</strong></span>
                    )}
                    {deal.realized_pnl != null && <span>P&L: ${deal.realized_pnl.toLocaleString()}</span>}
                    {roi != null && <span>ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%</span>}
                  </div>
                  {isDealCreator && (deal.metadata?.customer_name || deal.metadata?.supplier_name) && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {deal.metadata?.customer_name && (
                        <span className="flex items-center gap-1">👤 {t('dealLinkedCustomer')}: <strong className="text-foreground">{String(deal.metadata.customer_name)}</strong></span>
                      )}
                      {deal.metadata?.supplier_name && (
                        <span className="flex items-center gap-1">📦 {t('dealLinkedSupplier')}: <strong className="text-foreground">{String(deal.metadata.supplier_name)}</strong></span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-lg">${deal.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{deal.currency}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
