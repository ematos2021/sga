import { useState } from 'react';
import {
    FaSmog, FaPlus, FaTrash, FaFileExcel, FaCheckCircle, FaExclamationTriangle,
    FaEdit, FaEye, FaPrint, FaArrowLeft, FaMagic, FaFileAlt,
} from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, DataTable, Kpi, RowAction } from '../components/ui';
import { InfoTip, ExplicaBox, GlossarioModal } from '../components/didatico';
import { FaBookOpen } from 'react-icons/fa';
import { useCollection, uid, COL } from '../lib/store';
import { FASES_MEDICAO, PADROES_APURADOS, INJECAO_TIPOS, apuradoInfo, pctToGrau, FR658_DEFAULTS } from '../lib/constants';
import { exportToExcel } from '../lib/excel';

const brDate = (d) => (d ? d.split('-').reverse().join('/') : '—');

// ─── Helpers de relatório ───
function novaRodada(geradores, hora = '', fase = 'Ignição') {
    return {
        id: uid(), hora, fase,
        medicoes: geradores.map((g) => ({ gerador: g.tag, injecao: g.injecao || 'Eletrônica', apurado: 0 })),
    };
}
function relatorioVazio(geradores) {
    const hoje = new Date().toISOString().slice(0, 10);
    const agora = new Date().toTimeString().slice(0, 5);
    return {
        ...FR658_DEFAULTS,
        data: hoje, hora: agora,
        elaboradores: [],
        rounds: geradores.length ? [novaRodada(geradores, agora, 'Ignição')] : [],
        parecer: '', elaborador: '', status: 'Rascunho',
    };
}
function naoConformesDoRelatorio(rel) {
    let n = 0;
    (rel.rounds || []).forEach((r) => r.medicoes.forEach((m) => { if (apuradoInfo(m.apurado).conforme === false) n++; }));
    return n;
}

