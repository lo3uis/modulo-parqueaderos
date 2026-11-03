-- ============================================================
-- BASE DE DATOS COMPLETA: MÓDULO DE PARQUEADEROS (PROYECTO 2026)
-- Ejecuta este script en Supabase: SQL Editor -> New Query -> Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Conversaciones y Mensajes (Base Agent Template)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'Nueva Conversación',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_used VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ESQUEMA COMPLETO DE PARQUEADEROS
-- ============================================================
-- ============================================================
-- MÓDULO DE PARQUEADEROS — ESQUEMA SQL v2 (BASADO EN PRP v2)
-- ============================================================
-- Archivo:  parking-schema-v2.sql
-- Fecha:    2026-10-24
-- Estado:   PROPUESTA TÉCNICA — No ejecutada
--
-- CARACTERÍSTICAS PRINCIPALES:
--   - Compatible con Postgres / Supabase
--   - Capacidad: 96 carros / 25 motos
--   - Soporte de roles (admin, consejo, residente, porteria, auditor)
--   - Doble validación: Administración + Consejo (checklist independiente)
--   - Ciclo anual de rotación + periodos trimestrales
--   - Balota blanca con ciclo de vida completo
--   - RLS habilitado en todas las tablas
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ROLES DE USUARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'consejo', 'residente', 'porteria', 'auditor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

COMMENT ON TABLE public.user_roles IS 'Roles del sistema para control de acceso y doble validación';

-- ============================================================
-- 2. VIVIENDAS (DWELLINGS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dwellings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_number   VARCHAR(20) NOT NULL,
  zone          VARCHAR(50) NOT NULL,
  block         VARCHAR(50),
  house_number  VARCHAR(20),
  dwelling_type VARCHAR(30) NOT NULL DEFAULT 'apartamento' CHECK (dwelling_type IN ('apartamento', 'casa', 'local')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dwellings_unit_number_unique UNIQUE (unit_number)
);

CREATE INDEX IF NOT EXISTS idx_dwellings_zone ON public.dwellings(zone);
CREATE INDEX IF NOT EXISTS idx_dwellings_block ON public.dwellings(block);

-- ============================================================
-- 3. RESIDENTES (RESIDENTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.residents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dwelling_id             UUID NOT NULL REFERENCES public.dwellings(id) ON DELETE RESTRICT,
  full_name               TEXT NOT NULL,
  document_id             VARCHAR(20) NOT NULL,
  email                   TEXT,
  phone                   VARCHAR(20),
  residency_type          VARCHAR(15) NOT NULL CHECK (residency_type IN ('propietario', 'arrendatario')),
  payments_current        BOOLEAN NOT NULL DEFAULT false,
  payment_verified_until  DATE,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT residents_document_id_unique UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_residents_user_id ON public.residents(user_id);
CREATE INDEX IF NOT EXISTS idx_residents_dwelling_id ON public.residents(dwelling_id);

-- ============================================================
-- 4. VEHÍCULOS (VEHICLES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dwelling_id       UUID NOT NULL REFERENCES public.dwellings(id) ON DELETE RESTRICT,
  resident_id       UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  internal_code     VARCHAR(10) NOT NULL,
  plate             VARCHAR(10) NOT NULL,
  brand             VARCHAR(50),
  model             VARCHAR(50), -- Año / Modelo normalizado
  color             VARCHAR(30),
  vehicle_type      VARCHAR(1) NOT NULL CHECK (vehicle_type IN ('A', 'M')), -- A=Carro, M=Moto
  vehicle_category  VARCHAR(10) NOT NULL DEFAULT 'antiguo' CHECK (vehicle_category IN ('nuevo', 'antiguo')),
  is_oversized      BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vehicles_internal_code_unique UNIQUE (internal_code),
  CONSTRAINT vehicles_internal_code_format CHECK (internal_code ~ '^(VEH|MOT)-[0-9]{3}$'),
  CONSTRAINT vehicles_plate_unique UNIQUE (plate),
  CONSTRAINT vehicles_code_type_match CHECK (
    (vehicle_type = 'A' AND internal_code LIKE 'VEH-%') OR
    (vehicle_type = 'M' AND internal_code LIKE 'MOT-%')
  )
);

CREATE INDEX IF NOT EXISTS idx_vehicles_resident_id ON public.vehicles(resident_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_dwelling_id ON public.vehicles(dwelling_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate);

-- ============================================================
-- 5. DOCUMENTOS DE VEHÍCULOS (VEHICLE_DOCUMENTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_type   VARCHAR(30) NOT NULL CHECK (document_type IN ('tarjeta_propiedad', 'soat')),
  file_url        TEXT NOT NULL,
  expiry_date     DATE,
  review_status   VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  rejection_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON public.vehicle_documents(vehicle_id);

-- ============================================================
-- 6. ESPACIOS FÍSICOS (PARKING_SPACES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parking_spaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_number      VARCHAR(10) NOT NULL,
  zone              VARCHAR(50) NOT NULL,
  section           VARCHAR(50),
  vehicle_type      VARCHAR(1) NOT NULL CHECK (vehicle_type IN ('A', 'M')),
  allows_oversized  BOOLEAN NOT NULL DEFAULT false,
  status            VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'reserved')),
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_spaces_number_unique UNIQUE (space_number)
);

CREATE INDEX IF NOT EXISTS idx_parking_spaces_zone ON public.parking_spaces(zone);
CREATE INDEX IF NOT EXISTS idx_parking_spaces_type ON public.parking_spaces(vehicle_type);

-- ============================================================
-- 7. CATÁLOGO DE MOTIVOS DE DESCALIFICACIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disqualification_reasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_code VARCHAR(50) NOT NULL,
  label       TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT disqualification_reasons_code_unique UNIQUE (reason_code)
);

INSERT INTO public.disqualification_reasons (reason_code, label, description) VALUES
  ('E01_SIN_POSTULACION',       'Sin postulación',                  'No se diligenció el formulario de postulación dentro del plazo establecido.'),
  ('E02_PAGO_NO_AL_DIA',        'Pagos no al día',                  'La unidad no se encuentra al día con los pagos a la fecha de corte.'),
  ('E03_ACUERDO_PAGO',          'Acuerdo de pago incumplido',       'La unidad presenta acuerdos de pago pendientes o incumplidos.'),
  ('E04_DOCUMENTOS',            'Falta documentación obligatoria',  'Vehículo nuevo sin SOAT o tarjeta de propiedad vigentes y aprobados.'),
  ('E05_VEHICULO_INVALIDO',     'Vehículo no vinculado a unidad',   'El vehículo no corresponde ni está asociado a la unidad solicitante.'),
  ('E06_RESIDENTE_INACTIVO',    'Residente inactivo',               'El perfil del residente no se encuentra activo en el sistema.'),
  ('E07_DUPLICADO',             'Solicitud duplicada',              'La unidad ya cuenta con una postulación para este mismo sorteo y categoría.'),
  ('B01_SIN_POSTULACION',       'Balota blanca: sin postulación',   'El titular de balota blanca no diligenció una nueva solicitud en el periodo actual.'),
  ('B02_REQUISITOS',            'Balota blanca: incumple requisitos','El titular de balota blanca no cumple las condiciones generales de elegibilidad.'),
  ('B03_ACUERDO_INCUMPLIDO',    'Balota blanca: acuerdo incumplido','El titular registra un acuerdo de pago en mora.'),
  ('B04_RELACION_UNIDAD',       'Balota blanca: cambio de unidad',  'El residente ya no habita o no está vinculado a la unidad original.'),
  ('B05_VEHICULO_DISTINTO',     'Balota blanca: vehículo distinto', 'Se postuló un vehículo con placa o modelo diferente al registrado en la balota.'),
  ('B06_BALOTA_NO_VIGENTE',     'Balota blanca: no vigente',        'La balota blanca no se encuentra en estado vigente para este ciclo anual.')
ON CONFLICT (reason_code) DO NOTHING;

-- ============================================================
-- 8. CICLOS ANUALES DE ROTACIÓN (ROTATION_CYCLES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rotation_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rotation_cycles_year_unique UNIQUE (year)
);

-- ============================================================
-- 9. SORTEOS Y PERIODOS TRIMESTRALES (RAFFLES)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.raffles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id                UUID NOT NULL REFERENCES public.rotation_cycles(id) ON DELETE RESTRICT,
  period                  VARCHAR(10) NOT NULL, -- Ej: '2026-Q4'
  quarter_start           DATE NOT NULL,
  quarter_end             DATE NOT NULL,
  vehicle_type            VARCHAR(1) NOT NULL CHECK (vehicle_type IN ('A', 'M')),
  capacity                INTEGER NOT NULL DEFAULT 96, -- 96 para 'A', 25 para 'M'
  status                  VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN (
                            'draft',                  -- Preparación
                            'postulacion_abierta',    -- Recibiendo solicitudes
                            'postulacion_cerrada',    -- Cierre de postulaciones
                            'habilitacion',           -- Doble validación en proceso
                            'habilitacion_publicada', -- Publicado con pie de página
                            'sorteo_comprometido',    -- Instantánea congelada y hash publicado
                            'sorteo_ejecutado',       -- Ejecutado con semilla
                            'publicado',              -- Resultados abiertos
                            'vigente',                -- Trimestre en curso
                            'cerrado'                 -- Trimestre vencido
                          )),
  seed_hash               VARCHAR(64),
  revealed_seed           TEXT,
  snapshot_hash           VARCHAR(64),
  result_hash             VARCHAR(64),
  algorithm_version       VARCHAR(20) DEFAULT 'v2.0-fisher-yates',
  executed_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT raffles_period_vehicle_unique UNIQUE (period, vehicle_type)
);

