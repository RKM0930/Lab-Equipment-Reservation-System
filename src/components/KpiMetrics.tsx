import { Boxes, CalendarClock, PackageCheck } from 'lucide-react';
import type { Equipment, Reservation } from '../types/lab';
import { pluralize } from '../lib/format';

interface KpiMetricsProps {
  equipment: Equipment[];
  reservations: Reservation[];
  loading: boolean;
}

interface MetricCard {
  label: string;
  value: number;
  helper: string;
  icon: typeof Boxes;
  iconClassName: string;
}

function MetricSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-3 h-7 w-14" />
      <div className="skeleton mt-2 h-3 w-32" />
    </div>
  );
}

export function KpiMetrics({ equipment, reservations, loading }: KpiMetricsProps) {
  const totalEquipment = equipment.length;
  const totalAvailable = equipment.reduce((sum, item) => sum + item.available_qty, 0);
  const totalUnits = equipment.reduce((sum, item) => sum + item.total_qty, 0);
  const activeReservations = reservations.filter((reservation) => reservation.status === 'ACTIVE');
  const activeUnits = activeReservations.reduce((sum, reservation) => sum + reservation.quantity, 0);
  const categories = new Set(equipment.map((item) => item.category)).size;

  const metrics: MetricCard[] = [
    {
      label: 'Registered equipment',
      value: totalEquipment,
      helper: `${pluralize(categories, 'category', 'categories')} in the catalog`,
      icon: Boxes,
      iconClassName: 'text-slate-500',
    },
    {
      label: 'Available units',
      value: totalAvailable,
      helper: `of ${pluralize(totalUnits, 'registered unit')}`,
      icon: PackageCheck,
      iconClassName: 'text-emerald-500',
    },
    {
      label: 'Active reservations',
      value: activeReservations.length,
      helper: activeUnits === 0 ? 'No active bookings' : `${pluralize(activeUnits, 'unit')} in active bookings`,
      icon: CalendarClock,
      iconClassName: 'text-amber-500',
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-500">{metric.label}</p>
              <Icon className={`h-4 w-4 shrink-0 ${metric.iconClassName}`} aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {metric.value}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{metric.helper}</p>
          </article>
        );
      })}
    </div>
  );
}
