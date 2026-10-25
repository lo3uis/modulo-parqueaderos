// ============================================================
// MOTOR DE SORTEO TRIMESTRAL AUDITABLE Y DETERMINISTA (PRP v2)
// ============================================================
import type { ParkingSpace, ParkingRequest } from '../types/parking';

export interface SorteoInput {
  raffleId: string;
  vehicleType: 'A' | 'M';
  capacity: number;
  period: string;
  quarterStart: string;
  quarterEnd: string;
  eligibleRequests: ParkingRequest[];
  availableSpaces: ParkingSpace[];
  seed?: string;
}

export interface SorteoResult {
  directAssignments: Array<{
    requestId: string;
    spaceId: string;
    spaceNumber: string;
    zone: string;
    reason: string;
  }>;
  raffleAssignments: Array<{
    requestId: string;
    spaceId: string;
    spaceNumber: string;
    zone: string;
  }>;
  newWhiteBallots: Array<{
    requestId: string;
    residentId: string;
    dwellingId: string;
    vehicleId: string;
    plate: string;
    model?: string;
  }>;
  unassignedCount: number;
  seed: string;
  seedHash: string;
}

// Función pseudoaleatoria determinista basada en semilla
function createPRNG(seedStr: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function ejecutarSorteoOficial(input: SorteoInput): SorteoResult {
  const seed = input.seed || `SEMILLA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prng = createPRNG(seed);

  // Espacios disponibles clonados
  let poolEspacios = [...input.availableSpaces.filter((s) => s.vehicle_type === input.vehicleType && s.status === 'available')];

  // Separar solicitudes directas (balota blanca) y solicitudes de sorteo general
  const directas = input.eligibleRequests.filter((r) => r.has_white_ballot || r.is_direct_assignment);
  const paraSorteo = input.eligibleRequests.filter((r) => !r.has_white_ballot && !r.is_direct_assignment);

  const directAssignments: SorteoResult['directAssignments'] = [];
  const raffleAssignments: SorteoResult['raffleAssignments'] = [];
  const newWhiteBallots: SorteoResult['newWhiteBallots'] = [];

  // Función auxiliar para seleccionar puesto físico con rotación de zona
  function asignarEspacioFisico(req: ParkingRequest, esOversized: boolean) {
    let candidatos = poolEspacios.filter((s) => {
      if (esOversized && !s.allows_oversized) return false;
      return true;
    });

    // Intentar respetar rotación de zona (no repetir previous_zone_assigned)
    if (req.previous_zone_assigned) {
      const conRotacion = candidatos.filter((s) => s.zone !== req.previous_zone_assigned);
      if (conRotacion.length > 0) {
        candidatos = conRotacion;
      }
    }

    if (candidatos.length === 0) return null;

    // Elección aleatoria uniforme dentro de candidatos
    const idx = Math.floor(prng() * candidatos.length);
    const elegido = candidatos[idx];

    // Remover del pool de disponibles
    poolEspacios = poolEspacios.filter((s) => s.id !== elegido.id);
    return elegido;
  }

  // PASO 1: Asignaciones Directas por Balota Blanca (descuentan antes del sorteo)
  for (const req of directas) {
    if (poolEspacios.length === 0) break;
    const esOversized = !!req.vehicle?.is_oversized;
    const espacio = asignarEspacioFisico(req, esOversized);

    if (espacio) {
      directAssignments.push({
        requestId: req.id,
        spaceId: espacio.id,
        spaceNumber: espacio.space_number,
        zone: espacio.zone,
        reason: 'Asignación Directa: Balota Blanca vigente del periodo anterior',
      });
    }
  }

  // PASO 2: Barajar con Fisher-Yates determinista los participantes del sorteo general
  const barajados = [...paraSorteo];
  for (let i = barajados.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
  }

  // PASO 3: Asignar cupos a los ganadores del sorteo
  for (const req of barajados) {
    if (poolEspacios.length === 0) {
      // No alcanzó cupo -> Recibe Balota Blanca para el siguiente trimestre
      newWhiteBallots.push({
        requestId: req.id,
        residentId: req.resident_id,
        dwellingId: req.dwelling_id,
        vehicleId: req.vehicle_id,
        plate: req.vehicle?.plate || 'SIN_PLACA',
        model: req.vehicle?.model,
      });
      continue;
    }

    const esOversized = !!req.vehicle?.is_oversized;
    const espacio = asignarEspacioFisico(req, esOversized);

    if (espacio) {
      raffleAssignments.push({
        requestId: req.id,
        spaceId: espacio.id,
        spaceNumber: espacio.space_number,
        zone: espacio.zone,
      });
    } else {
      // Si no hubo espacio compatible (ej. sobredimensionado sin puesto apto)
      newWhiteBallots.push({
        requestId: req.id,
        residentId: req.resident_id,
        dwellingId: req.dwelling_id,
        vehicleId: req.vehicle_id,
        plate: req.vehicle?.plate || 'SIN_PLACA',
        model: req.vehicle?.model,
      });
    }
  }

  // Generar hash simple de auditoría
  const seedHash = `HASH-${Math.abs(
    seed.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
  ).toString(16)}`;

  return {
    directAssignments,
    raffleAssignments,
    newWhiteBallots,
    unassignedCount: newWhiteBallots.length,
    seed,
    seedHash,
  };
}
