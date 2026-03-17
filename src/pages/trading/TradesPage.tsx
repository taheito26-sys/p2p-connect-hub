import { useState, useEffect } from 'react';
import { trading } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeftRight, ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import type { Trade } from '@/types/domain';

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { trades: t } = await trading.getTrades();
        setTrades(t);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Trades" description="Trade history with FIFO allocation" />
      <div className="p-6 space-y-2">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {!loading && trades.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No trades recorded</p>
          </div>
        )}
        {trades.map(t => {
          const pnl = t.side === 'sell' && t.allocated_cost != null
            ? (t.unit_price * t.quantity - t.fee) - t.allocated_cost
            : null;
          return (
            <Card key={t.id} className="glass">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    t.side === 'buy' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {t.side === 'buy' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.asset_symbol}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">{t.side}</Badge>
                      {t.status === 'void' && <Badge className="bg-muted text-muted-foreground text-[10px]">VOID</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.traded_at).toLocaleDateString()} • {t.quantity.toFixed(4)} @ ${t.unit_price.toFixed(4)}
                      {t.fee > 0 && ` • Fee: $${t.fee.toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">${(t.quantity * t.unit_price).toFixed(2)}</p>
                  {pnl != null && (
                    <p className={`text-xs font-mono ${pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      P&L: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
