import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type { AuthUser, Reservation, ReservationStatus, UserRole } from '../types/lab';
import { Modal } from './ui/Modal';
import { formatDate, formatTimeSlot, formatTimestamp, pluralize } from '../lib/format';
import { toErrorMessage } from '../services/reservationService';

type StatusFilter = 'ALL' | ReservationStatus;

interface ReservationLogProps {
  reservations: Reservation[];
  loading: boolean;
  user: AuthUser | null;
  activeRole: UserRole;
  onCancel: (reservation: Reservation) => Promise<void>;
  onReturn: (reservation: Reservation) => void;
  onSignIn: () => void;
}

const FILTERS: StatusFilter[] = ['ALL', 'ACTIVE', 'RETURNED', 'CANCELLED'];

const STATUS_STYLES: Record<
  ReservationStatus,
  { label: string; className: string; dot: string }
> = {
  ACTIVE: {
    label: 'Active',
    className: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  RETURNED: {
    label: 'Returned',
    className: 'text-slate-500',
    dot: 'bg-slate-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'text-zinc-500',
    dot: 'bg-zinc-400',
  },
};

function StatusLabel({ status }: { status: ReservationStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${style.className}`}>
      <span className={`status-dot ${style.dot}`} />
      {style.label}
    </span>
  );
}

interface ReservationActionsProps {
  reservation: Reservation;
  isOwnReservation: boolean;
  isCustodian: boolean;
  user: AuthUser | null;
  onCancel: (reservation: Reservation) => void;
  onReturn: (reservation: Reservation) => void;
  onSignIn: () => void;
}

function ReservationActions({
  reservation,
  isOwnReservation,
  isCustodian,
  user,
  onCancel,
  onReturn,
  onSignIn,
}: ReservationActionsProps) {
  const isActive = reservation.status === 'ACTIVE';
  const canCancel = isActive && Boolean(user) && (isCustodian || isOwnReservation);
  const canReturn = isActive && Boolean(user) && isCustodian;

  if (!isActive) {
    return (
      <span className="text-[10px] text-slate-500">
        {reservation.status === 'RETURNED' ? 'Closed' : 'No action'}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {canReturn ? (
        <button
          type="button"
          onClick={() => onReturn(reservation)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Return
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          onClick={() => onCancel(reservation)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50"
        >
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Cancel
        </button>
      ) : null}
      {!user ? (
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-50"
        >
          Sign in
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
      {user && !canCancel && !canReturn ? (
        <span className="text-[10px] text-slate-500">—</span>
      ) : null}
    </div>
  );
}

interface CancelDialogProps {
  reservation: Reservation;
  onClose: () => void;
  onConfirm: (reservation: Reservation) => Promise<void>;
}

function CancelDialog({ reservation, onClose, onConfirm }: CancelDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    setError(null);
    setWorking(true);
    try {
      await onConfirm(reservation);
      onClose();
    } catch (cancelError) {
      setError(toErrorMessage(cancelError));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel reservation?"
      description="This cannot be undone. The reserved units return to available stock immediately."
      icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      iconTone="amber"
      size="sm"
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-900">{reservation.item_name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {reservation.reservation_code} · {formatDate(reservation.reservation_date)} ·{' '}
          {formatTimeSlot(reservation.time_slot)}
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {pluralize(reservation.quantity, 'unit')} will be restored to stock.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary" disabled={working}>
          Keep reservation
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/25 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          {working ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          {working ? 'Cancelling…' : 'Cancel reservation'}
        </button>
      </div>
    </Modal>
  );
}

export function ReservationLog({
  reservations,
  loading,
  user,
  activeRole,
  onCancel,
  onReturn,
  onSignIn,
}: ReservationLogProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const counts = useMemo<Record<StatusFilter, number>>(
    () => ({
      ALL: reservations.length,
      ACTIVE: reservations.filter((reservation) => reservation.status === 'ACTIVE').length,
      RETURNED: reservations.filter((reservation) => reservation.status === 'RETURNED').length,
      CANCELLED: reservations.filter((reservation) => reservation.status === 'CANCELLED').length,
    }),
    [reservations],
  );

  const filteredReservations = useMemo(
    () =>
      statusFilter === 'ALL'
        ? reservations
        : reservations.filter((reservation) => reservation.status === statusFilter),
    [reservations, statusFilter],
  );

  const isCustodian = activeRole === 'custodian';

  return (
    <section id="reservations" className="scroll-mt-24" aria-labelledby="reservation-log-heading">
      <div>
        <h2
          id="reservation-log-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
        >
          Reservation log
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {isCustodian
            ? 'Audit bookings, cancel active reservations, and process returns.'
            : 'Review reservations, schedules, and return notes.'}
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-3 py-2.5">
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Filter reservations by status"
          >
            {FILTERS.map((filter) => {
              const isActive = statusFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                  <span className={isActive ? 'text-white/60' : 'text-slate-500'}>
                    {counts[filter]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="skeleton h-8 w-20" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-5 w-16" />
                <div className="skeleton h-7 w-24" />
              </div>
            ))}
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <CalendarClock className="h-7 w-7 text-slate-300" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {reservations.length === 0
                ? 'No reservations yet'
                : `No ${statusFilter.toLowerCase()} reservations`}
            </h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              {reservations.length === 0
                ? 'Reserve an available item from the catalog to create the first reservation.'
                : 'Choose another status filter to see the rest of the reservation activity.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <caption className="sr-only">
                Laboratory reservations filtered by {statusFilter.toLowerCase()} status
              </caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5">
                    Reservation
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Equipment
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Borrower
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Schedule
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-center">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReservations.map((reservation) => {
                  const isOwnReservation = user?.id === reservation.clerk_user_id;

                  return (
                    <tr key={reservation.id} className="text-sm transition hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-top">
                        <p className="font-mono text-[11px] font-medium tracking-wide text-slate-600">
                          {reservation.reservation_code}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {formatTimestamp(reservation.created_at)}
                        </p>
                      </td>
                      <td className="max-w-[190px] px-4 py-3 align-top">
                        <p className="truncate font-medium text-slate-900">{reservation.item_name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                          {reservation.item_code}
                        </p>
                      </td>
                      <td className="max-w-[190px] px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-slate-700">{reservation.borrower_name}</p>
                          {isOwnReservation ? (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {reservation.borrower_email}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="whitespace-nowrap text-slate-700">
                          {formatDate(reservation.reservation_date)}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-500">
                          {formatTimeSlot(reservation.time_slot)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className="text-xs font-medium text-slate-700 tabular-nums">
                          {reservation.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusLabel status={reservation.status} />
                        {reservation.status === 'RETURNED' && reservation.return_note ? (
                          <p
                            className="mt-1 max-w-[220px] text-[10px] leading-4 text-slate-500"
                            title={reservation.return_note}
                          >
                            {reservation.return_note}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <ReservationActions
                          reservation={reservation}
                          isOwnReservation={isOwnReservation}
                          isCustodian={isCustodian}
                          user={user}
                          onCancel={setCancelTarget}
                          onReturn={onReturn}
                          onSignIn={onSignIn}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {filteredReservations.map((reservation) => {
              const isOwnReservation = user?.id === reservation.clerk_user_id;
              const showActions =
                reservation.status === 'ACTIVE' &&
                (!user || isCustodian || isOwnReservation);

              return (
                <article key={reservation.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-medium text-slate-500">
                        {reservation.reservation_code}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-900">
                        {reservation.item_name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {reservation.item_code} · {pluralize(reservation.quantity, 'unit')}
                      </p>
                    </div>
                    <StatusLabel status={reservation.status} />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    <div>
                      <dt className="text-slate-500">Schedule</dt>
                      <dd className="mt-0.5 text-slate-700">
                        {formatDate(reservation.reservation_date)}
                      </dd>
                      <dd className="text-slate-500">{formatTimeSlot(reservation.time_slot)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-slate-500">Borrower</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5">
                        <span className="truncate text-slate-700">{reservation.borrower_name}</span>
                        {isOwnReservation ? (
                          <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                            You
                          </span>
                        ) : null}
                      </dd>
                      <dd className="truncate text-slate-500">{reservation.borrower_email}</dd>
                    </div>
                  </dl>

                  {reservation.status === 'RETURNED' && reservation.return_note ? (
                    <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-500">
                      {reservation.return_note}
                    </p>
                  ) : null}

                  {showActions ? (
                    <div className="mt-3">
                      <ReservationActions
                        reservation={reservation}
                        isOwnReservation={isOwnReservation}
                        isCustodian={isCustodian}
                        user={user}
                        onCancel={setCancelTarget}
                        onReturn={onReturn}
                        onSignIn={onSignIn}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          </>
        )}
      </div>

      {cancelTarget ? (
        <CancelDialog
          reservation={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={onCancel}
        />
      ) : null}
    </section>
  );
}
