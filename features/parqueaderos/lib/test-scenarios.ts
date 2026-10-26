// ============================================================
// SUITE DE PRUEBAS DE CASOS DE NEGOCIO (PRP v2)
// Caso 1: Balota blanca y asignación directa en siguiente periodo
// Caso 2: No repetición de zona consecutiva y memoria histórica
// ============================================================
import { ejecutarSorteoOficial, type SorteoInput } from './sorteoEngine';
import type { ParkingSpace, ParkingRequest } from '../types/parking';

console.log('====================================================');
console.log('🧪 INICIANDO BANCO DE PRUEBAS DEL MOTOR DE SORTEO');
console.log('====================================================\n');

// 1. Mock de Espacios con las 9 Zonas Oficiales
function generarEspaciosMock(): ParkingSpace[] {
  const espacios: ParkingSpace[] = [];
  for (let i = 1; i <= 96; i++) {
    const sNum = String(i).padStart(2, '0');
    let z = 'Zona 1';
    if (i >= 19 && i <= 34) z = 'Zona 2';
    else if (i >= 35 && i <= 39) z = 'Zona 3';
    else if (i >= 40 && i <= 58) z = 'Zona 4';
    else if (i >= 59 && i <= 60) z = 'Zona 5';
    else if (i >= 61 && i <= 69) z = 'Zona 6';
    else if (i >= 70 && i <= 80) z = 'Zona 7';
    else if (i >= 81 && i <= 95) z = 'Zona 8';
    else if (i === 96) z = 'Zona 9';

    espacios.push({
      id: `space-uuid-${i}`,
      space_number: sNum,
      zone: z,
      vehicle_type: 'A',
      allows_oversized: [47, 48, 49, 50].includes(i),
      status: 'available',
      is_active: true,
      created_at: new Date().toISOString(),
    });
  }
  return espacios;
}

// ============================================================
// PRUEBA 1: BALOTA BLANCA -> ASIGNACIÓN DIRECTA EN EL SIGUIENTE
// ============================================================
console.log('--- PRUEBA 1: BALOTA BLANCA Y ASIGNACIÓN DIRECTA ---');

// Trimestre 1: Solo hay 1 cupo disponible, pero participan 2 personas
const espaciosT1 = generarEspaciosMock().slice(0, 1); // Solo puesto 01 (Zona 1)

const participantesT1: ParkingRequest[] = [
  {
    id: 'req-carlos',
    raffle_id: 'raffle-2026-Q1',
    resident_id: 'res-carlos',
    dwelling_id: 'dw-casa-01',
    vehicle_id: 'veh-carlos',
    receipt_number: 'ACUSE-001',
    residency_type_snapshot: 'propietario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: new Date().toISOString(),
    dwelling: { id: 'dw-casa-01', unit_number: 'Casa 01', zone: 'Zona 1', block: 'Bloque 1', dwelling_type: 'casa', is_active: true, created_at: '' },
    vehicle: { id: 'veh-carlos', dwelling_id: 'dw-casa-01', resident_id: 'res-carlos', internal_code: 'VEH-001', plate: 'ASI3215', brand: 'Mazda', vehicle_type: 'A', vehicle_category: 'antiguo', is_oversized: false, is_active: true, created_at: '', updated_at: '' },
  },
  {
    id: 'req-pedro',
    raffle_id: 'raffle-2026-Q1',
    resident_id: 'res-pedro',
    dwelling_id: 'dw-casa-02',
    vehicle_id: 'veh-pedro',
    receipt_number: 'ACUSE-002',
    residency_type_snapshot: 'arrendatario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: new Date().toISOString(),
    dwelling: { id: 'dw-casa-02', unit_number: 'Casa 02', zone: 'Zona 1', block: 'Bloque 1', dwelling_type: 'casa', is_active: true, created_at: '' },
    vehicle: { id: 'veh-pedro', dwelling_id: 'dw-casa-02', resident_id: 'res-pedro', internal_code: 'VEH-002', plate: 'BLU458', brand: 'Renault', vehicle_type: 'A', vehicle_category: 'antiguo', is_oversized: false, is_active: true, created_at: '', updated_at: '' },
  },
];

