import {
  createId,
  isSupabaseConfigured,
  readDemoDatabase,
  supabase,
  writeDemoDatabase,
} from '../lib/supabaseClient';
import type {
  CreateEquipmentDTO,
  CreateReservationDTO,
  Equipment,
  Reservation,
  ReservationActor,
  UserRole,
} from '../types/lab';

/* -------------------------------------------------------------------------- */
/*                              Validation layer                              */
/* -------------------------------------------------------------------------- */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const ITEM_CODE_PATTERN = /^[A-Z]{2,4}-\d{3,4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Current local date in YYYY-MM-DD, avoiding UTC off-by-one errors. */
export function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function validateItemCode(rawValue: string): string {
  const value = typeof rawValue === 'string' ? rawValue.trim().toUpperCase() : '';
  if (!ITEM_CODE_PATTERN.test(value)) {
    throw new ValidationError(
      'Item code must match the format ^[A-Z]{2,4}-\\d{3,4}$ (e.g., EQ-101 or LAB-201).',
    );
  }
  return value;
}

export function validatePositiveQuantity(value: number, label = 'Quantity'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${label} must be a whole number greater than zero.`);
  }
  return value;
}

export function validateReservationDate(rawValue: string): string {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!DATE_PATTERN.test(value)) {
    throw new ValidationError('Reservation date must use the YYYY-MM-DD format.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new ValidationError('Reservation date is not a valid calendar date.');
  }

  if (value < getTodayISO()) {
    throw new ValidationError('Reservation date cannot be in the past. Please choose today or a future date.');
  }

  return value;
}

export function validateTimeSlot(rawValue: string): string {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  const match = TIME_SLOT_PATTERN.exec(value);

  if (!match) {
    throw new ValidationError(
      'Time slot must use the 24-hour format HH:mm-HH:mm (e.g., 09:00-12:00).',
    );
  }

  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);

  if (startMinutes >= endMinutes) {
    throw new ValidationError('Start time must be strictly earlier than end time.');
  }

  return value;
}

export function validateEmail(rawValue: string): string {
  const value = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(value)) {
    throw new ValidationError('Please provide a valid email address.');
  }
  return value;
}

export function validateRequiredText(rawValue: string, label: string, minLength = 1): string {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (value.length < minLength) {
    throw new ValidationError(`${label} is required and must be at least ${minLength} characters.`);
  }
  return value;
}

function validateRole(role: UserRole): UserRole {
  if (!['student', 'faculty', 'custodian'].includes(role)) {
    throw new ValidationError('Your account role is not recognized.');
  }
  return role;
}

function assertSignedIn(actor: Pick<ReservationActor, 'clerkUserId'>): void {
  if (!actor?.clerkUserId?.trim()) {
    throw new ValidationError('You must be signed in to perform this action.');
  }
}

function assertCustodian(actor: ReservationActor): void {
  assertSignedIn(actor);
  if (validateRole(actor.role) !== 'custodian') {
    throw new ValidationError('Only laboratory custodians can perform this action.');
  }
}

function insufficientStock(name: string, requested: number, available: number): ValidationError {
  return new ValidationError(
    `Insufficient stock for ${name}. Requested: ${requested}, Available: ${available}.`,
  );
}

function equipmentNotFound(): ValidationError {
  return new ValidationError(
    'The selected equipment could not be found. It may have been removed from the catalog.',
  );
}

function lifecycleError(reservation: Reservation, verb: 'cancelled' | 'returned'): ValidationError {
  return new ValidationError(
    `Reservation ${reservation.reservation_code} is currently ${reservation.status}. Only ACTIVE reservations can be ${verb}; duplicate ${verb} operations are blocked and no stock was changed.`,
  );
}

/** Converts unknown thrown values into a safe message for alert banners. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'An unexpected error occurred. Please try again.';
}

/* -------------------------------------------------------------------------- */
/*                                Read queries                                */
/* -------------------------------------------------------------------------- */

export async function fetchEquipment(): Promise<Equipment[]> {
  if (!isSupabaseConfigured || !supabase) {
    const database = readDemoDatabase();
    return database.equipment
      .map((item) => ({ ...item }))
      .sort((a, b) => a.item_code.localeCompare(b.item_code));
  }

  const client = supabase;
  const { data, error } = await client
    .from('equipment')
    .select('*')
    .order('item_code', { ascending: true });

  if (error) {
    throw new Error(`Unable to load the equipment catalog. ${error.message}`);
  }

  return (data ?? []) as Equipment[];
}

export async function fetchReservations(): Promise<Reservation[]> {
  if (!isSupabaseConfigured || !supabase) {
    const database = readDemoDatabase();
    return database.reservations
      .map((reservation) => ({ ...reservation }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const client = supabase;
  const { data, error } = await client
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Unable to load the reservation log. ${error.message}`);
  }

  return (data ?? []) as Reservation[];
}

