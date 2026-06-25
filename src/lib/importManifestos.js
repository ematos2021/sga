// ════════════════════════════════════════════════════════════════
//  Importador de manifestos de resíduos (waste_manifests)
//  Lê comandos INSERT INTO waste_manifests (...) VALUES (...); — o dump
//  exportado do banco — e converte para o modelo de manifesto do SGA.
//  Tolera: aspas escapadas (''), NULL, placeholder '-', quebras de
//  linha dentro de strings e números sem aspas.
// ════════════════════════════════════════════════════════════════

// Classifica a destinação a partir do tipo de resíduo (para indicadores ESG)
export function classificaDestinacao(wasteType = '') {
    const t = wasteType.toUpperCase();
    if (/ATERRO|ENTULHO|CONTAMINAD|REJEITO|LIXO/.test(t)) return 'Aterro Sanitário';
    if (/EFLUENTE|FOSSA|SANITARI/.test(t)) return 'Tratamento';
    if (/OLEO|ÓLEO|LUBRIFICANTE/.test(t)) return 'Coprocessamento';
    if (/PAPEL|PAPELÃO|PAPELAO|PLÁSTICO|PLASTICO|ISOPOR|SUCATA|METÁL|METAL|PALLET|LENHA|MADEIRA|TUBETE|EMBAL|VIDRO|ORGÂNICO|ORGANICO/.test(t)) return 'Reciclagem';
    return 'Outros';
}

// Classe NBR 10004 aproximada a partir do tipo de resíduo
export function classificaClasse(wasteType = '') {
    const t = wasteType.toUpperCase();
    if (/OLEO|ÓLEO|LUBRIFICANTE|CONTAMINAD|EFLUENTE/.test(t)) return 'I';
    if (/ATERRO|ENTULHO|ORGÂNICO|ORGANICO/.test(t)) return 'IIA';
    return 'IIB';
}

export const ehVazio = (v) => {
    if (v == null) return true;
    const s = String(v).trim();
    return s === '' || s === '-' || /^null$/i.test(s);
};
export const limpa = (v) => (ehVazio(v) ? '' : String(v).trim().replace(/\s+/g, ' '));

// Percorre uma tupla VALUES (...) respeitando aspas/escapes
function parseValues(str, start) {
    const out = [];
    let i = start + 1, cur = '', quoted = false, inStr = false;
    while (i < str.length) {
        const ch = str[i];
        if (inStr) {
            if (ch === "'") {
                if (str[i + 1] === "'") { cur += "'"; i += 2; continue; } // '' → '
                inStr = false; i++; continue;
            }
            cur += ch; i++; continue;
        }
        if (ch === "'") { if (!cur.trim()) cur = ''; inStr = true; quoted = true; i++; continue; }
        if (ch === ',') { out.push(coerce(cur, quoted)); cur = ''; quoted = false; i++; continue; }
        if (ch === ')') { out.push(coerce(cur, quoted)); return out; }
        cur += ch; i++;
    }
    return out.length ? out : null;
}

function coerce(raw, quoted) {
    if (quoted) return raw;                 // string (pode ter espaços/quebras)
    const t = raw.trim();
    if (t === '' || /^null$/i.test(t)) return null;
    return t;                               // número ou token nu
}

// Converte um registro bruto (colunas → valores) no manifesto do SGA
function mapManifesto(r) {
    const data = limpa(r.date).slice(0, 10);
    const residuo = limpa(r.waste_type);
    if (!data && !residuo && ehVazio(r.mondial_manifest_number)) return null;
    return {
        data,
        mes: limpa(r.month),
        hora: limpa(r.time).slice(0, 5),
        solicitante: limpa(r.requester),
        residuo,
        motorista: limpa(r.driver),
        placa: limpa(r.vehicle_plate).replace(/\s+/g, ''),
        responsavelSGI: limpa(r.sgi_responsible),
        notaFiscal: limpa(r.invoice_number),
        ticketSustentare: limpa(r.sustentare_ticket),
        numeroMTR: limpa(r.mondial_manifest_number),
        manifestoSupertrans: limpa(r.supertrans_manifest_number),
        destinador: limpa(r.receiver),
        setorColeta: limpa(r.collection_sector),
        destinacao: classificaDestinacao(residuo),
        classe: classificaClasse(residuo),
        status: 'Emitido',
        sinir: !ehVazio(r.mondial_manifest_number),
        origem: 'import',
    };
}

// Parser principal: recebe o texto do dump e devolve manifestos mapeados
export function parseWasteManifestsSQL(text) {
    if (!text || !text.trim()) return [];
    const chunks = text.split(/INSERT\s+INTO\s+waste_manifests/i).slice(1);
    const recs = [];
    for (const chunk of chunks) {
        const colStart = chunk.indexOf('(');
        if (colStart < 0) continue;
        const colEnd = chunk.indexOf(')', colStart);
        if (colEnd < 0) continue;
        const cols = chunk.slice(colStart + 1, colEnd).split(',').map((c) => c.trim().replace(/["`]/g, ''));
        const vUp = chunk.toUpperCase().indexOf('VALUES', colEnd);
        if (vUp < 0) continue;
        const pStart = chunk.indexOf('(', vUp);
        if (pStart < 0) continue;
        const fields = parseValues(chunk, pStart);
        if (!fields) continue;
        const rec = {};
        cols.forEach((c, i) => { rec[c] = fields[i]; });
        const m = mapManifesto(rec);
        if (m) recs.push(m);
    }
    return recs;
}
