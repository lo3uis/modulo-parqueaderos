'use client';

import React, { useState } from 'react';
import { parkingService } from '../services/parkingService';

interface PostulacionFormProps {
  onSuccess?: () => void;
}

export function PostulacionForm({ onSuccess }: PostulacionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acuse, setAcuse] = useState<{
    receiptNumber: string;
    internalCode: string;
    submittedAt: string;
    fullName: string;
    plate: string;
    unitNumber: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    unitNumber: '',
    zone: 'Zona A',
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
  });

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

        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
          ⚠️ <strong>Importante:</strong> Tu solicitud pasará a la fase de Doble Validación (Administración + Consejo). Conserve su número de acuse.
        </div>

        <button
          onClick={() => {
            setAcuse(null);
            setFormData({
              unitNumber: '',
              zone: 'Zona A',
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium mb-1">N° Unidad / Apartamento *</label>
            <input
              type="text"
              name="unitNumber"
              value={formData.unitNumber}
              onChange={handleChange}
              placeholder="Ej: Apto 302"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Bloque / Torre</label>
            <input
              type="text"
              name="block"
              value={formData.block}
              onChange={handleChange}
              placeholder="Ej: Torre 2"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Zona Asignada</label>
            <select
              name="zone"
              value={formData.zone}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="Zona A">Zona A</option>
              <option value="Zona B">Zona B</option>
              <option value="Zona C">Zona C</option>
              <option value="Zona D">Zona D</option>
            </select>
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
