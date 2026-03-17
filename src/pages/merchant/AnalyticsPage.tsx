import { useState, useEffect } from 'react';
import { analytics as analyticsApi } from '@/lib/api';
import type { PortfolioAnalytics } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/layout/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, AlertTriangle, Shield, Briefcase, PieChart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

const riskSeverityColors: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-warning text-warning-foreground',
  low: 'bg-muted text-muted-foreground',
};

export default function AnalyticsPage() {
  const t = useT();
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.get().then(res => {
      setAnalytics(res);
      setLoading(false);
    }).catch(err => {
      toast.error(err.message || t('failedLoadAnalytics'));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div dir={t.isRTL ? 'rtl' : 'ltr'}>
      <PageHeader title={t('analyticsTitle')} description={t('analyticsSub')} />
      <div className="p-6 space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t('totalDeployed')} value={`$${analytics.totalDeployed.toLocaleString()}`} icon={DollarSign} />
          <StatCard label={t('activeExposure')} value={`$${analytics.activeDeployed.toLocaleString()}`} icon={Briefcase} />
          <StatCard label={t('realizedProfit')} value={`$${analytics.realizedProfit.toLocaleString()}`} icon={TrendingUp} />
          <StatCard label={t('returnedCapital')} value={`$${analytics.returnedCapital.toLocaleString()}`} icon={DollarSign} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t('unsettledExposure')} value={`$${analytics.unsettledExposure.toLocaleString()}`} icon={Shield} />
          <StatCard label={t('overdueDeals')} value={analytics.overdueDeals} icon={AlertTriangle} />
          <StatCard label={t('activeRelationships')} value={analytics.activeRelationships} icon={Users} />
          <StatCard label={t('pendingApprovals')} value={analytics.pendingApprovals} icon={Shield} />
        </div>

        {/* Capital Owner View */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <PieChart className="w-4 h-4" /> {t('capitalOwnerBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.capitalByCounterparty.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('noCounterpartyData')}</p>
            )}
            <div className="space-y-3">
              {analytics.capitalByCounterparty.map(cp => (
                <div key={cp.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{cp.name}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{t('deployed')}: ${cp.deployed.toLocaleString()}</span>
                      <span>{t('returned')}: ${cp.returned.toLocaleString()}</span>
                      <span className={cp.profit >= 0 ? 'text-success' : 'text-destructive'}>
                        {t('profit')}: ${cp.profit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-display font-bold text-lg ${cp.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {cp.roi.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">{t('roi')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Deal Type Breakdown */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-display">{t('dealTypeDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(analytics.dealsByType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                  <Badge variant="outline" className="text-xs font-mono">{type}</Badge>
                  <span className="text-sm font-medium">{count} {count !== 1 ? t('dealsSuffix') : t('dealSuffix')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Indicators */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {t('riskIndicators')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.riskIndicators.length === 0 && (
              <div className="flex items-center gap-2 text-success text-sm">
                <Shield className="w-4 h-4" /> {t('noRiskIndicators')}
              </div>
            )}
            <div className="space-y-2">
              {analytics.riskIndicators.map((risk, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Badge className={riskSeverityColors[risk.severity]}>{risk.severity}</Badge>
                  <span className="text-sm">{risk.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
