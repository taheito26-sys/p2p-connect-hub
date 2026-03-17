import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { relationships as relApi } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantRelationship } from '@/types/domain';

const statusColors: Record<string, string> = {
  active: 'bg-success text-success-foreground',
  restricted: 'bg-warning text-warning-foreground',
  suspended: 'bg-destructive text-destructive-foreground',
  terminated: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

export default function RelationshipsPage() {
  const [rels, setRels] = useState<MerchantRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { relationships } = await relApi.list();
        setRels(relationships);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load relationships');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Relationships" description="Active merchant collaborations" />
      <div className="p-6 space-y-3">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
        {!loading && rels.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No relationships yet</p>
            <p className="text-xs mt-1">Accept an invite or send one from the Directory to start collaborating.</p>
          </div>
        )}
        {rels.map(rel => (
          <Link key={rel.id} to={`/merchant/relationships/${rel.id}`}>
            <Card className="glass hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rel.counterparty?.display_name || 'Unknown'}</p>
                    <Badge className={statusColors[rel.status]}>{rel.status}</Badge>
                    <Badge variant="outline" className="font-mono text-xs">{rel.relationship_type}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>ID: {rel.counterparty?.merchant_id}</span>
                    <span>Role: {rel.my_role}</span>
                    {rel.summary && (
                      <>
                        <span>{rel.summary.totalDeals} deals</span>
                        <span>Exposure: ${rel.summary.activeExposure.toLocaleString()}</span>
                        {rel.summary.pendingApprovals > 0 && (
                          <Badge className="bg-warning text-warning-foreground text-[10px]">
                            {rel.summary.pendingApprovals} pending
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