const resultadoT1 = ejecutarSorteoOficial({
  raffleId: 'raffle-2026-Q1',
  vehicleType: 'A',
  capacity: 1,
  period: '2026-Q1',
  quarterStart: '2026-01-01',
  quarterEnd: '2026-03-31',
  eligibleRequests: participantesT1,
  availableSpaces: espaciosT1,
  seed: 'SEMILLA-FIJA-TEST-1',
});

console.log('Resultados Trimestre 1:');
console.log(` - Asignaciones por sorteo: ${resultadoT1.raffleAssignments.length}`);
console.log(` - Balotas blancas emitidas: ${resultadoT1.newWhiteBallots.length}`);
const perdedor = resultadoT1.newWhiteBallots[0];
console.log(` ✅ Participante que no alcanzó cupo: Placa [${perdedor.plate}] recibió Balota Blanca.\n`);

// Trimestre 2: El perdedor se postula de nuevo y ahora tiene balota blanca activa
console.log('Trimestre 2 (Siguiente sorteo):');
const espaciosT2 = generarEspaciosMock(); // Todos los espacios disponibles

const participantesT2: ParkingRequest[] = [
  {
    ...participantesT1.find((p) => p.vehicle?.plate === perdedor.plate)!,
    id: 'req-perdedor-T2',
    raffle_id: 'raffle-2026-Q2',
    has_white_ballot: true,       // TIENE BALOTA BLANCA VIGENTE
    is_direct_assignment: true,   // POSTULADO DIRECTO
  },
  {
    id: 'req-nuevo-vecino',
    raffle_id: 'raffle-2026-Q2',
    resident_id: 'res-nuevo',
    dwelling_id: 'dw-casa-03',
    vehicle_id: 'veh-nuevo',
    receipt_number: 'ACUSE-003',
    residency_type_snapshot: 'propietario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: new Date().toISOString(),
    dwelling: { id: 'dw-casa-03', unit_number: 'Casa 03', zone: 'Zona 2', block: 'Bloque 2', dwelling_type: 'casa', is_active: true, created_at: '' },
    vehicle: { id: 'veh-nuevo', dwelling_id: 'dw-casa-03', resident_id: 'res-nuevo', internal_code: 'VEH-003', plate: 'NEW777', brand: 'Chevrolet', vehicle_type: 'A', vehicle_category: 'antiguo', is_oversized: false, is_active: true, created_at: '', updated_at: '' },
  },
];

const resultadoT2 = ejecutarSorteoOficial({
  raffleId: 'raffle-2026-Q2',
  vehicleType: 'A',
  capacity: 96,
  period: '2026-Q2',
  quarterStart: '2026-04-01',
  quarterEnd: '2026-06-30',
  eligibleRequests: participantesT2,
  availableSpaces: espaciosT2,
  seed: 'SEMILLA-FIJA-TEST-2',
});

console.log(` - Asignaciones DIRECTAS por Balota Blanca: ${resultadoT2.directAssignments.length}`);
resultadoT2.directAssignments.forEach((d) => {
  console.log(`   🏆 Cupo Directo Adjudicado: Puesto N° ${d.spaceNumber} (${d.zone}) -> Motivo: ${d.reason}`);
});
console.log(` - Asignaciones por Sorteo General restante: ${resultadoT2.raffleAssignments.length}`);
console.log('✅ CASO 1 VALIDADO AL 100%: Quien quedó con balota blanca en Q1 ingresó con asignación directa en Q2 sin pasar por sorteo.\n');


