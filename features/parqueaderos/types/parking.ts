// ============================================================
// TIPOS TYPESCRIPT — MÓDULO DE PARQUEADEROS (PRP v2)
// ============================================================

export type UserRole = 'admin' | 'consejo' | 'residente' | 'porteria' | 'auditor';

export type VehicleType = 'A' | 'M'; // A=Carro (máx 96), M=Moto (máx 25)
export type VehicleCategory = 'nuevo' | 'antiguo';
export type ResidencyType = 'propietario' | 'arrendatario';

export type SpaceStatus = 'available' | 'assigned' | 'maintenance' | 'reserved';

export type RaffleStatus =
  | 'draft'
  | 'postulacion_abierta'
  | 'postulacion_cerrada'
  | 'habilitacion'
  | 'habilitacion_publicada'
  | 'sorteo_comprometido'
  | 'sorteo_ejecutado'
  | 'publicado'
  | 'vigente'
  | 'cerrado';

export type RequestStatus =
  | 'pending'
  | 'under_review'
  | 'eligible'
  | 'disqualified'
  | 'assigned_direct'
  | 'assigned_raffle'
  | 'not_assigned'
  | 'withdrawn';

export type WhiteBallotStatus =
  | 'vigente'
  | 'usada'
  | 'no_usada_sin_postulacion'
  | 'no_usada_incumple'
  | 'vencida';

export type ReviewDecision = 'approved' | 'rejected';

// 1. Vivienda
export interface Dwelling {
  id: string;
  unit_number: string;
  zone: string;
  block?: string;
  house_number?: string;
  dwelling_type: 'apartamento' | 'casa' | 'local';
  is_active: boolean;
  created_at: string;
}

// 2. Residente
export interface Resident {
  id: string;
  user_id?: string;
  dwelling_id: string;
  full_name: string;
  document_id: string;
  email?: string;
  phone?: string;
  residency_type: ResidencyType;
  payments_current: boolean;
  payment_verified_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  dwelling?: Dwelling;
}

// 3. Vehículo
export interface Vehicle {
  id: string;
  dwelling_id: string;
  resident_id: string;
  internal_code: string; // VEH-### o MOT-###
  plate: string;
  brand?: string;
  model?: string;
  color?: string;
  vehicle_type: VehicleType;
  vehicle_category: VehicleCategory;
  is_oversized: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 4. Espacio de parqueadero
export interface ParkingSpace {
  id: string;
  space_number: string;
  zone: string;
  section?: string;
  vehicle_type: VehicleType;
  allows_oversized: boolean;
  status: SpaceStatus;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

// 5. Motivo de exclusión
export interface DisqualificationReason {
  id: string;
  reason_code: string;
  label: string;
  description: string;
  is_active: boolean;
}

// 6. Periodo / Sorteo
export interface RafflePeriod {
  id: string;
  cycle_id: string;
  period: string; // ej: '2026-Q4'
  quarter_start: string;
  quarter_end: string;
  vehicle_type: VehicleType;
  capacity: number; // 96 para A, 25 para M
  status: RaffleStatus;
  seed_hash?: string;
  revealed_seed?: string;
  snapshot_hash?: string;
  result_hash?: string;
  algorithm_version?: string;
  executed_by?: string;
  executed_at?: string;
  created_at: string;
}

// 7. Postulación / Solicitud
export interface ParkingRequest {
  id: string;
  raffle_id: string;
  resident_id: string;
  dwelling_id: string;
  vehicle_id: string;
  receipt_number: string;
  residency_type_snapshot: ResidencyType;
  payment_status_snapshot: string;
  payment_validation_note?: string;
  documents_complete: boolean;
  status: RequestStatus;
  has_white_ballot: boolean;
  is_direct_assignment: boolean;
  is_special_priority?: boolean;
  special_priority_reason?: 'salud' | 'edad' | string;
  requested_space_number?: string;
  special_priority_note?: string;
  previous_zone_assigned?: string;
  submitted_at: string;
  resident?: Resident;
  vehicle?: Vehicle;
  dwelling?: Dwelling;
}

// 8. Doble validación (Checklist)
export interface RequestReview {
  id: string;
  request_id: string;
  reviewer_role: 'admin' | 'consejo';
  reviewer_id: string;
  decision: ReviewDecision;
  checklist_data?: Record<string, boolean>;
  observations?: string;
  reviewed_at: string;
}

// 9. Balota Blanca
export interface WhiteBallot {
  id: string;
  cycle_id: string;
  vehicle_type: VehicleType;
  origin_raffle_id: string;
  target_raffle_id?: string;
  resident_id: string;
  dwelling_id: string;
  vehicle_id: string;
  frozen_plate: string;
  frozen_model?: string;
  status: WhiteBallotStatus;
  non_use_reason?: string;
  created_at: string;
}

// 10. Asignación final
export interface ParkingAssignment {
  id: string;
  raffle_id: string;
  request_id: string;
  parking_space_id: string;
  vehicle_id: string;
  dwelling_id: string;
  assignment_type: 'direct' | 'raffle' | 'special' | 'reassignment';
  period: string;
  quarter_start: string;
  quarter_end: string;
  zone_assigned: string;
  status: 'active' | 'expired' | 'revoked' | 'reassigned';
  assigned_at: string;
  expires_at: string;
  parking_space?: ParkingSpace;
  vehicle?: Vehicle;
}
