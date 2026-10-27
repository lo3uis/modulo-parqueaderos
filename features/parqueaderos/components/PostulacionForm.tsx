'use client';

import React, { useState, useEffect } from 'react';
import { parkingService } from '../services/parkingService';

interface PostulacionFormProps {
  onSuccess?: () => void;
}

export function PostulacionForm({ onSuccess }: PostulacionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSpaces, setAvailableSpaces] = useState<any[]>([]);
  const [acuse, setAcuse] = useState<{
    receiptNumber: string;
    internalCode: string;
    submittedAt: string;
    fullName: string;
    plate: string;
    unitNumber: string;
    block: string;
    assignedSpace?: { spaceNumber: string; zone: string } | null;
    isSpecial?: boolean;
  } | null>(null);

  const [formData, setFormData] = useState({
    unitNumber: '',
    zone: '',
    block: '',
    houseNumber: '',
    fullName: '',
    documentId: '',
    email: '',
    phone: '',
    residencyType: 'propietario' as 'propietario' | 'arrendatario',
    vehicleType: 'A' as 'A' | 'M',
    plate: '',
    brand: '',
    model: '',
    vehicleCategory: 'antiguo' as 'nuevo' | 'antiguo',
    isOversized: false,
    isSpecialPriority: false,
    specialPriorityType: 'salud' as 'salud' | 'edad',
    requestedSpaceNumber: '',
    specialPriorityNote: '',
    propertyCardFile: '',
    propertyCardFileName: '',
    soatFile: '',
    soatFileName: '',
    soatExpiryDate: '',
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: 'tarjeta' | 'soat') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo supera los 5MB permitidos. Por favor sube un documento más liviano.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (docType === 'tarjeta') {
        setFormData((prev) => ({
          ...prev,
          propertyCardFile: base64,
          propertyCardFileName: file.name,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          soatFile: base64,
          soatFileName: file.name,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    async function loadSpaces() {
      try {
        const spaces = await parkingService.getParkingSpaces();
        setAvailableSpaces(spaces.filter((s) => s.vehicle_type === formData.vehicleType && s.status === 'available'));
      } catch (e) {
        console.error('Error cargando espacios disponibles:', e);
      }
    }
    loadSpaces();
  }, [formData.vehicleType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.unitNumber || !formData.fullName || !formData.documentId || !formData.plate) {
      setError('Por favor completa todos los campos obligatorios (*)');
      return;
    }

    try {
      setLoading(true);
      const res = await parkingService.submitParkingRequest(formData);
      setAcuse({
        receiptNumber: res.receiptNumber,
        internalCode: res.internalCode,
        submittedAt: res.submittedAt,
        fullName: formData.fullName,
        plate: formData.plate.toUpperCase(),
        unitNumber: formData.unitNumber,
        block: formData.block || 'Sin bloque',
        assignedSpace: res.assignedSpace,
        isSpecial: !!formData.isSpecialPriority,
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al enviar la postulación');
    } finally {
      setLoading(false);
    }
  };

  // Si ya se generó el acuse, mostramos el comprobante oficial
  if (acuse) {
    return (
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border-2 border-emerald-500 shadow-lg space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <span className="text-3xl">✅</span>
          <div>
            <h2 className="text-xl font-extrabold">¡Postulación Radicada con Éxito!</h2>
            <p className="text-xs text-gray-500">Se ha emitido tu acuse de recibo oficial.</p>
          </div>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-5 rounded-xl border border-emerald-200 dark:border-emerald-900 space-y-3 font-mono text-xs">
          <div className="flex justify-between border-b border-emerald-200/60 pb-2">
            <span className="text-gray-600 dark:text-gray-400">N° Consecutivo Acuse:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">{acuse.receiptNumber}</span>
          </div>
          <div className="flex justify-between border-b border-emerald-200/60 pb-2">
            <span className="text-gray-600 dark:text-gray-400">Código de Vehículo Asignado:</span>
            <span className="font-bold">{acuse.internalCode}</span>
          </div>
          <div className="flex justify-between border-b border-emerald-200/60 pb-2">
            <span className="text-gray-600 dark:text-gray-400">Titular de la Solicitud:</span>
            <span className="font-semibold">{acuse.fullName}</span>
          </div>
          <div className="flex justify-between border-b border-emerald-200/60 pb-2">
            <span className="text-gray-600 dark:text-gray-400">Bloque / Torre:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{acuse.block}</span>
          </div>
          <div className="flex justify-between border-b border-emerald-200/60 pb-2">
            <span className="text-gray-600 dark:text-gray-400">Vivienda / Apartamento:</span>
            <span className="font-semibold">{acuse.unitNumber}</span>
          </div>
          <div className="flex justify-between border-b border-emerald-200/60 pb-2">
            <span className="text-gray-600 dark:text-gray-400">Placa Registrada:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{acuse.plate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Fecha y Hora de Radicación:</span>
            <span>{new Date(acuse.submittedAt).toLocaleString('es-CO')}</span>
          </div>
        </div>

        {acuse.isSpecial && acuse.assignedSpace ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border-2 border-amber-400 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
              <span>⭐ CASO MUY ESPECIAL — ADJUDICACIÓN DIRECTA INMEDIATA</span>
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Puesto Físico Adjudicado:{' '}
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                N° {acuse.assignedSpace.spaceNumber} ({acuse.assignedSpace.zone})
              </span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              ✅ <strong>Cupo Descontado:</strong> Se quitó inmediatamente 1 cupo de los {formData.vehicleType === 'A' ? '96' : '25'} disponibles en la capacidad del sorteo general.
              <br />
              ✅ <strong>Exento de Proceso:</strong> Este caso queda formalmente adjudicado y <strong>no entra en la siguiente parte del proceso</strong> (no pasa por doble validación ni entra al bombo del sorteo general).
            </p>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ <strong>Importante:</strong> Tu solicitud pasará a la fase de Doble Validación (Administración + Consejo). Conserve su número de acuse.
          </div>
        )}

        <button
          onClick={() => {
            setAcuse(null);
            setFormData({
              unitNumber: '',
              zone: '',
              block: '',
              houseNumber: '',
              fullName: '',
              documentId: '',
              email: '',
              phone: '',
              residencyType: 'propietario',
              vehicleType: 'A',
              plate: '',
              brand: '',
              model: '',
              vehicleCategory: 'antiguo',
              isOversized: false,
              isSpecialPriority: false,
              specialPriorityType: 'salud',
              requestedSpaceNumber: '',
              specialPriorityNote: '',
              propertyCardFile: '',
              propertyCardFileName: '',
              soatFile: '',
              soatFileName: '',
              soatExpiryDate: '',
            });
          }}
          className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold transition"
        >
          Radicar otra postulación
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Formulario de Postulación al Sorteo Trimestral
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Diligencia tus datos. Recuerda que la vigencia del sorteo es trimestral y las asignaciones rotan por zona.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Sección 1: Vivienda */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          1. Datos de la Vivienda
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Bloque / Torre *</label>
            <input
              type="text"
              name="block"
              value={formData.block}
              onChange={handleChange}
              placeholder="Ej: Torre 2 o Bloque 09"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">N° Casa / Apartamento *</label>
            <input
              type="text"
              name="unitNumber"
              value={formData.unitNumber}
              onChange={handleChange}
              placeholder="Ej: Casa 01 o Apto 302"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
        </div>
      </div>

      {/* Sección 2: Residente */}
      <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          2. Datos del Residente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Nombre Completo *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Ej: Carlos Pérez"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Cédula / Documento *</label>
            <input
              type="text"
              name="documentId"
              value={formData.documentId}
              onChange={handleChange}
              placeholder="Ej: 1020304050"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Correo Electrónico</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Condición *</label>
            <select
              name="residencyType"
              value={formData.residencyType}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="propietario">Propietario</option>
              <option value="arrendatario">Arrendatario</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sección 3: Vehículo */}
      <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          3. Datos del Vehículo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Tipo de Vehículo *</label>
            <select
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="A">Carro (VEH-###)</option>
              <option value="M">Moto (MOT-###)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Placa *</label>
            <input
              type="text"
              name="plate"
              value={formData.plate}
              onChange={handleChange}
              placeholder="Ej: ABC123"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none font-mono uppercase"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Marca y Línea</label>
            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              placeholder="Ej: Mazda 3"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Condición del Vehículo *</label>
            <select
              name="vehicleCategory"
              value={formData.vehicleCategory}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="antiguo">Antiguo (Ya verificado en el conjunto)</option>
              <option value="nuevo">Nuevo (Requiere SOAT + Tarjeta)</option>
            </select>
          </div>
        </div>

        {formData.vehicleType === 'A' && (
          <div className="flex items-center gap-2 pt-1 text-xs">
            <input
              type="checkbox"
              id="isOversized"
              name="isOversized"
              checked={formData.isOversized}
              onChange={handleChange}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isOversized" className="text-gray-600 dark:text-gray-400">
              Vehículo grande / sobredimensionado (Camioneta SUV, Pick-up que requiere espacio especial)
            </label>
          </div>
        )}

        {/* Carga y Validación de Documentos (SOAT y Tarjeta de Propiedad) */}
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-800 dark:text-gray-200 text-xs flex items-center gap-1.5">
              <span>📄 Documentos Obligatorios del Vehículo (Cotejo de Placa y Titular)</span>
            </span>
            <span className="text-[10px] text-gray-500">PDF, JPG o PNG (Máx 5MB)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Tarjeta de Propiedad */}
            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-300">
                1. Tarjeta de Propiedad / Licencia de Tránsito *
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileUpload(e, 'tarjeta')}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {formData.propertyCardFileName ? (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span>✓ Archivo cargado:</span>
                  <span className="font-mono truncate">{formData.propertyCardFileName}</span>
                </div>
              ) : (
                <p className="text-[10px] text-gray-400">Adjunta el archivo escaneado o foto legible</p>
              )}
            </div>

            {/* SOAT */}
            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-300">
                2. SOAT (Seguro Obligatorio Vigente) *
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileUpload(e, 'soat')}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              {formData.soatFileName && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span>✓ Archivo cargado:</span>
                  <span className="font-mono truncate">{formData.soatFileName}</span>
                </div>
              )}

              <div className="pt-1">
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Fecha de Vencimiento del SOAT:
                </label>
                <input
                  type="date"
                  name="soatExpiryDate"
                  value={formData.soatExpiryDate}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {formData.soatExpiryDate && (
                  <div className="mt-1">
                    {new Date(formData.soatExpiryDate) < new Date() ? (
                      <span className="text-[10px] text-rose-600 font-bold block animate-pulse">
                        ⚠️ ATENCIÓN: El SOAT figura VENCIDO. No podrá ser habilitado.
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold block">
                        ✓ SOAT Vigente al momento de la postulación
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 4: Condición Especial (Caso Muy Especial) */}
      <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="isSpecialPriority"
              name="isSpecialPriority"
              checked={formData.isSpecialPriority}
              onChange={handleChange}
              className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 mt-0.5 cursor-pointer"
            />
            <div>
              <label htmlFor="isSpecialPriority" className="text-sm font-bold text-amber-950 dark:text-amber-200 cursor-pointer flex items-center gap-1.5">
                <span>⭐ Condición Especial (Caso Muy Especial — Salud / Edad)</span>
              </label>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Al marcar esta casilla, se reserva y se descuenta inmediatamente un cupo de los {formData.vehicleType === 'A' ? '96' : '25'} disponibles. El postulante <strong>no entra en la siguiente parte del proceso</strong> (queda exento de doble validación y excluido del bombo del sorteo general).
              </p>
            </div>
          </div>

          {formData.isSpecialPriority && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs border-t border-amber-200/80 dark:border-amber-900/60">
              <div>
                <label className="block font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  Motivo de la Condición Especial *
                </label>
                <select
                  name="specialPriorityType"
                  value={formData.specialPriorityType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="salud">🩺 Salud / Movilidad Reducida / Discapacidad</option>
                  <option value="edad">🧓 Adulto Mayor / Tercera Edad</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  Seleccionar Puesto a Descontar (Opcional)
                </label>
                {availableSpaces.length > 0 ? (
                  <select
                    name="requestedSpaceNumber"
                    value={formData.requestedSpaceNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  >
                    <option value="">-- Asignar primer puesto accesible disponible --</option>
                    {availableSpaces.map((s) => (
                      <option key={s.id} value={s.space_number}>
                        Puesto N° {s.space_number} ({s.zone}) {s.allows_oversized ? '[Grande]' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="requestedSpaceNumber"
                    value={formData.requestedSpaceNumber}
                    onChange={handleChange}
                    placeholder="Ej: 05"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-800 dark:text-gray-200">
                  Soporte / Detalle del Caso Muy Especial *
                </label>
                <input
                  type="text"
                  name="specialPriorityNote"
                  value={formData.specialPriorityNote}
                  onChange={handleChange}
                  placeholder="Ej: Adulto mayor de 85 años / Movilidad reducida severa"
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 outline-none"
                  required={formData.isSpecialPriority}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Radicando Postulación...' : 'Radicar Postulación y Generar Acuse'}
        </button>
      </div>
    </form>
  );
}