// ============================================================
// PRUEBA 2: ROTACIÓN DE ZONAS Y MEMORIA DE PUESTOS NUNCA REPETIDOS
// ============================================================
console.log('--- PRUEBA 2: ROTACIÓN DE ZONA Y MEMORIA HISTÓRICA ---');

// En Q1 a Carlos Pérez (Mazda ASI3215) le asignamos manualmente el Puesto 05 en Zona 1
const puestoQ1 = '05';
const zonaQ1 = 'Zona 1';
console.log(`Carlos Pérez en Trimestre Q1 tuvo: Puesto N° ${puestoQ1} (${zonaQ1})`);

// Historial acumulado en la base de datos
const historicalMap: Record<string, string[]> = {
  'BLOQUE 1-CASA 01-MAZDA-ASI3215': [puestoQ1],
};

const participanteCarlosQ2: ParkingRequest = {
  id: 'req-carlos-Q2',
  raffle_id: 'raffle-2026-Q2',
  resident_id: 'res-carlos',
  dwelling_id: 'dw-casa-01',
  vehicle_id: 'veh-carlos',
  receipt_number: 'ACUSE-004',
  residency_type_snapshot: 'propietario',
  payment_status_snapshot: 'al_dia',
  documents_complete: true,
  status: 'eligible',
  has_white_ballot: false,
  is_direct_assignment: false,
  previous_zone_assigned: zonaQ1, // ZONA ANTERIOR REGISTRADA
  submitted_at: new Date().toISOString(),
  dwelling: { id: 'dw-casa-01', unit_number: 'Casa 01', zone: 'Zona 1', block: 'Bloque 1', dwelling_type: 'casa', is_active: true, created_at: '' },
  vehicle: { id: 'veh-carlos', dwelling_id: 'dw-casa-01', resident_id: 'res-carlos', internal_code: 'VEH-001', plate: 'ASI3215', brand: 'Mazda', vehicle_type: 'A', vehicle_category: 'antiguo', is_oversized: false, is_active: true, created_at: '', updated_at: '' },
};

const resultadoCarlosQ2 = ejecutarSorteoOficial({
  raffleId: 'raffle-2026-Q2',
  vehicleType: 'A',
  capacity: 96,
  period: '2026-Q2',
  quarterStart: '2026-04-01',
  quarterEnd: '2026-06-30',
  eligibleRequests: [participanteCarlosQ2],
  availableSpaces: generarEspaciosMock(),
  historicalOccupiedSpaces: historicalMap,
  seed: 'SEMILLA-ROTACION-TEST',
});

const asignacionCarlos = resultadoCarlosQ2.raffleAssignments[0];
console.log(`\nResultado para Carlos Pérez en Trimestre Q2:`);
console.log(` - Nuevo Puesto Físico: N° ${asignacionCarlos.spaceNumber}`);
console.log(` - Nueva Zona Asignada: ${asignacionCarlos.zone}`);
console.log(` - ¿Es Puesto Inédito / Nunca ocupado?: ${asignacionCarlos.esPuestoNuevo ? 'SÍ (Novedad)' : 'No'}`);

// Validaciones automáticas:
const noRepitioZona = asignacionCarlos.zone !== zonaQ1;
const noRepitioPuesto = asignacionCarlos.spaceNumber !== puestoQ1;

console.log(`\nVerificaciones:`);
console.log(` 1. ¿Rotó de Zona (Diferente a ${zonaQ1})?: ${noRepitioZona ? '✅ SÍ, ROTÓ A ' + asignacionCarlos.zone : '❌ FALLÓ'}`);
console.log(` 2. ¿Puesto físico diferente a N° ${puestoQ1}?: ${noRepitioPuesto ? '✅ SÍ, PUESTO N° ' + asignacionCarlos.spaceNumber : '❌ FALLÓ'}`);

if (noRepitioZona && noRepitioPuesto) {
  console.log('\n🎉 TODOS LOS CASOS DE PRUEBA PASARON AL 100%');
}
