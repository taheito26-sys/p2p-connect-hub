import { useState, useEffect, useCallback } from 'react';
import { deals as dealsApi } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase } from 'lucide-react';
import type { MerchantDeal } from '@/types/domain';

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
  const [allDeals, setAllDeals] = useState<MerchantDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await dealsApi.list();
      setAllDeals(res.deals);
    } catch (err: any) {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div>
      <PageHeader title="Deals" description="All deals across relationships" />
      <div className="p-6 space-y-3">
        {allDeals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No deals yet</p>
            <p className="text-xs mt-1">Create deals from within a relationship workspace.</p>
          </div>
        )}
        {allDeals.map(deal => (
          <Card key={deal.id} className="glass">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{deal.title}</p>
                  <Badge variant="outline" className="text-xs font-mono">{deal.deal_type}</Badge>
                  <Badge className={statusColors[deal.status]}>{deal.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Issued: {deal.issue_date}</span>
                  {deal.due_date && <span>Due: {deal.due_date}</span>}
                  {deal.realized_pnl != null && <span>P&L: ${deal.realized_pnl.toLocaleString()}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-lg">${deal.amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{deal.currency}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
