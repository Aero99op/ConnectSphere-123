import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env: any = {};
envFile.split('\n').forEach(line => {
  const [k, ...vParts] = line.split('=');
  if (k && vParts.length) env[k.trim()] = vParts.join('=').trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('stories').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("DB STORIES:", JSON.stringify(data, null, 2));
  if (error) console.error("ERROR:", error);
}
check();