function FumacaPretaView({ onBack }) {
    const { items, add, update, remove } = useCollection(COL.FUMACA);
    const { items: geradores } = useCollection(COL.GERADORES);
    const [mode, setMode] = useState('list'); // list | edit | view
    const [current, setCurrent] = useState(null);
    const [showGlossario, setShowGlossario] = useState(false);

    const abrirNovo = () => { setCurrent(relatorioVazio(geradores)); setMode('edit'); };
    const editar = (rel) => { setCurrent(rel); setMode('edit'); };
    const visualizar = (rel) => { setCurrent(rel); setMode('view'); };

    const salvar = (rel) => {
        if (rel.id) update(rel.id, rel); else add(rel);
        setMode('list'); setCurrent(null);
    };

    if (mode === 'edit') {
        return <RelatorioEditor inicial={current} geradores={geradores} onCancel={() => setMode('list')} onSave={salvar} />;
    }
    if (mode === 'view') {
        return <RelatorioView rel={current} onBack={() => setMode('list')} onEdit={() => setMode('edit')} />;
    }

    // ─── LISTA ───
    const totalRelatorios = items.length;
    const totalNaoConf = items.reduce((s, r) => s + naoConformesDoRelatorio(r), 0);
    const ultimo = items[0];

    const columns = [
        { key: 'numeroFR', label: 'Relatório', render: (r) => <strong>{r.numeroFR || 'FR 658'}</strong> },
        { key: 'data', label: 'Data', render: (r) => `${brDate(r.data)}${r.hora ? ' ' + r.hora : ''}` },
        { key: 'rounds', label: 'Rodadas', align: 'center', render: (r) => (r.rounds || []).length },
        { key: 'elaborador', label: 'Elaborador', render: (r) => r.elaborador || (r.elaboradores || []).join(', ') || '—' },
        {
            key: 'conf', label: 'Resultado', render: (r) => {
                const nc = naoConformesDoRelatorio(r);
                return nc === 0
                    ? <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.8rem' }}><FaCheckCircle size={12} /> Conforme</span>
                    : <span style={{ color: '#ff4757', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.8rem' }}><FaExclamationTriangle size={12} /> {nc} não conforme(s)</span>;
            },
        },
        {
            key: 'acoes', label: '', align: 'right', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <RowAction icon={<FaEye size={13} />} color="#00ccff" title="Visualizar / Imprimir" onClick={() => visualizar(r)} />
                    <RowAction icon={<FaEdit size={13} />} title="Editar" onClick={() => editar(r)} />
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir relatório?') && remove(r.id)} />
                </div>
            ),
        },
    ];

    return (
        <PageShell
            icon={<FaSmog size={20} />} color="#a78bfa"
            title="Medição de Fumaça Preta — Geradores"
            subtitle="Relatório FR 658 · Escala Ringelmann Reduzida · NBR ISO 14001"
            onBack={onBack}
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={() => setShowGlossario(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaBookOpen size={10} /> Glossário</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={abrirNovo} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaPlus size={10} /> Novo Relatório</Btn>
            </>}
        >
            <ExplicaBox titulo="Como funciona a medição de fumaça preta" color="#a78bfa">
                <p style={{ margin: '0 0 0.5rem' }}>
                    Mede-se a <strong>opacidade da fumaça</strong> dos geradores a diesel comparando-a visualmente com a
                    {' '}<InfoTip title="Escala de Ringelmann" color="#a78bfa">Cartela com padrões de cinza de 0% a 100% de enegrecimento (graus 0 a 5). Quanto mais escura a fumaça, maior a concentração de fuligem.</InfoTip> <strong>Escala de Ringelmann</strong>.
                    A cartela é segurada a ~30 m do escapamento, contra fundo claro, e registra-se o padrão mais parecido.
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    <li><strong>Fases:</strong> mede-se na <strong>Ignição</strong> (partida do motor) e em <strong>Carga</strong> (operação normal).</li>
                    <li><strong>Limite legal:</strong> até <strong>40% (grau 2)</strong> é tolerado; acima disso há não conformidade ambiental.</li>
                    <li><strong>Norma:</strong> ABNT NBR 6016 e Portaria IBAMA 85/1996.</li>
                </ul>
            </ExplicaBox>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Kpi icon={<FaFileAlt size={15} />} label="Relatórios" value={totalRelatorios} color="#a78bfa" />
                <Kpi icon={<FaExclamationTriangle size={15} />} label="Não conformidades" value={totalNaoConf} sub="acima de 40% (grau 2)" color={totalNaoConf ? '#ff4757' : '#10b981'} />
                <Kpi icon={<FaSmog size={15} />} label="Último relatório" value={ultimo ? brDate(ultimo.data) : '—'} sub={ultimo ? `${(ultimo.rounds || []).length} rodada(s)` : ''} color="#00ccff" />
            </div>

            <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.95rem', color: 'var(--color-text-main)' }}>Relatórios Emitidos</h3>
            <DataTable columns={columns} rows={items} empty="Nenhum relatório. Clique em “Novo Relatório”." />

            {showGlossario && <GlossarioModal onClose={() => setShowGlossario(false)} />}
        </PageShell>
    );
}

// ════════════════════════════════════════════════════════════════
//  EDITOR
// ════════════════════════════════════════════════════════════════
function RelatorioEditor({ inicial, geradores, onCancel, onSave }) {
    const [rel, setRel] = useState(() => ({ ...inicial }));
    const set = (k, v) => setRel((r) => ({ ...r, [k]: v }));
    const elaboradoresStr = (rel.elaboradores || []).join(', ');

    const addRodada = () => set('rounds', [...(rel.rounds || []), novaRodada(geradores, new Date().toTimeString().slice(0, 5), 'Carga')]);
    const removeRodada = (rid) => set('rounds', rel.rounds.filter((r) => r.id !== rid));
    const setRodada = (rid, patch) => set('rounds', rel.rounds.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
    const setMedicao = (rid, idx, apurado) => set('rounds', rel.rounds.map((r) => {
        if (r.id !== rid) return r;
        const medicoes = r.medicoes.map((m, i) => (i === idx ? { ...m, apurado: Number(apurado) } : m));
        return { ...r, medicoes };
    }));

    const sugerirParecer = () => {
        const problemas = [];
        (rel.rounds || []).forEach((r) => r.medicoes.forEach((m) => {
            if (apuradoInfo(m.apurado).conforme === false) problemas.push(`${m.gerador} (${m.apurado}% na fase ${r.fase}, ${r.hora || 's/ hora'})`);
        }));
        const txt = problemas.length
            ? `Foi verificado que ${problemas.join('; ')} apresentou(aram) nível de fumaça acima do limite (40%), segundo a Escala Ringelmann. Recomenda-se manutenção corretiva nos geradores indicados.`
            : 'Todos os geradores avaliados apresentaram emissão de fumaça preta dentro do limite legal (≤ 40% / grau 2), segundo a Escala Ringelmann. Nenhuma não conformidade identificada.';
        set('parecer', txt);
    };

    return (
        <PageShell
            icon={<FaSmog size={20} />} color="#a78bfa"
            title={inicial.id ? 'Editar Relatório de Fumaça Preta' : 'Novo Relatório de Fumaça Preta'}
            subtitle="FR 658 · preencha conforme o procedimento"
            onBack={onCancel}
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={onCancel} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaArrowLeft size={10} /> Cancelar</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={() => onSave({ ...rel, status: 'Concluído' })} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>Salvar Relatório</Btn>
            </>}
        >
            {/* Cabeçalho */}
            <Card style={{ marginBottom: '1.2rem' }}>
                <SecTitle>1. Cabeçalho do Relatório</SecTitle>
                <FormGrid cols={4}>
                    <Field label="Nº FR"><Input value={rel.numeroFR} onChange={(e) => set('numeroFR', e.target.value)} /></Field>
                    <Field label="Revisão"><Input value={rel.revisao} onChange={(e) => set('revisao', e.target.value)} /></Field>
                    <Field label="Data" required><Input type="date" value={rel.data} onChange={(e) => set('data', e.target.value)} /></Field>
                    <Field label="Hora"><Input type="time" value={rel.hora} onChange={(e) => set('hora', e.target.value)} /></Field>
                    <Field label="Empresa"><Input value={rel.empresa} onChange={(e) => set('empresa', e.target.value)} /></Field>
                    <Field label="Elaboração (separar por vírgula)" span={3}>
                        <Input value={elaboradoresStr} onChange={(e) => set('elaboradores', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="Nome 1, Nome 2" />
                    </Field>
                    <Field label="Referência normativa" span={2}><Textarea rows={3} value={rel.referenciaNormativa} onChange={(e) => set('referenciaNormativa', e.target.value)} /></Field>
                    <Field label="Método"><Input value={rel.metodo} onChange={(e) => set('metodo', e.target.value)} /></Field>
                    <Field label="Fonte"><Input value={rel.fonte} onChange={(e) => set('fonte', e.target.value)} /></Field>
                    <Field label="Descrição do método" span={4}><Textarea rows={4} value={rel.descricaoMetodo} onChange={(e) => set('descricaoMetodo', e.target.value)} /></Field>
                </FormGrid>
            </Card>

            {/* Rodadas */}
            <Card style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <SecTitle style={{ margin: 0 }}>2. Rodadas de Medição</SecTitle>
                    <Btn variant="outline" color="#a78bfa" onClick={addRodada}><FaPlus size={11} /> Adicionar rodada</Btn>
                </div>
                {geradores.length === 0 && (
                    <div style={{ color: '#ffb700', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                        Cadastre os geradores em <strong>Cadastros → Geradores</strong> antes de medir.
                    </div>
                )}
                {(rel.rounds || []).length === 0 && geradores.length > 0 && (
                    <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.82rem' }}>Nenhuma rodada. Clique em “Adicionar rodada”.</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(rel.rounds || []).map((r, ri) => (
                        <div key={r.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa' }}>Rodada {ri + 1}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>Hora</span>
                                    <Input type="time" value={r.hora} onChange={(e) => setRodada(r.id, { hora: e.target.value })} style={{ width: 120 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>Fase</span>
                                    <Select value={r.fase} onChange={(e) => setRodada(r.id, { fase: e.target.value })} style={{ width: 140 }}>
                                        {FASES_MEDICAO.map((f) => <option key={f}>{f}</option>)}
                                    </Select>
                                </div>
                                <button onClick={() => removeRodada(r.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <FaTrash size={11} /> remover
                                </button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Fonte</th>
                                            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Injeção</th>
                                            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Padrão apurado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {r.medicoes.map((m, idx) => {
                                            const info = apuradoInfo(m.apurado);
                                            return (
                                                <tr key={idx} style={{ borderTop: '1px solid var(--border-color-soft)' }}>
                                                    <td style={{ padding: '0.3rem 0.5rem', color: 'var(--color-text-main)' }}>{m.gerador}</td>
                                                    <td style={{ padding: '0.3rem 0.5rem', color: 'var(--color-text-muted)' }}>{m.injecao}</td>
                                                    <td style={{ padding: '0.3rem 0.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <Select value={m.apurado} onChange={(e) => setMedicao(r.id, idx, e.target.value)} style={{ width: 110 }}>
                                                                {PADROES_APURADOS.map((p) => <option key={p} value={p}>{p}% (Nº{pctToGrau(p)})</option>)}
                                                            </Select>
                                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: info.color }} title={info.label} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Parecer + assinatura */}
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <SecTitle style={{ margin: 0 }}>3. Parecer e Assinatura</SecTitle>
                    <Btn variant="outline" color="#00ccff" onClick={sugerirParecer}><FaMagic size={11} /> Sugerir parecer</Btn>
                </div>
                <div style={{ marginTop: '0.8rem' }}>
                    <Field label="Parecer técnico"><Textarea rows={4} value={rel.parecer} onChange={(e) => set('parecer', e.target.value)} /></Field>
                </div>
                <FormGrid cols={2}>
                    <Field label="Elaborador (assinatura)"><Input value={rel.elaborador} onChange={(e) => set('elaborador', e.target.value)} placeholder="Nome de quem assina" /></Field>
                    <Field label="Cargo / função"><Input value={rel.cargoElaborador} onChange={(e) => set('cargoElaborador', e.target.value)} /></Field>
                </FormGrid>
            </Card>
        </PageShell>
    );
}

const SecTitle = ({ children, style }) => (
    <h3 style={{ margin: '0 0 1rem', fontSize: '0.92rem', color: 'var(--color-text-main)', ...style }}>{children}</h3>
);

// ════════════════════════════════════════════════════════════════
//  VISUALIZAÇÃO / IMPRESSÃO  (layout do FR 658)
// ════════════════════════════════════════════════════════════════
function RelatorioView({ rel, onBack, onEdit }) {
    const exportar = () => {
        const rows = [];
        (rel.rounds || []).forEach((r) => r.medicoes.forEach((m) => rows.push({
            'Fonte': m.gerador, 'Injeção': m.injecao, 'Hora': r.hora, 'Fase': r.fase,
            'Padrão Apurado': `${m.apurado}%`, 'Resultado': apuradoInfo(m.apurado).label,
        })));
        exportToExcel(rows, `relatorio_fumaca_${rel.data || ''}`, 'Fumaça Preta');
    };

    return (
        <PageShell
            icon={<FaEye size={20} />} color="#00ccff"
            title="Visualização do Relatório" subtitle={`${rel.numeroFR} · ${brDate(rel.data)}`}
            onBack={onBack}
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={onEdit} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaEdit size={10} /> Editar</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={10} /> Excel</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={() => window.print()} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaPrint size={10} /> Imprimir / PDF</Btn>
            </>}
        >
            <RelatorioDocumento rel={rel} />
        </PageShell>
    );
}

// Documento estilo papel (branco), pronto para impressão
function RelatorioDocumento({ rel }) {
    const td = { border: '1px solid #333', padding: '5px 8px', fontSize: '12px' };
    const th = { ...td, background: '#d9d9d9', fontWeight: 700, textAlign: 'center' };

    return (
        <div className="print-area" style={{
            background: '#fff', color: '#000', maxWidth: 820, margin: '0 auto', padding: '28px 34px',
            borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.25)', fontFamily: 'Inter, Arial, sans-serif',
        }}>
            {/* Cabeçalho */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                    <tr>
                        <td style={{ ...td, width: 150, textAlign: 'center', fontWeight: 800, fontSize: 18 }}>{rel.empresa || 'Grupo MK'}</td>
                        <td style={{ ...td, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>RELATÓRIO DE MEDIÇÃO DA FUMAÇA PRETA EMITIDA PELOS GERADORES</td>
                        <td style={{ ...td, width: 130, textAlign: 'center', fontSize: 11 }}>{rel.numeroFR}<br />Rev: {rel.revisao}<br />{rel.revData}</td>
                    </tr>
                </tbody>
            </table>

            {/* Metadados */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
                <tbody>
                    <tr>
                        <td style={{ ...td, width: '25%' }}><b>ELABORAÇÃO:</b><br />{(rel.elaboradores || []).join(', ') || rel.elaborador || '—'}</td>
                        <td style={{ ...td, width: '25%' }}><b>DATA / HORA:</b><br />{brDate(rel.data)}{rel.hora ? ` – ${rel.hora}` : ''}</td>
                        <td style={{ ...td, width: '50%' }} rowSpan={2}><b>REFERÊNCIA NORMATIVA:</b><br />{(rel.referenciaNormativa || '').split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</td>
                    </tr>
                    <tr>
                        <td style={td}><b>MÉTODO:</b><br />{rel.metodo}</td>
                        <td style={td}><b>FONTE:</b><br />{rel.fonte}</td>
                    </tr>
                </tbody>
            </table>

            {/* Seção 1 */}
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>1. IDENTIFICAÇÃO DOS GERADORES</h3>
            <div style={{ fontSize: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {(rel.rounds?.[0]?.medicoes || []).map((m) => (
                    <span key={m.gerador} style={{ minWidth: 130 }}>• {m.gerador} <span style={{ color: '#666' }}>({m.injecao})</span></span>
                ))}
            </div>

            {/* Seção 2 */}
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>2. MÉTODO E RECURSOS UTILIZADOS NA MEDIÇÃO</h3>
            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-line' }}>{rel.descricaoMetodo}</div>

            {/* Escala Ringelmann */}
            <div style={{ fontSize: 12, marginBottom: 16, padding: '8px 12px', border: '1px solid #999', background: '#f5f5f5', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <b style={{ width: '100%' }}>Escala de Ringelmann Reduzida</b>
                {[['Nº1', '20%', '#cfcfcf'], ['Nº2', '40%', '#9a9a9a'], ['Nº3', '60%', '#6b6b6b'], ['Nº4', '80%', '#3a3a3a'], ['Nº5', '100%', '#000']].map(([n, p, c]) => (
                    <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 16, height: 16, background: c, border: '1px solid #555', display: 'inline-block' }} /> {n} — Densidade {p}
                    </span>
                ))}
            </div>

            {/* Resultados */}
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>RESULTADOS</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
                <thead>
                    <tr><td style={{ ...th, textAlign: 'center' }} colSpan={5}>ÍNDICE DE FUMAÇA PRETA — ESCALA RINGELMANN REDUZIDA</td></tr>
                    <tr>
                        <td style={th}>FONTE</td><td style={th}>INJEÇÃO</td><td style={th}>HORA</td><td style={th}>FASE</td><td style={th}>PADRÃO APURADO</td>
                    </tr>
                </thead>
                <tbody>
                    {(rel.rounds || []).map((r) => r.medicoes.map((m, idx) => {
                        const info = apuradoInfo(m.apurado);
                        return (
                            <tr key={r.id + idx}>
                                <td style={td}>{m.gerador}</td>
                                <td style={td}>{m.injecao}</td>
                                {idx === 0 && <td style={{ ...td, textAlign: 'center' }} rowSpan={r.medicoes.length}>{r.hora || '—'}</td>}
                                {idx === 0 && <td style={{ ...td, textAlign: 'center' }} rowSpan={r.medicoes.length}>{r.fase}</td>}
                                <td style={{ ...td, textAlign: 'center', fontWeight: info.conforme === false ? 700 : 400, color: info.conforme === false ? '#b00' : '#000' }}>{m.apurado}%</td>
                            </tr>
                        );
                    }))}
                </tbody>
            </table>

            {/* Parecer */}
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>2.1 PARECER</h3>
            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 40, textAlign: 'justify' }}>{rel.parecer || '—'}</div>

            {/* Assinatura */}
            <h3 style={{ fontSize: 13, margin: '0 0 30px' }}>2.2 ASSINATURA DO ELABORADOR</h3>
            <div style={{ textAlign: 'center', fontSize: 12 }}>
                <div style={{ borderTop: '1px solid #000', width: 280, margin: '0 auto', paddingTop: 4 }}>
                    {rel.elaborador || (rel.elaboradores || [])[0] || '—'}<br />
                    <span style={{ color: '#444' }}>{rel.cargoElaborador}</span>
                </div>
            </div>
        </div>
    );
}

export default FumacaPretaView;
