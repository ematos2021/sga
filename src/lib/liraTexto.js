// ════════════════════════════════════════════════════════════════
//  LIRA — texto da base → leitura humana (relatório por setor)
//  A base vem em Title Case ("Os Dosímetros Individuais São Obtidos…"),
//  com códigos internos no início ("(MA/SSO - Classes I, II e III)") e
//  notas/itens colados na pergunta. Aqui só se troca caixa e se separa
//  as partes — nenhuma palavra é reescrita.
// ════════════════════════════════════════════════════════════════

// Siglas, unidades e nomes com grafia fixa (chave em minúsculo).
// "ART" (anotação) fica de fora de propósito: em Title Case colide com "Art." (artigo).
const CANON = Object.fromEntries([
    'NR', 'NBR', 'ABNT', 'PGR', 'PGRS', 'PGRSS', 'EPI', 'EPC', 'CNEN', 'CTF', 'AIDA', 'PBA', 'EAS', 'PRR', 'SNVS',
    'ANP', 'ANTT', 'ANA', 'CONAMA', 'CEPRAM', 'INEMA', 'AGERSA', 'CBMBA', 'CONFEA', 'CREA', 'RBC', 'RTQ', 'SPIE', 'SIS',
    'SESMT', 'CIPA', 'PCMSO', 'ASO', 'APP', 'APR', 'SPDA', 'PMOC', 'PTS', 'AVCB', 'FISPQ', 'FDS', 'LTCAT', 'MTE',
    'MTR', 'SINIR', 'CNPJ', 'GLP', 'GNV', 'CNRH', 'CONERH', 'CONTRAN', 'CONMETRO', 'MMA', 'ICMS', 'SVS', 'CFQ',
    'CFBIO', 'COFEN', 'ANTAQ', 'SFB', 'SMA', 'SSP', 'SUSEP', 'MINTER', 'ASTM', 'ISO', 'IEC', 'PIE', 'SEP',
    'Inmetro', 'Anvisa', 'Ibama', 'Anatel', 'Mondial', 'Eletrodomésticos', 'Bahia', 'Brasil',
    'kW', 'kVA', 'kPa', 'MPa', 'nº',
].map((w) => [w.toLowerCase(), w]));

// Conectivos que às vezes vêm em maiúscula nos títulos ("…, DE 31-03-2023")
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'por', 'a', 'o', 'as', 'os']);

// Algarismos romanos soltos ("Classes I, II e III", "raios X") — não há
// palavra em português com essas grafias
const ROMANO = /^(i{1,3}|iv|v|vi{1,3}|ix|x)$/i;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Texto "Title Case": maioria das palavras de 3+ letras começa em maiúscula
function emTitleCase(s) {
    const palavras = String(s).match(/\p{L}{3,}/gu) || [];
    if (palavras.length < 4) return false;
    const maiusc = palavras.filter((w) => /^\p{Lu}\p{Ll}/u.test(w)).length;
    return maiusc / palavras.length > 0.6;
}

// Troca só a caixa: início de frase em maiúscula, siglas na grafia oficial,
// o resto em minúsculo. Palavras já todas em maiúscula (NR, CONAMA) ficam —
// exceto em títulos (modo titulo), onde conectivos e palavras longas em
// maiúscula ("RESOLUÇÃO … DE") voltam ao normal.
function caixaDeFrase(s, { titulo = false } = {}) {
    let inicio = true;
    const out = String(s).replace(/\p{L}+|[.?!:]\s|\S/gu, (tok) => {
        if (/^[.?!:]\s$/.test(tok)) { inicio = true; return tok; }
        if (!/^\p{L}/u.test(tok)) return tok;
        const lw = tok.toLowerCase();
        const gritado = tok.length >= 2 && tok === tok.toUpperCase();
        let r;
        if (CANON[lw]) r = CANON[lw];
        else if (gritado && !(titulo && (CONECTIVOS.has(lw) || tok.length >= 4))) r = tok;
        else if (ROMANO.test(tok)) r = tok.toUpperCase();
        else if (inicio) r = lw.charAt(0).toUpperCase() + lw.slice(1);
        else r = lw;
        inicio = false;
        return r;
    });
    // "categoria a" / "classe b" → letra de classificação em maiúscula
    return out.replace(/\b(categoria|classe)\s+([a-e])\b/gi, (_, w, l) => `${w} ${l.toUpperCase()}`);
}

