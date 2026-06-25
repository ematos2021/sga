// ════════════════════════════════════════════════════════════════
//  Cadastro de Resíduos (waste_management_registry) — CRUD ao vivo
//  no Supabase. Hook useWasteRegistry() expõe:
//  { items, add, update, remove, reload, loading, error }.
//  Trabalha direto com os nomes de coluna da tabela (snake_case).
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

const TABELA = 'waste_management_registry';

// Colunas editáveis (id e created_at são gerenciados pelo banco)
export const CAMPOS = [
    'waste_type', 'category', 'ibama_code',
    'physical_state', 'waste_class', 'packaging', 'unit', 'weight', 'treatment',
    'destinator_name', 'destinator_cnpj',
    'temp_storage_name', 'temp_storage_cnpj',
    'transporter_1_name', 'transporter_1_cnpj',
    'transporter_2_name', 'transporter_2_cnpj',
    'transporter_3_name', 'transporter_3_cnpj',
    'transporter_4_name', 'transporter_4_cnpj',
    'onu_number', 'risk_class', 'shipping_name', 'packaging_group',
];

// Mantém só as colunas editáveis e normaliza '' → null
function limparPayload(obj) {
    const out = {};
    for (const k of CAMPOS) {
        const v = obj[k];
        out[k] = v === '' || v === undefined ? null : v;
    }
    return out;
}

export function useWasteRegistry() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from(TABELA)
            .select('*')
            .order('waste_type', { ascending: true })
            .order('id', { ascending: true })
            .limit(5000);
        if (error) setError(error.message);
        else setItems(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const add = useCallback(async (record) => {
        const { data, error } = await supabase.from(TABELA).insert(limparPayload(record)).select().single();
        if (error) { alert('Erro ao salvar: ' + error.message); return null; }
        setItems((prev) => [data, ...prev]);
        return data;
    }, []);

    const update = useCallback(async (id, patch) => {
        const { data, error } = await supabase.from(TABELA).update(limparPayload(patch)).eq('id', id).select().single();
        if (error) { alert('Erro ao atualizar: ' + error.message); return null; }
        setItems((prev) => prev.map((it) => (it.id === id ? data : it)));
        return data;
    }, []);

    const remove = useCallback(async (id) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        const { error } = await supabase.from(TABELA).delete().eq('id', id);
        if (error) { alert('Erro ao excluir: ' + error.message); reload(); }
    }, [reload]);

    return { items, add, update, remove, reload, loading, error };
}
