// ════════════════════════════════════════════════════════════════
//  LIRA — Levantamento de Requisitos Legais (tabela lira_geral)
//  O app conversa com a VIEW lira_analises (nomes ASCII — o gateway
//  do Supabase rejeita colunas acentuadas na URL). A view é
//  atualizável: updates caem na tabela base.
//
//  useLira() → { items, loading, error, needsSetup, reload,
//                getFull, salvarAnalise }
//  · needsSetup = true quando a view/colunas ainda não existem
//    (rodar database/lira.sql no SQL Editor).
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

const VIEW = 'lira_analises';

// Colunas leves para a listagem (textos longos ficam para getFull)
const COLS_LISTA = 'id,codigo,requisito,sumario,obrigacao,origem,prioridade,situacao,conformidade,observacoes,analisado_em,analisado_por';

// Um registro conta como analisado quando as observações/conclusões foram preenchidas
export const foiAnalisado = (r) => !!(r?.observacoes && String(r.observacoes).trim());

export function useLira() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [needsSetup, setNeedsSetup] = useState(false);

    const reload = useCallback(async () => {
        setLoading(true); setError(null);
        const { data, error } = await supabase
            .from(VIEW)
            .select(COLS_LISTA)
            .order('id', { ascending: true })
            .range(0, 4999);
        if (error) {
            // 42P01 = relação inexistente → falta rodar o script de setup
            if (error.code === '42P01' || /does not exist/i.test(error.message || '')) setNeedsSetup(true);
            else setError(error.message);
        } else {
            setNeedsSetup(false);
            setItems(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    // Registro completo (sumário, evidência, penalidade…) para o modal
    const getFull = useCallback(async (id) => {
        const { data, error } = await supabase.from(VIEW).select('*').eq('id', id).single();
        if (error) { alert('Erro ao carregar o requisito: ' + error.message); return null; }
        return data;
    }, []);

    // Salva a análise; carimba data/autor na PRIMEIRA conclusão (o dia em
    // que contou para a meta não muda em edições posteriores).
    const salvarAnalise = useCallback(async (row, { observacoes, conformidade, autor }) => {
        const patch = { observacoes, conformidade };
        if (!row.analisado_em && observacoes?.trim()) {
            patch.analisado_em = new Date().toISOString();
            patch.analisado_por = autor || null;
        }
        const { data, error } = await supabase.from(VIEW).update(patch).eq('id', row.id).select(COLS_LISTA).single();
        if (error) { alert('Erro ao salvar a análise: ' + error.message); return null; }
        setItems((prev) => prev.map((it) => (it.id === row.id ? data : it)));
        return data;
    }, []);

    return { items, loading, error, needsSetup, reload, getFull, salvarAnalise };
}
