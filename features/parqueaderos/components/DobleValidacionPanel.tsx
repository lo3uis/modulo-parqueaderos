'use client';

import React, { useEffect, useState } from 'react';
import { parkingService } from '../services/parkingService';
import type { DisqualificationReason } from '../types/parking';

export function DobleValidacionPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [reasons, setReasons] = useState<DisqualificationReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<'admin' | 'consejo'>('admin');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Checklist de control
  const [checklist, setChecklist] = useState({
    paymentsCurrent: true,
    docsApproved: true,
    unitMatch: true,
    noSanctions: true,
  });

  const [observations, setObservations] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeWarnings, setActiveWarnings] = useState<any[]>([]);

  const handleOpenModal = async (req: any) => {
    setSelectedRequest(req);
    setObservations('');
    // Consultar amonestaciones oficiales del vehículo
    const plate = req.vehicle?.plate || '';
    const warnings = await parkingService.getActiveWarningsByPlate(plate);
    setActiveWarnings(warnings);

    if (warnings.length > 0) {
      // Si tiene amonestaciones, desmarcamos el punto 4 automáticamente
      setChecklist({
        paymentsCurrent: true,
        docsApproved: true,
        unitMatch: true,
        noSanctions: false,
      });
      // Pre-seleccionar motivo de sanción previa
      const priorReason = reasons.find((r) => r.reason_code === 'PRIOR_VIOLATION' || r.reason_code === 'E07_DUPLICADO');
      if (priorReason) setSelectedReasonId(priorReason.id);
      setObservations(`Vehículo registra ${warnings.length} amonestación(es) oficial(es) en portería.`);
    } else {
      setChecklist({
        paymentsCurrent: true,
        docsApproved: true,
        unitMatch: true,
        noSanctions: true,
      });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, rs] = await Promise.all([
        parkingService.getPendingRequests(),
        parkingService.getDisqualificationReasons(),
      ]);

      // Consultar amonestaciones de cada vehículo para mostrar alerta en tarjeta
      const reqsWithWarnings = await Promise.all(
        reqs.map(async (r: any) => {
          const plate = r.vehicle?.plate || '';
          const warnings = await parkingService.getActiveWarningsByPlate(plate);
          return { ...r, warningsCount: warnings.length, warnings };
        })
      );

      setRequests(reqsWithWarnings);
      setReasons(rs);
      if (rs.length > 0) setSelectedReasonId(rs[0].id);
    } catch (err) {
      console.error('Error cargando validaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    try {
      setProcessing(true);
      await parkingService.submitReview({
        requestId: selectedRequest.id,
        reviewerRole: activeRole,
        decision,
        checklist,
        observations,
        disqualificationReasonIds: decision === 'rejected' && selectedReasonId ? [selectedReasonId] : [],
      });
      setSelectedRequest(null);
      setObservations('');
      await loadData();
    } catch (err: any) {
      alert('Error al guardar revisión: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-gray-500">Cargando postulaciones para validación...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Selector de Rol Validador */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold">Panel de Doble Validación Obligatoria</h2>
          <p className="text-xs text-gray-500">
            Regla PRP v2: Una postulación solo pasa a la lista congelada si es aprobada independientemente por la Administración Y por el Consejo.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveRole('admin')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeRole === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            🏢 Rol: Administración
          </button>
          <button
            onClick={() => setActiveRole('consejo')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeRole === 'consejo'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            ⚖️ Rol: Consejo Autorizado
          </button>
        </div>
      </div>

      {/* Lista de Postulaciones */}
      {requests.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-xs text-gray-500 space-y-2">
          <span className="text-3xl block">📬</span>
          <p className="font-semibold text-gray-700 dark:text-gray-300">No hay postulaciones registradas aún</p>
          <p>Usa la pestaña &quot;📝 Radicar Postulación&quot; para enviar la primera solicitud y probar la validación.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {requests.map((req) => {
              const adminReview = req.reviews?.find((r: any) => r.reviewer_role === 'admin');
              const consejoReview = req.reviews?.find((r: any) => r.reviewer_role === 'consejo');
              const isEligible = req.status === 'eligible';
              const isDisqualified = req.status === 'disqualified';

              return (
                <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                        {req.receipt_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {req.vehicle?.vehicle_type === 'A' ? '🚗 Carro' : '🏍️ Moto'} ({req.vehicle?.internal_code})
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        [{req.vehicle?.plate}]
                      </span>
                      {req.warningsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-600 text-white animate-pulse flex items-center gap-1 shadow-sm">
                          🚨 {req.warningsCount} AMONESTACIÓN(ES) EN PORTERÍA
                        </span>
                      )}
                    </div>

                    <div className="text-gray-600 dark:text-gray-400">
                      <strong>{req.resident?.full_name}</strong> • {req.dwelling?.unit_number} ({req.dwelling?.zone}) • {req.residency_type_snapshot}
                    </div>

                    {/* Estado de Aprobaciones */}
                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          adminReview?.decision === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : adminReview?.decision === 'rejected'
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}
                      >
                        Admin: {adminReview ? (adminReview.decision === 'approved' ? 'Aprobado ✓' : 'Rechazado ✗') : 'Pendiente'}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          consejoReview?.decision === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : consejoReview?.decision === 'rejected'
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}
                      >
                        Consejo: {consejoReview ? (consejoReview.decision === 'approved' ? 'Aprobado ✓' : 'Rechazado ✗') : 'Pendiente'}
                      </span>

                      {isEligible && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-bold text-[10px]">
                          ⭐ HABILITADO PARA SORTEO
                        </span>
                      )}

                      {isDisqualified && (
                        <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-[10px]">
                          🚫 NO HABILITADO
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => handleOpenModal(req)}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-emerald-600 hover:text-white font-semibold text-xs transition"
                    >
                      {activeRole === 'admin' ? 'Validar como Admin' : 'Validar como Consejo'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal / Panel de Validación del Rol */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 max-w-lg w-full rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Validación: {activeRole === 'admin' ? 'Administración' : 'Consejo de Administración'}
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedRequest.receipt_number} — {selectedRequest.resident?.full_name}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedRequest.dwelling?.unit_number} • Placa: {selectedRequest.vehicle?.plate}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Alerta de Amonestaciones de Portería */}
            {activeWarnings.length > 0 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 rounded-xl space-y-1.5 text-xs text-rose-800 dark:text-rose-300 animate-pulse">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>🚨</span>
                  <span>ATENCIÓN: {activeWarnings.length} Amonestación(es) Oficial(es) en Portería</span>
                </div>
                <div className="text-[11px] space-y-1 pl-5">
                  {activeWarnings.map((w) => (
                    <div key={w.id}>
                      • Infracción: <strong>{w.incident_type}</strong> — &quot;{w.notes || 'Sin detalle'}&quot; ({new Date(w.occurred_at).toLocaleDateString('es-CO')})
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 pl-5">
                  Recomendación: Descalificar por violación previa de reglamento de parqueaderos.
                </p>
              </div>
            )}

            {/* Checklist de verificación */}
            <div className="space-y-3 text-xs">
              <label className="font-semibold block text-gray-700 dark:text-gray-300">
                Checklist Obligatorio de Habilitación:
              </label>

              <div className="space-y-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist.paymentsCurrent}
                    onChange={(e) => setChecklist({ ...checklist, paymentsCurrent: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>1. Pagos de administración al día a la fecha de corte</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist.docsApproved}
                    onChange={(e) => setChecklist({ ...checklist, docsApproved: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>2. SOAT y Tarjeta de propiedad vigentes (o vehículo antiguo verificado)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist.unitMatch}
                    onChange={(e) => setChecklist({ ...checklist, unitMatch: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>3. Coincidencia de unidad y titularidad de vivienda</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist.noSanctions}
                    onChange={(e) => setChecklist({ ...checklist, noSanctions: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>4. Sin amonestaciones o sanciones vigentes en portería</span>
                </label>
              </div>
            </div>

            {/* Si no cumple todo, seleccionar motivo de descalificación */}
            {(!checklist.paymentsCurrent || !checklist.docsApproved || !checklist.unitMatch || !checklist.noSanctions) && (
              <div className="space-y-2 text-xs">
                <label className="font-semibold block text-rose-600 dark:text-rose-400">
                  Motivo de Descalificación del Catálogo Oficial:
                </label>
                <select
                  value={selectedReasonId}
                  onChange={(e) => setSelectedReasonId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 text-xs"
                >
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reason_code} — {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Observaciones */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold block text-gray-700 dark:text-gray-300">
                Observaciones / Justificación de la revisión:
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Ej: Verificado estado contable a fecha de corte. Todo en orden."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => handleReview('rejected')}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition"
              >
                {processing ? 'Guardando...' : 'Descalificar (Rechazar)'}
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => handleReview('approved')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm"
              >
                {processing ? 'Guardando...' : 'Aprobar Validación ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
