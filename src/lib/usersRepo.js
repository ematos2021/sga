// ════════════════════════════════════════════════════════════════
//  Gestão de usuários — perfis em public.profiles (1:1 com auth.users)
//  Login usa Supabase Auth; aqui gerenciamos nome/papel/admin/ativo.
//  Criação de usuário usa signUp num client ISOLADO para não trocar a
//  sessão do admin logado.
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://pfyimfplmycakshzyhaj.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_FiqdFTv3TkOimlj2NH3Iug_2ib9CfUw';

export function useUsuarios() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true); setError(null);
        const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
        if (error) setError(error.message);
        else setItems(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    // Cria usuário no Auth (client isolado) + grava o perfil
    const criar = useCallback(async ({ email, password, name, role, avatar, is_admin }) => {
        const isolado = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await isolado.auth.signUp({ email: email.trim(), password, options: { data: { name } } });
        if (error) { alert('Erro ao criar usuário: ' + error.message); return null; }
        const id = data?.user?.id;
        if (id) {
            const { error: pe } = await supabase.from('profiles').upsert({
                id, email: email.trim(), name, role, avatar: avatar || '👤', is_admin: !!is_admin, active: true,
            });
            if (pe) alert('Usuário criado, mas falhou ao salvar o perfil: ' + pe.message);
        }
        try { await isolado.auth.signOut(); } catch { /* noop */ }
        await reload();
        return data?.user || null;
    }, [reload]);

    const update = useCallback(async (id, patch) => {
        const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single();
        if (error) { alert('Erro ao atualizar: ' + error.message); return null; }
        setItems((prev) => prev.map((u) => (u.id === id ? data : u)));
        return data;
    }, []);

    const remove = useCallback(async (id) => {
        setItems((prev) => prev.filter((u) => u.id !== id));
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) { alert('Erro ao excluir o perfil: ' + error.message); reload(); }
    }, [reload]);

    // ── Permissões de acesso por tela ──────────────────────────────

    const getPermissions = useCallback(async (userId) => {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('page_id')
            .eq('user_id', userId);
        if (error) { console.warn('Erro ao carregar permissões:', error.message); return []; }
        return (data || []).map((p) => p.page_id);
    }, []);

    const savePermissions = useCallback(async (userId, pageIds) => {
        // Remove todas as permissões anteriores
        const { error: delErr } = await supabase
            .from('user_permissions')
            .delete()
            .eq('user_id', userId);
        if (delErr) { alert('Erro ao limpar permissões: ' + delErr.message); return false; }

        // Insere as novas
        if (pageIds.length > 0) {
            const rows = pageIds.map((page_id) => ({ user_id: userId, page_id }));
            const { error: insErr } = await supabase
                .from('user_permissions')
                .insert(rows);
            if (insErr) { alert('Erro ao salvar permissões: ' + insErr.message); return false; }
        }
        return true;
    }, []);

    return { items, loading, error, reload, criar, update, remove, getPermissions, savePermissions };
}
