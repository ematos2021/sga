// ════════════════════════════════════════════════════════════════
//  Controle de Pragas / Dedetização — tabela dedetizacao_solicitacoes
//  useDedetizacao() → { items, loading, error, needsSetup, reload,
//                       add, update, remove }
//  · needsSetup = true quando a tabela ainda não existe
//    (rodar database/dedetizacao.sql no SQL Editor).
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

const TABELA = 'dedetizacao_solicitacoes';

export function useDedetizacao() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [needsSetup, setNeedsSetup] = useState(false);

    const reload = useCallback(async () => {
        setLoading(true); setError(null);
        const { data, error } = await supabase
            .from(TABELA)
            .select('*')
            .order('created_at', { ascending: false })
            .range(0, 4999);
        if (error) {
            if (error.code === '42P01' || /does not exist/i.test(error.message || '')) setNeedsSetup(true);
            else setError(error.message);
        } else {
            setNeedsSetup(false);
            setItems(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const add = useCallback(async (registro) => {
        const { data, error } = await supabase.from(TABELA).insert(registro).select().single();
        if (error) { alert('Erro ao registrar a solicitação: ' + error.message); return null; }
        setItems((prev) => [data, ...prev]);
        return data;
    }, []);

    const update = useCallback(async (id, patch) => {
        const { data, error } = await supabase.from(TABELA).update(patch).eq('id', id).select().single();
        if (error) { alert('Erro ao atualizar: ' + error.message); return null; }
        setItems((prev) => prev.map((it) => (it.id === id ? data : it)));
        return data;
    }, []);

    const remove = useCallback(async (id) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        const { error } = await supabase.from(TABELA).delete().eq('id', id);
        if (error) { alert('Erro ao excluir: ' + error.message); reload(); }
    }, [reload]);

    return { items, loading, error, needsSetup, reload, add, update, remove };
}
