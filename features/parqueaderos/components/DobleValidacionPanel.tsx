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

  // Estado para asignación prioritaria directa e inmediata (Salud / Adulto Mayor)
  const [specialAssignReq, setSpecialAssignReq] = useState<any | null>(null);
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
  const [chosenSpaceNumber, setChosenSpaceNumber] = useState('');
  const [specialReason, setSpecialReason] = useState('Salud / Movilidad Reducida / Discapacidad');
  const [specialNote, setSpecialNote] = useState('');
  const [assigningSpecial, setAssigningSpecial] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Estado para visor y cotejo de documentos (SOAT y Tarjeta de Propiedad)
  const [previewDoc, setPreviewDoc] = useState<{
    type: 'soat' | 'tarjeta_propiedad';
    url: string;
    plate: string;
    brand: string;
    residentName: string;
    dwelling: string;
    expiryDate?: string;
  } | null>(null);

  const handleOpenSpecialAssignModal = async (req: any) => {
    setSpecialAssignReq(req);
    setActionSuccessMsg(null);
    setSpecialNote('');

    // Pre-cargar puesto solicitado si viene en la nota
    const note = req.payment_validation_note || '';
    let defaultPuesto = '';
    const match = note.match(/Puesto:\s*(\w+)/i);
    if (match && match[1] && match[1] !== 'Por') {
      defaultPuesto = match[1];
    }
    setChosenSpaceNumber(defaultPuesto);

    if (note.includes('Adulto Mayor')) {
      setSpecialReason('Adulto Mayor / Tercera Edad');
    } else {
      setSpecialReason('Salud / Movilidad Reducida / Discapacidad');
    }

    // Cargar espacios disponibles para el tipo de vehículo
    const vType = req.vehicle?.vehicle_type || 'A';
    const spaces = await parkingService.getParkingSpaces();
    const avail = spaces.filter((s) => s.vehicle_type === vType && s.status === 'available');
    setAvailableSpaces(avail);
  };

  const handleConfirmSpecialAssign = async () => {
    if (!specialAssignReq || !chosenSpaceNumber) {
      alert('Por favor selecciona o escribe el número de puesto a adjudicar.');
      return;
    }
    try {
      setAssigningSpecial(true);
      const res = await parkingService.assignSpecialPrioritySpace({
        requestId: specialAssignReq.id,
        spaceNumber: chosenSpaceNumber,
        reason: specialReason,
        note: specialNote,
      });
      setActionSuccessMsg(res.message);
      setSpecialAssignReq(null);
      await loadData();
    } catch (err: any) {
      alert('Error en asignación directa: ' + err.message);
    } finally {
      setAssigningSpecial(false);
    }
  };

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

      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline px-2 py-1"
          >
            Entendido ✕
          </button>
        </div>
      )}

      {/* Aviso de Casos Muy Especiales Exentos */}
      {requests.filter((r) => r.status === 'assigned_direct').length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⭐</span>
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">
                {requests.filter((r) => r.status === 'assigned_direct').length} Caso(s) Muy Especial(es) con Cupo Asignado
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Estos vehículos fueron adjudicados directamente en la inscripción. Ya tienen su cupo descontado de la capacidad de 96, quedan <strong>exentos de doble validación y no entran a la rifa del sorteo</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Postulaciones Sujetas a Doble Validación */}
      {requests.filter((r) => r.status !== 'assigned_direct').length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-xs text-gray-500 space-y-2">
          <span className="text-3xl block">📬</span>
          <p className="font-semibold text-gray-700 dark:text-gray-300">No hay postulaciones pendientes de doble validación</p>
          <p>Todas las solicitudes están procesadas o fueron adjudicadas como casos especiales directamente.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {requests.filter((r) => r.status !== 'assigned_direct').map((req) => {
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
                      <strong>{req.resident?.full_name}</strong> • {req.dwelling?.block ? `${req.dwelling?.block} - ` : ''}{req.dwelling?.unit_number} • {req.residency_type_snapshot}
                    </div>

                    {/* Botones de Cotejo de Documentos (SOAT y Tarjeta) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {req.vehicle?.documents?.find((d: any) => d.document_type === 'tarjeta_propiedad')?.file_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const doc = req.vehicle.documents.find((d: any) => d.document_type === 'tarjeta_propiedad');
                            setPreviewDoc({
                              type: 'tarjeta_propiedad',
                              url: doc.file_url,
                              plate: req.vehicle.plate,
                              brand: req.vehicle.brand || 'N/A',
                              residentName: req.resident?.full_name || 'N/A',
                              dwelling: `${req.dwelling?.block || ''} - ${req.dwelling?.unit_number || ''}`,
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium text-[11px] flex items-center gap-1 transition"
                        >
                          <span>📄 Tarjeta Propiedad</span>
                          <span className="font-bold text-blue-600 text-[10px]">👁️ Ver</span>
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 text-[10px]">
                          Sin Tarjeta adjunta
                        </span>
                      )}

                      {req.vehicle?.documents?.find((d: any) => d.document_type === 'soat')?.file_url ? (
                        (() => {
                          const doc = req.vehicle.documents.find((d: any) => d.document_type === 'soat');
                          const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDoc({
                                  type: 'soat',
                                  url: doc.file_url,
                                  plate: req.vehicle.plate,
                                  brand: req.vehicle.brand || 'N/A',
                                  residentName: req.resident?.full_name || 'N/A',
                                  dwelling: `${req.dwelling?.block || ''} - ${req.dwelling?.unit_number || ''}`,
                                  expiryDate: doc.expiry_date,
                                });
                              }}
                              className={`px-2.5 py-1 rounded border font-medium text-[11px] flex items-center gap-1 transition ${
                                isExpired
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100'
                              }`}
                            >
                              <span>🛡️ SOAT {doc.expiry_date ? `(Vence: ${doc.expiry_date})` : ''}</span>
                              <span className="font-bold text-[10px]">👁️ Ver</span>
                              {isExpired && <span className="font-extrabold text-[10px] text-rose-600">[VENCIDO]</span>}
                            </button>
                          );
                        })()
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 text-[10px]">
                          Sin SOAT adjunto
                        </span>
                      )}
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

                      {req.status === 'assigned_direct' && (
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm">
                          ♿ ASIGNADO DIRECTO (SALUD / EDAD)
                        </span>
                      )}

                      {isEligible && req.status !== 'assigned_direct' && (
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

                    {req.payment_validation_note?.includes('[PRIORIDAD_ESPECIAL]') && (
                      <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2">
                        <span className="text-base">♿</span>
                        <div>
                          <strong>Solicitud Prioritaria:</strong>{' '}
                          {req.payment_validation_note.replace('[PRIORIDAD_ESPECIAL]:', '')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {req.status !== 'assigned_direct' && (
                      <button
                        onClick={() => handleOpenSpecialAssignModal(req)}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
                        title="Adjudicar inmediatamente este puesto por condición de salud o adulto mayor sin esperar al sorteo"
                      >
                        <span>⚡ Asignar Directo (Salud/Edad)</span>
                      </button>
                    )}

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

                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.docsApproved}
                      onChange={(e) => setChecklist({ ...checklist, docsApproved: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      2. SOAT y Tarjeta de propiedad cotejados (corresponden a la placa [<strong>{selectedRequest.vehicle?.plate}</strong>] y al titular)
                    </span>
                  </label>

                  {/* Acceso directo a ver documentos en el modal */}
                  <div className="flex gap-2 pl-6 pt-0.5">
                    {selectedRequest.vehicle?.documents?.find((d: any) => d.document_type === 'tarjeta_propiedad')?.file_url && (
                      <button
                        type="button"
                        onClick={() => {
                          const doc = selectedRequest.vehicle.documents.find((d: any) => d.document_type === 'tarjeta_propiedad');
                          setPreviewDoc({
                            type: 'tarjeta_propiedad',
                            url: doc.file_url,
                            plate: selectedRequest.vehicle.plate,
                            brand: selectedRequest.vehicle.brand || 'N/A',
                            residentName: selectedRequest.resident?.full_name || 'N/A',
                            dwelling: `${selectedRequest.dwelling?.block || ''} - ${selectedRequest.dwelling?.unit_number || ''}`,
                          });
                        }}
                        className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                      >
                        👁️ Abrir Tarjeta de Propiedad
                      </button>
                    )}
                    {selectedRequest.vehicle?.documents?.find((d: any) => d.document_type === 'soat')?.file_url && (
                      <button
                        type="button"
                        onClick={() => {
                          const doc = selectedRequest.vehicle.documents.find((d: any) => d.document_type === 'soat');
                          setPreviewDoc({
                            type: 'soat',
                            url: doc.file_url,
                            plate: selectedRequest.vehicle.plate,
                            brand: selectedRequest.vehicle.brand || 'N/A',
                            residentName: selectedRequest.resident?.full_name || 'N/A',
                            dwelling: `${selectedRequest.dwelling?.block || ''} - ${selectedRequest.dwelling?.unit_number || ''}`,
                            expiryDate: doc.expiry_date,
                          });
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                      >
                        👁️ Abrir SOAT
                      </button>
                    )}
                  </div>
                </div>

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

      {/* Modal de Asignación Prioritaria Inmediata (Salud / Adulto Mayor) */}
      {specialAssignReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 max-w-lg w-full rounded-2xl border border-blue-200 dark:border-blue-900 p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span>♿ ASIGNACIÓN PRIORITARIA DIRECTA (ANTICIPADA)</span>
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {specialAssignReq.resident?.full_name}
                </h3>
                <p className="text-xs text-gray-500">
                  {specialAssignReq.dwelling?.block ? `${specialAssignReq.dwelling?.block} - ` : ''}
                  {specialAssignReq.dwelling?.unit_number} • Placa: <strong>[{specialAssignReq.vehicle?.plate}]</strong>
                </p>
              </div>
              <button
                onClick={() => setSpecialAssignReq(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
              ℹ️ Esta acción adjudicará el puesto <strong>de inmediato</strong> en el sistema, habilitándolo en portería y <strong>excluyendo al vehículo y al puesto del sorteo general</strong>.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                  Motivo de la Adjudicación Prioritaria:
                </label>
                <select
                  value={specialReason}
                  onChange={(e) => setSpecialReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Salud / Movilidad Reducida / Discapacidad">🩺 Salud / Movilidad Reducida / Discapacidad</option>
                  <option value="Adulto Mayor / Tercera Edad">🧓 Adulto Mayor / Tercera Edad</option>
                  <option value="Excepción Médica o Administrativa Autorizada">⚖️ Excepción Médica o Administrativa Autorizada</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                  Seleccionar Puesto Físico Disponible:
                </label>
                {availableSpaces.length > 0 ? (
                  <select
                    value={chosenSpaceNumber}
                    onChange={(e) => setChosenSpaceNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    <option value="">-- Selecciona un puesto disponible --</option>
                    {availableSpaces.map((s) => (
                      <option key={s.id} value={s.space_number}>
                        Puesto N° {s.space_number} ({s.zone}) {s.allows_oversized ? '[Puesto Grande]' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={chosenSpaceNumber}
                    onChange={(e) => setChosenSpaceNumber(e.target.value)}
                    placeholder="Número de puesto (ej: 05)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                )}
              </div>

              <div>
                <label className="font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                  Justificación / Observaciones de la excepción:
                </label>
                <textarea
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  placeholder="Ej: Residente con certificado médico de artrosis severa, requiere acceso directo sin escaleras."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
              <button
                type="button"
                onClick={() => setSpecialAssignReq(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={assigningSpecial || !chosenSpaceNumber}
                onClick={handleConfirmSpecialAssign}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>{assigningSpecial ? 'Adjudicando...' : '⚡ Confirmar Adjudicación Inmediata'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visor y Cotejo Documental (SOAT y Tarjeta de Propiedad) */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 max-w-4xl w-full rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4 shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-3 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Cotejo y Verificación Documental
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>{previewDoc.type === 'soat' ? '🛡️ SOAT (Seguro Obligatorio)' : '📄 Tarjeta de Propiedad / Licencia'}</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">[{previewDoc.plate}]</span>
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 overflow-y-auto grow p-1">
              {/* Vista del documento adjunto */}
              <div className="md:col-span-2 bg-gray-100 dark:bg-gray-950 rounded-xl p-2 flex items-center justify-center min-h-[300px] border border-gray-200 dark:border-gray-800 overflow-hidden">
                {previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.endsWith('.pdf') ? (
                  <iframe src={previewDoc.url} className="w-full h-full min-h-[420px] rounded-lg" title="PDF Documento" />
                ) : (
                  <img src={previewDoc.url} alt="Documento del vehículo" className="max-h-[420px] w-auto object-contain rounded-lg shadow-sm" />
                )}
              </div>

              {/* Panel de Cotejo con datos del vehículo */}
              <div className="space-y-3 text-xs bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[10px] border-b pb-1">
                    Datos Registrados en la Postulación
                  </h4>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Placa Registrada:</span>
                    <span className="font-mono font-bold text-base text-blue-600 dark:text-blue-400">
                      [{previewDoc.plate}]
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Marca / Línea:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{previewDoc.brand}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Titular / Residente:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{previewDoc.residentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Vivienda:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{previewDoc.dwelling}</span>
                  </div>
                  {previewDoc.expiryDate && (
                    <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500 block text-[10px]">Vencimiento del SOAT:</span>
                      <span className={`font-mono font-bold ${new Date(previewDoc.expiryDate) < new Date() ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                        {previewDoc.expiryDate} {new Date(previewDoc.expiryDate) < new Date() ? '(¡VENCIDO!)' : '(Vigente)'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900 text-[10px] text-amber-800 dark:text-amber-300">
                  ⚠️ <strong>Criterio de Control:</strong> Verifique que los datos del documento coincidan exactamente. Si el documento no coincide con el vehículo o está vencido, rechace la validación.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-semibold text-xs transition"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
