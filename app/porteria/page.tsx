'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { parkingService } from '@/features/parqueaderos/services/parkingService';
import type { ParkingSpace } from '@/features/parqueaderos/types/parking';

export default function PorteriaPage() {
  const [searchPlate, setSearchPlate] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Estado para el modal de reportar incidencia
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    parkingSpaceId: '',
    observedPlate: '',
    incidentType: 'unauthorized_vehicle',
    hasWarning: true,
    notes: '',
  });
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        setLoadingHistory(true);
        const [sp, inc] = await Promise.all([
          parkingService.getParkingSpaces(),
          parkingService.getRecentIncidents(),
        ]);
        setSpaces(sp);
        setIncidents(inc);
      } catch (err) {
        console.error('Error cargando datos de portería:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
    init();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPlate.trim()) return;

    try {
      setSearching(true);
      const res = await parkingService.verifyPlate(searchPlate);
      setResult(res);
      // Pre-llenar datos para reporte si no está autorizado
      if (!res.authorized) {
        setIncidentForm((prev) => ({
          ...prev,
          observedPlate: res.plate,
        }));
      }
    } catch (err: any) {
      alert('Error al consultar placa: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.parkingSpaceId || !incidentForm.observedPlate) {
      alert('Por favor selecciona el puesto físico y la placa observada.');
      return;
    }

    try {
      setReporting(true);
      await parkingService.reportIncident({
        ...incidentForm,
        expectedVehicleId: result?.vehicle?.id,
      });
      alert('✅ Incidencia registrada y amonestación archivada con éxito.');
      setShowIncidentModal(false);
      setIncidentForm({
        parkingSpaceId: '',
        observedPlate: '',
        incidentType: 'unauthorized_vehicle',
        hasWarning: true,
        notes: '',
      });
      // Recargar lista de incidencias
      const inc = await parkingService.getRecentIncidents();
      setIncidents(inc);
    } catch (err: any) {
      alert('Error al registrar incidencia: ' + err.message);
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Encabezado */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              👮‍♂️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">Módulo de Portería y Vigilancia</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Consulta instantánea de placas, verificación de asignación trimestral y control de invasiones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/parqueaderos"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              🚗 Gestión Parqueaderos
            </Link>
            <Link
              href="/chat"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              💬 Chat
            </Link>
          </div>
        </div>

        {/* Buscador de Placas */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                placeholder="DIGITA LA PLACA (Ej: ASI3215 o BLU458)..."
                className="w-full pl-4 pr-10 py-3.5 text-lg font-mono font-bold tracking-widest uppercase rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-transparent focus:border-blue-500 outline-none transition"
                autoFocus
              />
              {searchPlate && (
                <button
                  type="button"
                  onClick={() => setSearchPlate('')}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 text-sm font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={searching || !searchPlate.trim()}
              className="px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {searching ? '🔍 Verificando...' : '🔍 Verificar Placa'}
            </button>
          </form>

          {/* Accesos rápidos de placas recientes para pruebas */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Placas registradas de prueba:</span>
            <button
              type="button"
              onClick={() => {
                setSearchPlate('ASI3215');
              }}
              className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 font-mono font-semibold"
            >
              ASI3215
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchPlate('BLU458');
              }}
              className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 font-mono font-semibold"
            >
              BLU458
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchPlate('XYZ999');
              }}
              className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-mono font-semibold"
            >
              XYZ999 (No autorizada)
            </button>
          </div>
        </div>

        {/* Tarjeta de Resultado en Pantalla Gigante */}
        {result && (
          <div
            className={`p-6 md:p-8 rounded-2xl border-2 shadow-lg animate-fadeIn space-y-5 ${
              result.authorized
                ? 'bg-emerald-50/70 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-700'
                : 'bg-rose-50/70 border-rose-500 dark:bg-rose-950/40 dark:border-rose-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{result.authorized ? '🟢' : '🔴'}</span>
                <div>
                  <span className="text-xs font-mono font-bold tracking-wider uppercase text-gray-500">
                    Placa Consultada
                  </span>
                  <div className="text-3xl font-extrabold font-mono tracking-wider">
                    {result.plate}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    result.authorized
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white animate-pulse'
                  }`}
                >
                  {result.authorized ? 'AUTORIZADO PARA INGRESAR' : 'NO AUTORIZADO / SIN PUESTO'}
                </span>
                <p className="text-xs text-gray-500 mt-1">{result.message}</p>
              </div>
            </div>

            {/* Detalles si está autorizado */}
            {result.authorized && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Puesto Asignado:</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    N° {result.space?.space_number}
                  </div>
                  <span className="text-xs text-gray-500 font-medium">({result.space?.zone})</span>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Vivienda:</span>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                    {result.vehicle?.dwelling?.unit_number}
                  </div>
                  <span className="text-xs text-gray-500">{result.vehicle?.dwelling?.block || 'Bloque Principal'}</span>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Titular:</span>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                    {result.vehicle?.resident?.full_name}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">Cédula: {result.vehicle?.resident?.document_id}</span>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Vehículo:</span>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                    {result.vehicle?.brand} {result.vehicle?.model}
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    {result.vehicle?.internal_code}
                  </span>
                </div>
              </div>
            )}

            {/* Botón de Reportar Incidencia si hay anomalía */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIncidentForm((prev) => ({
                    ...prev,
                    observedPlate: result.plate,
                    parkingSpaceId: result.space?.id || '',
                  }));
                  setShowIncidentModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold hover:bg-gray-800 transition flex items-center gap-2"
              >
                ⚠️ Registrar Incidencia / Amonestación con esta Placa
              </button>
            </div>
          </div>
        )}

        {/* Bitácora de Incidencias Registradas */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Bitácora de Incidencias y Amonestaciones de Portería
              </h2>
              <p className="text-xs text-gray-500">
                Historial de vehículos no autorizados o invasiones de espacios detectadas por vigilancia.
              </p>
            </div>
            <button
              onClick={() => {
                setIncidentForm({
                  parkingSpaceId: '',
                  observedPlate: '',
                  incidentType: 'unauthorized_vehicle',
                  hasWarning: true,
                  notes: '',
                });
                setShowIncidentModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
            >
              + Nueva Incidencia
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-xs text-gray-500">Cargando incidencias...</div>
          ) : incidents.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No se registran novedades ni amonestaciones activas en portería.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/30 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Fecha / Hora</th>
                    <th className="p-3.5">Placa Infractora</th>
                    <th className="p-3.5">Puesto Afectado</th>
                    <th className="p-3.5">Tipo de Infracción</th>
                    <th className="p-3.5">Amonestación</th>
                    <th className="p-3.5">Detalle / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                      <td className="p-3.5 text-gray-500">
                        {new Date(inc.occurred_at).toLocaleString('es-CO')}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                        [{inc.observed_plate}]
                      </td>
                      <td className="p-3.5 font-bold font-mono">
                        N° {inc.parking_space?.space_number} ({inc.parking_space?.zone})
                      </td>
                      <td className="p-3.5">
                        {inc.incident_type === 'unauthorized_vehicle' && 'Vehículo no autorizado'}
                        {inc.incident_type === 'wrong_space' && 'Invasión de puesto ajeno'}
                        {inc.incident_type === 'other' && 'Otra infracción'}
                      </td>
                      <td className="p-3.5">
                        {inc.has_warning ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">
                            Amonestación Oficial
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px]">
                            Advertencia verbal
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {inc.notes || 'Sin observaciones'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Registro de Incidencia */}
        {showIncidentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleReportIncident}
              className="bg-white dark:bg-gray-900 max-w-md w-full rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4 shadow-2xl animate-scaleUp text-xs"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Registrar Incidencia / Amonestación en Portería
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block font-semibold mb-1">Placa Observada / Infractora *</label>
                <input
                  type="text"
                  value={incidentForm.observedPlate}
                  onChange={(e) => setIncidentForm({ ...incidentForm, observedPlate: e.target.value })}
                  placeholder="Ej: ABC123"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent font-mono uppercase font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Puesto Físico Involucrado / Invadido *</label>
                <select
                  value={incidentForm.parkingSpaceId}
                  onChange={(e) => setIncidentForm({ ...incidentForm, parkingSpaceId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-rose-500"
                  required
                >
                  <option value="">-- Selecciona el puesto --</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      Puesto N° {s.space_number} ({s.zone} - {s.vehicle_type === 'A' ? 'Carro' : 'Moto'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tipo de Infracción</label>
                <select
                  value={incidentForm.incidentType}
                  onChange={(e) => setIncidentForm({ ...incidentForm, incidentType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="unauthorized_vehicle">Vehículo no autorizado (sin cupo en el conjunto)</option>
                  <option value="wrong_space">Invasión de puesto ajeno</option>
                  <option value="other">Mal parqueado / Obstrucción</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="hasWarning"
                  checked={incidentForm.hasWarning}
                  onChange={(e) => setIncidentForm({ ...incidentForm, hasWarning: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="hasWarning" className="font-semibold text-rose-700 dark:text-rose-300 cursor-pointer">
                  Generar Amonestación Oficial (Afecta historial de sorteos futuros)
                </label>
              </div>

              <div>
                <label className="block font-semibold mb-1">Observaciones del Vigilante</label>
                <textarea
                  value={incidentForm.notes}
                  onChange={(e) => setIncidentForm({ ...incidentForm, notes: e.target.value })}
                  placeholder="Ej: Carro parqueado en puesto ajeno sin autorización del propietario..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition disabled:opacity-50"
                >
                  {reporting ? 'Guardando...' : 'Radicar Incidencia'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
