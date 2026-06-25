// ════════════════════════════════════════════════════════════════
//  Cliente Supabase — conexão única reutilizada em todo o app.
//  URL e chave pública (anon/publishable) vêm de variáveis de ambiente
//  (.env → VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// ════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://pfyimfplmycakshzyhaj.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_FiqdFTv3TkOimlj2NH3Iug_2ib9CfUw';

export const supabase = createClient(url, anonKey);
