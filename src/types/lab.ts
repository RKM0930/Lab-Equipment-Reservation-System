/** Roles supported by the prototype. Students and faculty are borrowers. */
export type UserRole = 'student' | 'faculty' | 'custodian';

export type ReservationStatus = 'ACTIVE' | 'RETURNED' | 'CANCELLED';

export interface Equipment {
  id: string;
  item_code: string;
  name: string;
  category: string;
  total_qty: number;
  available_qty: number;
  created_at: string;
}

export interface Reservation {
  id: string;
  reservation_code: string;
  clerk_user_id: string;
  borrower_name: string;
  borrower_email: string;
  equipment_id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  reservation_date: string;
  time_slot: string;
  status: ReservationStatus;
  return_note: string | null;
  created_at: string;
}

/** DTO accepted by the reservation service. */
export interface CreateReservationDTO {
  equipment_id: string;
  quantity: number;
  reservation_date: string;
  time_slot: string;
  clerk_user_id: string;
  borrower_name: string;
  borrower_email: string;
}

/** DTO accepted by the equipment registration service. */
export interface CreateEquipmentDTO {
  item_code: string;
  name: string;
  category: string;
  total_qty: number;
}

/** The authenticated person performing an action. */
export interface ReservationActor {
  clerkUserId: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  /** True when the identity comes from Clerk rather than the demo fallback. */
  isClerkUser?: boolean;
}

/** Values collected by the reservation form before auth details are attached. */
export interface ReservationFormValues {
  quantity: number;
  reservation_date: string;
  time_slot: string;
}
