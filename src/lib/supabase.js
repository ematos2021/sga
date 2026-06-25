// ════════════════════════════════════════════════════════════════
//  Cliente Supabase — conexão única reutilizada em todo o app.
//  URL e chave pública (anon/publishable) vêm de variáveis de ambiente
//  (.env → VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// ════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes no .env');
}

export const supabase = createClient(url, anonKey);
