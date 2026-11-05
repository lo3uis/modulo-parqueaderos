'use client';

import React, { useEffect, useState } from 'react';
import { parkingService } from '../services/parkingService';
import { getYearEndRaffleSchedule } from '../lib/holidayCalendar';

export function SorteoPanel() {
  const [vehicleType, setVehicleType] = useState<'A' | 'M'>('A');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [whiteBallots, setWhiteBallots] = useState<any[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrintReport, setShowPrintReport] = useState(false);

  const holidaySchedule = getYearEndRaffleSchedule(2026);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allReqs, assignList, ballotsList] = await Promise.all([
        parkingService.getPendingRequests(),
        parkingService.getAssignments(vehicleType),
        parkingService.getWhiteBallots(vehicleType),
      ]);

      const eligibles = allReqs.filter(
        (r) => r.status === 'eligible' && r.vehicle?.vehicle_type === vehicleType
      );
      setEligibleCount(eligibles.length);
      setAssignments(assignList.filter((a) => a.parking_space?.vehicle_type === vehicleType));
      setWhiteBallots(ballotsList);
    } catch (err: any) {
      console.error('Error al cargar datos del sorteo:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vehicleType]);

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError(null);
      const res = await parkingService.executeRaffle({
        vehicleType,
        period: '2026-Q4',
      });
      setLastResult(res);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar el sorteo');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Calendario Festividades de Fin de Año (Punto 2) */}
      <div className="p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20 rounded-2xl border-2 border-amber-300 dark:border-amber-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <span className="text-3xl">🗓️</span>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-amber-950 dark:text-amber-100 text-sm">
                Calendario Especial por Festividades de Fin de Año ({holidaySchedule.year})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold text-[10px]">
                Regla Reglamentaria
              </span>
            </div>
            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed max-w-3xl">
              Por temas de festividades de fin de año, las inscripciones deben publicarse el <strong>último jueves del mes de noviembre ({holidaySchedule.publicationFormatted})</strong> y el sorteo se realiza en la segunda semana de diciembre el <strong>día jueves ({holidaySchedule.raffleFormatted})</strong> con vigencia para {holidaySchedule.targetPeriod}.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 text-center text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-gray-900/80 border border-amber-200 dark:border-amber-800 font-mono font-bold text-amber-900 dark:text-amber-300">
            📢 Inscripción: {holidaySchedule.publicationIso}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-mono font-bold shadow-sm">
            🎲 Sorteo: {holidaySchedule.raffleIso}
          </div>
        </div>
      </div>

      {/* Selector de Tipo de Vehículo y Acciones */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Sorteo Trimestral Oficial — Periodo 2026-Q4 / 2027-Q1
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Algoritmo determinista Fisher-Yates, asignación directa por balota blanca previa y rotación de zonas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/acta-asignacion-parqueaderos.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <span>📥 Descargar PDF Oficial Publicado</span>
          </a>

          <button
            type="button"
            onClick={() => setShowPrintReport(true)}
            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <span>🖨️ Vista Imprimible / Guardar PDF</span>
          </button>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setVehicleType('A')}
              className={`px-4 py-2 rounded-lg transition ${
                vehicleType === 'A'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🚗 Carros (Cap. 96)
            </button>
            <button
              onClick={() => setVehicleType('M')}
              className={`px-4 py-2 rounded-lg transition ${
                vehicleType === 'M'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🏍️ Motos (Cap. 25)
            </button>
          </div>

          <button
            onClick={handleExecute}
            disabled={executing || eligibleCount === 0}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm flex items-center gap-2"
          >
            {executing ? (
              '🎲 Ejecutando Sorteo...'
            ) : (
              <>
                <span>🎲 Ejecutar Sorteo</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-[10px]">
                  {eligibleCount} Elegibles
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* Resultados de la última ejecución */}
      {lastResult && (
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-5 rounded-2xl space-y-3 animate-fadeIn text-xs">
          <div className="flex justify-between items-center border-b border-emerald-200/50 pb-2">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
              ✅ ¡Sorteo Ejecutado Exitosamente!
            </span>
            <span className="font-mono text-[10px] text-gray-500">Auditoría: {lastResult.seedHash}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-gray-500 block text-[10px]">Directas (Balota Blanca):</span>
              <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                {lastResult.directAssignments.length}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-gray-500 block text-[10px]">Por Sorteo Aleatorio:</span>
              <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                {lastResult.raffleAssignments.length}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-gray-500 block text-[10px]">Nuevas Balotas Emitidas:</span>
              <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                {lastResult.newWhiteBallots.length}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-gray-500 block text-[10px]">Semilla Criptográfica:</span>
              <span className="font-mono font-bold text-[10px] truncate block text-gray-700 dark:text-gray-300">
                {lastResult.seed}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabla Oficial de Asignaciones Vigentes */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold">Listado Oficial de Puestos Asignados</h3>
            <p className="text-xs text-gray-500">
              {assignments.length} espacios activos en el trimestre actual ({vehicleType === 'A' ? 'Carros' : 'Motos'})
            </p>
          </div>
          <button
            onClick={loadData}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Actualizar resultados
          </button>
        </div>

        {assignments.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No hay asignaciones vigentes para esta categoría. Habilita solicitudes en la Doble Validación y ejecuta el sorteo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Puesto Asignado</th>
                  <th className="p-3.5">Zona</th>
                  <th className="p-3.5">Vivienda</th>
                  <th className="p-3.5">Vehículo / Placa</th>
                  <th className="p-3.5">Vía de Adjudicación</th>
                  <th className="p-3.5">Vigencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                    <td className="p-3.5 font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      N° {a.parking_space?.space_number}
                      {['47', '48', '49', '50'].includes(a.parking_space?.space_number) && (
                        <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded font-sans font-bold">
                          Grande
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-gray-700 dark:text-gray-300">
                      {vehicleType === 'M' || a.vehicle?.vehicle_type === 'M' ? (
                        <span className="text-gray-400 font-normal">Sin zonificación</span>
                      ) : (
                        a.parking_space?.zone || a.zone_assigned
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-gray-900 dark:text-gray-100">
                      {a.dwelling?.unit_number} ({a.dwelling?.block || 'Principal'})
                    </td>
                    <td className="p-3.5 font-mono">
                      <span className="font-bold text-blue-600 dark:text-blue-400">[{a.vehicle?.plate}]</span>{' '}
                      <span className="text-gray-500">({a.vehicle?.internal_code})</span>
                    </td>
                    <td className="p-3.5">
                      {a.assignment_type === 'direct' ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                          Directa (Balota Blanca)
                        </span>
                      ) : a.assignment_type === 'special' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] inline-flex items-center gap-1">
                          ♿ Directa (Salud / Edad)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold text-[10px]">
                          Sorteo Aleatorio
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-500">{a.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabla Oficial de Balotas Blancas Vigentes */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-amber-50/40 dark:bg-amber-950/20 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">⚪</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Padrón Oficial de Balotas Blancas Vigentes (Ciclo Anual 2026)
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Participantes habilitados que no obtuvieron cupo en sorteos previos. Tienen asignación directa para el próximo trimestre.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs">
            {whiteBallots.length} Titulares
          </span>
        </div>

        {whiteBallots.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No hay balotas blancas vigentes actualmente para esta categoría.
            <br />
            (Cuando la demanda de solicitudes supere los 96 cupos de carros o 25 de motos, quienes queden sin espacio recibirán su balota automáticamente aquí).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Titular</th>
                  <th className="p-3.5">Vivienda</th>
                  <th className="p-3.5">Placa Congelada</th>
                  <th className="p-3.5">Vehículo / Modelo</th>
                  <th className="p-3.5">Estado / Beneficio</th>
                  <th className="p-3.5">Fecha Otorgamiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {whiteBallots.map((b) => (
                  <tr key={b.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition">
                    <td className="p-3.5 font-semibold text-gray-900 dark:text-gray-100">
                      {b.resident?.full_name}
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300">
                      {b.dwelling?.unit_number} ({b.dwelling?.block || 'Bloque Principal'})
                    </td>
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      [{b.frozen_plate}]
                    </td>
                    <td className="p-3.5 text-gray-500">
                      {b.frozen_model || 'Modelo estándar'} ({b.vehicle?.internal_code || 'VEH'})
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                        Asignación Directa Próximo Periodo
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-500">
                      {new Date(b.created_at).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal / Vista de Impresión y Exportación PDF Oficial (Punto 4) */}
      {showPrintReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col p-4 md:p-8 overflow-y-auto animate-fadeIn">
          {/* Barra de Controles superior (no se imprime) */}
          <div className="max-w-5xl w-full mx-auto flex items-center justify-between pb-4 print:hidden">
            <button
              type="button"
              onClick={() => setShowPrintReport(false)}
              className="px-4 py-2 rounded-xl bg-gray-800 text-white font-semibold text-xs hover:bg-gray-700 transition flex items-center gap-1.5"
            >
              <span>← Volver al Panel</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-300">
                Formato Oficial de Impresión / Guardado en PDF
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-lg flex items-center gap-2"
              >
                <span>🖨️ Mandar a Imprimir / Guardar como PDF</span>
              </button>
            </div>
          </div>

          {/* Hoja Imprimible Oficial (Estilo Formal de Copropiedad) */}
          <div className="max-w-5xl w-full mx-auto bg-white text-gray-900 rounded-2xl p-8 md:p-12 shadow-2xl space-y-8 print:p-0 print:shadow-none print:rounded-none">
            {/* Membrete Institucional */}
            <div className="border-b-2 border-gray-900 pb-5 text-center space-y-1">
              <span className="text-[11px] font-bold tracking-widest uppercase text-gray-500 block">
                CONJUNTO RESIDENCIAL — PROPIEDAD HORIZONTAL
              </span>
              <h1 className="text-xl md:text-2xl font-extrabold uppercase tracking-tight text-gray-950">
                Acta Oficial de Asignación y Padrón de Parqueaderos
              </h1>
              <p className="text-xs font-semibold text-gray-700">
                Periodo Asignado: <strong>2026-Q4 / 2027-Q1</strong> • Categoría: <strong>{vehicleType === 'A' ? 'Vehículos Automóviles (Carros)' : 'Motocicletas'}</strong>
              </p>
              <div className="text-[10px] text-gray-500 pt-1">
                Expedición: {new Date().toLocaleString('es-CO')} • Sistema Auditor Determinista PRP v2
              </div>
            </div>

            {/* Cuadro de Regla Especial de Fin de Año (Punto 2) */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-300 text-xs space-y-1">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                <span>🗓️ REGLAMENTACIÓN ESPECIAL POR FESTIVIDADES DE FIN DE AÑO:</span>
              </div>
              <p className="text-[11px] text-gray-700 leading-relaxed">
                Por temas de festividades de fin de año, las inscripciones fueron publicadas el <strong>último jueves de noviembre ({holidaySchedule.publicationFormatted})</strong> y el sorteo oficial se realiza el <strong>segundo jueves de diciembre ({holidaySchedule.raffleFormatted})</strong> con vigencia para el primer trimestre del año siguiente ({holidaySchedule.targetPeriod}).
              </p>
            </div>

            {/* Resumen de Capacidad y Asignaciones */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-lg border border-gray-300 bg-gray-50/50">
                <span className="text-[10px] text-gray-500 block">Capacidad Total Oficial:</span>
                <span className="text-lg font-bold text-gray-950">
                  {vehicleType === 'A' ? '96 Puestos' : '25 Puestos'}
                </span>
              </div>
              <div className="p-3 rounded-lg border border-gray-300 bg-gray-50/50">
                <span className="text-[10px] text-gray-500 block">Condición Especial (Salud/Edad):</span>
                <span className="text-lg font-bold text-blue-700">
                  {assignments.filter((a) => a.assignment_type === 'special').length} Cupos
                </span>
              </div>
              <div className="p-3 rounded-lg border border-gray-300 bg-gray-50/50">
                <span className="text-[10px] text-gray-500 block">Directas (Balota Blanca):</span>
                <span className="text-lg font-bold text-purple-700">
                  {assignments.filter((a) => a.assignment_type === 'direct').length} Cupos
                </span>
              </div>
              <div className="p-3 rounded-lg border border-gray-300 bg-gray-50/50">
                <span className="text-[10px] text-gray-500 block">Asignados en Sorteo General:</span>
                <span className="text-lg font-bold text-emerald-700">
                  {assignments.filter((a) => a.assignment_type === 'raffle').length} Cupos
                </span>
              </div>
            </div>

            {/* Tabla Principal de Asignaciones Oficiales */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1">
                Listado Oficial de Puestos Asignados ({assignments.length} Espacios Adjudicados)
              </h2>

              <table className="w-full text-left text-xs border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-900 border-b border-gray-300 text-[11px] font-bold">
                    <th className="p-2 border border-gray-300">Puesto</th>
                    <th className="p-2 border border-gray-300">Zona Oficial</th>
                    <th className="p-2 border border-gray-300">Vivienda (Bloque y Casa)</th>
                    <th className="p-2 border border-gray-300">Placa / Vehículo</th>
                    <th className="p-2 border border-gray-300">Vía de Adjudicación</th>
                    <th className="p-2 border border-gray-300">Vigencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500 italic">
                        No hay asignaciones registradas para este periodo.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="text-[11px]">
                        <td className="p-2 border border-gray-300 font-mono font-bold">
                          N° {a.parking_space?.space_number}
                          {['47', '48', '49', '50'].includes(a.parking_space?.space_number) && ' [Grande]'}
                        </td>
                        <td className="p-2 border border-gray-300 font-medium">
                          {vehicleType === 'M' || a.vehicle?.vehicle_type === 'M'
                            ? 'Sin zonificación'
                            : (a.parking_space?.zone || a.zone_assigned)}
                        </td>
                        <td className="p-2 border border-gray-300">
                          {a.dwelling?.unit_number} ({a.dwelling?.block || 'Principal'})
                        </td>
                        <td className="p-2 border border-gray-300 font-mono font-bold">
                          [{a.vehicle?.plate}] {a.vehicle?.brand || ''}
                        </td>
                        <td className="p-2 border border-gray-300 font-medium">
                          {a.assignment_type === 'special'
                            ? '⭐ Directa (Condición Especial Salud/Edad)'
                            : a.assignment_type === 'direct'
                            ? '🎟️ Directa (Balota Blanca Vigente)'
                            : '🎲 Sorteo General'}
                        </td>
                        <td className="p-2 border border-gray-300 font-mono text-gray-600">
                          {a.period}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Padrón Oficial de Balotas Blancas (si aplica) */}
            {whiteBallots.length > 0 && (
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1">
                  Padrón Oficial de Balotas Blancas Otorgadas ({whiteBallots.length} Titulares)
                </h2>
                <table className="w-full text-left text-xs border border-gray-300 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-900 border-b border-gray-300 text-[11px] font-bold">
                      <th className="p-2 border border-gray-300">Titular</th>
                      <th className="p-2 border border-gray-300">Vivienda</th>
                      <th className="p-2 border border-gray-300">Placa Congelada</th>
                      <th className="p-2 border border-gray-300">Beneficio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whiteBallots.map((b) => (
                      <tr key={b.id} className="text-[11px]">
                        <td className="p-2 border border-gray-300 font-medium">{b.resident?.full_name}</td>
                        <td className="p-2 border border-gray-300">
                          {b.dwelling?.unit_number} ({b.dwelling?.block || 'Principal'})
                        </td>
                        <td className="p-2 border border-gray-300 font-mono font-bold">[{b.frozen_plate}]</td>
                        <td className="p-2 border border-gray-300">Asignación Directa Próximo Periodo</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Firmas de Legalización de la Copropiedad */}
            <div className="pt-10 grid grid-cols-2 gap-12 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-gray-900 w-4/5 mx-auto pb-8"></div>
                <span className="font-bold block text-gray-950">ADMINISTRACIÓN</span>
                <span className="text-[10px] text-gray-500 block">Representante Legal / Copropiedad</span>
              </div>

              <div className="space-y-1">
                <div className="border-b border-gray-900 w-4/5 mx-auto pb-8"></div>
                <span className="font-bold block text-gray-950">CONSEJO DE ADMINISTRACIÓN</span>
                <span className="text-[10px] text-gray-500 block">Delegado Oficial Veedor</span>
              </div>
            </div>

            {/* Pie de página oficial reglamentario inmodificable */}
            <div className="pt-6 border-t border-gray-300 text-center space-y-1">
              <p className="text-xs font-bold text-gray-900">
                📌 “Si no está en el listado, acérquese a la administración antes del sorteo.”
              </p>
              <p className="text-[9px] text-gray-500">
                Documento oficial generado bajo el Reglamento de Propiedad Horizontal y el motor de sorteo determinista con memoria histórica de 9 zonas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
