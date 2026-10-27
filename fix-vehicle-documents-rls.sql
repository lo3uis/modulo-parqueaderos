-- ============================================================
-- Habilitar acceso total a vehicle_documents para desarrollo
-- ============================================================
ALTER TABLE public.vehicle_documents DISABLE ROW LEVEL SECURITY;
-- O si prefieres mantener RLS activo con política abierta:
-- DROP POLICY IF EXISTS "Allow all for dev" ON public.vehicle_documents;
-- CREATE POLICY "Allow all for dev" ON public.vehicle_documents FOR ALL USING (true) WITH CHECK (true);
