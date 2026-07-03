// ════════════════════════════════════════════════════════════════
//  Reembolsos de Manifestos (waste_refund_items) — CRUD
//  com fallback automático para localStorage se a tabela
//  não existir no Supabase.
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getCollection, saveCollection, uid } from './store';

const TABELA = 'waste_refund_items';
const LOCAL_COL = 'reembolsos';

export function useRefunds(manifestId = null) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isLocal, setIsLocal] = useState(false);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Tenta consultar no Supabase
            let query = supabase.from(TABELA).select('*');
            if (manifestId) {
                query = query.eq('manifest_id', manifestId);
            }
            const { data, error: sbError } = await query.order('id', { ascending: true });

            if (sbError) {
                // Se a tabela não existe, ativa fallback silencioso no localStorage
                if (sbError.message && sbError.message.includes('does not exist')) {
                    setIsLocal(true);
                    const localItems = getCollection(LOCAL_COL);
                    if (manifestId) {
                        setItems(localItems.filter(x => String(x.manifest_id) === String(manifestId)));
                    } else {
                        setItems(localItems);
                    }
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
    }, [manifestId]);

    useEffect(() => {
        reload();
    }, [reload]);

    const add = useCallback(async (record, username) => {
        const payload = {
            manifest_id: manifestId,
            description: record.description || '',
            quantity: Number(record.quantity || 0),
            unit: record.unit || 'kg',
            unit_price: Number(record.unit_price || 0),
            total_price: Number((record.quantity || 0) * (record.unit_price || 0)),
            created_by: username || null,
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
                alert('Erro ao salvar reembolso no Supabase: ' + sbError.message);
                return null;
            }
            setItems((prev) => [...prev, data]);
            return data;
        }
    }, [manifestId, isLocal]);

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
                alert('Erro ao excluir reembolso no Supabase: ' + sbError.message);
                reload();
            }
        }
    }, [isLocal, reload]);

    return { items, add, remove, loading, error, isLocal, reload };
}

const CATALOG_TABELA = 'waste_refund_catalog';
const CATALOG_LOCAL_COL = 'refund_catalog';

const SEED_CATALOGO = [
    'Sucata de Plástico',
    'Sucata de Papelão',
    'Sucata de Madeira',
    'Sucata de Metal',
    'Reembolso de Frete',
    'Reembolso de Coleta',
    'Taxa Administrativa',
    'Destinação Final',
];

export function useRefundCatalog() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLocal, setIsLocal] = useState(false);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from(CATALOG_TABELA).select('*').order('name', { ascending: true });
            if (error) {
                if (error.message && error.message.includes('does not exist')) {
                    setIsLocal(true);
                    let localItems = getCollection(CATALOG_LOCAL_COL);
                    if (localItems.length === 0) {
                        localItems = SEED_CATALOGO.map((name, i) => ({ id: String(i + 1), name }));
                        saveCollection(CATALOG_LOCAL_COL, localItems);
                    }
                    setItems(localItems);
                } else {
                    console.error(error.message);
                }
            } else {
                setIsLocal(false);
                setItems(data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const add = useCallback(async (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return null;

        if (isLocal) {
            const localItems = getCollection(CATALOG_LOCAL_COL);
            if (localItems.some((x) => x.name.toLowerCase() === trimmed.toLowerCase())) {
                return localItems.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
            }
            const newItem = { id: uid(), name: trimmed };
            localItems.push(newItem);
            saveCollection(CATALOG_LOCAL_COL, localItems);
            setItems(localItems);
            return newItem;
        } else {
            // Tenta inserir no Supabase
            const { data, error } = await supabase.from(CATALOG_TABELA).insert({ name: trimmed }).select().single();
            if (error) {
                if (error.message && error.message.includes('duplicate')) {
                    // Já existe, tenta buscar o existente
                    const { data: ext } = await supabase.from(CATALOG_TABELA).select('*').eq('name', trimmed).single();
                    return ext;
                }
                alert('Erro ao salvar item no catálogo: ' + error.message);
                return null;
            }
            setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            return data;
        }
    }, [isLocal]);

    return { items, add, loading, isLocal, reload };
}
