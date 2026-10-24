import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Equipment, Reservation } from '../types/lab';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

function isValidSupabaseUrl(value: string): boolean {
  if (!value || value.includes('your-project')) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidSupabaseKey(value: string): boolean {
  if (value.length < 30) return false;
  const normalized = value.toLowerCase();
  return !normalized.includes('your_') && !normalized.includes('placeholder');
}

/**
 * True only when both Supabase values look like real credentials. Any failure
 * sends the application into its localStorage-backed demo mode instead of
 * throwing during startup.
 */
export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) && isValidSupabaseKey(supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/* -------------------------------------------------------------------------- */
/*                   Fallback localStorage / in-memory database                */
/* -------------------------------------------------------------------------- */

const DEMO_DB_KEY = 'lers.demo-database.v1';
const DEMO_DB_VERSION = 1;

export interface DemoDatabase {
  version: number;
  equipment: Equipment[];
  reservations: Reservation[];
  nextReservationNumber: number;
}

const SEED_TIMESTAMP = new Date().toISOString();

const SEED_EQUIPMENT: Equipment[] = [
  {
    id: '11111111-1111-4111-8111-000000000101',
    item_code: 'EQ-101',
    name: 'Digital Oscilloscope',
    category: 'Electronics',
    total_qty: 5,
    available_qty: 4,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: '11111111-1111-4111-8111-000000000102',
    item_code: 'EQ-102',
    name: 'Arduino Uno R4 Kit',
    category: 'Embedded',
    total_qty: 10,
    available_qty: 10,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: '11111111-1111-4111-8111-000000000103',
    item_code: 'EQ-103',
    name: 'Optical Microscope',
    category: 'Optics',
    total_qty: 3,
    available_qty: 3,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: '11111111-1111-4111-8111-000000000104',
    item_code: 'EQ-104',
    name: 'Logic Analyzer 16-Ch',
    category: 'Electronics',
    total_qty: 3,
    available_qty: 3,
    created_at: SEED_TIMESTAMP,
  },
  {
    id: '11111111-1111-4111-8111-000000000105',
    item_code: 'EQ-105',
    name: 'Raspberry Pi 5 Kit',
    category: 'Computing',
    total_qty: 5,
    available_qty: 5,
    created_at: SEED_TIMESTAMP,
  },
];

let memoryDatabase: DemoDatabase | null = null;

function createSeedDatabase(): DemoDatabase {
  return {
    version: DEMO_DB_VERSION,
    equipment: SEED_EQUIPMENT.map((item) => ({ ...item })),
    reservations: [],
    nextReservationNumber: 1001,
  };
}

function isDemoDatabase(value: unknown): value is DemoDatabase {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoDatabase>;
  return (
    candidate.version === DEMO_DB_VERSION &&
    Array.isArray(candidate.equipment) &&
    Array.isArray(candidate.reservations) &&
    typeof candidate.nextReservationNumber === 'number'
  );
}

function cloneDatabase(database: DemoDatabase): DemoDatabase {
  return JSON.parse(JSON.stringify(database)) as DemoDatabase;
}

function persistDatabase(database: DemoDatabase): void {
  memoryDatabase = cloneDatabase(database);

  try {
    window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(database));
  } catch {
    // Browsers can block localStorage (private mode, disabled storage). The
    // in-memory copy above keeps the current session fully functional.
  }

  try {
    window.dispatchEvent(new CustomEvent('lers:demo-database-updated'));
  } catch {
    // CustomEvent is unavailable only in very old environments.
  }
}

/** Reads a defensive copy of the fallback database, seeding it on first use. */
export function readDemoDatabase(): DemoDatabase {
  try {
    const raw = window.localStorage.getItem(DEMO_DB_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isDemoDatabase(parsed)) {
        memoryDatabase = cloneDatabase(parsed);
        return cloneDatabase(parsed);
      }
    }
  } catch {
    // Fall through to the in-memory copy or a fresh seed.
  }

  if (memoryDatabase) return cloneDatabase(memoryDatabase);

  const seeded = createSeedDatabase();
  persistDatabase(seeded);
  return cloneDatabase(seeded);
}

/** Persists a demo database, keeping an in-memory copy as a safety net. */
export function writeDemoDatabase(database: DemoDatabase): void {
  persistDatabase(database);
}

/** Restores the bundled demo inventory. Useful while presenting the prototype. */
export function resetDemoDatabase(): void {
  memoryDatabase = null;
  try {
    window.localStorage.removeItem(DEMO_DB_KEY);
  } catch {
    // Ignore unavailable storage; the in-memory seed will be used.
  }
}

/** Generates IDs in the browser, with a safe fallback for older runtimes. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
