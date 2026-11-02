// ============================================================
// MOTOR DE SORTEO TRIMESTRAL CON MEMORIA HISTÓRICA (PRP v2)
// ============================================================
// Reglas implementadas:
// 1. 9 Zonas oficiales (puestos 1 al 96).
// 2. Puestos grandes: 47, 48, 49 y 50 para vehículos sobredimensionados.
// 3. Memoria histórica: controla que al menos una vez en los ciclos
//    el vehículo ocupe cada número de puesto.
// 4. Si ya ocupó el puesto, queda libre para rotar en cualquier zona.
// 5. Rotación de zona consecutiva: evita repetir la zona anterior.
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
  // Mapa histórico: clave única -> lista de números de puesto ya ocupados anteriormente
  historicalOccupiedSpaces?: Record<string, string[]>;
  seed?: string;
}

export interface SorteoResult {
  directAssignments: Array<{
    requestId: string;
    spaceId: string;
    spaceNumber: string;
    zone: string;
    reason: string;
    esPuestoNuevo: boolean;
  }>;
  raffleAssignments: Array<{
    requestId: string;
    spaceId: string;
    spaceNumber: string;
    zone: string;
    esPuestoNuevo: boolean;
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

  let poolEspacios = [...input.availableSpaces.filter((s) => s.vehicle_type === input.vehicleType && s.status === 'available')];

  const directas = input.eligibleRequests.filter((r) => r.has_white_ballot || r.is_direct_assignment);
  const paraSorteo = input.eligibleRequests.filter((r) => !r.has_white_ballot && !r.is_direct_assignment);

  const directAssignments: SorteoResult['directAssignments'] = [];
  const raffleAssignments: SorteoResult['raffleAssignments'] = [];
  const newWhiteBallots: SorteoResult['newWhiteBallots'] = [];

  const historyMap = input.historicalOccupiedSpaces || {};

  // Función clave: asignación con memoria de puestos ocupados
  function asignarEspacioConMemoria(req: ParkingRequest, esOversized: boolean) {
    // Clave de memoria: Bloque + Casa + Marca + Placa
    const key = `${req.dwelling?.block || ''}-${req.dwelling?.unit_number || ''}-${req.vehicle?.brand || ''}-${req.vehicle?.plate || ''}`.toUpperCase();
    const puestosOcupados = historyMap[key] || [];

    // 1. Filtrar compatibles por tamaño (47-50 si es sobredimensionado)
    let candidatos = poolEspacios.filter((s) => {
      if (esOversized) {
        return s.allows_oversized; // Solo 47, 48, 49, 50
      }
      return true;
    });

    if (candidatos.length === 0) return null;

    // 2. FASE A: Priorizar puestos que NUNCA haya ocupado antes
    const nuncaOcupados = candidatos.filter((s) => !puestosOcupados.includes(s.space_number));

    let poolFinal = nuncaOcupados.length > 0 ? nuncaOcupados : candidatos;
    let esPuestoNuevo = nuncaOcupados.length > 0;

    // 3. Aplicar rotación de zona consecutiva (no repetir la zona del trimestre anterior)
    // Regla: Solo aplica para carros (9 zonas oficiales). Las motos no tienen zonificación (zona única de 25 cupos).
    if (input.vehicleType === 'A' && req.previous_zone_assigned) {
      const conRotacionZona = poolFinal.filter((s) => s.zone !== req.previous_zone_assigned);
      if (conRotacionZona.length > 0) {
        poolFinal = conRotacionZona;
      }
    }

    // 4. Selección aleatoria uniforme
    const idx = Math.floor(prng() * poolFinal.length);
    const elegido = poolFinal[idx];

    // Remover del pool disponible
    poolEspacios = poolEspacios.filter((s) => s.id !== elegido.id);

    return { elegido, esPuestoNuevo };
  }

  // PASO 1: Asignaciones Directas por Balota Blanca previa
  for (const req of directas) {
    if (poolEspacios.length === 0) break;
    const esOversized = !!req.vehicle?.is_oversized;
    const asignado = asignarEspacioConMemoria(req, esOversized);

    if (asignado) {
      directAssignments.push({
        requestId: req.id,
        spaceId: asignado.elegido.id,
        spaceNumber: asignado.elegido.space_number,
        zone: asignado.elegido.zone,
        reason: 'Asignación Directa: Balota Blanca vigente del periodo anterior',
        esPuestoNuevo: asignado.esPuestoNuevo,
      });
    }
  }

  // PASO 2: Barajado Fisher-Yates de los participantes del sorteo general
  const barajados = [...paraSorteo];
  for (let i = barajados.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
  }

  // PASO 3: Asignar cupos a los ganadores del sorteo
  for (const req of barajados) {
    if (poolEspacios.length === 0) {
      // Sin cupo -> Balota Blanca para el siguiente periodo
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
    const asignado = asignarEspacioConMemoria(req, esOversized);

    if (asignado) {
      raffleAssignments.push({
        requestId: req.id,
        spaceId: asignado.elegido.id,
        spaceNumber: asignado.elegido.space_number,
        zone: asignado.elegido.zone,
        esPuestoNuevo: asignado.esPuestoNuevo,
      });
    } else {
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
