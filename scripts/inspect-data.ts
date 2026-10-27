import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function inspectData() {
  const { data: assignments } = await supabase
    .from('parking_assignments')
    .select('*, parking_space:parking_spaces(*), vehicle:vehicles(*), dwelling:dwellings(*)');

  console.log('Assignments count in DB:', assignments?.length || 0);

  const { data: spaces } = await supabase
    .from('parking_spaces')
    .select('*')
    .order('space_number', { ascending: true });

  console.log('Total spaces in DB:', spaces?.length || 0);

  const { data: ballots } = await supabase
    .from('white_ballots')
    .select('*, vehicle:vehicles(*), dwelling:dwellings(*)');

  console.log('White ballots in DB:', ballots?.length || 0);

  const { data: requests } = await supabase
    .from('parking_requests')
    .select('*, vehicle:vehicles(*), dwelling:dwellings(*), resident:residents(*)');

  console.log('Requests in DB:', requests?.length || 0);
}

inspectData();
