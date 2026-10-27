// ============================================================
// SUITE DE PRUEBAS DE CASOS DE NEGOCIO — MOTOCICLETAS (PRP v2)
// Caso 1: Sorteo Segundo Semestre (2026-S2 / Q2) -> Balota Blanca para moto sin cupo
// Caso 2: Sorteo Tercer Semestre (2026-S3 / Q3) -> Ingreso DIRECTO automático sin tómbola
// Caso 3: Rotación de Zona en Motos (Bahía Motos 1 vs Bahía Motos 2)
// ============================================================

import { ejecutarSorteoOficial } from './sorteoEngine';
import type { ParkingSpace, ParkingRequest } from '../types/parking';

console.log('======================================================================');
console.log('🏍️ INICIANDO BANCO DE PRUEBAS DE SORTEO PARA MOTOCICLETAS (CAP. 25)');
console.log('======================================================================\n');

// 1. Generador de los 25 Espacios Oficiales de Motos (M-01 a M-25)
function generarEspaciosMotosMock(): ParkingSpace[] {
  const espacios: ParkingSpace[] = [];
  for (let i = 1; i <= 25; i++) {
    const sNum = `M-${String(i).padStart(2, '0')}`;
    const zone = i <= 13 ? 'Bahía Motos 1' : 'Bahía Motos 2';

    espacios.push({
      id: `space-moto-${i}`,
      space_number: sNum,
      zone: zone,
      vehicle_type: 'M',
      allows_oversized: false,
      status: 'available',
      is_active: true,
      created_at: new Date().toISOString(),
    });
  }
  return espacios;
}

// ============================================================
// PARTE 1: SORTEO SEGUNDO SEMESTRE (2026-S2)
// Escenario: 3 Motocicletas compitiendo por 2 cupos disponibles.
// Objetivo: Validar que la moto no favorecida NO reciba parqueadero
//           y reciba su Balota Blanca oficial para el siguiente periodo.
// ============================================================
console.log('======================================================================');
console.log('📍 PASO 1: SORTEO DEL SEGUNDO SEMESTRE (2026-S2)');
console.log('   Capacidad disponible de prueba: 2 cupos de moto');
console.log('   Postulaciones habilitadas: 3 motos');
console.log('======================================================================\n');

// Solo 2 espacios disponibles en este semestre
const espaciosS2 = generarEspaciosMotosMock().slice(0, 2); // M-01 y M-02 (Bahía Motos 1)

