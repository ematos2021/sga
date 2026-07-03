// ════════════════════════════════════════════════════════════════
//  Fluxo de Caixa (waste_cash_flow) — CRUD
//  com fallback automático para localStorage se a tabela
//  não existir no Supabase.
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getCollection, saveCollection, uid } from './store';

const TABELA = 'waste_cash_flow';
const LOCAL_COL = 'fluxo_caixa';

export function useCashFlow() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isLocal, setIsLocal] = useState(false);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: sbError } = await supabase
                .from(TABELA)
                .select('*')
                .order('date', { ascending: false })
                .order('id', { ascending: false });

            if (sbError) {
                if (sbError.message && sbError.message.includes('does not exist')) {
                    setIsLocal(true);
                    setItems(getCollection(LOCAL_COL));
                } else {
                    setError(sbError.message);
                }
            } else {
                setIsLocal(false);
                setItems(data || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const add = useCallback(async (record) => {
        const payload = {
            manifest_id: record.manifest_id ? Number(record.manifest_id) : null,
            type: record.type || 'saida',
            description: record.description || '',
            amount: Number(record.amount || 0),
            date: record.date || new Date().toISOString().slice(0, 10),
        };

        if (isLocal) {
            const localItems = getCollection(LOCAL_COL);
            const newItem = {
                id: uid(),
                created_at: new Date().toISOString(),
                ...payload
            };
            localItems.unshift(newItem);
            saveCollection(LOCAL_COL, localItems);
            setItems((prev) => [newItem, ...prev]);
            return newItem;
        } else {
            const { data, error: sbError } = await supabase.from(TABELA).insert(payload).select().single();
            if (sbError) {
                alert('Erro ao salvar no Supabase: ' + sbError.message);
                return null;
            }
            setItems((prev) => [data, ...prev]);
            return data;
        }
    }, [isLocal]);

    const remove = useCallback(async (id) => {
        if (isLocal) {
            const localItems = getCollection(LOCAL_COL);
            const filtered = localItems.filter((x) => x.id !== id);
            saveCollection(LOCAL_COL, filtered);
            setItems((prev) => prev.filter((x) => x.id !== id));
        } else {
            setItems((prev) => prev.filter((x) => x.id !== id));
            const { error: sbError } = await supabase.from(TABELA).delete().eq('id', id);
            if (sbError) {
                alert('Erro ao excluir no Supabase: ' + sbError.message);
                reload();
            }
        }
    }, [isLocal, reload]);

    return { items, add, remove, loading, error, isLocal, reload };
}
