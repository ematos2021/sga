// ════════════════════════════════════════════════════════════════
//  SGA — Camada de persistência (localStorage)
//  API simples de coleções + hook React. Backend real entra depois,
//  bastando trocar estas funções por chamadas à API.
// ════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'sga_';

// ─── Eventos para sincronizar abas/componentes na mesma página ───
const listeners = new Set();
function emit(collection) {
    listeners.forEach((fn) => fn(collection));
}

export function getCollection(collection) {
    try {
        const raw = localStorage.getItem(PREFIX + collection);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveCollection(collection, items) {
    localStorage.setItem(PREFIX + collection, JSON.stringify(items));
    emit(collection);
}

export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function addItem(collection, item) {
    const items = getCollection(collection);
    const record = { id: uid(), createdAt: new Date().toISOString(), ...item };
    items.unshift(record);
    saveCollection(collection, items);
    return record;
}

export function updateItem(collection, id, patch) {
    const items = getCollection(collection).map((it) =>
        it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it
    );
    saveCollection(collection, items);
}

export function removeItem(collection, id) {
    saveCollection(collection, getCollection(collection).filter((it) => it.id !== id));
}

// ─── Hook reativo ───
export function useCollection(collection) {
    const [items, setItems] = useState(() => getCollection(collection));

    useEffect(() => {
        const fn = (changed) => {
            if (changed === collection) setItems(getCollection(collection));
        };
        listeners.add(fn);
        return () => listeners.delete(fn);
    }, [collection]);

    const add = useCallback((item) => addItem(collection, item), [collection]);
    const update = useCallback((id, patch) => updateItem(collection, id, patch), [collection]);
    const remove = useCallback((id) => removeItem(collection, id), [collection]);

    return { items, add, update, remove, setAll: (arr) => saveCollection(collection, arr) };
}

// ─── Nomes das coleções (constantes para evitar typo) ───
export const COL = {
    RESIDUOS: 'residuos',          // cadastro de tipos de resíduo
    AUTORIZACOES: 'autorizacoes',  // autorização de saída
    MANIFESTOS: 'manifestos',      // MTR / Sinir
    TICKETS: 'tickets',            // tickets de coleta
    FUMACA: 'fumaca',              // medição de fumaça preta
    NFSUCATA: 'nfSucata',          // NF de sucata plástica VIAMED
    MOTORISTAS: 'motoristas',      // transportadoras / motoristas
    GERADORES: 'geradores',        // geradores a diesel
    CALENDARIO: 'calendario',      // calendário de datas ambientais
    EMISSOES: 'emissoes',          // inventário de GEE (GHG Protocol)
    ESG_IND: 'esgIndicadores',     // indicadores ESG (social / governança)
    INICIATIVAS: 'iniciativas',    // iniciativas de descarbonização
    ESG_CFG: 'esgConfig',          // programa de metas / descarbonização
    MAPA_EMISSOES: 'mapaEmissoes', // mapa de coleta do inventário (Mondial)
    CONTATOS: 'contatosEsg',       // responsáveis por unidade/setor (Mondial)
};

// ─── Documento único de configuração (1 registro) ───
export function getConfig(collection, fallback = {}) {
    const arr = getCollection(collection);
    return arr.length ? arr[0] : fallback;
}
export function saveConfig(collection, doc) {
    saveCollection(collection, [{ id: 'cfg', ...doc }]);
}

