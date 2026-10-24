import { useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarCheck2, CalendarPlus, Loader2 } from 'lucide-react';
import type { AuthUser, Equipment, ReservationFormValues } from '../types/lab';
import { Modal } from './ui/Modal';
import { getInitials, pluralize } from '../lib/format';
import { getTodayISO, toErrorMessage } from '../services/reservationService';

interface ReservationModalProps {
  equipment: Equipment;
  user: AuthUser;
  onClose: () => void;
  onSubmit: (values: ReservationFormValues) => Promise<void>;
}

const TIME_PRESETS = ['09:00-12:00', '13:00-16:00', '16:00-19:00'];

export function ReservationModal({ equipment, user, onClose, onSubmit }: ReservationModalProps) {
  const [reservationDate, setReservationDate] = useState(getTodayISO());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [quantity, setQuantity] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOutOfStock = equipment.available_qty <= 0;
  const combinedSlot = startTime && endTime ? `${startTime}-${endTime}` : '';

  function applyPreset(slot: string) {
    const [start, end] = slot.split('-');
    setStartTime(start);
    setEndTime(end);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!startTime || !endTime) {
      setFormError('Please choose both a start time and an end time.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        quantity: Number(quantity),
        reservation_date: reservationDate,
        time_slot: combinedSlot,
      });
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reserve equipment"
      description="Choose a date, time, and quantity. Stock is deducted when you confirm."
      icon={<CalendarPlus className="h-5 w-5" aria-hidden="true" />}
      iconTone="emerald"
      size="lg"
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-slate-500">{equipment.item_code}</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{equipment.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{equipment.category}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold leading-none text-slate-900 tabular-nums">
              {equipment.available_qty}
              <span className="text-xs font-normal text-slate-500"> / {equipment.total_qty}</span>
            </p>
            <p className="mt-1 text-[10px] text-slate-500">available</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-600">
          {getInitials(user.fullName)}
        </span>
        <span className="font-medium text-slate-700">{user.fullName}</span>
        <span className="text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className="truncate">{user.email || 'No email'}</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <label htmlFor="reservation-date" className="field-label">
              Reservation date
            </label>
            <input
              id="reservation-date"
              type="date"
              className="field-input"
              min={getTodayISO()}
              value={reservationDate}
              onChange={(event) => {
                setReservationDate(event.target.value);
                setFormError(null);
              }}
              required
            />
            <p className="field-hint">Today or later</p>
          </div>
          <div>
            <label htmlFor="reservation-quantity" className="field-label">
              Quantity
            </label>
            <div className="relative">
              <input
                id="reservation-quantity"
                type="number"
                min={1}
                max={equipment.available_qty}
                step={1}
                inputMode="numeric"
                className="field-input pr-16"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setFormError(null);
                }}
                required
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                units
              </span>
            </div>
            <p className="field-hint">Max {pluralize(equipment.available_qty, 'unit')}</p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <span className="field-label mb-0">Time slot</span>
            <span className="text-[11px] text-slate-500">Start must be before end</span>
          </div>
          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              <label htmlFor="start-time" className="sr-only">
                Start time
              </label>
              <input
                id="start-time"
                type="time"
                className="field-input"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setFormError(null);
                }}
                required
              />
            </div>
            <span className="text-xs text-slate-500">to</span>
            <div>
              <label htmlFor="end-time" className="sr-only">
                End time
              </label>
              <input
                id="end-time"
                type="time"
                className="field-input"
                value={endTime}
                onChange={(event) => {
                  setEndTime(event.target.value);
                  setFormError(null);
                }}
                required
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Presets</span>
            {TIME_PRESETS.map((slot) => {
              const isActive = combinedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => applyPreset(slot)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 transition ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        {formError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <p>{formError}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || isOutOfStock}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? 'Confirming…' : 'Confirm reservation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
