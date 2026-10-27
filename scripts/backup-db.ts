import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno
const envPath = path.resolve('C:/Users/luis/Desktop/Proyecto/agent-base-template-main/.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envText.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TABLES = [
  'dwellings',
  'residents',
  'vehicles',
  'vehicle_documents',
  'parking_spaces',
  'rotation_cycles',
  'raffles',
  'parking_requests',
  'request_reviews',
  'parking_request_disqualifications',
  'parking_assignments',
  'white_ballots',
  'incidents',
  'disqualification_reasons',
];

async function runBackup() {
  console.log('====================================================');
  console.log('🛡️ INICIANDO RESPALDO DE SEGURIDAD DE SUPABASE');
  console.log('====================================================\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.resolve('C:/Users/luis/Desktop/Proyecto/agent-base-template-main/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`⚠️ Tabla [${table}]: No se pudo exportar (${error.message})`);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
        totalRecords += (data || []).length;
        console.log(`✅ [${table}]: ${(data || []).length} registros respaldados`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Error leyendo tabla [${table}]:`, err.message);
    }
  }

  // Guardar archivo JSON completo de respaldo
  const jsonFile = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(backupData, null, 2), 'utf8');

  // Guardar también como snapshot más reciente 'latest-backup.json'
  const latestJsonFile = path.join(backupDir, 'latest-backup.json');
  fs.writeFileSync(latestJsonFile, JSON.stringify(backupData, null, 2), 'utf8');

  console.log('\n====================================================');
  console.log(`🎉 RESPALDO COMPLETADO: ${totalRecords} registros en total.`);
  console.log(`📁 Archivo generado: ${jsonFile}`);
  console.log(`📁 Archivo latest: ${latestJsonFile}`);
  console.log('⚡ Nota: Esta consulta también restablece el contador de inactividad de Supabase.');
  console.log('====================================================\n');
}

runBackup().catch((err) => {
  console.error('Error al generar respaldo:', err);
  process.exit(1);
});