/* -------------------------------------------------------------------------- */
/*                           Reservation operations                           */
/* -------------------------------------------------------------------------- */

export async function createReservation(dto: CreateReservationDTO): Promise<Reservation> {
  const quantity = validatePositiveQuantity(dto.quantity);
  const reservationDate = validateReservationDate(dto.reservation_date);
  const timeSlot = validateTimeSlot(dto.time_slot);
  const clerkUserId = validateRequiredText(dto.clerk_user_id, 'User ID');
  const borrowerName = validateRequiredText(dto.borrower_name, 'Full name', 2);
  const borrowerEmail = validateEmail(dto.borrower_email);

  if (!dto.equipment_id?.trim()) {
    throw new ValidationError('Please select an equipment item to reserve.');
  }

  if (!isSupabaseConfigured || !supabase) {
    return createReservationInDemoStore({
      equipmentId: dto.equipment_id,
      quantity,
      reservationDate,
      timeSlot,
      clerkUserId,
      borrowerName,
      borrowerEmail,
    });
  }

  const client = supabase;
  const equipment = await deductStock(client, dto.equipment_id, quantity);
  const codeBase = await getNextReservationCodeBase(client);

  let created: Reservation | null = null;
  let insertError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client
      .from('reservations')
      .insert({
        reservation_code: `RES-${codeBase + attempt}`,
        clerk_user_id: clerkUserId,
        borrower_name: borrowerName,
        borrower_email: borrowerEmail,
        equipment_id: dto.equipment_id,
        item_code: equipment.item_code,
        item_name: equipment.name,
        quantity,
        reservation_date: reservationDate,
        time_slot: timeSlot,
        status: 'ACTIVE',
        return_note: '-',
      })
      .select()
      .single();

    if (!error && data) {
      created = data as Reservation;
      break;
    }

    insertError = error;
    if (error?.code !== '23505') break;
  }

  if (!created) {
    try {
      await addAvailableStock(client, equipment.id, quantity);
    } catch (restoreError) {
      throw new Error(
        `The reservation could not be saved and stock restoration also failed. Please contact the laboratory custodian. ${toErrorMessage(restoreError)}`,
      );
    }

    if (insertError?.code === '23505') {
      throw new Error('A unique reservation code could not be generated. Please try again.');
    }
    if (insertError?.code === '23503') {
      throw new ValidationError('The selected equipment is no longer available. Please choose another item.');
    }

    throw new Error(`Unable to save the reservation. ${insertError?.message ?? 'Please try again.'}`);
  }

  return created;
}

export async function cancelReservation(id: string, actor: ReservationActor): Promise<Reservation> {
  assertSignedIn(actor);

  if (!isSupabaseConfigured || !supabase) {
    return cancelReservationInDemoStore(id, actor);
  }

  const client = supabase;
  const reservation = await getReservation(client, id);

  if (reservation.status !== 'ACTIVE') {
    throw lifecycleError(reservation, 'cancelled');
  }

  if (actor.role !== 'custodian' && reservation.clerk_user_id !== actor.clerkUserId) {
    throw new ValidationError('You can only cancel your own reservations.');
  }

  const { data: cancelled, error } = await client
    .from('reservations')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to cancel the reservation. ${error.message}`);
  }

  if (!cancelled) {
    const latest = await getReservation(client, id);
    throw lifecycleError(latest, 'cancelled');
  }

  try {
    await addAvailableStock(client, reservation.equipment_id, reservation.quantity);
  } catch (stockError) {
    // Compensating update: do not leave a cancelled reservation with stock
    // still deducted from inventory.
    await client
      .from('reservations')
      .update({ status: 'ACTIVE' })
      .eq('id', id)
      .eq('status', 'CANCELLED');
    throw new Error(
      `Cancellation could not restore inventory, so it was rolled back. Please try again. ${toErrorMessage(stockError)}`,
    );
  }

  return cancelled as Reservation;
}

export async function returnReservation(
  id: string,
  rawNote: string,
  actor: ReservationActor,
): Promise<Reservation> {
  assertCustodian(actor);

  const returnNote = validateRequiredText(rawNote, 'Condition note', 3);
  if (returnNote.length > 500) {
    throw new ValidationError('Condition note must be 500 characters or fewer.');
  }

  if (!isSupabaseConfigured || !supabase) {
    return returnReservationInDemoStore(id, returnNote, actor);
  }

  const client = supabase;
  const reservation = await getReservation(client, id);

  if (reservation.status !== 'ACTIVE') {
    throw lifecycleError(reservation, 'returned');
  }

  const { data: returned, error } = await client
    .from('reservations')
    .update({ status: 'RETURNED', return_note: returnNote })
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to process the return. ${error.message}`);
  }

  if (!returned) {
    const latest = await getReservation(client, id);
    throw lifecycleError(latest, 'returned');
  }

  try {
    await addAvailableStock(client, reservation.equipment_id, reservation.quantity);
  } catch (stockError) {
    await client
      .from('reservations')
      .update({ status: 'ACTIVE', return_note: reservation.return_note ?? '-' })
      .eq('id', id)
      .eq('status', 'RETURNED');
    throw new Error(
      `Return could not restore inventory, so it was rolled back. Please try again. ${toErrorMessage(stockError)}`,
    );
  }

  return returned as Reservation;
}