CREATE INDEX IF NOT EXISTS idx_raffles_period ON public.raffles(period);
CREATE INDEX IF NOT EXISTS idx_raffles_status ON public.raffles(status);

-- ============================================================
-- 10. POSTULACIONES (PARKING_REQUESTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parking_requests (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id                     UUID NOT NULL REFERENCES public.raffles(id) ON DELETE RESTRICT,
  resident_id                   UUID NOT NULL REFERENCES public.residents(id) ON DELETE RESTRICT,
  dwelling_id                   UUID NOT NULL REFERENCES public.dwellings(id) ON DELETE RESTRICT,
  vehicle_id                    UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  receipt_number                VARCHAR(30) NOT NULL, -- Consecutivo oficial con acuse
  residency_type_snapshot       VARCHAR(15) NOT NULL CHECK (residency_type_snapshot IN ('propietario', 'arrendatario')),
  payment_status_snapshot       VARCHAR(15) NOT NULL DEFAULT 'no_verificado',
  payment_validation_note       TEXT,
  documents_complete            BOOLEAN NOT NULL DEFAULT false,
  status                        VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
                                  'pending',
                                  'under_review',
                                  'eligible',
                                  'disqualified',
                                  'assigned_direct',
                                  'assigned_raffle',
                                  'not_assigned',
                                  'withdrawn'
                                )),
  has_white_ballot              BOOLEAN NOT NULL DEFAULT false,
  is_direct_assignment          BOOLEAN NOT NULL DEFAULT false,
  previous_zone_assigned        VARCHAR(50),
  submitted_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_requests_raffle_vehicle_unique UNIQUE (raffle_id, vehicle_id),
  CONSTRAINT parking_requests_receipt_unique UNIQUE (receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_parking_requests_raffle ON public.parking_requests(raffle_id);
CREATE INDEX IF NOT EXISTS idx_parking_requests_status ON public.parking_requests(status);

-- ============================================================
-- 11. DOBLE VALIDACIÓN: ADMINISTRACIÓN Y CONSEJO (REQUEST_REVIEWS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.request_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES public.parking_requests(id) ON DELETE CASCADE,
  reviewer_role   VARCHAR(20) NOT NULL CHECK (reviewer_role IN ('admin', 'consejo')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision        VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
  checklist_data  JSONB, -- Registro de verificación
  observations    TEXT,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT request_reviews_role_unique UNIQUE (request_id, reviewer_role)
);

CREATE INDEX IF NOT EXISTS idx_request_reviews_request ON public.request_reviews(request_id);

-- ============================================================
-- 12. DESCALIFICACIONES POR SOLICITUD (TABLA PUENTE M:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parking_request_disqualifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES public.parking_requests(id) ON DELETE CASCADE,
  reason_id   UUID NOT NULL REFERENCES public.disqualification_reasons(id) ON DELETE RESTRICT,
  detail      TEXT NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prd_unique_request_reason UNIQUE (request_id, reason_id)
);

-- ============================================================
-- 13. BALOTAS BLANCAS (WHITE_BALLOTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.white_ballots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id            UUID NOT NULL REFERENCES public.rotation_cycles(id) ON DELETE RESTRICT,
  vehicle_type        VARCHAR(1) NOT NULL CHECK (vehicle_type IN ('A', 'M')),
  origin_raffle_id    UUID NOT NULL REFERENCES public.raffles(id) ON DELETE RESTRICT,
  target_raffle_id    UUID REFERENCES public.raffles(id) ON DELETE SET NULL,
  resident_id         UUID NOT NULL REFERENCES public.residents(id) ON DELETE RESTRICT,
  dwelling_id         UUID NOT NULL REFERENCES public.dwellings(id) ON DELETE RESTRICT,
  vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  frozen_plate        VARCHAR(10) NOT NULL,
  frozen_model        VARCHAR(50),
  status              VARCHAR(35) NOT NULL DEFAULT 'vigente' CHECK (status IN (
                        'vigente',
                        'usada',
                        'no_usada_sin_postulacion',
                        'no_usada_incumple',
                        'vencida'
                      )),
  non_use_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT white_ballots_cycle_resident_unique UNIQUE (cycle_id, resident_id, vehicle_type)
);

CREATE INDEX IF NOT EXISTS idx_white_ballots_cycle ON public.white_ballots(cycle_id);
CREATE INDEX IF NOT EXISTS idx_white_ballots_status ON public.white_ballots(status);

-- ============================================================
-- 14. ASIGNACIONES FINALES (PARKING_ASSIGNMENTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parking_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id         UUID NOT NULL REFERENCES public.raffles(id) ON DELETE RESTRICT,
  request_id        UUID NOT NULL REFERENCES public.parking_requests(id) ON DELETE RESTRICT,
  parking_space_id  UUID NOT NULL REFERENCES public.parking_spaces(id) ON DELETE RESTRICT,
  vehicle_id        UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  dwelling_id       UUID NOT NULL REFERENCES public.dwellings(id) ON DELETE RESTRICT,
  assignment_type   VARCHAR(15) NOT NULL CHECK (assignment_type IN ('direct', 'raffle', 'special', 'reassignment')),
  period            VARCHAR(10) NOT NULL,
  quarter_start     DATE NOT NULL,
  quarter_end       DATE NOT NULL,
  zone_assigned     VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'reassigned')),
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  CONSTRAINT assignments_request_unique UNIQUE (request_id),
  CONSTRAINT assignments_space_period_unique UNIQUE (parking_space_id, period)
);

