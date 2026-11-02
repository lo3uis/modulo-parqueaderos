-- ============================================================
-- ACTUALIZACIÓN: MOTOS SIN ZONIFICACIÓN (ZONA ÚNICA DE 25 PUESTOS)
-- ============================================================
-- Las motocicletas no tienen sub-zonificación (es un único bloque de 25 puestos M-01 a M-25).
-- Ejecuta este script en el SQL Editor de Supabase:

UPDATE public.parking_spaces
SET zone = 'Zona Motos'
WHERE vehicle_type = 'M';

-- Permitir actualización de estado de espacios por la aplicación
DROP POLICY IF EXISTS "Allow update spaces" ON public.parking_spaces;
CREATE POLICY "Allow update spaces" ON public.parking_spaces FOR UPDATE USING (true) WITH CHECK (true);

-- Verificación de los 25 espacios de motos:
SELECT space_number, zone, vehicle_type, status
FROM public.parking_spaces
WHERE vehicle_type = 'M'
ORDER BY space_number ASC;
