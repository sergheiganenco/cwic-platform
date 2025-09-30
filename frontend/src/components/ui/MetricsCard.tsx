// src/components/ui/MetricsCard.tsx
import {
  CheckCircle,
  Database,
  Grid3x3,
  LucideIcon,
  ShieldCheck,
  Table,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { memo } from 'react';

const ICONS: Record<string, LucideIcon> = {
  database: Database,
  table: Table,
  'check-circle': CheckCircle,
  grid: Grid3x3,
  'shield-check': ShieldCheck,
  users: Users,
};

type Variant = 'default' | 'success' | 'warning' | 'error';
type TrendDir = 'up' | 'down';

export interface MetricsCardProps {
  title: string;
  /** Accepts number or string (we'll coerce safely) */
  value: number | string;
  /** Optional trend object; value will be formatted to % */
  trend?: {
    value: number;
    direction: TrendDir;
    period: string;
  };
  /** Optional percentage badge under the value (0..100) */
  percentage?: number;
  /** Icon key from ICONS; optional for compact cards */
  icon?: keyof typeof ICONS;
  variant?: Variant;
  className?: string;
  /** For a11y; if omitted we'll build one from props */
  ariaLabel?: string;
  /** data-testid hook for e2e/unit tests */
  'data-testid'?: string;
}

/** ——— helpers ——— */
const asNumber = (n: unknown, fallback = 0): number => {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
};
const asString = (v: unknown, fallback = '—'): string => {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v.toLocaleString();
  try {
    return String(v);
  } catch {
    return fallback;
  }
};

const variantStyles: Record<Variant, string> = {
  default: 'bg-white border-gray-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
  error: 'bg-red-50 border-red-200',
};
const iconStyles: Record<Variant, string> = {
  default: 'text-gray-500',
  success: 'text-green-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

export const MetricsCard = memo<MetricsCardProps>(function MetricsCard({
  title,
  value,
  trend,
  percentage,
  icon,
  variant = 'default',
  className = '',
  ariaLabel,
  'data-testid': testId,
}) {
  const IconComponent = icon ? ICONS[icon] : null;
  const displayValue = asString(value);
  const pct = percentage == null ? null : Math.max(0, Math.min(100, asNumber(percentage)));

  const label =
    ariaLabel ??
    `${title}: ${displayValue}${pct != null ? ` (${pct.toFixed(1)}% of total)` : ''}${
      trend ? `. Trend ${trend.direction} ${asNumber(trend.value)}% ${trend.period}` : ''
    }`;

  return (
    <div
      className={`rounded-xl border p-4 ${variantStyles[variant]} ${className}`}
      role="group"
      aria-label={label}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {IconComponent ? <IconComponent className={`h-5 w-5 ${iconStyles[variant]}`} /> : null}
          <span className="truncate text-sm text-gray-600">{title}</span>
        </div>

        {trend && Number.isFinite(trend.value) && (
          <div
            className="flex items-center gap-1"
            aria-label={`Trend ${trend.direction} ${asNumber(trend.value)}% ${trend.period}`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={`text-xs ${
                trend.direction === 'up' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {asNumber(trend.value).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="text-2xl font-bold text-gray-900">{displayValue}</div>
        {pct != null && (
          <div className="mt-1 text-xs text-gray-500">{pct.toFixed(1)}% of total</div>
        )}
      </div>
    </div>
  );
});
