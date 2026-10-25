'use client';

import React, { useEffect, useState } from 'react';
import { parkingService } from '../services/parkingService';

export function SorteoPanel() {
  const [vehicleType, setVehicleType] = useState<'A' | 'M'>('A');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [whiteBallots, setWhiteBallots] = useState<any[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      {/* Selector de Tipo de Vehículo */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Sorteo Trimestral Oficial — Periodo 2026-Q4
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Algoritmo determinista Fisher-Yates, asignación directa por balota blanca previa y rotación de zonas.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
                    </td>
                    <td className="p-3.5 font-medium">{a.zone_assigned}</td>
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
    </div>
  );
}
