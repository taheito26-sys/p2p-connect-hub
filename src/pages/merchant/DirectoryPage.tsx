import { useState } from 'react';
import { merchant as merchantApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { MerchantSearchResult } from '@/types/domain';

export default function DirectoryPage() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MerchantSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length < 2) { toast.error(t('enterMin2Chars')); return; }
    setLoading(true);
    try {
      const { results: r } = await merchantApi.search(query);
      setResults(r);
      setSearched(true);
    } catch (err: any) {
      toast.error(err.message || t('searchFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('platformDirectory')} description={t('discoverMerchants')} />
      <div className="p-6 space-y-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('search')}
          </Button>
        </form>

        {searched && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('noMerchantsFound')} "{query}"</p>
          </div>
        )}

        <div className="grid gap-3">
          {results.map(r => (
            <Card key={r.id} className="glass hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{r.display_name}</p>
                    <Badge variant="outline" className="font-mono text-xs">{r.merchant_type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-mono text-primary">{r.merchant_id}</span>
                    <span className="text-xs text-muted-foreground">@{r.nickname}</span>
                    {r.region && <span className="text-xs text-muted-foreground">{r.region}</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> {t('invite')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
