import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import type {
  CreateEquipmentDTO,
  Equipment,
  Reservation,
  ReservationActor,
  ReservationFormValues,
} from './types/lab';
import { Navbar } from './components/Navbar';
import { KpiMetrics } from './components/KpiMetrics';
import { EquipmentCatalog } from './components/EquipmentCatalog';
import { ReservationModal } from './components/ReservationModal';
import { RegisterEquipmentModal, ReturnReservationModal } from './components/CustodianModals';
import { ReservationLog } from './components/ReservationLog';
import { isSupabaseConfigured, resetDemoDatabase } from './lib/supabaseClient';
import { useSession } from './lib/auth';
import { formatToday, pluralize } from './lib/format';
import {
  cancelReservation,
  createEquipment,
  createReservation,
  fetchEquipment,
  fetchReservations,
  returnReservation,
  toErrorMessage,
  ValidationError,
} from './services/reservationService';

interface AppAlert {
  type: 'success' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AlertBannerProps {
  alert: AppAlert;
  onDismiss: () => void;
}

function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  const isSuccess = alert.type === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-900'
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${isSuccess ? 'text-emerald-600' : 'text-red-600'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{alert.title}</p>
        <p
          className={`mt-0.5 text-xs leading-5 ${
            isSuccess ? 'text-emerald-800' : 'text-red-700'
          }`}
        >
          {alert.message}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {alert.actionLabel && alert.onAction ? (
          <button
            type="button"
            onClick={alert.onAction}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              isSuccess
                ? 'text-emerald-800 hover:bg-emerald-100'
                : 'text-red-800 hover:bg-red-100'
            }`}
          >
            {alert.actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
            isSuccess
              ? 'text-emerald-600 hover:bg-emerald-100'
              : 'text-red-500 hover:bg-red-100'
          }`}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, isSignedIn, signIn } = useSession();
  // ClerkAuthProvider maps this from Clerk's publicMetadata.role or a
  // @custodian.com email. Demo mode is borrower-only and can never set it.
  const isCustodian = user?.role === 'custodian';

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AppAlert | null>(null);

  const [reservationTarget, setReservationTarget] = useState<Equipment | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<Reservation | null>(null);

  useEffect(() => {
    // Close role-specific dialogs immediately if the verified role changes.
    if (isCustodian) {
      setReservationTarget(null);
    } else {
      setRegisterOpen(false);
      setReturnTarget(null);
    }
  }, [isCustodian]);