/* -------------------------------------------------------------------------- */
/*                            Equipment operations                            */
/* -------------------------------------------------------------------------- */

export async function createEquipment(
  dto: CreateEquipmentDTO,
  actor: ReservationActor,
): Promise<Equipment> {
  assertCustodian(actor);

  const itemCode = validateItemCode(dto.item_code);
  const name = validateRequiredText(dto.name, 'Equipment name', 2);
  const category = validateRequiredText(dto.category, 'Category', 2);
  const totalQty = validatePositiveQuantity(dto.total_qty, 'Total quantity');

  if (name.length > 120) {
    throw new ValidationError('Equipment name must be 120 characters or fewer.');
  }
  if (category.length > 60) {
    throw new ValidationError('Category must be 60 characters or fewer.');
  }

  if (!isSupabaseConfigured || !supabase) {
    return createEquipmentInDemoStore({ itemCode, name, category, totalQty });
  }

  const client = supabase;
  const { data, error } = await client
    .from('equipment')
    .insert({
      item_code: itemCode,
      name,
      category,
      total_qty: totalQty,
      available_qty: totalQty,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ValidationError(`An equipment item with code ${itemCode} already exists.`);
    }
    throw new Error(`Unable to register the equipment item. ${error.message}`);
  }

  return data as Equipment;
}

/* -------------------------------------------------------------------------- */
/*                        Supabase-specific helpers                           */
/* -------------------------------------------------------------------------- */

type Supabase = NonNullable<typeof supabase>;

async function getReservation(client: Supabase, id: string): Promise<Reservation> {
  const { data, error } = await client.from('reservations').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Unable to load the reservation. ${error.message}`);
  }
  if (!data) {
    throw new ValidationError('The reservation could not be found.');
  }

  return data as Reservation;
}

async function deductStock(client: Supabase, equipmentId: string, quantity: number): Promise<Equipment> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await client
      .from('equipment')
      .select('*')
      .eq('id', equipmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to check equipment availability. ${error.message}`);
    }
    if (!data) throw equipmentNotFound();

    const equipment = data as Equipment;
    if (quantity > equipment.available_qty) {
      throw insufficientStock(equipment.name, quantity, equipment.available_qty);
    }

    const { data: updated, error: updateError } = await client
      .from('equipment')
      .update({ available_qty: equipment.available_qty - quantity })
      .eq('id', equipmentId)
      .eq('available_qty', equipment.available_qty)
      .select()
      .maybeSingle();

    if (updateError) {
      throw new Error(`Unable to reserve inventory. ${updateError.message}`);
    }
    if (updated) return updated as Equipment;
    // Another session changed availability between the read and the update.
    // Retry with fresh stock numbers.
  }

  throw new Error('Inventory changed while processing your reservation. Please check availability and try again.');
}

async function addAvailableStock(
  client: Supabase,
  equipmentId: string,
  quantity: number,
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client
      .from('equipment')
      .select('*')
      .eq('id', equipmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to restore equipment stock. ${error.message}`);
    }
    if (!data) {
      throw new Error('The equipment record no longer exists, so its stock could not be restored.');
    }

    const equipment = data as Equipment;
    const nextAvailable = Math.min(equipment.total_qty, equipment.available_qty + quantity);
    if (nextAvailable === equipment.available_qty) return;

    const { data: updated, error: updateError } = await client
      .from('equipment')
      .update({ available_qty: nextAvailable })
      .eq('id', equipmentId)
      .eq('available_qty', equipment.available_qty)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new Error(`Unable to restore equipment stock. ${updateError.message}`);
    }
    if (updated) return;
    // Retry on an optimistic-concurrency conflict.
  }

  throw new Error('Equipment stock could not be restored because inventory changed concurrently. Please retry.');
}

async function getNextReservationCodeBase(client: Supabase): Promise<number> {
  const { count, error } = await client
    .from('reservations')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Unable to prepare a reservation code. ${error.message}`);
  }

  return 1001 + (count ?? 0);
}

