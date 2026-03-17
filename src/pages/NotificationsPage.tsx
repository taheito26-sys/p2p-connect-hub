import { useState, useEffect } from 'react';
import { notifications as notifApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantNotification } from '@/types/domain';

export default function NotificationsPage() {
  const t = useT();
  const [notifs, setNotifs] = useState<MerchantNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { notifications: n } = await notifApi.list(100);
      setNotifs(n);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    try {
      await notifApi.markAllRead();
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('notificationsTitle')} description={t('allNotifications')}>
        <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1">
          <CheckCheck className="w-4 h-4" /> {t('markAllRead')}
        </Button>
      </PageHeader>
      <div className="p-6 space-y-2">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {!loading && notifs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('noNotifications')}</p>
          </div>
        )}
        {notifs.map(n => (
          <Card key={n.id} className={`glass ${!n.read_at ? 'border-primary/30' : ''}`}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${n.read_at ? 'bg-muted-foreground/30' : 'bg-primary animate-pulse-glow'}`} />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{n.category}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
