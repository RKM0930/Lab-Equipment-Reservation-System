import { useState, type FormEvent } from 'react';
import { AlertTriangle, ClipboardCheck, Loader2, PackagePlus, RotateCcw } from 'lucide-react';
import type { CreateEquipmentDTO, Reservation } from '../types/lab';
import { Modal } from './ui/Modal';
import { formatDate, formatTimeSlot, pluralize } from '../lib/format';
import { toErrorMessage } from '../services/reservationService';

/* -------------------------------------------------------------------------- */
/*                          Equipment registration                            */
/* -------------------------------------------------------------------------- */

interface RegisterEquipmentModalProps {
  onClose: () => void;
  onSubmit: (values: CreateEquipmentDTO) => Promise<void>;
}

const CATEGORY_SUGGESTIONS = [
  'Electronics',
  'Embedded',
  'Optics',
  'Computing',
  'Mechanical',
  'Networking',
  'General',
];

export function RegisterEquipmentModal({ onClose, onSubmit }: RegisterEquipmentModalProps) {
  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [totalQty, setTotalQty] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        item_code: itemCode.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim(),
        total_qty: Number(totalQty),
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
      title="Register equipment"
      description="Add an item to the shared catalog. All units start available."
      icon={<PackagePlus className="h-5 w-5" aria-hidden="true" />}
      iconTone="emerald"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
          <div>
            <label htmlFor="equipment-code" className="field-label">
              Item code
            </label>
            <input
              id="equipment-code"
              className="field-input font-mono uppercase"
              value={itemCode}
              onChange={(event) => {
                setItemCode(event.target.value.toUpperCase());
                setFormError(null);
              }}
              placeholder="EQ-106"
              maxLength={9}
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className="field-hint">Format: AA-000 or AAAA-0000</p>
          </div>
          <div>
            <label htmlFor="equipment-name" className="field-label">
              Equipment name
            </label>
            <input
              id="equipment-name"
              className="field-input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFormError(null);
              }}
              placeholder="e.g., Portable Function Generator"
              maxLength={120}
              autoComplete="off"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_0.55fr]">
          <div>
            <label htmlFor="equipment-category" className="field-label">
              Category
            </label>
            <input
              id="equipment-category"
              className="field-input"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setFormError(null);
              }}
              placeholder="Select or type a category"
              list="category-suggestions"
              maxLength={60}
              autoComplete="off"
              required
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="equipment-total" className="field-label">
              Total quantity
            </label>
            <input
              id="equipment-total"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className="field-input"
              value={totalQty}
              onChange={(event) => {
                setTotalQty(event.target.value);
                setFormError(null);
              }}
              required
            />
            <p className="field-hint">Starts fully available</p>
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
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? 'Registering…' : 'Register equipment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Return check-in                               */
/* -------------------------------------------------------------------------- */

interface ReturnReservationModalProps {
  reservation: Reservation;
  onClose: () => void;
  onSubmit: (conditionNote: string) => Promise<void>;
}

const NOTE_PRESETS = [
  'Returned in good condition.',
  'Minor wear noted; unit remains functional.',
  'Damage noted; needs inspection before next use.',
];

export function ReturnReservationModal({
  reservation,
  onClose,
  onSubmit,
}: ReturnReservationModalProps) {
  const [conditionNote, setConditionNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (conditionNote.trim().length < 3) {
      setFormError('Please add an equipment condition note (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(conditionNote.trim());
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
      title="Process return"
      description="Record the equipment condition and restore the units to stock."
      icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
      iconTone="amber"
      size="lg"
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-slate-500">{reservation.reservation_code}</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{reservation.item_name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono">{reservation.item_code}</span> ·{' '}
              {reservation.borrower_name}
            </p>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-slate-500">Quantity</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {pluralize(reservation.quantity, 'unit')}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-500">Date</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {formatDate(reservation.reservation_date)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-500">Time slot</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {formatTimeSlot(reservation.time_slot)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-slate-500">Borrower email</dt>
            <dd
              className="mt-0.5 break-all font-medium leading-4 text-slate-700"
              title={reservation.borrower_email}
            >
              {reservation.borrower_email}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800">
        <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Returns are final and can only be processed once.{' '}
          <strong>{pluralize(reservation.quantity, 'unit')}</strong> will return to available stock.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="condition-note" className="field-label mb-0">
              Condition note
            </label>
            <span className="text-[11px] tabular-nums text-slate-500">
              {conditionNote.length}/500
            </span>
          </div>
          <textarea
            id="condition-note"
            className="field-input mt-1.5 min-h-28 resize-y"
            value={conditionNote}
            onChange={(event) => {
              setConditionNote(event.target.value.slice(0, 500));
              setFormError(null);
            }}
            placeholder="Describe the condition of the returned equipment…"
            maxLength={500}
            required
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NOTE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setConditionNote(preset);
                  setFormError(null);
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {preset}
              </button>
            ))}
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
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? 'Processing…' : 'Confirm return'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