/* -------------------------------------------------------------------------- */
/*                         Demo store implementation                          */
/* -------------------------------------------------------------------------- */

interface NormalizedReservation {
  equipmentId: string;
  quantity: number;
  reservationDate: string;
  timeSlot: string;
  clerkUserId: string;
  borrowerName: string;
  borrowerEmail: string;
}

async function createReservationInDemoStore(input: NormalizedReservation): Promise<Reservation> {
  const database = readDemoDatabase();
  const equipment = database.equipment.find((item) => item.id === input.equipmentId);

  if (!equipment) throw equipmentNotFound();
  if (input.quantity > equipment.available_qty) {
    throw insufficientStock(equipment.name, input.quantity, equipment.available_qty);
  }

  const reservation: Reservation = {
    id: createId(),
    reservation_code: `RES-${database.nextReservationNumber}`,
    clerk_user_id: input.clerkUserId,
    borrower_name: input.borrowerName,
    borrower_email: input.borrowerEmail,
    equipment_id: equipment.id,
    item_code: equipment.item_code,
    item_name: equipment.name,
    quantity: input.quantity,
    reservation_date: input.reservationDate,
    time_slot: input.timeSlot,
    status: 'ACTIVE',
    return_note: '-',
    created_at: new Date().toISOString(),
  };

  equipment.available_qty -= input.quantity;
  database.nextReservationNumber += 1;
  database.reservations.unshift(reservation);
  writeDemoDatabase(database);

  return reservation;
}

async function cancelReservationInDemoStore(
  id: string,
  actor: ReservationActor,
): Promise<Reservation> {
  const database = readDemoDatabase();
  const reservation = database.reservations.find((item) => item.id === id);

  if (!reservation) throw new ValidationError('The reservation could not be found.');
  if (reservation.status !== 'ACTIVE') {
    throw lifecycleError(reservation, 'cancelled');
  }
  if (actor.role !== 'custodian' && reservation.clerk_user_id !== actor.clerkUserId) {
    throw new ValidationError('You can only cancel your own reservations.');
  }

  const equipment = database.equipment.find((item) => item.id === reservation.equipment_id);
  if (!equipment) {
    throw new Error('The equipment record no longer exists, so its stock could not be restored.');
  }

  reservation.status = 'CANCELLED';
  equipment.available_qty = Math.min(
    equipment.total_qty,
    equipment.available_qty + reservation.quantity,
  );
  writeDemoDatabase(database);

  return reservation;
}

async function returnReservationInDemoStore(
  id: string,
  returnNote: string,
  actor: ReservationActor,
): Promise<Reservation> {
  assertCustodian(actor);

  const database = readDemoDatabase();
  const reservation = database.reservations.find((item) => item.id === id);

  if (!reservation) throw new ValidationError('The reservation could not be found.');
  if (reservation.status !== 'ACTIVE') {
    throw lifecycleError(reservation, 'returned');
  }

  const equipment = database.equipment.find((item) => item.id === reservation.equipment_id);
  if (!equipment) {
    throw new Error('The equipment record no longer exists, so its stock could not be restored.');
  }

  reservation.status = 'RETURNED';
  reservation.return_note = returnNote;
  equipment.available_qty = Math.min(
    equipment.total_qty,
    equipment.available_qty + reservation.quantity,
  );
  writeDemoDatabase(database);

  return reservation;
}

interface NormalizedEquipment {
  itemCode: string;
  name: string;
  category: string;
  totalQty: number;
}

async function createEquipmentInDemoStore(input: NormalizedEquipment): Promise<Equipment> {
  const database = readDemoDatabase();

  if (database.equipment.some((item) => item.item_code === input.itemCode)) {
    throw new ValidationError(`An equipment item with code ${input.itemCode} already exists.`);
  }

  const equipment: Equipment = {
    id: createId(),
    item_code: input.itemCode,
    name: input.name,
    category: input.category,
    total_qty: input.totalQty,
    available_qty: input.totalQty,
    created_at: new Date().toISOString(),
  };

  database.equipment.push(equipment);
  writeDemoDatabase(database);

  return equipment;
}
