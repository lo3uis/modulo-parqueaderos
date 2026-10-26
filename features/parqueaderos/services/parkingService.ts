// ============================================================
// SERVICIOS CRUD — MÓDULO DE PARQUEADEROS
// ============================================================
import { createClient } from '@/shared/lib/supabase/client';
import { ejecutarSorteoOficial } from '../lib/sorteoEngine';
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

  // Obtener postulaciones completas para el panel de doble validación
  async getPendingRequests() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('parking_requests')
      .select(`
        *,
        resident:residents(*),
        dwelling:dwellings(*),
        vehicle:vehicles(*),
        reviews:request_reviews(*)
      `)
      .order('submitted_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Registrar revisión (de Administración o de Consejo)
  async submitReview(params: {
    requestId: string;
    reviewerRole: 'admin' | 'consejo';
    decision: 'approved' | 'rejected';
    checklist: Record<string, boolean>;
    observations: string;
    disqualificationReasonIds?: string[];
  }) {
    const supabase = createClient();

    // 1. Obtener usuario actual o usar null en desarrollo
    const { data: { user } } = await supabase.auth.getUser();
    const reviewerId = user?.id || null;

    // 2. Insertar o actualizar la revisión del rol correspondiente
    const { error: revErr } = await supabase
      .from('request_reviews')
      .upsert(
        {
          request_id: params.requestId,
          reviewer_role: params.reviewerRole,
          reviewer_id: reviewerId,
          decision: params.decision,
          checklist_data: params.checklist,
          observations: params.observations,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'request_id,reviewer_role' }
      );

    if (revErr) throw new Error('Error al registrar validación: ' + revErr.message);

    // 3. Si es rechazada, asociar motivos de descalificación en tabla puente
    if (params.decision === 'rejected' && params.disqualificationReasonIds?.length) {
      const inserts = params.disqualificationReasonIds.map((rId) => ({
        request_id: params.requestId,
        reason_id: rId,
        detail: params.observations || 'Rechazado en doble validación',
        reviewed_by: reviewerId,
      }));

      await supabase.from('parking_request_disqualifications').upsert(inserts, {
        onConflict: 'request_id,reason_id',
      });

      // Marcar solicitud como descalificada
      await supabase
        .from('parking_requests')
        .update({ status: 'disqualified' })
        .eq('id', params.requestId);

      return { status: 'disqualified' };
    }

    // 4. Si es aprobada, verificar si el otro rol ya aprobó
    const { data: allReviews } = await supabase
      .from('request_reviews')
      .select('reviewer_role, decision')
      .eq('request_id', params.requestId);

    const adminApproved = allReviews?.some((r) => r.reviewer_role === 'admin' && r.decision === 'approved');
    const consejoApproved = allReviews?.some((r) => r.reviewer_role === 'consejo' && r.decision === 'approved');

    if (adminApproved && consejoApproved) {
      // Ambas aprobaciones completadas -> pasa a elegible para el sorteo
      await supabase
        .from('parking_requests')
        .update({ status: 'eligible' })
        .eq('id', params.requestId);

      return { status: 'eligible' };
    } else {
      await supabase
        .from('parking_requests')
        .update({ status: 'under_review' })
        .eq('id', params.requestId);

      return { status: 'under_review' };
    }
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

  // Crear una postulación completa con acuse de recibo
  async submitParkingRequest(formData: {
    unitNumber: string;
    zone?: string;
    block: string;
    houseNumber?: string;
    fullName: string;
    documentId: string;
    email: string;
    phone: string;
    residencyType: 'propietario' | 'arrendatario';
    vehicleType: 'A' | 'M';
    plate: string;
    brand: string;
    model: string;
    vehicleCategory: 'nuevo' | 'antiguo';
    isOversized: boolean;
    isSpecialPriority?: boolean;
    specialPriorityType?: 'salud' | 'edad';
    requestedSpaceNumber?: string;
    specialPriorityNote?: string;
  }) {
    const supabase = createClient();

    // 1. Obtener o crear el ciclo anual y el sorteo activo
    let cycleId: string;
    const { data: activeCycle } = await supabase
      .from('rotation_cycles')
      .select('id')
      .eq('year', 2026)
      .single();

    if (activeCycle) {
      cycleId = activeCycle.id;
    } else {
      const { data: newCycle, error: cErr } = await supabase
        .from('rotation_cycles')
        .insert({
          year: 2026,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          status: 'active',
        })
        .select()
        .single();
      if (cErr) throw new Error('Error al inicializar ciclo anual: ' + cErr.message);
      cycleId = newCycle.id;
    }

    // 2. Obtener o crear el sorteo activo para el tipo de vehículo
    let raffleId: string;
    const { data: activeRaffle } = await supabase
      .from('raffles')
      .select('id')
      .eq('period', '2026-Q4')
      .eq('vehicle_type', formData.vehicleType)
      .single();

    if (activeRaffle) {
      raffleId = activeRaffle.id;
    } else {
      const { data: newRaffle, error: rErr } = await supabase
        .from('raffles')
        .insert({
          cycle_id: cycleId,
          period: '2026-Q4',
          quarter_start: '2026-10-01',
          quarter_end: '2026-12-31',
          vehicle_type: formData.vehicleType,
          capacity: formData.vehicleType === 'A' ? 96 : 25,
          status: 'postulacion_abierta',
        })
        .select()
        .single();
      if (rErr) throw new Error('Error al inicializar periodo de sorteo: ' + rErr.message);
      raffleId = newRaffle.id;
    }

    // 3. Crear o buscar vivienda (dwelling)
    let dwellingId: string;
    const { data: existingDwelling } = await supabase
      .from('dwellings')
      .select('id')
      .eq('unit_number', formData.unitNumber)
      .single();

    if (existingDwelling) {
      dwellingId = existingDwelling.id;
    } else {
      const { data: newDwelling, error: dErr } = await supabase
        .from('dwellings')
        .insert({
          unit_number: formData.unitNumber,
          zone: formData.zone || 'Asignada por Sistema',
          block: formData.block,
          house_number: formData.houseNumber || formData.unitNumber,
        })
        .select()
        .single();
      if (dErr) throw new Error('Error al registrar vivienda: ' + dErr.message);
      dwellingId = newDwelling.id;
    }

    // 4. Crear o buscar residente
    let residentId: string;
    const { data: existingResident } = await supabase
      .from('residents')
      .select('id')
      .eq('document_id', formData.documentId)
      .single();

    if (existingResident) {
      residentId = existingResident.id;
    } else {
      const { data: newResident, error: resErr } = await supabase
        .from('residents')
        .insert({
          dwelling_id: dwellingId,
          full_name: formData.fullName,
          document_id: formData.documentId,
          email: formData.email,
          phone: formData.phone,
          residency_type: formData.residencyType,
          payments_current: true, // Inicialmente asumido al postularse
        })
        .select()
        .single();
      if (resErr) throw new Error('Error al registrar residente: ' + resErr.message);
      residentId = newResident.id;
    }

    // 5. Generar código interno consecutivo (VEH-### o MOT-###)
    const prefix = formData.vehicleType === 'A' ? 'VEH-' : 'MOT-';
    const { count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('vehicle_type', formData.vehicleType);

    const nextNum = String((count || 0) + 1).padStart(3, '0');
    const internalCode = `${prefix}${nextNum}`;

    // 6. Crear o buscar vehículo
    let vehicleId: string;
    const cleanPlate = formData.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('plate', cleanPlate)
      .single();

    if (existingVehicle) {
      vehicleId = existingVehicle.id;
    } else {
      const { data: newVehicle, error: vErr } = await supabase
        .from('vehicles')
        .insert({
          dwelling_id: dwellingId,
          resident_id: residentId,
          internal_code: internalCode,
          plate: cleanPlate,
          brand: formData.brand,
          model: formData.model,
          vehicle_type: formData.vehicleType,
          vehicle_category: formData.vehicleCategory,
          is_oversized: formData.isOversized,
        })
        .select()
        .single();
      if (vErr) throw new Error('Error al registrar vehículo: ' + vErr.message);
      vehicleId = newVehicle.id;
    }

    // 7. Generar número de acuse único consecutivo
    const receiptNumber = `ACUSE-${formData.vehicleType}-${Date.now().toString().slice(-6)}`;

    // 8. Preparar nota de prioridad especial si aplica
    let paymentNote: string | null = null;
    if (formData.isSpecialPriority) {
      const reasonLabel = formData.specialPriorityType === 'salud' ? 'Salud / Movilidad Reducida' : 'Adulto Mayor / Tercera Edad';
      paymentNote = `[PRIORIDAD_ESPECIAL]: ${reasonLabel} | Puesto: ${formData.requestedSpaceNumber ? formData.requestedSpaceNumber.padStart(2, '0') : 'Por asignar'} | Justificación: ${formData.specialPriorityNote || 'Sin observación adicional'}`;
    }

    // 9. Crear la postulación oficial (parking_request)
    const { data: request, error: reqErr } = await supabase
      .from('parking_requests')
      .insert({
        raffle_id: raffleId,
        resident_id: residentId,
        dwelling_id: dwellingId,
        vehicle_id: vehicleId,
        receipt_number: receiptNumber,
        residency_type_snapshot: formData.residencyType,
        payment_status_snapshot: 'al_dia',
        payment_validation_note: paymentNote,
        is_direct_assignment: !!formData.isSpecialPriority,
        documents_complete: formData.vehicleCategory === 'antiguo',
        status: 'under_review',
      })
      .select()
      .single();

    if (reqErr) throw new Error('Error al radicar postulación: ' + reqErr.message);

    return {
      success: true,
      receiptNumber,
      internalCode,
      requestId: request.id,
      submittedAt: request.submitted_at,
    };
  },

  // Obtener balotas blancas vigentes del ciclo actual
  async getWhiteBallots(vehicleType: 'A' | 'M' = 'A') {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('white_ballots')
      .select(`
        *,
        resident:residents(*),
        dwelling:dwellings(*),
        vehicle:vehicles(*)
      `)
      .eq('vehicle_type', vehicleType)
      .eq('status', 'vigente')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Obtener asignaciones activas con datos de puesto y vehículo
  async getAssignments(vehicleType: 'A' | 'M' = 'A') {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('parking_assignments')
      .select(`
        *,
        parking_space:parking_spaces(*),
        vehicle:vehicles(*),
        dwelling:dwellings(*)
      `)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // Ejecutar el sorteo completo y persistir resultados en Supabase
  async executeRaffle(params: { vehicleType: 'A' | 'M'; period: string }) {
    const supabase = createClient();

    // 1. Obtener el sorteo
    const { data: raffle, error: rErr } = await supabase
      .from('raffles')
      .select('*')
      .eq('period', params.period)
      .eq('vehicle_type', params.vehicleType)
      .single();

    if (rErr || !raffle) throw new Error('No se encontró el periodo de sorteo: ' + params.period);

    // 2. Obtener solicitudes habilitadas (status = 'eligible')
    const { data: eligibleRequests, error: reqErr } = await supabase
      .from('parking_requests')
      .select('*, vehicle:vehicles(*), resident:residents(*)')
      .eq('raffle_id', raffle.id)
      .eq('status', 'eligible');

    if (reqErr) throw new Error('Error al consultar elegibles: ' + reqErr.message);
    if (!eligibleRequests || eligibleRequests.length === 0) {
      throw new Error('No hay solicitudes con estatus "Elegible" (aprobadas por Administración y Consejo).');
    }

    // 3. Obtener espacios disponibles
    const { data: availableSpaces, error: spErr } = await supabase
      .from('parking_spaces')
      .select('*')
      .eq('vehicle_type', params.vehicleType)
      .eq('status', 'available');

    if (spErr) throw new Error('Error al consultar espacios: ' + spErr.message);

    // 3.5. Construir memoria histórica: Bloque + Casa + Marca + Placa -> Puestos ya ocupados
    const { data: pastAssignments } = await supabase
      .from('parking_assignments')
      .select(`
        parking_space_id,
        parking_space:parking_spaces(space_number),
        vehicle:vehicles(plate, brand),
        dwelling:dwellings(unit_number, block)
      `);

    const historicalOccupiedSpaces: Record<string, string[]> = {};
    if (pastAssignments) {
      for (const pa of pastAssignments as any[]) {
        const key = `${pa.dwelling?.block || ''}-${pa.dwelling?.unit_number || ''}-${pa.vehicle?.brand || ''}-${pa.vehicle?.plate || ''}`.toUpperCase();
        const spaceNum = pa.parking_space?.space_number;
        if (spaceNum) {
          if (!historicalOccupiedSpaces[key]) historicalOccupiedSpaces[key] = [];
          if (!historicalOccupiedSpaces[key].includes(spaceNum)) {
            historicalOccupiedSpaces[key].push(spaceNum);
          }
        }
      }
    }

    // 4. Ejecutar el motor puro de sorteo con memoria histórica
    const resultado = ejecutarSorteoOficial({
      raffleId: raffle.id,
      vehicleType: params.vehicleType,
      capacity: raffle.capacity,
      period: raffle.period,
      quarterStart: raffle.quarter_start,
      quarterEnd: raffle.quarter_end,
      eligibleRequests,
      availableSpaces: availableSpaces || [],
      historicalOccupiedSpaces,
    });

    // 5. Persistir Asignaciones Directas
    for (const d of resultado.directAssignments) {
      const req = eligibleRequests.find((r) => r.id === d.requestId);
      if (!req) continue;

      await supabase.from('parking_assignments').insert({
        raffle_id: raffle.id,
        request_id: req.id,
        parking_space_id: d.spaceId,
        vehicle_id: req.vehicle_id,
        dwelling_id: req.dwelling_id,
        assignment_type: 'direct',
        period: raffle.period,
        quarter_start: raffle.quarter_start,
        quarter_end: raffle.quarter_end,
        zone_assigned: d.zone,
        status: 'active',
        assigned_at: new Date().toISOString(),
        expires_at: raffle.quarter_end,
      });

      // Actualizar espacio y postulación
      await supabase.from('parking_spaces').update({ status: 'assigned' }).eq('id', d.spaceId);
      await supabase.from('parking_requests').update({ status: 'assigned_direct' }).eq('id', req.id);
    }

    // 6. Persistir Asignaciones del Sorteo General
    for (const r of resultado.raffleAssignments) {
      const req = eligibleRequests.find((x) => x.id === r.requestId);
      if (!req) continue;

      await supabase.from('parking_assignments').insert({
        raffle_id: raffle.id,
        request_id: req.id,
        parking_space_id: r.spaceId,
        vehicle_id: req.vehicle_id,
        dwelling_id: req.dwelling_id,
        assignment_type: 'raffle',
        period: raffle.period,
        quarter_start: raffle.quarter_start,
        quarter_end: raffle.quarter_end,
        zone_assigned: r.zone,
        status: 'active',
        assigned_at: new Date().toISOString(),
        expires_at: raffle.quarter_end,
      });

      await supabase.from('parking_spaces').update({ status: 'assigned' }).eq('id', r.spaceId);
      await supabase.from('parking_requests').update({ status: 'assigned_raffle' }).eq('id', req.id);
    }

    // 7. Emitir Nuevas Balotas Blancas a quienes no ganaron
    for (const b of resultado.newWhiteBallots) {
      await supabase.from('white_ballots').insert({
        cycle_id: raffle.cycle_id,
        vehicle_type: params.vehicleType,
        origin_raffle_id: raffle.id,
        resident_id: b.residentId,
        dwelling_id: b.dwellingId,
        vehicle_id: b.vehicleId,
        frozen_plate: b.plate,
        frozen_model: b.model,
        status: 'vigente',
      });

      await supabase.from('parking_requests').update({ status: 'not_assigned' }).eq('id', b.requestId);
    }

    // 8. Actualizar estado del sorteo
    await supabase
      .from('raffles')
      .update({
        status: 'sorteo_ejecutado',
        revealed_seed: resultado.seed,
        seed_hash: resultado.seedHash,
        executed_at: new Date().toISOString(),
      })
      .eq('id', raffle.id);

    return resultado;
  },

  // ASIGNACIÓN PRIORITARIA DIRECTA E INMEDIATA (Salud / Adulto Mayor)
  // Permite adjudicar un puesto específico de forma anticipada sin esperar al sorteo
  async assignSpecialPrioritySpace(params: {
    requestId: string;
    spaceNumber: string; // ej. '05'
    reason: string;      // ej. 'Salud / Movilidad Reducida' o 'Adulto Mayor'
    note?: string;
  }) {
    const supabase = createClient();

    // 1. Obtener la solicitud completa con sus relaciones
    const { data: req, error: reqErr } = await supabase
      .from('parking_requests')
      .select('*, resident:residents(*), vehicle:vehicles(*), dwelling:dwellings(*), raffle:raffles(*)')
      .eq('id', params.requestId)
      .single();

    if (reqErr || !req) {
      throw new Error('No se encontró la solicitud especificada: ' + (reqErr?.message || ''));
    }

    // 2. Normalizar número de puesto y buscar en parking_spaces
    const formattedNumber = params.spaceNumber.trim().padStart(2, '0');
    const vType = req.vehicle?.vehicle_type || 'A';

    const { data: space, error: sErr } = await supabase
      .from('parking_spaces')
      .select('*')
      .eq('space_number', formattedNumber)
      .eq('vehicle_type', vType)
      .maybeSingle();

    if (sErr || !space) {
      throw new Error(`El puesto N° ${formattedNumber} no existe para el tipo de vehículo (${vType === 'A' ? 'Carro' : 'Moto'}).`);
    }

    if (space.status !== 'available') {
      throw new Error(`El puesto N° ${space.space_number} (${space.zone}) ya se encuentra asignado u ocupado.`);
    }

    // 3. Determinar periodo y fechas del sorteo
    const rafflePeriod = req.raffle?.period || '2026-Q4';
    const quarterStart = req.raffle?.quarter_start || '2026-10-01';
    const quarterEnd = req.raffle?.quarter_end || '2026-12-31';

    // 4. Crear la asignación activa inmediata
    const { data: assignment, error: aErr } = await supabase
      .from('parking_assignments')
      .insert({
        raffle_id: req.raffle_id,
        request_id: req.id,
        parking_space_id: space.id,
        vehicle_id: req.vehicle_id,
        dwelling_id: req.dwelling_id,
        assignment_type: 'special',
        period: rafflePeriod,
        quarter_start: quarterStart,
        quarter_end: quarterEnd,
        zone_assigned: space.zone,
        status: 'active',
        assigned_at: new Date().toISOString(),
        expires_at: quarterEnd,
      })
      .select('*, parking_space:parking_spaces(*)')
      .single();

    if (aErr) {
      throw new Error('Error al registrar la asignación especial en base de datos: ' + aErr.message);
    }

    // 5. Marcar el espacio como asignado (bloqueado para sorteo general)
    await supabase.from('parking_spaces').update({ status: 'assigned' }).eq('id', space.id);

    // 6. Actualizar estado de la solicitud a 'assigned_direct'
    const updatedNote = `[ASIGNACIÓN DIRECTA]: ${params.reason} | Puesto N° ${space.space_number} (${space.zone}) | ${params.note || ''}`;
    await supabase.from('parking_requests').update({
      status: 'assigned_direct',
      is_direct_assignment: true,
      payment_validation_note: updatedNote,
    }).eq('id', req.id);

    return {
      success: true,
      assignment,
      space,
      message: `Puesto N° ${space.space_number} (${space.zone}) adjudicado directamente a ${req.resident?.full_name} (${req.vehicle?.plate}) por motivo de ${params.reason}.`,
    };
  },

  // PORTERÍA: Buscar placa y verificar asignación activa
  async verifyPlate(plateToSearch: string) {
    const supabase = createClient();
    const cleanPlate = plateToSearch.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 1. Buscar vehículo por placa
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .select('*, dwelling:dwellings(*), resident:residents(*)')
      .eq('plate', cleanPlate)
      .maybeSingle();

    if (vErr) throw new Error('Error al buscar vehículo: ' + vErr.message);

    if (!vehicle) {
      return {
        found: false,
        authorized: false,
        plate: cleanPlate,
        message: 'Placa no registrada en el sistema del conjunto.',
      };
    }

    // 2. Buscar asignación activa en el trimestre actual
    const { data: assignment, error: aErr } = await supabase
      .from('parking_assignments')
      .select('*, parking_space:parking_spaces(*)')
      .eq('vehicle_id', vehicle.id)
      .eq('status', 'active')
      .maybeSingle();

    if (aErr) throw new Error('Error al consultar asignación: ' + aErr.message);

    if (!assignment) {
      return {
        found: true,
        authorized: false,
        plate: cleanPlate,
        vehicle,
        message: 'Vehículo registrado pero SIN asignación vigente en este trimestre.',
      };
    }

    return {
      found: true,
      authorized: true,
      plate: cleanPlate,
      vehicle,
      assignment,
      space: assignment.parking_space,
      message: 'Vehículo AUTORIZADO con puesto asignado.',
    };
  },

  // PORTERÍA: Registrar una incidencia o amonestación
  async reportIncident(data: {
    parkingSpaceId: string;
    observedPlate: string;
    expectedVehicleId?: string;
    incidentType: string;
    hasWarning: boolean;
    notes: string;
  }) {
    const supabase = createClient();
    const cleanPlate = data.observedPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const { data: incident, error } = await supabase
      .from('incidents')
      .insert({
        parking_space_id: data.parkingSpaceId,
        observed_plate: cleanPlate,
        expected_vehicle_id: data.expectedVehicleId || null,
        incident_type: data.incidentType,
        has_warning: data.hasWarning,
        notes: data.notes,
      })
      .select()
      .single();

    if (error) throw new Error('Error al registrar incidencia: ' + error.message);
    return incident;
  },

  // PORTERÍA: Obtener incidencias recientes
  async getRecentIncidents() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('incidents')
      .select('*, parking_space:parking_spaces(*)')
      .order('occurred_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // PORTERÍA: Editar una incidencia existente
  async updateIncident(id: string, data: {
    parkingSpaceId: string;
    observedPlate: string;
    incidentType: string;
    hasWarning: boolean;
    notes: string;
  }) {
    const supabase = createClient();
    const cleanPlate = data.observedPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const { data: updated, error } = await supabase
      .from('incidents')
      .update({
        parking_space_id: data.parkingSpaceId,
        observed_plate: cleanPlate,
        incident_type: data.incidentType,
        has_warning: data.hasWarning,
        notes: data.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error('Error al actualizar incidencia: ' + error.message);
    return updated;
  },

  // DOBLE VALIDACIÓN: Consultar amonestaciones oficiales activas por placa
  async getActiveWarningsByPlate(plate: string) {
    const supabase = createClient();
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('observed_plate', cleanPlate)
      .eq('has_warning', true);

    if (error) return [];
    return data || [];
  },
};
