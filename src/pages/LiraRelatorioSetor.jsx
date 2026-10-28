import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaPrint, FaTimes } from 'react-icons/fa';
import { tituloNorma, partesObrigacao, legivel } from '../lib/liraTexto';

// ════════════════════════════════════════════════════════════════
//  LIRA — Relatório por área (folha A4 para enviar ao setor)
//  Só entra o que ainda depende da área (Conforme / Não Aplicável ficam
//  de fora), agrupado por norma e por tema, com as quatro respostas
//  possíveis já impressas para a área só marcar e escrever a prova.
//  Cores fixas de "papel": sai igual na tela, no PDF e na impressora,
//  qualquer que seja o tema do app.
// ════════════════════════════════════════════════════════════════

const PAPEL = {
    fundo: '#ffffff', fundoAlt: '#f6f7f9', faixa: '#eef1f5',
    tinta: '#16191f', media: '#454d5a', clara: '#6b7380',
    linha: '#cdd3db', suave: '#e5e8ed',
};

// Cor de cada área no papel — tons escuros, legíveis também em P&B
const COR_AREA = {
    'Manutenção': '#c2410c', 'Logística': '#0e7490', 'SESMT': '#a16207',
    'Ambiental': '#15803d', 'RH': '#7e22ce', 'Administrativo': '#1d4ed8',
};

const nm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
const RESOLVIDAS = ['CONFORME', 'NAO APLICAVEL', 'NAO SE APLICA'];
const pendente = (r) => !RESOLVIDAS.includes(nm(r.conformidade));
const ordemNatural = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });

const RESPOSTAS = [
    { rotulo: 'Atende', dica: 'onde está a prova: documento, registro ou foto, com data' },
    { rotulo: 'Atende em parte', dica: 'o que falta, quem resolve e até quando' },
    { rotulo: 'Não atende', dica: 'a ação para regularizar, o responsável e o prazo' },
    { rotulo: 'Não se aplica', dica: 'em uma linha, por quê (ex.: não temos caldeira)' },
];

function Quadrinho({ cor = PAPEL.media }) {
    return <span style={{ display: 'inline-block', width: 9, height: 9, border: `1.2px solid ${cor}`, borderRadius: 2, marginRight: 5, verticalAlign: '-1px', flexShrink: 0 }} />;
}

