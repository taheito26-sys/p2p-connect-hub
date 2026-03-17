import { useState, useEffect } from 'react';
import { invites as invitesApi } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X, RotateCcw, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantInvite } from '@/types/domain';

const statusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  accepted: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  withdrawn: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};

export default function InvitationsPage() {
  const [inbox, setInbox] = useState<MerchantInvite[]>([]);
  const [sent, setSent] = useState<MerchantInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [i, s] = await Promise.all([invitesApi.inbox(), invitesApi.sent()]);
      setInbox(i.invites);
      setSent(s.invites);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAccept = async (id: string) => {
    try {
      await invitesApi.accept(id);
      toast.success('Invite accepted!');
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleReject = async (id: string) => {
    try {
      await invitesApi.reject(id);
      toast.success('Invite rejected');
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleWithdraw = async (id: string) => {
    try {
      await invitesApi.withdraw(id);
      toast.success('Invite withdrawn');
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div>
      <PageHeader title="Invitations" description="Manage collaboration invites" />
      <div className="p-6">
        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">Inbox ({inbox.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4 space-y-3">
            {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
            {!loading && inbox.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No invitations in your inbox</p>
              </div>
            )}
            {inbox.map(inv => (
              <Card key={inv.id} className="glass">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{inv.from_display_name}</p>
                      <Badge className={statusColors[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inv.purpose && <span>{inv.purpose} • </span>}
                      Role: {inv.requested_role} • From: @{inv.from_nickname}
                    </p>
                    {inv.message && <p className="text-sm mt-2 text-muted-foreground italic">"{inv.message}"</p>}
                  </div>
                  {inv.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAccept(inv.id)} className="gap-1"><Check className="w-3.5 h-3.5" /> Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(inv.id)} className="gap-1"><X className="w-3.5 h-3.5" /> Reject</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="sent" className="mt-4 space-y-3">
            {!loading && sent.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No sent invitations</p>
              </div>
            )}
            {sent.map(inv => (
              <Card key={inv.id} className="glass">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">To: {inv.to_display_name || inv.to_merchant_id}</p>
                      <Badge className={statusColors[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{inv.purpose || 'General collaboration'}</p>
                  </div>
                  {inv.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => handleWithdraw(inv.id)} className="gap-1">
                      <RotateCcw className="w-3.5 h-3.5" /> Withdraw
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
