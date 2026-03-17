import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Users, ExternalLink } from 'lucide-react';
import type { MerchantMessage } from '@/types/domain';

interface ConversationSummary {
  relationshipId: string;
  counterpartyName: string;
  counterpartyMerchantId: string;
  status: string;
  lastMessage: MerchantMessage | null;
  unreadCount: number;
}

export default function MessagesPage() {
  const { userId } = useAuth();
  const t = useT();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { relationships } = await api.relationships.list();
      const convoPromises = relationships.map(async (rel) => {
        const { messages } = await api.messages.list(rel.id);
        const unread = messages.filter(m => !m.is_read && m.sender_user_id !== userId).length;
        return {
          relationshipId: rel.id,
          counterpartyName: rel.counterparty?.display_name || 'Unknown',
          counterpartyMerchantId: rel.counterparty?.merchant_id || '',
          status: rel.status,
          lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
          unreadCount: unread,
        };
      });

      const convos = await Promise.all(convoPromises);
      convos.sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return tb - ta;
      });
      setConversations(convos);
    } catch (err: any) {
      toast.error(t('failedLoadMessages'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unreadCount, 0), [conversations]);

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('messagesLabel')} description={`${t('messagesAcrossRels')}${totalUnread > 0 ? ` · ${totalUnread} ${t('unread')}` : ''}`} />
      <div className="p-6 space-y-3">
        {conversations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('noConversations')}</p>
            <p className="text-xs mt-1">{t('messagesAppear')}</p>
          </div>
        )}
        {conversations.map(convo => (
          <Link key={convo.relationshipId} to={`/network/relationships/${convo.relationshipId}`}>
            <Card className="glass hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{convo.counterpartyName}</p>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">{convo.counterpartyMerchantId}</Badge>
                      {convo.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shrink-0">{convo.unreadCount}</Badge>}
                    </div>
                    {convo.lastMessage ? (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {convo.lastMessage.message_type === 'system' ? '📋 ' : ''}
                        {convo.lastMessage.sender_user_id === userId ? `${t('you')}: ` : ''}
                        {convo.lastMessage.body}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic mt-0.5">{t('noMessagesShort')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {convo.lastMessage && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(convo.lastMessage.created_at).toLocaleDateString()}
                    </span>
                  )}
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
