'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { parkingService } from '@/features/parqueaderos/services/parkingService';
import { PostulacionForm } from '@/features/parqueaderos/components/PostulacionForm';
import { DobleValidacionPanel } from '@/features/parqueaderos/components/DobleValidacionPanel';
import type { DisqualificationReason } from '@/features/parqueaderos/types/parking';

export default function ParqueaderosPage() {
  const [stats, setStats] = useState({
    totalCarSpaces: 0,
    maxCarCapacity: 96,
    totalMotoSpaces: 0,
    maxMotoCapacity: 25,
    activeAssignments: 0,
    totalRequests: 0,
    pendingReviews: 0,
  });

  const [reasons, setReasons] = useState<DisqualificationReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'postulacion' | 'validacion' | 'motivos' | 'reglas'>('resumen');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dashStats, reasonsList] = await Promise.all([
          parkingService.getDashboardStats(),
          parkingService.getDisqualificationReasons(),
        ]);
        setStats(dashStats);
        setReasons(reasonsList);
      } catch (err) {
        console.error('Error al cargar datos de parqueaderos:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistema Trimestral Oficial (PRP v2)
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Módulo de Parqueaderos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestión auditable, sorteo determinista con balota blanca y doble validación del Consejo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              💬 Ir al Chat
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Tarjetas de Capacidad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Capacidad Carros
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {stats.maxCarCapacity}
              </div>
              <span className="text-xs bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                Registrados: {stats.totalCarSpaces}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Cupos válidos por sorteo trimestral</p>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Capacidad Motos
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                {stats.maxMotoCapacity}
              </div>
              <span className="text-xs bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                Registrados: {stats.totalMotoSpaces}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Cupos independientes de motos</p>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Postulaciones
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {stats.totalRequests}
              </div>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                Acuse activo
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">En proceso de habilitación</p>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Doble Validación
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {stats.pendingReviews}
              </div>
              <span className="text-xs bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                Consejo + Admin
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Checklists pendientes</p>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`pb-3 transition ${
              activeTab === 'resumen'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📊 Resumen y Flujo
          </button>
          <button
            onClick={() => setActiveTab('postulacion')}
            className={`pb-3 transition ${
              activeTab === 'postulacion'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📝 Radicar Postulación
          </button>
          <button
            onClick={() => setActiveTab('validacion')}
            className={`pb-3 transition ${
              activeTab === 'validacion'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🛡️ Doble Validación
          </button>
          <button
            onClick={() => setActiveTab('motivos')}
            className={`pb-3 transition ${
              activeTab === 'motivos'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🚫 Catálogo de Exclusiones ({reasons.length})
          </button>
          <button
            onClick={() => setActiveTab('reglas')}
            className={`pb-3 transition ${
              activeTab === 'reglas'
                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            ⚖️ Reglas de Balota Blanca
          </button>
        </div>

        {/* Contenido de la pestaña: Resumen */}
        {activeTab === 'resumen' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
              <h2 className="text-lg font-bold">Flujo Trimestral de Asignación</h2>
              <ol className="relative border-l border-gray-200 dark:border-gray-800 ml-3 space-y-6">
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full -left-3 ring-4 ring-white dark:ring-gray-900 font-bold text-xs">
                    1
                  </span>
                  <h3 className="font-semibold text-sm">Postulación y Acuse de Recibo</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    El residente postula su carro o moto (códigos VEH-### o MOT-###). Los titulares de balota blanca deben postularse activamente para hacerla efectiva.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-800 rounded-full -left-3 ring-4 ring-white dark:ring-gray-900 font-bold text-xs">
                    2
                  </span>
                  <h3 className="font-semibold text-sm">Doble Validación (Administración + Consejo)</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Verificación de pagos al día, SOAT y tarjeta de propiedad. Ambos roles deben aprobar mediante checklist independiente para congelar la lista.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-800 rounded-full -left-3 ring-4 ring-white dark:ring-gray-900 font-bold text-xs">
                    3
                  </span>
                  <h3 className="font-semibold text-sm">Asignación Directa y Sorteo Criptográfico</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Las balotas blancas reciben puesto directo primero. Los puestos restantes se sortean con semilla pública verificable y rotación de zonas obligatoria.
                  </p>
                </li>
              </ol>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
              <h2 className="text-lg font-bold">Estado de la Base de Datos</h2>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Conexión Supabase</span>
                  <span className="font-semibold text-emerald-600">● Conectado</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Tablas Módulo</span>
                  <span className="font-semibold">15 tablas activas</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Seguridad RLS</span>
                  <span className="font-semibold text-blue-600">Habilitada</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Versión Algoritmo</span>
                  <span className="font-mono font-medium">v2.0-fisher-yates</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contenido de la pestaña: Postulación */}
        {activeTab === 'postulacion' && (
          <PostulacionForm
            onSuccess={async () => {
              const dashStats = await parkingService.getDashboardStats();
              setStats(dashStats);
            }}
          />
        )}

        {/* Contenido de la pestaña: Doble Validación */}
        {activeTab === 'validacion' && <DobleValidacionPanel />}

        {/* Contenido de la pestaña: Catálogo de Motivos */}
        {activeTab === 'motivos' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-sm font-bold">Motivos Oficiales de No Habilitación (Pre-cargados en Supabase)</h2>
              <p className="text-xs text-gray-500">
                Cada solicitud excluida registra uno o varios de estos códigos con su detalle exacto.
              </p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {reasons.map((r) => (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 mr-2">
                      {r.reason_code}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{r.label}</span>
                    <p className="text-gray-500 mt-1">{r.description}</p>
                  </div>
                  <span className="self-start sm:self-auto text-emerald-600 dark:text-emerald-400 font-medium">
                    Activo
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contenido de la pestaña: Postulación */}
        {activeTab === 'postulacion' && (
          <PostulacionForm
            onSuccess={async () => {
              const dashStats = await parkingService.getDashboardStats();
              setStats(dashStats);
            }}
          />
        )}

        {/* Contenido de la pestaña: Doble Validación */}
        {activeTab === 'validacion' && <DobleValidacionPanel />}

        {/* Contenido de la pestaña: Reglas Balota Blanca */}
        {activeTab === 'reglas' && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h2 className="text-lg font-bold">Reglas Confirmadas de Balota Blanca (PRP v2)</h2>
            <ul className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Otorgamiento:</strong> Recibe balota blanca quien participó, cumplió requisitos pero no alcanzó cupo en el sorteo general.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Límite por Ciclo Anual:</strong> Nadie recibe una segunda balota blanca en el ciclo mientras otros participantes nunca hayan tenido una.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Postulación Obligatoria:</strong> El titular de balota blanca debe postularse de nuevo para el siguiente trimestre para redimirla. No hay asignación automática sin solicitud.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Mismo Vehículo Congelado:</strong> Debe postularse con la misma placa y modelo registrados en la balota original.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Rotación de Zona:</strong> La asignación directa recibe un puesto físico aleatorio y rota de zona igual que los ganadores del sorteo.</span>
              </li>
            </ul>
          </div>
        )}

        {/* Contenido de la pestaña: Postulación */}
        {activeTab === 'postulacion' && (
          <PostulacionForm
            onSuccess={async () => {
              const dashStats = await parkingService.getDashboardStats();
              setStats(dashStats);
            }}
          />
        )}

        {/* Contenido de la pestaña: Doble Validación */}
        {activeTab === 'validacion' && <DobleValidacionPanel />}

        {/* Pie de página obligatorio */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            📌 “Si no está en el listado, acérquese a la administración antes del sorteo.”
          </p>
        </div>

      </div>
    </div>
  );
}
