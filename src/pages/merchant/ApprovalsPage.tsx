import { useState, useEffect } from 'react';
import { approvals as approvalsApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantApproval } from '@/types/domain';

const statusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  approved: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};

export default function ApprovalsPage() {
  const t = useT();
  const [inbox, setInbox] = useState<MerchantApproval[]>([]);
  const [sent, setSent] = useState<MerchantApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [i, s] = await Promise.all([approvalsApi.inbox(), approvalsApi.sent()]);
      setInbox(i.approvals);
      setSent(s.approvals);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    try { await approvalsApi.approve(id); toast.success(t('approved')); load(); }
    catch (err: any) { toast.error(err.message); }
  };
  const handleReject = async (id: string) => {
    try { await approvalsApi.reject(id); toast.success(t('rejected')); load(); }
    catch (err: any) { toast.error(err.message); }
  };

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('approvals')} description={t('manageInvites')} />
      <div className="p-6">
        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">{t('toReview')} ({inbox.filter(a => a.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="sent">{t('submitted')} ({sent.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4 space-y-3">
            {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
            {!loading && inbox.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{t('noApprovalsToReview')}</p>
              </div>
            )}
            {inbox.map(a => (
              <Card key={a.id} className="glass">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{a.type.replace(/_/g, ' ')}</p>
                      <Badge className={statusColors[a.status]}>{a.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('target')}: {a.target_entity_type} • {t('submitted')}: {new Date(a.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  {a.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(a.id)} className="gap-1"><Check className="w-3.5 h-3.5" /> {t('approve')}</Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(a.id)} className="gap-1"><X className="w-3.5 h-3.5" /> {t('reject')}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="sent" className="mt-4 space-y-3">
            {sent.map(a => (
              <Card key={a.id} className="glass">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{a.type.replace(/_/g, ' ')}</p>
                      <Badge className={statusColors[a.status]}>{a.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('submitted')}: {new Date(a.submitted_at).toLocaleDateString()}
                      {a.resolution_note && ` • ${a.resolution_note}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
