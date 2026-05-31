const SUPABASE_URL = 'https://tbqwtxwydcnkkknogbno.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rzOrqiZJqla4NAncjPypDQ_xObHPijD';

const { createClient } = supabase;
// Nota: carga el SDK de Supabase via CDN en index.html antes de este script

const db = createClient(SUPABASE_URL, SUPABASE_KEY);