function RelatorioSetor({ setor, itens, emissor, onClose }) {
    const cor = COR_AREA[setor] || '#475569';
    const hoje = new Date().toLocaleDateString('pt-BR');
    const [prazo, setPrazo] = useState('');
    const [recado, setRecado] = useState('');
    const [fora, setFora] = useState(() => new Set()); // normas deixadas para outra remessa
    const prazoFmt = prazo ? prazo.split('-').reverse().join('/') : '____/____/______';
    const contato = emissor ? `${emissor}, do Meio Ambiente` : 'a equipe de Meio Ambiente';

    const pendentes = useMemo(() => itens.filter(pendente), [itens]);
    const conformes = itens.filter((r) => nm(r.conformidade) === 'CONFORME').length;
    const naoAplica = itens.length - pendentes.length - conformes;
    const pctResolvido = itens.length ? Math.round(((itens.length - pendentes.length) / itens.length) * 100) : 0;

    // Norma → temas → itens, já com o texto legível
    const normas = useMemo(() => {
        const mapa = new Map();
        for (const r of pendentes) {
            const chave = String(r.requisito ?? '').replace(/\s+/g, ' ').trim() || 'Norma não informada';
            if (!mapa.has(chave)) {
                const t = tituloNorma(chave);
                mapa.set(chave, { chave, ...t, rotulo: t.sigla ? `${t.sigla} · ${t.nome}` : t.nome, sumario: legivel(r.sumario), itens: [] });
            }
            mapa.get(chave).itens.push({ r, p: partesObrigacao(r.obrigacao) });
        }
        return [...mapa.values()]
            .sort((a, b) => ordemNatural(`${a.rotulo} ${a.versao}`, `${b.rotulo} ${b.versao}`))
            .map((n) => {
                n.itens.sort((x, y) => ordemNatural(x.p.ref || '~', y.p.ref || '~') || x.r.id - y.r.id);
                const temas = new Map();
                for (const it of n.itens) {
                    if (!temas.has(it.p.chaveTema)) temas.set(it.p.chaveTema, { nome: it.p.tema, itens: [] });
                    temas.get(it.p.chaveTema).itens.push(it);
                }
                return { ...n, temas: [...temas.values()] };
            });
    }, [pendentes]);

    const remessa = normas.filter((n) => !fora.has(n.chave));
    const qtdRemessa = remessa.reduce((s, n) => s + n.itens.length, 0);
    const alternar = (chave) => setFora((f) => { const s = new Set(f); s.has(chave) ? s.delete(chave) : s.add(chave); return s; });

    // Nome do PDF ao salvar: "LIRA – Manutenção – 28-10-2026"
    useEffect(() => {
        const antes = document.title;
        document.title = `LIRA – ${setor} – ${hoje.replace(/\//g, '-')}`;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => { document.title = antes; window.removeEventListener('keydown', onKey); };
    }, [setor, hoje, onClose]);

    const rotulo = { fontSize: '6.5pt', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: PAPEL.clara };
    const linhaEscrever = { borderBottom: `1px solid ${PAPEL.linha}`, height: 18 };
    const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9rem', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' };
    const campo = { width: '100%', padding: '0.42rem 0.6rem', borderRadius: 8, border: `1px solid ${PAPEL.linha}`, background: '#fff', color: PAPEL.tinta, fontSize: '0.8rem', fontFamily: 'inherit' };

    // Renderizado direto no <body> (portal): na impressão a folha precisa ficar
    // no fluxo normal do documento para paginar — dentro do app ela ficava presa
    // a um ancestral fixed/overflow e só saía a primeira página.
    return createPortal(
        <div className="lira-rel-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,14,0.82)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}>
            <style>{`
                /* Barra fixa no topo só em tela larga; no celular ela comeria metade da folha */
                .lira-rel-barra { position: sticky; }
                @media (max-width: 640px) { .lira-rel-barra { position: static; } }
                @media print {
                    @page { size: A4 portrait; margin: 12mm 11mm 14mm; }
                    html, body {
                        background: #fff !important; margin: 0 !important; padding: 0 !important;
                        display: block !important; height: auto !important; min-height: 0 !important;
                        overflow: visible !important;
                    }
                    /* Só a folha vai para a impressora; o app sai do fluxo por completo */
                    body > *:not(.lira-rel-overlay) { display: none !important; }
                    /* index.css esconde tudo com "body * { visibility: hidden }" — reativa a folha */
                    .lira-rel-overlay, .lira-rel-overlay * { visibility: visible !important; }
                    .lira-rel-overlay {
                        position: static !important; inset: auto !important; display: block !important;
                        padding: 0 !important; background: #fff !important; backdrop-filter: none !important;
                        overflow: visible !important; z-index: auto !important;
                    }
                    .lira-rel-setor {
                        max-width: none !important; width: 100% !important; max-height: none !important;
                        overflow: visible !important; background: #fff !important; border: none !important;
                        box-shadow: none !important; border-radius: 0 !important;
                    }
                    .lira-rel-setor, .lira-rel-setor * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .lira-rel-setor .no-print { display: none !important; }
                    .lira-rel-setor .folha { padding: 0 !important; }
                    .lira-rel-setor .bloco, .lira-rel-setor .item { break-inside: avoid; page-break-inside: avoid; }
                    .lira-rel-setor .cab-secao, .lira-rel-setor .cab-tema { break-after: avoid; page-break-after: avoid; }
                }
            `}</style>

            <div className="lira-rel-setor" onClick={(e) => e.stopPropagation()} style={{ background: PAPEL.fundo, color: PAPEL.tinta, borderRadius: 10, maxWidth: 880, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

                {/* ── Barra de montagem — não sai na impressão ── */}
                <div className="no-print lira-rel-barra" style={{ padding: '0.85rem 1rem', background: PAPEL.fundoAlt, borderBottom: `1px solid ${PAPEL.linha}`, borderRadius: '10px 10px 0 0', top: 0, zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.7rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 140px', maxWidth: 180 }}>
                            <div style={{ ...rotulo, marginBottom: 3 }}>Devolver até</div>
                            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={campo} />
                        </div>
                        <div style={{ flex: '3 1 220px' }}>
                            <div style={{ ...rotulo, marginBottom: 3 }}>Recado para a área (opcional)</div>
                            <input value={recado} onChange={(e) => setRecado(e.target.value)} placeholder="Ex.: comecem pela NR 13, a auditoria é em dezembro" style={campo} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                            <button onClick={() => window.print()} disabled={!qtdRemessa} style={{ ...btn, background: cor, color: '#fff', opacity: qtdRemessa ? 1 : 0.5 }}><FaPrint size={12} /> Imprimir / PDF</button>
                            <button onClick={onClose} title="Fechar (Esc)" style={{ ...btn, background: '#e3e7ed', color: PAPEL.media, padding: '0.5rem 0.65rem' }}><FaTimes size={13} /></button>
                        </div>
                    </div>
                    {normas.length > 1 && (
                        <div style={{ marginTop: '0.7rem' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: 5 }}>
                                <span style={rotulo}>Normas nesta remessa · {qtdRemessa} de {pendentes.length} itens</span>
                                <button onClick={() => setFora(new Set())} style={{ background: 'none', border: 'none', color: cor, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>todas</button>
                                <button onClick={() => setFora(new Set(normas.map((n) => n.chave)))} style={{ background: 'none', border: 'none', color: PAPEL.clara, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>nenhuma</button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {normas.map((n) => {
                                    const dentro = !fora.has(n.chave);
                                    return (
                                        <button key={n.chave} onClick={() => alternar(n.chave)} title={n.rotulo} style={{
                                            fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 14, cursor: 'pointer', maxWidth: 260,
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            border: `1px solid ${dentro ? cor : PAPEL.linha}`, background: dentro ? `${cor}14` : '#fff', color: dentro ? PAPEL.tinta : PAPEL.clara,
                                        }}>
                                            {n.sigla || n.nome.replace(/,\s*de\s+\d.*$/i, '')}{n.versao ? ` (${n.versao})` : ''} · {n.itens.length}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ Folha A4 ═══ */}
                <div className="folha" style={{ padding: '1.6rem 1.8rem 2rem' }}>

                    {/* Cabeçalho */}
                    <div className="bloco" style={{ borderLeft: `4px solid ${cor}`, paddingLeft: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <span style={rotulo}>Grupo MK · Meio Ambiente · Requisitos legais</span>
                            <span style={rotulo}>Emitido em {hoje}</span>
                        </div>
                        <div style={{ fontSize: '17pt', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.15, marginTop: 6 }}>
                            Requisitos legais · <span style={{ color: cor }}>{setor}</span>
                        </div>
                        <p style={{ fontSize: '9.5pt', color: PAPEL.media, lineHeight: 1.55, margin: '0.5rem 0 0', maxWidth: 640 }}>
                            Olá, equipe de {setor}. Aqui estão as obrigações legais que dependem da área de vocês e que ainda não têm
                            comprovação registrada. Com as respostas, a empresa chega preparada às auditorias e fiscalizações.
                        </p>
                    </div>

                    {/* Onde a área está */}
                    <div className="bloco" style={{ marginTop: '1.1rem', border: `1px solid ${PAPEL.suave}`, borderRadius: 8, padding: '0.8rem 0.95rem', background: PAPEL.fundoAlt }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.8rem' }}>
                            <div>
                                <div style={rotulo}>Itens da área</div>
                                <div style={{ fontSize: '18pt', fontWeight: 800, lineHeight: 1.1 }}>{itens.length}</div>
                            </div>
                            <div>
                                <div style={rotulo}>Já resolvidos</div>
                                <div style={{ fontSize: '18pt', fontWeight: 800, lineHeight: 1.1, color: '#15803d' }}>{itens.length - pendentes.length}</div>
                                <div style={{ fontSize: '7pt', color: PAPEL.clara }}>{conformes} comprovados · {naoAplica} não se aplicam</div>
                            </div>
                            <div>
                                <div style={rotulo}>Faltam</div>
                                <div style={{ fontSize: '18pt', fontWeight: 800, lineHeight: 1.1, color: cor }}>{pendentes.length}</div>
                                <div style={{ fontSize: '7pt', color: PAPEL.clara }}>em {normas.length} {normas.length === 1 ? 'norma' : 'normas'}</div>
                            </div>
                        </div>
                        <div style={{ marginTop: '0.7rem', height: 7, borderRadius: 4, background: PAPEL.suave, overflow: 'hidden' }}>
                            <div style={{ width: `${pctResolvido}%`, height: '100%', background: '#15803d' }} />
                        </div>
                        <div style={{ fontSize: '7.5pt', color: PAPEL.media, marginTop: 4 }}>
                            {pctResolvido}% da área já está resolvida.
                            {qtdRemessa < pendentes.length && <> Esta remessa traz <strong>{qtdRemessa} itens</strong>; o restante vai em outra etapa.</>}
                        </div>
                    </div>

                    {recado && (
                        <div className="bloco" style={{ marginTop: '0.85rem', fontSize: '9pt', lineHeight: 1.5, padding: '0.6rem 0.8rem', border: `1px solid ${PAPEL.linha}`, borderLeft: `3px solid ${cor}`, borderRadius: 4 }}>
                            <strong>Recado do Meio Ambiente:</strong> {recado}
                        </div>
                    )}

                    {/* Como responder */}
                    <div className="bloco" style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '10.5pt', fontWeight: 700, marginBottom: '0.45rem' }}>Como responder</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.45rem' }}>
                            {RESPOSTAS.map((o) => (
                                <div key={o.rotulo} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '8pt', lineHeight: 1.45, padding: '0.45rem 0.6rem', border: `1px solid ${PAPEL.suave}`, borderRadius: 6 }}>
                                    <Quadrinho />
                                    <span><strong>{o.rotulo}:</strong> {o.dica}.</span>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '8pt', color: PAPEL.media, lineHeight: 1.5, margin: '0.5rem 0 0' }}>
                            Em cada item, marque uma opção e escreva na linha a prova ou o próximo passo. Se um tema inteiro não existe na área
                            (por exemplo, radiação ionizante), marque o quadrinho do tema e pule os itens dele.
                            Devolver até <strong>{prazoFmt}</strong> para {contato}. Dúvidas, é só chamar.
                        </p>
                    </div>

                    {/* Índice da remessa */}
                    {remessa.length > 1 && (
                        <div className="bloco" style={{ marginTop: '1rem' }}>
                            <div style={{ fontSize: '10.5pt', fontWeight: 700, marginBottom: '0.35rem' }}>O que tem nesta remessa</div>
                            {remessa.map((n, i) => (
                                <div key={n.chave} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '8.5pt', padding: '3px 0', borderBottom: `1px dotted ${PAPEL.linha}` }}>
                                    <span style={{ width: 16, color: cor, fontWeight: 800 }}>{i + 1}</span>
                                    <span style={{ flex: 1 }}>{n.rotulo}{n.versao && <span style={{ color: PAPEL.clara }}> ({n.versao})</span>}</span>
                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{n.itens.length} {n.itens.length === 1 ? 'item' : 'itens'}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Normas */}
                    {remessa.map((n, i) => (
                        <section key={n.chave} style={{ marginTop: '1.4rem' }}>
                            <div className="cab-secao" style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', borderTop: `2px solid ${cor}`, paddingTop: '0.55rem' }}>
                                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: cor, color: '#fff', fontSize: '9pt', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11pt', fontWeight: 800, lineHeight: 1.25 }}>
                                            {n.rotulo}{n.versao && <span style={{ fontWeight: 600, color: PAPEL.clara }}> ({n.versao})</span>}
                                        </span>
                                        <span style={{ fontSize: '8pt', fontWeight: 700, color: cor, whiteSpace: 'nowrap' }}>{n.itens.length} {n.itens.length === 1 ? 'item' : 'itens'}</span>
                                    </div>
                                    {n.sumario && <div style={{ fontSize: '8pt', color: PAPEL.media, lineHeight: 1.45, marginTop: 3 }}><strong>Do que se trata:</strong> {n.sumario}</div>}
                                </div>
                            </div>

                            {n.temas.map((t, ti) => (
                                <div key={ti}>
                                    {(t.nome || n.temas.length > 1) && (
                                        <div className="cab-tema" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.8rem 0 0.2rem', padding: '0.35rem 0.6rem', background: PAPEL.faixa, borderRadius: 4 }}>
                                            <span style={{ fontSize: '8.5pt', fontWeight: 700 }}>{t.nome || 'Geral'} <span style={{ fontWeight: 500, color: PAPEL.clara }}>· {t.itens.length} {t.itens.length === 1 ? 'item' : 'itens'}</span></span>
                                            {t.itens.length > 1 && <span style={{ fontSize: '7.5pt', color: PAPEL.media, display: 'flex', alignItems: 'center' }}><Quadrinho />Não temos isso na área — vale para os {t.itens.length} itens</span>}
                                        </div>
                                    )}
                                    {t.itens.map(({ r, p }, k) => {
                                        const num = `${i + 1}.${n.temas.slice(0, ti).reduce((s, x) => s + x.itens.length, 0) + k + 1}`;
                                        return (
                                            <div key={r.id} className="item" style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: '0.4rem', padding: '0.5rem 0 0.4rem', borderBottom: `1px solid ${PAPEL.suave}` }}>
                                                <span style={{ fontSize: '8pt', fontWeight: 800, color: cor, paddingTop: 1 }}>{num}</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '9pt', lineHeight: 1.45 }}>{p.pergunta}</div>
                                                    {p.nota && <div style={{ fontSize: '7.5pt', color: PAPEL.clara, lineHeight: 1.45, marginTop: 2 }}>Nota: {p.nota}</div>}
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', alignItems: 'center', marginTop: 5, fontSize: '8pt', color: PAPEL.media }}>
                                                        {RESPOSTAS.map((o) => <span key={o.rotulo} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}><Quadrinho />{o.rotulo}</span>)}
                                                        <span style={{ marginLeft: 'auto', fontSize: '6.5pt', color: PAPEL.clara, whiteSpace: 'nowrap' }}>{p.ref ? `${p.ref} · ` : ''}nº {r.id} no SGA</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 4 }}>
                                                        <span style={{ fontSize: '7pt', color: PAPEL.clara, whiteSpace: 'nowrap', paddingBottom: 2 }}>Prova ou próximo passo:</span>
                                                        <div style={{ ...linhaEscrever, flex: 1 }} />
                                                    </div>
                                                    <div style={linhaEscrever} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </section>
                    ))}

                    {pendentes.length === 0 && (
                        <div className="bloco" style={{ marginTop: '1.2rem', padding: '1.2rem', textAlign: 'center', border: '1px solid #bfe5cb', background: '#eefaf1', borderRadius: 8, fontSize: '10pt', color: '#15803d', fontWeight: 600 }}>
                            Tudo em dia: nenhuma obrigação pendente para {setor}. Obrigado!
                        </div>
                    )}

                    {/* Encerramento */}
                    <div className="bloco" style={{ marginTop: '1.8rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem 2rem', marginTop: '1.6rem' }}>
                            <div style={{ borderTop: `1px solid ${PAPEL.media}`, paddingTop: 4, ...rotulo }}>Respondido por — nome, cargo e data</div>
                            <div style={{ borderTop: `1px solid ${PAPEL.media}`, paddingTop: 4, ...rotulo }}>Recebido pelo Meio Ambiente — data</div>
                        </div>
                        <div style={{ marginTop: '1.2rem', paddingTop: '0.5rem', borderTop: `1px solid ${PAPEL.suave}`, display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', ...rotulo, fontWeight: 600 }}>
                            <span>Grupo MK · SGA · LIRA por área</span>
                            <span>{setor} · {qtdRemessa} {qtdRemessa === 1 ? 'item' : 'itens'} · {hoje}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default RelatorioSetor;
