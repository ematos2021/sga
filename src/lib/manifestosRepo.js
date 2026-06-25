// ════════════════════════════════════════════════════════════════
//  Manifestos (waste_manifests) — leitura/gravação ao vivo no Supabase.
//  Expõe useManifestos() com a MESMA interface de useCollection:
//  { items, add, update, remove, setAll } + { loading, error, reload }.
//
//  A tabela usa nomes em inglês; o app usa o modelo em português. O
//  mapeamento abaixo converte nos dois sentidos. Campos derivados
//  (status, destinacao, classe, sinir) NÃO têm coluna no banco — são
//  calculados na leitura e só persistem em memória durante a sessão.
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { classificaDestinacao, classificaClasse, limpa, ehVazio } from './importManifestos';

const MESES_PT = { '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR', '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO', '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ' };

// Campo do modelo (app) → coluna da tabela (Supabase)
const FIELD_TO_COL = {
    data: 'date',
    mes: 'month',
    hora: 'time',
    solicitante: 'requester',
    residuo: 'waste_type',
    motorista: 'driver',
    placa: 'vehicle_plate',
    responsavelSGI: 'sgi_responsible',
    notaFiscal: 'invoice_number',
    ticketSustentare: 'sustentare_ticket',
    numeroMTR: 'mondial_manifest_number',
    manifestoSupertrans: 'supertrans_manifest_number',
    destinador: 'receiver',
    setorColeta: 'collection_sector',
    tipoRecebedor: 'recebedor_tipo',
};

// Linha do banco → manifesto do app
function rowToManifesto(row) {
    const data = (row.date || '').slice(0, 10);
    const residuo = limpa(row.waste_type);
    return {
        id: String(row.id),
        data,
        mes: limpa(row.month) || MESES_PT[data.slice(5, 7)] || '',
        hora: limpa(row.time).slice(0, 5),
        solicitante: limpa(row.requester),
        residuo,
        motorista: limpa(row.driver),
        placa: limpa(row.vehicle_plate).replace(/\s+/g, ''),
        responsavelSGI: limpa(row.sgi_responsible),
        notaFiscal: limpa(row.invoice_number),
        ticketSustentare: limpa(row.sustentare_ticket),
        numeroMTR: limpa(row.mondial_manifest_number),
        manifestoSupertrans: limpa(row.supertrans_manifest_number),
        destinador: limpa(row.receiver),
        setorColeta: limpa(row.collection_sector),
        tipoRecebedor: limpa(row.recebedor_tipo) || 'Fornecedor',
        destinacao: classificaDestinacao(residuo),
        classe: classificaClasse(residuo),
        status: 'Emitido',
        sinir: !ehVazio(row.mondial_manifest_number),
        createdAt: row.created_at,
    };
}

// Manifesto do app → colunas do banco. partial=true mapeia só as chaves presentes
// (usado em updates parciais; chaves sem coluna, ex. status, são ignoradas).
function manifestoToRow(m, partial = false) {
    const row = {};
    for (const [field, col] of Object.entries(FIELD_TO_COL)) {
        if (partial && !(field in m)) continue;
        const v = m[field];
        row[col] = v === '' || v === undefined ? null : v;
    }
    // Deriva o mês a partir da data quando não informado (insert completo)
    if (!partial && !row.month && row.date) row.month = MESES_PT[String(row.date).slice(5, 7)] || null;
    return row;
}

const TABELA = 'waste_manifests';

export function useManifestos() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from(TABELA)
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .limit(5000);
        if (error) setError(error.message);
        else setItems((data || []).map(rowToManifesto));
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const add = useCallback(async (m) => {
        const { data, error } = await supabase.from(TABELA).insert(manifestoToRow(m)).select().single();
        if (error) { alert('Erro ao salvar manifesto: ' + error.message); return; }
        setItems((prev) => [rowToManifesto(data), ...prev]);
    }, []);

    const update = useCallback(async (id, patch) => {
        // Atualiza a UI imediatamente (cobre campos derivados sem coluna, ex. status)
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
        const row = manifestoToRow(patch, true);
        if (Object.keys(row).length) {
            const { error } = await supabase.from(TABELA).update(row).eq('id', id);
            if (error) alert('Erro ao atualizar manifesto: ' + error.message);
        }
    }, []);

    const remove = useCallback(async (id) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        const { error } = await supabase.from(TABELA).delete().eq('id', id);
        if (error) alert('Erro ao excluir manifesto: ' + error.message);
    }, []);

    // Inserção em lote (usado pela importação de dump). Grava no banco e recarrega.
    const setAll = useCallback(async (arr) => {
        const novos = arr.filter((m) => !m.id || !/^\d+$/.test(String(m.id)));
        if (novos.length) {
            const { error } = await supabase.from(TABELA).insert(novos.map((m) => manifestoToRow(m)));
            if (error) { alert('Erro ao importar manifestos: ' + error.message); return; }
        }
        reload();
    }, [reload]);

    return { items, add, update, remove, setAll, loading, error, reload };
}
