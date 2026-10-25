// ============================================================
// SERVICIOS CRUD — MÓDULO DE PARQUEADEROS
// ============================================================
import { createClient } from '@/shared/lib/supabase/client';
import type {
  ParkingSpace,
  DisqualificationReason,
  RafflePeriod,
  ParkingRequest,
  ParkingAssignment,
} from '../types/parking';

export const parkingService = {
  // Obtener todos los espacios de parqueadero
  async getParkingSpaces(): Promise<ParkingSpace[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('*')
      .order('space_number', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Obtener catálogo de motivos de exclusión
  async getDisqualificationReasons(): Promise<DisqualificationReason[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('disqualification_reasons')
      .select('*')
      .eq('is_active', true)
      .order('reason_code', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Obtener periodos o sorteos actuales
  async getRaffles(): Promise<RafflePeriod[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('raffles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Obtener resumen de estadísticas generales para el Dashboard
  async getDashboardStats() {
    const supabase = createClient();

    const [spacesRes, requestsRes, assignmentsRes] = await Promise.all([
      supabase.from('parking_spaces').select('id, vehicle_type, status'),
      supabase.from('parking_requests').select('id, status'),
      supabase.from('parking_assignments').select('id, status').eq('status', 'active'),
    ]);

    const spaces = spacesRes.data || [];
    const requests = requestsRes.data || [];
    const assignments = assignmentsRes.data || [];

    const carSpaces = spaces.filter((s) => s.vehicle_type === 'A');
    const motoSpaces = spaces.filter((s) => s.vehicle_type === 'M');

    return {
      totalCarSpaces: carSpaces.length,
      maxCarCapacity: 96,
      totalMotoSpaces: motoSpaces.length,
      maxMotoCapacity: 25,
      activeAssignments: assignments.length,
      totalRequests: requests.length,
      pendingReviews: requests.filter((r) => r.status === 'under_review' || r.status === 'pending').length,
    };
  },
};