// Só mexe no que está em Title Case; frases normais passam intactas
export const legivel = (s) => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim();
    return emTitleCase(t) ? caixaDeFrase(t) : t;
};

// ── Título da norma ──
// "NR - Norma Regulamentadora nº 13 - Caldeiras… (VERSÃO 2026)"
//   → { sigla: 'NR 13', nome: 'Caldeiras…', versao: 'versão 2026' }
// "RESOLUÇÃO CONAMA Nº 08, DE 06-12-1990" → { nome: 'Resolução CONAMA nº 08, de 06-12-1990' }
export function tituloNorma(requisito) {
    const t = String(requisito ?? '').replace(/\s+/g, ' ').trim();
    let versao = '';
    const base = t.replace(/\s*\((VERS[ÃA]O[^)]*)\)\s*$/i, (_, v) => { versao = v.toLowerCase(); return ''; });
    const nr = base.match(/^NR\s*-\s*Norma Regulamentadora n[ºo°]\s*(\d+)\s*-\s*(.+)$/i);
    if (nr) return { sigla: `NR ${nr[1]}`, nome: caixaDeFrase(nr[2], { titulo: true }), versao };
    return { sigla: '', nome: caixaDeFrase(base, { titulo: true }), versao };
}

// Chave de agrupamento de tema: sem acento, sem caixa, sem plural, sem
// conectivos ("Caldeira" = "Caldeiras"; "Classes I, II e III" = "Classe I, II, III";
// "Da limpeza e conservação" = "Limpeza e conservação")
const chaveTema = (s) => norm(s).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
    .filter((w) => w && !['e', 'ou', 'do', 'da', 'dos', 'das'].includes(w))
    .map((w) => w.replace(/s$/, '')).join(' ');

// ── Obrigação → partes ──
// tema: escopo entre parênteses no início, sem o código interno (MA/SSO, ma/sst)
// pergunta: o texto principal, sem nota e sem a referência do item
// nota: o que vem depois de "Nota:" / "NOTA 1:"
// ref: "item 32.4.5.1", "art. 15° - II"
export function partesObrigacao(obrigacao) {
    let t = String(obrigacao ?? '').replace(/\s+/g, ' ').trim();

    let tema = '';
    const pre = t.match(/^\(((?:[^()]|\([^()]*\)){1,160})\)\s*/);
    if (pre) {
        t = t.slice(pre[0].length);
        tema = pre[1].replace(/^\s*ma\/ss[ot]\s*(-\s*)?/i, '').trim();
        // Tema é curto e vem em qualquer caixa: sempre vira frase
        tema = tema ? caixaDeFrase(tema.toLowerCase()) : '';
    }

    let nota = '';
    const n = t.search(/\bNOTA\s*\d*\s*:/i);
    if (n > 0) { nota = t.slice(n).replace(/^NOTA\s*\d*\s*:\s*/i, '').replace(/\s*NOTA\s*\d*\s*:\s*/gi, ' · '); t = t.slice(0, n).trim(); }

    // A referência pode vir antes ou depois do "?": "…Cnen (item 32.4.5.1)?" / "…kPa? (item 5.8.6)"
    let ref = '';
    t = t.replace(/\s*\(\s*((?:ite(?:m|ns)|art\.?|artigo|anexo|§)[^()]*)\)\s*([?.]?)\s*$/i, (_, r, p) => { ref = r.trim(); return p; });
    t = t.replace(/\s+([?.])$/, '$1');

    return { tema, chaveTema: chaveTema(tema), pergunta: legivel(t), nota: legivel(nota), ref: ref.replace(/^Item\b/, 'item').replace(/^Art\b/, 'art') };
}