CREATE INDEX IF NOT EXISTS idx_parking_assignments_raffle ON public.parking_assignments(raffle_id);
CREATE INDEX IF NOT EXISTS idx_parking_assignments_space ON public.parking_assignments(parking_space_id);
CREATE INDEX IF NOT EXISTS idx_parking_assignments_plate ON public.parking_assignments(vehicle_id);

-- ============================================================
-- 15. INCIDENCIAS Y PORTERÍA (INCIDENTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incidents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_space_id    UUID NOT NULL REFERENCES public.parking_spaces(id) ON DELETE RESTRICT,
  observed_plate      VARCHAR(10) NOT NULL,
  expected_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  incident_type       VARCHAR(50) NOT NULL DEFAULT 'unauthorized_vehicle',
  has_warning         BOOLEAN NOT NULL DEFAULT false,
  registered_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               TEXT,
  evidence_url        TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_plate ON public.incidents(observed_plate);

-- ============================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_residents_updated ON public.residents;
CREATE TRIGGER trg_residents_updated BEFORE UPDATE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SEGURIDAD RLS (ROW LEVEL SECURITY)
-- ============================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dwellings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disqualification_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_request_disqualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.white_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura básica para usuarios autenticados
CREATE POLICY "Authenticated users view dwellings" ON public.dwellings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users view spaces" ON public.parking_spaces FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users view reasons" ON public.disqualification_reasons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users view raffles" ON public.raffles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users view own resident profile" ON public.residents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users view own vehicles" ON public.vehicles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.residents WHERE id = resident_id AND user_id = auth.uid())
);
CREATE POLICY "Users view own requests" ON public.parking_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.residents WHERE id = resident_id AND user_id = auth.uid())
);
CREATE POLICY "Users view own assignments" ON public.parking_assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.parking_requests pr
    JOIN public.residents r ON pr.resident_id = r.id
    WHERE pr.id = request_id AND r.user_id = auth.uid()
  )
);


-- ============================================================
-- AJUSTE DE COLUMNAS NULLABLES PARA DEMO / ACCESO FLEXIBLE
-- ============================================================
ALTER TABLE public.request_reviews ALTER COLUMN reviewer_id DROP NOT NULL;

