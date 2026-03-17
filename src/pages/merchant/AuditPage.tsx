import { useState, useEffect } from 'react';
import { audit as auditApi } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditLog } from '@/types/domain';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { logs: l } = await auditApi.activity();
        setLogs(l);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Audit Trail" description="Complete activity history" />
      <div className="p-6 space-y-2">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No audit events yet</p>
          </div>
        )}
        {logs.map(log => (
          <Card key={log.id} className="glass">
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{log.entity_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