  useEffect(() => {
    if (isSignedIn) {
      setAlert((current) =>
        current?.title === 'Sign-in required' ? null : current,
      );
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (alert?.type !== 'success') return;

    const timeout = window.setTimeout(() => setAlert(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [alert]);

  async function loadData(showSkeleton = false): Promise<boolean> {
    if (showSkeleton) setLoading(true);

    try {
      const [equipmentRows, reservationRows] = await Promise.all([
        fetchEquipment(),
        fetchReservations(),
      ]);
      setEquipment(equipmentRows);
      setReservations(reservationRows);
      return true;
    } catch (error) {
      setAlert({
        type: 'error',
        title: 'Laboratory data could not be synced',
        message: toErrorMessage(error),
        actionLabel: 'Retry',
        onAction: () => {
          setAlert(null);
          void loadData(true);
        },
      });
      return false;
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(true);
    // Data is loaded once on mount; mutations explicitly refresh afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notifyError(title: string, error: unknown): string {
    const message = toErrorMessage(error);
    setAlert({ type: 'error', title, message });
    return message;
  }

  function requireActor(requireCustodian = false): ReservationActor {
    if (!user || !isSignedIn) {
      throw new ValidationError('Please sign in to perform this action.');
    }
    if (requireCustodian && !isCustodian) {
      throw new ValidationError('Only laboratory custodians can perform this action.');
    }

    return {
      clerkUserId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
  }

  function handleReserveClick(item: Equipment) {
    if (!user) {
      setAlert({
        type: 'error',
        title: 'Sign-in required',
        message: 'Please sign in with your laboratory account before reserving equipment.',
      });
      signIn();
      return;
    }

    if (isCustodian) {
      setAlert({
        type: 'error',
        title: 'Borrower account required',
        message:
          'Custodian accounts manage inventory and returns. Sign in with a student or faculty account to reserve equipment.',
      });
      return;
    }

    setReservationTarget(item);
  }

  function handleOpenRegister() {
    if (!user) {
      setAlert({
        type: 'error',
        title: 'Sign-in required',
        message: 'Please sign in to access custodian inventory tools.',
      });
      signIn();
      return;
    }

    if (!isCustodian) {
      setAlert({
        type: 'error',
        title: 'Custodian access required',
        message: 'Only accounts with the Clerk custodian role can register equipment.',
      });
      return;
    }

    setRegisterOpen(true);
  }

  function handleReturnRequest(reservation: Reservation) {
    if (!user) {
      setAlert({
        type: 'error',
        title: 'Sign-in required',
        message: 'Please sign in to process an equipment return.',
      });
      signIn();
      return;
    }

    if (!isCustodian) {
      setAlert({
        type: 'error',
        title: 'Custodian access required',
        message: 'Only accounts with the Clerk custodian role can process returns.',
      });
      return;
    }

    setReturnTarget(reservation);
  }

  async function handleCreateReservation(
    item: Equipment,
    values: ReservationFormValues,
  ): Promise<void> {
    if (!user) {
      const message = 'Please sign in before reserving equipment.';
      setAlert({ type: 'error', title: 'Sign-in required', message });
      throw new ValidationError(message);
    }
    if (isCustodian) {
      const message =
        'Custodian accounts cannot create borrowing reservations. Sign in with a student or faculty account.';
      setAlert({ type: 'error', title: 'Borrower account required', message });
      throw new ValidationError(message);
    }

    try {
      const reservation = await createReservation({
        equipment_id: item.id,
        quantity: values.quantity,
        reservation_date: values.reservation_date,
        time_slot: values.time_slot,
        clerk_user_id: user.id,
        borrower_name: user.fullName,
        borrower_email: user.email,
      });

      setReservationTarget(null);
      setAlert({
        type: 'success',
        title: 'Reservation confirmed',
        message: `Reservation ${reservation.reservation_code} confirmed for ${reservation.item_name} (x${reservation.quantity}). Stock updated.`,
      });
      await loadData();
    } catch (error) {
      notifyError('Reservation blocked', error);
      throw error;
    }
  }

  async function handleRegisterEquipment(values: CreateEquipmentDTO): Promise<void> {
    try {
      const actor = requireActor(true);
      const item = await createEquipment(values, actor);

      setRegisterOpen(false);
      setAlert({
        type: 'success',
        title: 'Equipment registered',
        message: `${item.item_code} — ${item.name} added to inventory with ${pluralize(item.total_qty, 'unit')}. All units are available.`,
      });
      await loadData();
    } catch (error) {
      notifyError('Equipment registration blocked', error);
      throw error;
    }
  }

  async function handleReturnReservation(conditionNote: string): Promise<void> {
    if (!returnTarget) return;

    try {
      const actor = requireActor(true);
      const updated = await returnReservation(returnTarget.id, conditionNote, actor);

      setReturnTarget(null);
      setAlert({
        type: 'success',
        title: 'Return processed',
        message: `Reservation ${updated.reservation_code} marked RETURNED for ${updated.item_name}. ${pluralize(updated.quantity, 'unit')} restored to available stock.`,
      });
      await loadData();
    } catch (error) {
      notifyError('Return processing blocked', error);
      throw error;
    }
  }

  async function handleCancelReservation(reservation: Reservation): Promise<void> {
    try {
      const actor = requireActor();
      const updated = await cancelReservation(reservation.id, actor);

      setAlert({
        type: 'success',
        title: 'Reservation cancelled',
        message: `Reservation ${updated.reservation_code} cancelled. ${pluralize(updated.quantity, 'unit')} restored to available stock.`,
      });
      await loadData();
    } catch (error) {
      notifyError('Cancellation blocked', error);
      throw error;
    }
  }

  async function handleResetDemoData() {
    const confirmed = window.confirm(
      'Reset the local demo database? This restores the five seed items and removes all demo reservations.',
    );
    if (!confirmed) return;

    resetDemoDatabase();
    const loaded = await loadData(true);
    if (loaded) {
      setAlert({
        type: 'success',
        title: 'Demo data reset',
        message: 'Seed inventory restored: 5 equipment items with no reservations.',
      });
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {alert ? (
          <div className="mb-5">
            <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />
          </div>
        ) : null}

        <section aria-labelledby="dashboard-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1
                id="dashboard-heading"
                className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
              >
                Equipment dashboard
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                {isCustodian
                  ? 'Monitor stock, register equipment, and process returns.'
                  : 'Browse live stock, reserve equipment, and track your returns.'}
              </p>
            </div>

            <p className="shrink-0 text-xs text-slate-500">
              {formatToday()} · {isSupabaseConfigured ? 'Supabase connected' : 'Demo data'}
            </p>
          </div>
        </section>

        <div className="mt-5">
          <KpiMetrics equipment={equipment} reservations={reservations} loading={loading} />
        </div>

        <div className="mt-8 space-y-10">
          <EquipmentCatalog
            equipment={equipment}
            loading={loading}
            isCustodian={isCustodian}
            onReserve={handleReserveClick}
            onRegister={handleOpenRegister}
          />

          <ReservationLog
            reservations={reservations}
            loading={loading}
            user={user}
            onCancel={handleCancelReservation}
            onReturn={handleReturnRequest}
            onSignIn={signIn}
          />
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="font-medium text-slate-700">ReserveLab</p>
            <p className="mt-0.5 text-slate-500">BCS45 / S-CSSE421LA · Laboratory 6</p>
          </div>
          {!isSupabaseConfigured ? (
            <button
              type="button"
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1 self-start font-medium text-slate-600 transition hover:text-slate-900 md:self-auto"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset demo data
            </button>
          ) : null}
        </div>
      </footer>

      {reservationTarget && user && !isCustodian ? (
        <ReservationModal
          key={`${reservationTarget.id}-${user.id}`}
          equipment={reservationTarget}
          user={user}
          onClose={() => setReservationTarget(null)}
          onSubmit={(values) => handleCreateReservation(reservationTarget, values)}
        />
      ) : null}

      {registerOpen && user && isCustodian ? (
        <RegisterEquipmentModal
          onClose={() => setRegisterOpen(false)}
          onSubmit={handleRegisterEquipment}
        />
      ) : null}

      {returnTarget && user && isCustodian ? (
        <ReturnReservationModal
          reservation={returnTarget}
          onClose={() => setReturnTarget(null)}
          onSubmit={handleReturnReservation}
        />
      ) : null}
    </div>
  );
}