const participantesS2: ParkingRequest[] = [
  {
    id: 'req-moto-maria',
    raffle_id: 'raffle-motos-2026-S2',
    resident_id: 'res-maria-gomez',
    dwelling_id: 'dw-casa-12',
    vehicle_id: 'veh-moto-maria',
    receipt_number: 'ACUSE-MOTO-001',
    residency_type_snapshot: 'propietario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: '2026-06-15T10:00:00.000Z',
    dwelling: {
      id: 'dw-casa-12',
      unit_number: 'Casa 12',
      zone: 'Zona 1',
      block: 'Manzana B',
      dwelling_type: 'casa',
      is_active: true,
      created_at: '',
    },
    vehicle: {
      id: 'veh-moto-maria',
      dwelling_id: 'dw-casa-12',
      resident_id: 'res-maria-gomez',
      internal_code: 'MOT-001',
      plate: 'STU89F',
      brand: 'Yamaha NMAX',
      model: '2023',
      vehicle_type: 'M',
      vehicle_category: 'antiguo',
      is_oversized: false,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  },
  {
    id: 'req-moto-andres',
    raffle_id: 'raffle-motos-2026-S2',
    resident_id: 'res-andres-lopez',
    dwelling_id: 'dw-casa-25',
    vehicle_id: 'veh-moto-andres',
    receipt_number: 'ACUSE-MOTO-002',
    residency_type_snapshot: 'arrendatario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: '2026-06-15T11:30:00.000Z',
    dwelling: {
      id: 'dw-casa-25',
      unit_number: 'Casa 25',
      zone: 'Zona 2',
      block: 'Manzana C',
      dwelling_type: 'casa',
      is_active: true,
      created_at: '',
    },
    vehicle: {
      id: 'veh-moto-andres',
      dwelling_id: 'dw-casa-25',
      resident_id: 'res-andres-lopez',
      internal_code: 'MOT-002',
      plate: 'KLM45D',
      brand: 'Honda CB190',
      model: '2022',
      vehicle_type: 'M',
      vehicle_category: 'antiguo',
      is_oversized: false,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  },
  {
    id: 'req-moto-juan',
    raffle_id: 'raffle-motos-2026-S2',
    resident_id: 'res-juan-martinez',
    dwelling_id: 'dw-casa-38',
    vehicle_id: 'veh-moto-juan',
    receipt_number: 'ACUSE-MOTO-003',
    residency_type_snapshot: 'propietario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: '2026-06-15T14:20:00.000Z',
    dwelling: {
      id: 'dw-casa-38',
      unit_number: 'Casa 38',
      zone: 'Zona 3',
      block: 'Manzana E',
      dwelling_type: 'casa',
      is_active: true,
      created_at: '',
    },
    vehicle: {
      id: 'veh-moto-juan',
      dwelling_id: 'dw-casa-38',
      resident_id: 'res-juan-martinez',
      internal_code: 'MOT-003',
      plate: 'QRS12E',
      brand: 'Bajaj Pulsar NS200',
      model: '2024',
      vehicle_type: 'M',
      vehicle_category: 'antiguo',
      is_oversized: false,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  },
];

console.log('📋 Motos postuladas al Sorteo Segundo Semestre:');
participantesS2.forEach((p, idx) => {
  console.log(`   ${idx + 1}. [${p.vehicle?.internal_code}] ${p.dwelling?.unit_number} - Placa: ${p.vehicle?.plate} (${p.vehicle?.brand})`);
});
console.log(`\n🅿️ Cupos disponibles para motos: ${espaciosS2.length} puestos (${espaciosS2.map((s) => s.space_number).join(', ')})\n`);

// Ejecutar sorteo del Segundo Semestre con semilla controlada
const resultadoS2 = ejecutarSorteoOficial({
  raffleId: 'raffle-motos-2026-S2',
  vehicleType: 'M',
  capacity: 2,
  period: '2026-S2',
  quarterStart: '2026-07-01',
  quarterEnd: '2026-12-31',
  eligibleRequests: participantesS2,
  availableSpaces: espaciosS2,
  seed: 'SEMILLA-TEST-MOTO-SEMESTRE-2',
});

console.log('📊 RESULTADOS SORTEO SEGUNDO SEMESTRE:');
console.log(` - Asignaciones realizadas por sorteo: ${resultadoS2.raffleAssignments.length}`);
resultadoS2.raffleAssignments.forEach((a) => {
  const req = participantesS2.find((p) => p.id === a.requestId);
  console.log(`   ✅ Asignado: Moto [${req?.vehicle?.plate}] ${req?.vehicle?.brand} -> Puesto N° ${a.spaceNumber} (${a.zone})`);
});

console.log(`\n - Balotas Blancas emitidas (sin cupo asignado): ${resultadoS2.newWhiteBallots.length}`);
const motoBalotaBlanca = resultadoS2.newWhiteBallots[0];
console.log(`   ⚪ Placa que NO obtuvo parqueadero: [${motoBalotaBlanca.plate}] (${motoBalotaBlanca.model})`);
console.log(`   📌 Constancia: Se emite Balota Blanca oficial con derecho de prelación para el Tercer Semestre.\n`);

// Verificación paso 1
if (resultadoS2.raffleAssignments.length === 2 && resultadoS2.newWhiteBallots.length === 1) {
  console.log('✅ VALIDACIÓN PASO 1 EXITOSA: 2 motos asignadas y 1 moto quedó con Balota Blanca sin parqueadero.\n');
} else {
  console.error('❌ Error en validación Paso 1');
  process.exit(1);
}

// ============================================================
// PARTE 2: SORTEO TERCER SEMESTRE (2026-S3 / SIGUIENTE PERIODO)
// Escenario:
//   - La moto que sacó Balota Blanca en el Segundo Semestre (Placa: STU89F / KLM45D / QRS12E)
//     se postula nuevamente.
//   - Ahora ingresa DIRECTAMENTE por prelación de Balota Blanca.
//   - Se postulan nuevas motos al sorteo ordinario.
// ============================================================
console.log('======================================================================');
console.log('📍 PASO 2: SORTEO DEL TERCER SEMESTRE (2026-S3 / SIGUIENTE PERIODO)');
console.log(`   Moto con Balota Blanca activa: Placa [${motoBalotaBlanca.plate}]`);
console.log('   Objetivo: Comprobar que ingresa automáticamente sin pasar por sorteo.');
console.log('======================================================================\n');

// Todos los espacios de motos disponibles en este nuevo periodo
const espaciosS3 = generarEspaciosMotosMock();

// Encontrar la solicitud original del participante con balota blanca
const originalReq = participantesS2.find((p) => p.vehicle?.plate === motoBalotaBlanca.plate)!;

// Postulantes para el Tercer Semestre:
const participantesS3: ParkingRequest[] = [
  // 1. Participante con Balota Blanca previa -> INGRESO DIRECTO
  {
    ...originalReq,
    id: `req-moto-${motoBalotaBlanca.plate}-S3`,
    raffle_id: 'raffle-motos-2026-S3',
    has_white_ballot: true,       // Posee Balota Blanca del periodo anterior
    is_direct_assignment: true,   // Prioridad de asignación directa
    submitted_at: '2026-12-10T09:00:00.000Z',
  },
  // 2. Nuevo vecino postulante ordinario 1
  {
    id: 'req-moto-sandra-S3',
    raffle_id: 'raffle-motos-2026-S3',
    resident_id: 'res-sandra-mora',
    dwelling_id: 'dw-casa-50',
    vehicle_id: 'veh-moto-sandra',
    receipt_number: 'ACUSE-MOTO-004',
    residency_type_snapshot: 'propietario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: '2026-12-10T10:15:00.000Z',
    dwelling: {
      id: 'dw-casa-50',
      unit_number: 'Casa 50',
      zone: 'Zona 5',
      block: 'Manzana H',
      dwelling_type: 'casa',
      is_active: true,
      created_at: '',
    },
    vehicle: {
      id: 'veh-moto-sandra',
      dwelling_id: 'dw-casa-50',
      resident_id: 'res-sandra-mora',
      internal_code: 'MOT-004',
      plate: 'WXY34C',
      brand: 'Suzuki Gixxer 250',
      model: '2024',
      vehicle_type: 'M',
      vehicle_category: 'nuevo',
      is_oversized: false,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  },
  // 3. Nuevo vecino postulante ordinario 2
  {
    id: 'req-moto-diego-S3',
    raffle_id: 'raffle-motos-2026-S3',
    resident_id: 'res-diego-castro',
    dwelling_id: 'dw-casa-63',
    vehicle_id: 'veh-moto-diego',
    receipt_number: 'ACUSE-MOTO-005',
    residency_type_snapshot: 'arrendatario',
    payment_status_snapshot: 'al_dia',
    documents_complete: true,
    status: 'eligible',
    has_white_ballot: false,
    is_direct_assignment: false,
    submitted_at: '2026-12-10T11:45:00.000Z',
    dwelling: {
      id: 'dw-casa-63',
      unit_number: 'Casa 63',
      zone: 'Zona 6',
      block: 'Manzana K',
      dwelling_type: 'casa',
      is_active: true,
      created_at: '',
    },
    vehicle: {
      id: 'veh-moto-diego',
      dwelling_id: 'dw-casa-63',
      resident_id: 'res-diego-castro',
      internal_code: 'MOT-005',
      plate: 'ZAB56B',
      brand: 'KTM Duke 200',
      model: '2023',
      vehicle_type: 'M',
      vehicle_category: 'antiguo',
      is_oversized: false,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  },
];

console.log('📋 Participantes en Tercer Semestre:');
console.log(` 1. Moto [${originalReq.vehicle?.plate}] (${originalReq.vehicle?.brand}) -> 🎟️ TIENE BALOTA BLANCA VIGENTE (Entra directo)`);
console.log(' 2. Moto [WXY34C] (Suzuki Gixxer 250) -> Sorteo ordinario');
console.log(' 3. Moto [ZAB56B] (KTM Duke 200) -> Sorteo ordinario\n');

// Ejecutar sorteo del Tercer Semestre
const resultadoS3 = ejecutarSorteoOficial({
  raffleId: 'raffle-motos-2026-S3',
  vehicleType: 'M',
  capacity: 25,
  period: '2026-S3',
  quarterStart: '2027-01-01',
  quarterEnd: '2027-06-30',
  eligibleRequests: participantesS3,
  availableSpaces: espaciosS3,
  seed: 'SEMILLA-TEST-MOTO-SEMESTRE-3',
});

console.log('📊 RESULTADOS SORTEO TERCER SEMESTRE:');
console.log(` - Asignaciones DIRECTAS (Balota Blanca): ${resultadoS3.directAssignments.length}`);
resultadoS3.directAssignments.forEach((d) => {
  console.log(`   🏆 ASIGNACIÓN DIRECTA ADJUDICADA:`);
  console.log(`      * Vehículo: Moto [${originalReq.vehicle?.plate}] - ${originalReq.vehicle?.brand}`);
  console.log(`      * Vivienda: ${originalReq.dwelling?.unit_number} (${originalReq.dwelling?.block})`);
  console.log(`      * Puesto Moto Adjudicado: N° ${d.spaceNumber}`);
  console.log(`      * Zona Adjudicada: ${d.zone}`);
  console.log(`      * Causa de prelación: ${d.reason}`);
});

console.log(`\n - Asignaciones por Sorteo Ordinario (Azar Fisher-Yates): ${resultadoS3.raffleAssignments.length}`);
resultadoS3.raffleAssignments.forEach((a) => {
  const req = participantesS3.find((p) => p.id === a.requestId);
  console.log(`   🎲 Asignado por Sorteo: Moto [${req?.vehicle?.plate}] -> Puesto N° ${a.spaceNumber} (${a.zone})`);
});

// Verificación paso 2
const asignadaDirecta = resultadoS3.directAssignments.find((d) => d.requestId === `req-moto-${motoBalotaBlanca.plate}-S3`);
if (asignadaDirecta) {
  console.log('\n✅ VALIDACIÓN PASO 2 EXITOSA AL 100%:');
  console.log(`   La moto con placa [${motoBalotaBlanca.plate}] que quedó en balota blanca en el primer sorteo,`);
  console.log(`   ingresó AUTOMÁTICAMENTE en el segundo sorteo sin depender del azar, recibiendo el puesto ${asignadaDirecta.spaceNumber}.\n`);
} else {
  console.error('❌ Error: La moto con balota blanca no recibió asignación directa.');
  process.exit(1);
}

// ============================================================
// PARTE 3: ROTACIÓN DE ZONA EN MOTOS (Bahía Motos 1 vs Bahía Motos 2)
// Escenario: Una moto estuvo en Bahía Motos 1 en el semestre anterior.
// En el nuevo sorteo el algoritmo de rotación evita repetir Bahía Motos 1
// y le asigna un cupo en Bahía Motos 2.
// ============================================================
console.log('======================================================================');
console.log('📍 PASO 3: VALIDACIÓN DE ROTACIÓN DE ZONA PARA MOTOCICLETAS');
console.log('   Bahía anterior asignada: Bahía Motos 1');
console.log('   Objetivo: Garantizar que el sorteo rote automáticamente a Bahía Motos 2.');
console.log('======================================================================\n');

const zonaAnteriorMoto = 'Bahía Motos 1';
const puestoAnteriorMoto = 'M-05';

const historicalMapMotos: Record<string, string[]> = {
  'MANZANA B-CASA 12-YAMAHA NMAX-STU89F': [puestoAnteriorMoto],
};

const reqMotoRotacion: ParkingRequest = {
  id: 'req-moto-rotacion-test',
  raffle_id: 'raffle-motos-rotacion',
  resident_id: 'res-maria-gomez',
  dwelling_id: 'dw-casa-12',
  vehicle_id: 'veh-moto-maria',
  receipt_number: 'ACUSE-MOTO-ROT-001',
  residency_type_snapshot: 'propietario',
  payment_status_snapshot: 'al_dia',
  documents_complete: true,
  status: 'eligible',
  has_white_ballot: false,
  is_direct_assignment: false,
  previous_zone_assigned: zonaAnteriorMoto, // ZONA ANTERIOR REGISTRADA
  submitted_at: '2027-01-05T08:00:00.000Z',
  dwelling: {
    id: 'dw-casa-12',
    unit_number: 'Casa 12',
    zone: 'Zona 1',
    block: 'Manzana B',
    dwelling_type: 'casa',
    is_active: true,
    created_at: '',
  },
  vehicle: {
    id: 'veh-moto-maria',
    dwelling_id: 'dw-casa-12',
    resident_id: 'res-maria-gomez',
    internal_code: 'MOT-001',
    plate: 'STU89F',
    brand: 'Yamaha NMAX',
    model: '2023',
    vehicle_type: 'M',
    vehicle_category: 'antiguo',
    is_oversized: false,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
};

const resultadoRotacion = ejecutarSorteoOficial({
  raffleId: 'raffle-motos-rotacion',
  vehicleType: 'M',
  capacity: 25,
  period: '2027-S1',
  quarterStart: '2027-01-01',
  quarterEnd: '2027-06-30',
  eligibleRequests: [reqMotoRotacion],
  availableSpaces: generarEspaciosMotosMock(),
  historicalOccupiedSpaces: historicalMapMotos,
  seed: 'SEMILLA-ROTACION-MOTOS-TEST',
});

const asignacionRotada = resultadoRotacion.raffleAssignments[0];
console.log(`Resultado de Rotación para Moto STU89F:`);
console.log(` - Zona anterior: ${zonaAnteriorMoto} (Puesto ${puestoAnteriorMoto})`);
console.log(` - Nueva Zona Asignada: ${asignacionRotada.zone}`);
console.log(` - Nuevo Puesto Físico Asignado: ${asignacionRotada.spaceNumber}`);
console.log(` - ¿Puesto inédito/nunca ocupado por este vehículo?: ${asignacionRotada.esPuestoNuevo ? 'SÍ' : 'NO'}`);

const rotoZonaExitoso = asignacionRotada.zone !== zonaAnteriorMoto;
const rotoPuestoExitoso = asignacionRotada.spaceNumber !== puestoAnteriorMoto;

console.log(`\nVerificaciones:`);
console.log(` 1. ¿Rotó de Zona (Diferente a ${zonaAnteriorMoto})?: ${rotoZonaExitoso ? '✅ SÍ, ROTÓ A ' + asignacionRotada.zone : '❌ FALLÓ'}`);
console.log(` 2. ¿Puesto físico diferente a ${puestoAnteriorMoto}?: ${rotoPuestoExitoso ? '✅ SÍ, NUEVO PUESTO ' + asignacionRotada.spaceNumber : '❌ FALLÓ'}`);

if (rotoZonaExitoso && rotoPuestoExitoso) {
  console.log('\n🎉 TODOS LOS CASOS DE PRUEBA DE MOTOCICLETAS PASARON AL 100%');
  console.log('======================================================================\n');
} else {
  console.error('❌ Error en validación de rotación de motos.');
  process.exit(1);
}
