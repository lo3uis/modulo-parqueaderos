import fs from 'fs';
import path from 'path';

const projectRoot = 'C:/Users/luis/Desktop/Proyecto/agent-base-template-main';
const schemaV2Path = 'C:/Users/luis/.gemini/antigravity/brain/5bac437e-3e11-4913-993a-443ce2057250/parking-schema-v2.sql';
const backupPath = path.join(projectRoot, 'backups/latest-backup.json');

const schemaV2 = fs.readFileSync(schemaV2Path, 'utf8');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

// Fix reviewer_id in request_reviews: allow NULL (since in demo/audits it can be unassigned)
let schemaV2Fixed = schemaV2
  .replace(/reviewer_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+RESTRICT/gi, 'reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL');

let out = `-- ============================================================
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
${schemaV2Fixed}

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
`;

// Insert tables in dependency order
const tableOrder = [
  'dwellings',
  'residents',
  'vehicles',
  'parking_spaces',
  'disqualification_reasons',
  'rotation_cycles',
  'raffles',
  'parking_requests',
  'request_reviews',
  'parking_assignments',
  'incidents',
  'white_ballots',
  'parking_request_disqualifications',
  'vehicle_documents',
];

for (const table of tableOrder) {
  const rows = backup[table];
  if (!rows || rows.length === 0) continue;
  out += `\n-- Datos para ${table} (${rows.length} registros)\n`;
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = cols.map((c) => {
      let v = row[c];
      // Garantizar que motos tengan 'Zona Motos'
      if (table === 'parking_spaces' && c === 'zone' && row.vehicle_type === 'M') {
        v = 'Zona Motos';
      }
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number') return String(v);
      if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    out += `INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;\n`;
  }
}

out += `\n-- Ajuste final: Asegurar que motos queden en 'Zona Motos'
UPDATE public.parking_spaces SET zone = 'Zona Motos' WHERE vehicle_type = 'M';
`;

fs.writeFileSync(path.join(projectRoot, 'setup-complete-new-project.sql'), out, 'utf8');
console.log('setup-complete-new-project.sql actualizado con éxito! Tamaño:', out.length);