-- ============================================================
-- POLÍTICAS DE PERMISO TOTAL PARA DEMO / PORTERÍA / RESIDENTES
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Políticas permisivas RLS para lectura y escritura desde la demo
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'user_roles', 'dwellings', 'residents', 'vehicles', 'vehicle_documents',
    'parking_spaces', 'disqualification_reasons', 'rotation_cycles', 'raffles',
    'parking_requests', 'request_reviews', 'parking_request_disqualifications',
    'white_ballots', 'parking_assignments', 'incidents', 'conversations', 'messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public access policy" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Public access policy" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

-- ============================================================
-- DATOS OFICIALES Y RESPALDO (157 REGISTROS)
-- ============================================================

-- Datos para dwellings (3 registros)
INSERT INTO public.dwellings (id, unit_number, zone, block, house_number, dwelling_type, is_active, created_at) VALUES ('6e312027-9c79-4683-95cf-ab6e4bfb4193', 'Casa 01', 'Zona A', '09', '', 'apartamento', true, '2026-10-25T04:26:42.491121+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.dwellings (id, unit_number, zone, block, house_number, dwelling_type, is_active, created_at) VALUES ('32f3d885-72c6-4729-afc7-ab1e6cc59acb', 'Casa 29', 'Zona A', 'Bloque 12', '', 'apartamento', true, '2026-10-25T04:31:54.84723+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.dwellings (id, unit_number, zone, block, house_number, dwelling_type, is_active, created_at) VALUES ('25abf327-7b74-49e3-9304-bba7fb028ee5', '12', 'Asignada por Sistema', '07', '12', 'apartamento', true, '2026-10-27T02:00:31.058384+00:00') ON CONFLICT DO NOTHING;

-- Datos para residents (3 registros)
INSERT INTO public.residents (id, user_id, dwelling_id, full_name, document_id, email, phone, residency_type, payments_current, payment_verified_until, is_active, created_at, updated_at) VALUES ('d05d32f6-aa15-4219-9da2-eb75809dec46', NULL, '6e312027-9c79-4683-95cf-ab6e4bfb4193', 'Carlos perez', '102203050', 'ejemplo@correo.com', '', 'propietario', true, NULL, true, '2026-10-25T04:26:42.82203+00:00', '2026-10-25T04:26:42.82203+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.residents (id, user_id, dwelling_id, full_name, document_id, email, phone, residency_type, payments_current, payment_verified_until, is_active, created_at, updated_at) VALUES ('6ffe8220-1855-4501-8e7d-78acae5b47ce', NULL, '32f3d885-72c6-4729-afc7-ab1e6cc59acb', 'Pedro Torres', '1025354510', 'pedrot@pruebas.com', '', 'arrendatario', true, NULL, true, '2026-10-25T04:31:55.154094+00:00', '2026-10-25T04:31:55.154094+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.residents (id, user_id, dwelling_id, full_name, document_id, email, phone, residency_type, payments_current, payment_verified_until, is_active, created_at, updated_at) VALUES ('d49ab434-a68b-4e4b-b01b-f501b909d46b', NULL, '25abf327-7b74-49e3-9304-bba7fb028ee5', 'Juan', 'Medina Castro', 'pruebas@pruebas.com', '', 'propietario', true, NULL, true, '2026-10-27T02:00:31.423231+00:00', '2026-10-27T02:00:31.423231+00:00') ON CONFLICT DO NOTHING;

-- Datos para vehicles (3 registros)
INSERT INTO public.vehicles (id, dwelling_id, resident_id, internal_code, plate, brand, model, color, vehicle_type, vehicle_category, is_oversized, is_active, created_at, updated_at) VALUES ('28955ab7-ea4c-49c3-8e1e-a26e061ec25d', '6e312027-9c79-4683-95cf-ab6e4bfb4193', 'd05d32f6-aa15-4219-9da2-eb75809dec46', 'VEH-001', 'ASI3215', 'Mazada 5', '', NULL, 'A', 'antiguo', false, true, '2026-10-25T04:26:43.339088+00:00', '2026-10-25T04:26:43.339088+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.vehicles (id, dwelling_id, resident_id, internal_code, plate, brand, model, color, vehicle_type, vehicle_category, is_oversized, is_active, created_at, updated_at) VALUES ('6f0da669-5ffa-4a18-b33a-3e2dc81edbe1', '32f3d885-72c6-4729-afc7-ab1e6cc59acb', '6ffe8220-1855-4501-8e7d-78acae5b47ce', 'VEH-002', 'BLU458', 'Renault', '', NULL, 'A', 'nuevo', false, true, '2026-10-25T04:31:55.771313+00:00', '2026-10-25T04:31:55.771313+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.vehicles (id, dwelling_id, resident_id, internal_code, plate, brand, model, color, vehicle_type, vehicle_category, is_oversized, is_active, created_at, updated_at) VALUES ('8637ffdf-0ab3-438c-a992-5edd53ccb2a1', '25abf327-7b74-49e3-9304-bba7fb028ee5', 'd49ab434-a68b-4e4b-b01b-f501b909d46b', 'VEH-003', 'ESE784', 'Ford', '', NULL, 'A', 'antiguo', false, true, '2026-10-27T02:00:31.945889+00:00', '2026-10-27T02:00:31.945889+00:00') ON CONFLICT DO NOTHING;

-- Datos para parking_spaces (121 registros)
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('acb4355d-f4f9-44f2-8be2-9e498b52bb6d', 'M-01', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('e07a1899-815c-4af9-a7de-29b83b12bbba', 'M-02', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('01de762f-eaf3-4b1f-91b4-5a6872db623e', 'M-03', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('d2bc4026-300c-4896-a3a2-6116743a3a5b', 'M-04', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('0c1ecd3b-7e36-4dcb-a57e-61b5b261b225', 'M-05', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('a6612b62-f57a-4fa7-a77c-6f86b262482c', 'M-06', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('e421da03-8216-4c66-8ed6-c4a57953d55c', 'M-07', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('8600784f-a235-4ac6-89a1-455c532a702e', 'M-08', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('fa33cbf7-650e-4755-8e34-ef851fe9bb13', 'M-09', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('7eb18887-f7d0-4af7-b4d0-d13e3db62be1', 'M-10', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('0b7b94a2-b633-423c-8d82-ac39224c125c', 'M-11', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('0bb8221a-088f-4f74-afff-d0ec28db061b', 'M-12', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('61a56290-0756-4df8-8158-38e487541b24', 'M-13', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('6bfd9c2c-3f8d-4324-999d-c6105e64447d', 'M-14', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2e7374e7-bf1e-4a38-8192-9b49c8501010', 'M-15', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('15bf507c-f5a9-4565-97b0-9ec8e8c4036f', 'M-16', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('035fd98f-36a0-4537-b7ca-0d182a470165', 'M-17', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('8ceaa173-f260-461d-a90b-a61f8a179664', 'M-18', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('ffa92a58-2a73-4538-9516-a754962ff8e3', 'M-19', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('c2d7123c-1b5a-4893-a83d-ebb09b556c86', 'M-20', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('8155f630-30c0-4691-be56-75f68c5ee4d5', 'M-21', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('1397a673-4683-4716-b905-42bc400abce9', 'M-22', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('1fb4af6e-cd8c-4c27-afda-007d13653c21', 'M-23', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('410e1445-4f14-4e9b-9b16-9e497f10c0f8', 'M-24', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('61b5ed7e-0b62-4d26-8193-2498a79b342d', 'M-25', 'Zona Motos', NULL, 'M', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('188a62cb-36f7-458f-9535-02e2f35f69b4', '01', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('9636c475-fcab-4708-838b-fc918565ac5c', '02', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('3faee6cd-cef7-4978-9f5d-042692105f05', '03', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('24323fcc-21d1-434d-b9ac-24a21b64ddfe', '04', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('c5093215-cd5d-4b6a-99f5-ce6be99a4335', '05', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('952bbb5b-c7cc-4daa-950e-a8d845ac762a', '06', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('bc53dbf1-befa-42a5-a922-b0af78de6187', '07', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('da2e6f8a-87ff-4cb7-b2c7-8bf3bae701ba', '08', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('c277c860-bd55-4ca9-a0b3-89e39caf625a', '09', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('6f7055ed-e69c-4513-9fe7-b0f9e436bad9', '10', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('bc0f3024-11d8-404e-901e-d86141f5c4eb', '11', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('06fdadb9-1a8b-483a-820f-0d9f6d03a0ec', '12', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('9c30e19d-a005-486c-8e1d-5487f80c9aa9', '13', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2f69f649-9680-46cb-b5ac-81b65a771b8a', '14', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('fd4d5758-3629-4d87-b6bd-d145d0558c66', '15', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('626f5eb7-9a6b-4930-90d2-286013e119eb', '16', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('ba48f164-ee10-46db-95ba-d43883770e6e', '17', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('07b64888-10a1-4a21-b5ca-c4457ae9caa5', '18', 'Zona 1', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('e0be1dfd-6c42-406d-8604-03a91a69c9b8', '19', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('f6147730-6fa6-4e2c-bc7d-a2330cc6a196', '20', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('e19cd870-4483-4724-9b92-10e571a9fc68', '21', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('9e2010a2-00f2-4124-b265-60f467c1a4b5', '22', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('22ce004f-29e4-46b7-9aff-488bda2cd06d', '23', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('d980e69a-9ab8-4033-93df-6932b27397d0', '24', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('ec3d8988-14eb-4835-924f-9b4c1cf40e79', '25', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('04b07736-acc7-48a1-bf9d-8638e4981a1f', '26', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('8823c349-3d4a-4b05-9c3b-f8bfa2b2c889', '27', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('900dfd5a-2e7b-4b0f-90db-98d66f0c05fa', '28', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('c0df3a40-0bc0-43b1-8a19-463dace26057', '29', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('4f88ae4e-97ac-4ba0-a8a4-6cf27d6422a8', '30', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2484e6c3-0dff-4335-9c7c-2059b08452f9', '31', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('67e40423-5d8d-4e02-8442-e5c18177f9be', '32', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('640190e3-c0b6-4a64-bbc9-b64a043b2cd2', '33', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('d647e21d-e820-4457-b66c-9a1f46c35fc4', '34', 'Zona 2', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('9152189f-9aeb-407a-aadf-d76310fc470f', '35', 'Zona 3', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('8bd17b32-00f2-4c53-b299-92e2f1176078', '36', 'Zona 3', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('27bca57c-ed84-494f-9ab7-d7c632dda2a3', '37', 'Zona 3', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('6496e60a-7f69-48ba-9987-ce11abea60a2', '38', 'Zona 3', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('b9b3ebf8-da13-408d-9aa7-bba4ea270bb4', '39', 'Zona 3', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('8ee225f4-f601-4eef-8055-21a0729ddf3d', '40', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('db7114a7-0a4c-4fba-873c-1b041459eb02', '41', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('facaaa76-58e0-4c01-a1a1-536ef9829a6b', '42', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2717b544-c69f-425a-a647-916100be3440', '43', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('9cc9acd5-4377-4c52-aabe-ba559e03c77c', '44', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('3ba30657-6eff-4675-8a74-ce86a00eae15', '45', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('170f3e2d-a9d6-4d42-be3a-05b3eef2c3fe', '46', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('d4e9ed4d-1fe2-4e40-be59-2290397d320a', '47', 'Zona 4', NULL, 'A', true, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('b4a9d819-9bb0-437a-8eb3-a9c143f4ba24', '48', 'Zona 4', NULL, 'A', true, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('67ac8fc0-e4bb-4527-88cc-3c8d54b80c6f', '49', 'Zona 4', NULL, 'A', true, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('4d5cd8ba-9f8c-4ba5-aa10-a3a4bab64ef0', '50', 'Zona 4', NULL, 'A', true, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('07c9133c-2103-4a5b-adc6-32d03640f99b', '51', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('07587a95-7574-4c48-83e8-013d3b9f8386', '52', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2dc15c7e-68ae-400a-8a74-475d6edf8626', '53', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('19e6d7e3-6895-4932-81bc-1a94d7a60541', '54', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('f012937a-9d8e-408f-a7e5-1681c7467ffc', '55', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('5a92cb55-a6b5-451f-b670-ff72606b032d', '56', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('d2902a53-5d1a-4b68-a078-9f72775f7cc2', '57', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('811660ce-abf0-4c68-9251-1548f555881b', '58', 'Zona 4', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('66acbbe4-f9ab-4050-a539-6269261c6893', '59', 'Zona 5', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('08c6a4fd-3054-453e-af1d-5c1d5962fa42', '60', 'Zona 5', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2a1fc8ca-5e1b-4301-b2c6-e6c968894c5a', '61', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('cf8b0ce0-333f-405f-ac19-3ebc8e7c19ee', '62', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('100736b3-a87e-4c0a-8843-2d1b23e0a09b', '63', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('7e3281d4-d922-4d72-a9ca-eabc51cc9fc5', '64', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('2b992be1-11b5-43ca-8025-e7af291bdede', '65', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('4bf8ac36-d916-4c98-8113-39a7da8bd8a0', '66', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('a94ca28c-c7e0-4dab-9249-da6e8e8aec3f', '67', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('69108542-40b8-4b46-ac56-412d4ba3c430', '68', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('20ed7279-10e7-4b1f-a177-1445e690632d', '69', 'Zona 6', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('14a965b6-a366-488a-b9b7-85ac80eabdd6', '70', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('d50447c6-8a2f-49f2-a67d-1ab6d576fcc6', '71', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('420d9df8-de2d-4d21-bd9a-cbe3b23556d8', '72', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('b1a5802a-2475-419b-9489-9b8e82e96cfc', '73', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('b1165302-1cff-4995-b806-92906354f084', '74', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('011ac668-367b-4e73-bd44-e03fd125c85f', '75', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('01ffe71c-ff8a-4292-9979-9d70b49d2c2d', '76', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('195b179f-cb72-4839-b55f-c0c150e27dfb', '77', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('3c2c3064-884f-4abf-ae91-ff885afa33b6', '78', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('23f3779b-0d46-43b6-97d2-16d1a1f20307', '79', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('1ab25cb5-185b-4990-9e63-b5435990bfd8', '80', 'Zona 7', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('4e57feb0-b9b2-4c50-9edd-b7987a9b4b21', '81', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('1c8eb0b0-6f8f-4f98-b95a-bc59d4eecd9f', '82', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('c2a0c972-7cab-4435-80c9-44f63e8e5b6d', '83', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('395e5f41-501a-46d4-a0bd-d3e040c5ee3e', '84', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('87239c75-6d43-4bf2-9282-954fcfefee4f', '85', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('5fd26885-262b-42e8-9688-58362a04975c', '86', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('c4cc2e3c-1da5-4423-9eb8-fffd4ead1837', '87', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('568a0caa-3703-460b-b589-3e51fcd6c842', '88', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('4c815b82-e61c-46e0-bb5f-80e5d5d28ef9', '89', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('6f26d256-1fd4-4b91-b9aa-f87fb79969ee', '90', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('25e66bc4-c75c-4de2-8f30-089ebd7dbf3a', '91', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('9b6b4966-4a98-4956-b1bf-e62a465904f3', '92', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('4b98a72a-3d51-4cc9-aab6-0a2a7cf1baeb', '93', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('b756724e-ebd6-47fa-bd3f-32cd860e08a9', '94', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('553fb360-2ef3-4158-a578-254c554af478', '95', 'Zona 8', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_spaces (id, space_number, zone, section, vehicle_type, allows_oversized, status, notes, is_active, created_at) VALUES ('455b4739-015b-4c70-a1dc-fe737f44af6c', '96', 'Zona 9', NULL, 'A', false, 'available', NULL, true, '2026-10-25T04:14:21.07435+00:00') ON CONFLICT DO NOTHING;

-- Datos para disqualification_reasons (13 registros)
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('3e99beea-d3d6-48ea-928c-a84c91956cbd', 'E01_SIN_POSTULACION', 'Sin postulación', 'No se diligenció el formulario de postulación dentro del plazo establecido.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('6eb22a9c-a350-4f6c-8bd1-2736df37da23', 'E02_PAGO_NO_AL_DIA', 'Pagos no al día', 'La unidad no se encuentra al día con los pagos a la fecha de corte.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('bc26f0f7-142a-46b7-8dd2-b31f318bb57f', 'E03_ACUERDO_PAGO', 'Acuerdo de pago incumplido', 'La unidad presenta acuerdos de pago pendientes o incumplidos.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('76aa0be8-d89b-4c60-90fc-590edd578d17', 'E04_DOCUMENTOS', 'Falta documentación obligatoria', 'Vehículo nuevo sin SOAT o tarjeta de propiedad vigentes y aprobados.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('f464577c-5634-45d2-9edc-4af81705a583', 'E05_VEHICULO_INVALIDO', 'Vehículo no vinculado a unidad', 'El vehículo no corresponde ni está asociado a la unidad solicitante.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('3935e3dd-6243-483f-be8b-178b64c9b17e', 'E06_RESIDENTE_INACTIVO', 'Residente inactivo', 'El perfil del residente no se encuentra activo en el sistema.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('b5f5cf93-eaea-4e35-8b34-29447e4c3777', 'E07_DUPLICADO', 'Solicitud duplicada', 'La unidad ya cuenta con una postulación para este mismo sorteo y categoría.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('1d6f31b5-0674-4ad1-b8af-e57dd0c7a0d6', 'B01_SIN_POSTULACION', 'Balota blanca: sin postulación', 'El titular de balota blanca no diligenció una nueva solicitud en el periodo actual.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('a6e6f854-f881-4491-bef5-117ed4656367', 'B02_REQUISITOS', 'Balota blanca: incumple requisitos', 'El titular de balota blanca no cumple las condiciones generales de elegibilidad.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('61e2676d-2518-4abd-8acc-4d9704b6ba3a', 'B03_ACUERDO_INCUMPLIDO', 'Balota blanca: acuerdo incumplido', 'El titular registra un acuerdo de pago en mora.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('efb6ac75-c279-456f-9ea7-ba635c447683', 'B04_RELACION_UNIDAD', 'Balota blanca: cambio de unidad', 'El residente ya no habita o no está vinculado a la unidad original.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('7bac7b96-5b2d-4672-9908-58d29609c4a6', 'B05_VEHICULO_DISTINTO', 'Balota blanca: vehículo distinto', 'Se postuló un vehículo con placa o modelo diferente al registrado en la balota.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.disqualification_reasons (id, reason_code, label, description, is_active, created_at) VALUES ('7e12b763-a3c5-4716-8e65-8a67275290e2', 'B06_BALOTA_NO_VIGENTE', 'Balota blanca: no vigente', 'La balota blanca no se encuentra en estado vigente para este ciclo anual.', true, '2026-10-25T04:01:03.825489+00:00') ON CONFLICT DO NOTHING;

-- Datos para rotation_cycles (1 registros)
INSERT INTO public.rotation_cycles (id, year, start_date, end_date, status, created_at) VALUES ('73403afb-2320-4f50-8768-55ce2e345f0a', 2026, '2026-01-01', '2026-12-31', 'active', '2026-10-25T04:26:41.729475+00:00') ON CONFLICT DO NOTHING;

-- Datos para raffles (1 registros)
INSERT INTO public.raffles (id, cycle_id, period, quarter_start, quarter_end, vehicle_type, capacity, status, seed_hash, revealed_seed, snapshot_hash, result_hash, algorithm_version, executed_by, executed_at, created_at) VALUES ('7021c3f1-ba96-45f4-83c5-845ee5677bd3', '73403afb-2320-4f50-8768-55ce2e345f0a', '2026-Q4', '2026-10-01', '2026-12-31', 'A', 96, 'sorteo_ejecutado', 'HASH-665f8783', 'SEMILLA-1792903131302-nzudx6', NULL, NULL, 'v2.0-fisher-yates', NULL, '2026-10-25T04:38:52.192+00:00', '2026-10-25T04:26:42.123945+00:00') ON CONFLICT DO NOTHING;

-- Datos para parking_requests (3 registros)
INSERT INTO public.parking_requests (id, raffle_id, resident_id, dwelling_id, vehicle_id, receipt_number, residency_type_snapshot, payment_status_snapshot, payment_validation_note, documents_complete, status, has_white_ballot, is_direct_assignment, previous_zone_assigned, submitted_at) VALUES ('f6674dc4-f811-4cb6-b777-ed762820edd0', '7021c3f1-ba96-45f4-83c5-845ee5677bd3', '6ffe8220-1855-4501-8e7d-78acae5b47ce', '32f3d885-72c6-4729-afc7-ab1e6cc59acb', '6f0da669-5ffa-4a18-b33a-3e2dc81edbe1', 'ACUSE-A-716950', 'arrendatario', 'al_dia', NULL, false, 'eligible', false, false, NULL, '2026-10-25T04:31:55.906053+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_requests (id, raffle_id, resident_id, dwelling_id, vehicle_id, receipt_number, residency_type_snapshot, payment_status_snapshot, payment_validation_note, documents_complete, status, has_white_ballot, is_direct_assignment, previous_zone_assigned, submitted_at) VALUES ('97be67b0-ae08-4ec0-a4cd-8eb9408d5846', '7021c3f1-ba96-45f4-83c5-845ee5677bd3', 'd05d32f6-aa15-4219-9da2-eb75809dec46', '6e312027-9c79-4683-95cf-ab6e4bfb4193', '28955ab7-ea4c-49c3-8e1e-a26e061ec25d', 'ACUSE-A-404523', 'propietario', 'al_dia', NULL, true, 'eligible', false, false, NULL, '2026-10-25T04:26:43.496375+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_requests (id, raffle_id, resident_id, dwelling_id, vehicle_id, receipt_number, residency_type_snapshot, payment_status_snapshot, payment_validation_note, documents_complete, status, has_white_ballot, is_direct_assignment, previous_zone_assigned, submitted_at) VALUES ('7bf4586c-3a55-4cad-bb43-8723d6581216', '7021c3f1-ba96-45f4-83c5-845ee5677bd3', 'd49ab434-a68b-4e4b-b01b-f501b909d46b', '25abf327-7b74-49e3-9304-bba7fb028ee5', '8637ffdf-0ab3-438c-a992-5edd53ccb2a1', 'ACUSE-A-432825', 'propietario', 'al_dia', '[CASO MUY ESPECIAL - CONDICIÓN ESPECIAL]: Adjudicado directamente Puesto N° 01 (Zona 1). Descontado de la capacidad de 96. Exento de doble validación y de sorteo general. Motivo: Salud / Movilidad Reducida | Adulto mayor, movilidad reducida', true, 'assigned_direct', false, true, NULL, '2026-10-27T02:00:32.460516+00:00') ON CONFLICT DO NOTHING;

-- Datos para request_reviews (4 registros)
INSERT INTO public.request_reviews (id, request_id, reviewer_role, reviewer_id, decision, checklist_data, observations, reviewed_at) VALUES ('2a921067-cab5-47de-915f-5150f6707366', 'f6674dc4-f811-4cb6-b777-ed762820edd0', 'admin', NULL, 'approved', '{"unitMatch":true,"noSanctions":true,"docsApproved":true,"paymentsCurrent":true}'::jsonb, 'Verificado cumple con los requisitos', '2026-10-26T14:59:40.824+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.request_reviews (id, request_id, reviewer_role, reviewer_id, decision, checklist_data, observations, reviewed_at) VALUES ('1ba9bc97-599d-4954-9714-d45cfe1665b4', '97be67b0-ae08-4ec0-a4cd-8eb9408d5846', 'admin', NULL, 'approved', '{"unitMatch":true,"noSanctions":false,"docsApproved":true,"paymentsCurrent":true}'::jsonb, 'Vehículo registra 1 amonestación(es) oficial(es) en portería.', '2026-10-26T15:00:12.56+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.request_reviews (id, request_id, reviewer_role, reviewer_id, decision, checklist_data, observations, reviewed_at) VALUES ('b690d12a-24cb-4ce1-8cb6-d078be95640f', 'f6674dc4-f811-4cb6-b777-ed762820edd0', 'consejo', NULL, 'approved', '{"unitMatch":true,"noSanctions":true,"docsApproved":true,"paymentsCurrent":true}'::jsonb, '', '2026-10-26T15:00:19.902+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.request_reviews (id, request_id, reviewer_role, reviewer_id, decision, checklist_data, observations, reviewed_at) VALUES ('7cf24a9f-7815-4dbd-bf6f-8efd3366cc85', '97be67b0-ae08-4ec0-a4cd-8eb9408d5846', 'consejo', NULL, 'approved', '{"unitMatch":true,"noSanctions":false,"docsApproved":true,"paymentsCurrent":true}'::jsonb, 'Vehículo registra 1 amonestación(es) oficial(es) en portería.', '2026-10-26T15:00:27.712+00:00') ON CONFLICT DO NOTHING;

-- Datos para parking_assignments (3 registros)
INSERT INTO public.parking_assignments (id, raffle_id, request_id, parking_space_id, vehicle_id, dwelling_id, assignment_type, period, quarter_start, quarter_end, zone_assigned, status, assigned_at, expires_at) VALUES ('36e4cb9a-01f5-4616-a4e0-6c9c2bc9dbc3', '7021c3f1-ba96-45f4-83c5-845ee5677bd3', '97be67b0-ae08-4ec0-a4cd-8eb9408d5846', 'c0df3a40-0bc0-43b1-8a19-463dace26057', '28955ab7-ea4c-49c3-8e1e-a26e061ec25d', '6e312027-9c79-4683-95cf-ab6e4bfb4193', 'raffle', '2026-Q4', '2026-10-01', '2026-12-31', 'Zona 2', 'active', '2026-10-25T04:38:51.302+00:00', '2026-12-31T00:00:00+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_assignments (id, raffle_id, request_id, parking_space_id, vehicle_id, dwelling_id, assignment_type, period, quarter_start, quarter_end, zone_assigned, status, assigned_at, expires_at) VALUES ('922aeac1-ee14-4282-b663-61ca3476201b', '7021c3f1-ba96-45f4-83c5-845ee5677bd3', 'f6674dc4-f811-4cb6-b777-ed762820edd0', '6496e60a-7f69-48ba-9987-ce11abea60a2', '6f0da669-5ffa-4a18-b33a-3e2dc81edbe1', '32f3d885-72c6-4729-afc7-ab1e6cc59acb', 'raffle', '2026-Q4', '2026-10-01', '2026-12-31', 'Zona 3', 'active', '2026-10-25T04:38:51.782+00:00', '2026-12-31T00:00:00+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.parking_assignments (id, raffle_id, request_id, parking_space_id, vehicle_id, dwelling_id, assignment_type, period, quarter_start, quarter_end, zone_assigned, status, assigned_at, expires_at) VALUES ('69c1f937-70e8-46e6-809d-1354b060f9db', '7021c3f1-ba96-45f4-83c5-845ee5677bd3', '7bf4586c-3a55-4cad-bb43-8723d6581216', '188a62cb-36f7-458f-9535-02e2f35f69b4', '8637ffdf-0ab3-438c-a992-5edd53ccb2a1', '25abf327-7b74-49e3-9304-bba7fb028ee5', 'special', '2026-Q4', '2026-10-01', '2026-12-31', 'Zona 1', 'active', '2026-10-27T02:00:33.344+00:00', '2026-12-31T00:00:00+00:00') ON CONFLICT DO NOTHING;

-- Datos para incidents (2 registros)
INSERT INTO public.incidents (id, parking_space_id, observed_plate, expected_vehicle_id, incident_type, has_warning, registered_by, notes, evidence_url, occurred_at) VALUES ('9a6b3dbe-301d-474c-a425-3145ad29b4d8', 'bc53dbf1-befa-42a5-a922-b0af78de6187', 'XYZ999', NULL, 'unauthorized_vehicle', true, NULL, 'Reporta ingreso para Casa 11 Bloque 16 no se encuentra registro alguno de este vehículo, no procede ingreso', NULL, '2026-10-26T14:21:22.111506+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.incidents (id, parking_space_id, observed_plate, expected_vehicle_id, incident_type, has_warning, registered_by, notes, evidence_url, occurred_at) VALUES ('9beb2eec-a0ba-479d-bbee-aae63e0658c2', 'c0df3a40-0bc0-43b1-8a19-463dace26057', 'ASI3215', NULL, 'unauthorized_vehicle', true, NULL, '', NULL, '2026-10-26T14:58:29.324823+00:00') ON CONFLICT DO NOTHING;

-- Ajuste final: Asegurar que motos queden en 'Zona Motos'
UPDATE public.parking_spaces SET zone = 'Zona Motos' WHERE vehicle_type = 'M';
