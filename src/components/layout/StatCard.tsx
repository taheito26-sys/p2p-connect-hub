import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn('glass rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-display font-bold">{value}</p>
      {trend && (
        <p className={cn('text-xs mt-1', trendUp ? 'text-success' : 'text-destructive')}>
          {trend}
        </p>
      )}
    </div>
  );
}
