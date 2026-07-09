import { useEffect, useMemo, useState } from 'react';
import {
    FaBug, FaPlus, FaTrash, FaPrint, FaClipboardCheck, FaFileExcel,
    FaMapMarkerAlt, FaRedoAlt, FaCheckCircle, FaHourglassHalf, FaCalendarAlt,
} from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, DataTable, RowAction, Modal, Kpi } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useDedetizacao } from '../lib/dedetizacaoRepo';
import { exportToExcel } from '../lib/excel';
import FR861Print from '../components/FR861Print';

// ── Domínio ──
const PRAGAS = [
    { nome: 'Baratas / rasteiros', emoji: '🪳' },
    { nome: 'Voadores (moscas, mosquitos)', emoji: '🦟' },
    { nome: 'Formigas', emoji: '🐜' },
    { nome: 'Roedores', emoji: '🐀' },
    { nome: 'Cupins / brocas', emoji: '🪲' },
    { nome: 'Escorpiões', emoji: '🦂' },
    { nome: 'Aranhas', emoji: '🕷️' },
    { nome: 'Abelhas / vespas', emoji: '🐝' },
    { nome: 'Pombos / aves', emoji: '🐦' },
    { nome: 'Outros', emoji: '❓' },
];
const pragaEmoji = (nome) => PRAGAS.find((p) => p.nome === nome)?.emoji || '🐛';

const SITUACOES = ['Pendente', 'Em análise', 'Agendado', 'Realizado', 'Não realizado'];
const corSituacao = (s) => ({ 'Pendente': '#ffb700', 'Em análise': '#54a0ff', 'Agendado': '#a78bfa', 'Realizado': '#10b981', 'Não realizado': '#ff4757' }[s] || '#8b9bb4');

const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
const corPrioridade = (p) => ({ 'Baixa': '#54a0ff', 'Média': '#ffb700', 'Alta': '#ff9f43', 'Urgente': '#ff4757' }[p] || '#8b9bb4');

function Pill({ text, color }) {
    if (!text) return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
    return <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px', color, background: color + '1a', border: `1px solid ${color}45`, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{text}</span>;
}

const trunca = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };
const brData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const normArea = (a) => String(a || '').trim().toUpperCase();

const tooltipStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.74rem', color: 'var(--color-text-main)' };
const chartTitle = { margin: '0 0 0.6rem', fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 };

const novaSolicitacao = () => ({
    solicitante: '', area_solicitante: '', empresa: '', motivo: '', tipo_praga: '',
    endereco: '', localizacao: '', descricao: '', prioridade: 'Média',
});

function DedetizacaoView({ onBack }) {
    const { items, loading, error, needsSetup, add, update, remove } = useDedetizacao();
    const { currentUser } = useAuth();
    const nomeUsuario = currentUser?.name || currentUser?.username || '';
    const podeAnalisar = currentUser?.is_admin || ['gestor', 'analista'].includes(currentUser?.role);

    // Filtros
    const [busca, setBusca] = useState('');
    const [fSituacao, setFSituacao] = useState('todos');
    const [fPraga, setFPraga] = useState('todos');
    const [fPrioridade, setFPrioridade] = useState('todos');
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    // Modais
    const [novo, setNovo] = useState(null);            // form de solicitação
    const [analise, setAnalise] = useState(null);      // { row, form }
    const [printItem, setPrintItem] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);
    const [salvando, setSalvando] = useState(false);

    // ── Reincidência: nº da ocorrência de cada solicitação dentro da mesma área ──
    const ocorrencias = useMemo(() => {
        const porArea = {};
        const idx = {};
        [...items].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).forEach((r) => {
            const a = normArea(r.area_solicitante);
            if (!a) return;
            porArea[a] = (porArea[a] || 0) + 1;
            idx[r.id] = porArea[a];
        });
        return { idx, porArea };
    }, [items]);

    const filtrados = useMemo(() => items.filter((r) => {
        if (fSituacao !== 'todos' && r.situacao !== fSituacao) return false;
        if (fPraga !== 'todos' && r.tipo_praga !== fPraga) return false;
        if (fPrioridade !== 'todos' && r.prioridade !== fPrioridade) return false;
        if (busca) {
            const alvo = `${r.solicitante} ${r.area_solicitante} ${r.empresa} ${r.motivo} ${r.tipo_praga} ${r.localizacao} ${r.descricao} ${r.situacao}`.toLowerCase();
            if (!alvo.includes(busca.toLowerCase())) return false;
        }
        return true;
    }), [items, fSituacao, fPraga, fPrioridade, busca]);

    useEffect(() => { setPage(1); }, [busca, fSituacao, fPraga, fPrioridade, pageSize]);
    const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const paginados = filtrados.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

    // ── Indicadores ──
    const stats = useMemo(() => {
        const abertas = items.filter((r) => ['Pendente', 'Em análise', 'Agendado'].includes(r.situacao)).length;
        const realizadas = items.filter((r) => r.situacao === 'Realizado').length;
        const reincidentes = Object.values(ocorrencias.porArea).filter((n) => n >= 2).length;

        const topAreas = Object.entries(ocorrencias.porArea)
            .map(([area, qtd]) => ({ area: trunca(area, 16), qtd }))
            .sort((a, b) => b.qtd - a.qtd).slice(0, 8);

        const porPragaMap = {};
        items.forEach((r) => { if (r.tipo_praga) porPragaMap[r.tipo_praga] = (porPragaMap[r.tipo_praga] || 0) + 1; });
        const porPraga = Object.entries(porPragaMap)
            .map(([nome, qtd]) => ({ praga: `${pragaEmoji(nome)} ${trunca(nome.split(' ')[0].replace('/', ''), 10)}`, nome, qtd }))
            .sort((a, b) => b.qtd - a.qtd);
        const pragaTop = porPraga[0] || null;

        // Últimos 12 meses
        const meses = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
            const chave = d.toISOString().slice(0, 7);
            meses.push({ chave, mes: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`, qtd: 0 });
        }
        items.forEach((r) => {
            const m = meses.find((x) => String(r.created_at || '').startsWith(x.chave));
            if (m) m.qtd++;
        });

        return { total: items.length, abertas, realizadas, reincidentes, topAreas, porPraga, pragaTop, meses };
    }, [items, ocorrencias]);

    const areasSugeridas = useMemo(() => [...new Set(items.map((r) => r.area_solicitante).filter(Boolean))].sort(), [items]);

    // ── Ações ──
    const abrirNovo = () => setNovo({ ...novaSolicitacao(), solicitante: nomeUsuario });

    const salvarNovo = async () => {
        const f = novo;
        if (!f.area_solicitante?.trim()) { alert('Informe a área solicitante.'); return; }
        if (!f.tipo_praga) { alert('Selecione o tipo de praga.'); return; }
        if (!f.localizacao?.trim()) { alert('Informe a localização exata do serviço.'); return; }
        setSalvando(true);
        const r = await add({ ...f, situacao: 'Pendente' });
        setSalvando(false);
        if (r) setNovo(null);
    };

    const abrirAnalise = (row) => setAnalise({
        row,
        form: {
            situacao: row.situacao || 'Pendente',
            data_agendamento: row.data_agendamento || '',
            justificativa: row.justificativa || '',
            necessidade_isolamento: row.necessidade_isolamento === true ? 'sim' : row.necessidade_isolamento === false ? 'nao' : '',
            tempo_isolamento: row.tempo_isolamento || '',
            escopo_contrato: row.escopo_contrato === true ? 'sim' : row.escopo_contrato === false ? 'nao' : '',
            tamanho_area: row.tamanho_area || '',
            parecer_empresa: row.parecer_empresa || '',
            ciencia_gestao: row.ciencia_gestao || '',
        },
    });

    const salvarAnalise = async () => {
        const { row, form: f } = analise;
        const b = (v) => (v === 'sim' ? true : v === 'nao' ? false : null);
        const patch = {
            situacao: f.situacao,
            data_agendamento: f.data_agendamento || null,
            justificativa: f.justificativa,
            necessidade_isolamento: b(f.necessidade_isolamento),
            tempo_isolamento: f.tempo_isolamento,
            escopo_contrato: b(f.escopo_contrato),
            tamanho_area: f.tamanho_area,
            parecer_empresa: f.parecer_empresa,
            ciencia_gestao: f.ciencia_gestao,
        };
        if (!row.analisado_em) { patch.analisado_em = new Date().toISOString(); patch.analisado_por = nomeUsuario; }
        if (f.situacao === 'Realizado' && !row.realizado_em) patch.realizado_em = new Date().toISOString();
        setSalvando(true);
        const r = await update(row.id, patch);
        setSalvando(false);
        if (r) setAnalise(null);
    };

    const exportar = () => {
        const fonte = filtrados.length ? filtrados : items;
        exportToExcel(fonte.map((r) => ({
            'Nº': r.id, 'Data': brData(r.created_at), 'Solicitante': r.solicitante || '', 'Área': r.area_solicitante || '',
            'Empresa': r.empresa || '', 'Praga': r.tipo_praga || '', 'Motivo': r.motivo || '', 'Localização': r.localizacao || '',
            'Descrição': r.descricao || '', 'Prioridade': r.prioridade || '', 'Situação': r.situacao || '',
            'Agendamento': brData(r.data_agendamento), 'Isolamento': r.necessidade_isolamento === true ? 'Sim' : r.necessidade_isolamento === false ? 'Não' : '',
            'Escopo contrato': r.escopo_contrato === true ? 'Sim' : r.escopo_contrato === false ? 'Não' : '',
            'Parecer': r.parecer_empresa || '', 'Analisado por': r.analisado_por || '', 'Ocorrência na área': ocorrencias.idx[r.id] || '',
        })), 'controle_pragas_dedetizacao', 'Dedetização');
    };

    const columns = [
        { key: 'id', label: 'Nº', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem' }}>{String(r.id).padStart(3, '0')}<div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem' }}>{brData(r.created_at)}</div></span> },
        { key: 'area', label: 'Área', wrap: true, render: (r) => (
            <span>
                <span style={{ fontWeight: 600 }}>{r.area_solicitante || '—'}</span>
                {(ocorrencias.idx[r.id] || 0) >= 2 && (
                    <div style={{ marginTop: 2 }}><Pill text={`↻ ${ocorrencias.idx[r.id]}ª na área`} color="#ff6b6b" /></div>
                )}
                <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem' }}>{r.solicitante || ''}{r.empresa ? ` · ${r.empresa}` : ''}</div>
            </span>
        ) },
        { key: 'praga', label: 'Praga', align: 'center', render: (r) => r.tipo_praga ? <span title={r.tipo_praga} style={{ whiteSpace: 'nowrap' }}><span style={{ fontSize: '0.95rem', marginRight: 4 }}>{pragaEmoji(r.tipo_praga)}</span>{trunca(r.tipo_praga.split(' ')[0].replace('/', ''), 10)}</span> : '—' },
        { key: 'local', label: 'Motivo / Localização', wrap: true, render: (r) => (
            <span title={`${r.motivo || ''}\n${r.localizacao || ''}\n${r.descricao || ''}`}>
                {trunca(r.motivo || '—', 46)}
                <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.64rem', display: 'flex', alignItems: 'center', gap: 3 }}><FaMapMarkerAlt size={8} />{trunca(r.localizacao || '—', 50)}</div>
            </span>
        ) },
        { key: 'agend', label: 'Agendamento', align: 'center', render: (r) => <span style={{ fontSize: '0.72rem' }}>{brData(r.data_agendamento)}</span> },
        { key: 'prioridade', label: 'Prioridade', align: 'center', render: (r) => <Pill text={r.prioridade} color={corPrioridade(r.prioridade)} /> },
        { key: 'situacao', label: 'Situação', align: 'center', render: (r) => <Pill text={r.situacao} color={corSituacao(r.situacao)} /> },
        { key: 'acoes', label: '', align: 'center', render: (r) => (
            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                {podeAnalisar && <RowAction icon={<FaClipboardCheck size={13} />} color="#ff9f43" title="Analisar / atualizar" onClick={() => abrirAnalise(r)} />}
                <RowAction icon={<FaPrint size={13} />} color="#54a0ff" title="Imprimir FR 861" onClick={() => setPrintItem(r)} />
                {podeAnalisar && <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => setConfirmDel(r)} />}
            </div>
        ) },
    ];

    const setN = (k, v) => setNovo((f) => ({ ...f, [k]: v }));
    const setA = (k, v) => setAnalise((m) => ({ ...m, form: { ...m.form, [k]: v } }));

    return (
        <PageShell
            icon={<FaBug size={20} />} color="#ff9f43"
            title="Controle de Pragas · Dedetização"
            subtitle="FR 861 · solicitações, análise e indicadores de reincidência"
            onBack={onBack}
            maxWidth="100%"
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={11} /> Exportar Excel</Btn>
                <Btn color="#ff9f43" onClick={abrirNovo} style={{ padding: '0.4rem 0.8rem', fontSize: '0.72rem' }}><FaPlus size={11} /> Solicitar dedetização</Btn>
            </>}
        >
            {needsSetup && (
                <div style={{ padding: '0.8rem 1rem', borderRadius: 10, background: '#ffb7001a', border: '1px solid #ffb70055', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    <strong>Configuração pendente:</strong> rode o script <code>database/dedetizacao.sql</code> no SQL Editor do Supabase para criar a tabela <code>dedetizacao_solicitacoes</code>.
                </div>
            )}
            {error && (
                <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: '#ff47571a', border: '1px solid #ff475755', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>
                    Falha ao carregar: {error}
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaBug size={12} />} label="Solicitações" value={stats.total} sub="registradas" color="#ff9f43" onClick={() => setFSituacao('todos')} active={fSituacao === 'todos'} />
                <Kpi icon={<FaHourglassHalf size={12} />} label="Abertas" value={stats.abertas} sub="pendente · análise · agendado" color="#ffb700" onClick={() => setFSituacao('Pendente')} active={fSituacao === 'Pendente'} />
                <Kpi icon={<FaCheckCircle size={12} />} label="Realizadas" value={stats.realizadas} sub={`${stats.total ? Math.round((stats.realizadas / stats.total) * 100) : 0}% do total`} color="#10b981" onClick={() => setFSituacao('Realizado')} active={fSituacao === 'Realizado'} />
                <Kpi icon={<FaRedoAlt size={12} />} label="Áreas reincidentes" value={stats.reincidentes} sub="2+ ocorrências" color="#ff6b6b" />
                <Kpi icon={<span style={{ fontSize: 13 }}>{stats.pragaTop ? pragaEmoji(stats.pragaTop.nome) : '🐛'}</span>} label="Praga nº 1" value={stats.pragaTop ? stats.pragaTop.qtd : 0} sub={stats.pragaTop ? trunca(stats.pragaTop.nome, 18) : 'sem registros'} color="#a78bfa" />
            </div>

            {/* Indicadores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                <Card style={{ padding: '0.9rem 1rem' }}>
                    <h3 style={chartTitle}><FaMapMarkerAlt size={11} color="#ff9f43" /> Aparições por área (top 8)</h3>
                    {stats.topAreas.length === 0 ? <SemDados /> : (
                        <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={stats.topAreas} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="area" width={108} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [`${v} solicitação${v === 1 ? '' : 'es'}`, null]} separator="" />
                                <Bar dataKey="qtd" fill="#ff9f43" radius={[0, 4, 4, 0]} maxBarSize={14} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
                <Card style={{ padding: '0.9rem 1rem' }}>
                    <h3 style={chartTitle}><FaBug size={11} color="#a78bfa" /> Por tipo de praga</h3>
                    {stats.porPraga.length === 0 ? <SemDados /> : (
                        <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={stats.porPraga} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" vertical={false} />
                                <XAxis dataKey="praga" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={44} />
                                <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, _n, p) => [`${v} — ${p?.payload?.nome || ''}`, null]} separator="" />
                                <Bar dataKey="qtd" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={22} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
                <Card style={{ padding: '0.9rem 1rem' }}>
                    <h3 style={chartTitle}><FaCalendarAlt size={11} color="#54a0ff" /> Solicitações por mês (12m)</h3>
                    <ResponsiveContainer width="100%" height={190}>
                        <BarChart data={stats.meses} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" vertical={false} />
                            <XAxis dataKey="mes" tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                            <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [`${v} solicitação${v === 1 ? '' : 'es'}`, null]} separator="" />
                            <Bar dataKey="qtd" fill="#54a0ff" radius={[4, 4, 0, 0]} maxBarSize={18} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)', marginRight: 'auto' }}>
                    Solicitações <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>({filtrados.length})</span>
                </h3>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={{ width: 180, fontSize: '0.68rem', padding: '0.3rem 0.55rem' }} />
                <Select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)} style={{ width: 130, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Situação</option>
                    {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select value={fPraga} onChange={(e) => setFPraga(e.target.value)} style={{ width: 150, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Praga</option>
                    {PRAGAS.map((p) => <option key={p.nome} value={p.nome}>{p.emoji} {p.nome}</option>)}
                </Select>
                <Select value={fPrioridade} onChange={(e) => setFPrioridade(e.target.value)} style={{ width: 118, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Prioridade</option>
                    {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: 90, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n}/pág</option>)}
                </Select>
            </div>

            <div className="dedet-tbl">
                <style>{`
                    .dedet-tbl > div { border: none !important; border-radius: 0 !important; border-top: 1px solid var(--border-color-soft) !important; }
                    .dedet-tbl table { font-size: 0.74rem !important; font-variant-numeric: tabular-nums; table-layout: fixed; width: 100%; }
                    .dedet-tbl thead th { font-size: 0.6rem !important; font-weight: 600 !important; letter-spacing: 0.7px; padding: 0.5rem 0.6rem !important; }
                    .dedet-tbl tbody td { padding: 0.5rem 0.6rem !important; line-height: 1.35; overflow: hidden; }
                    .dedet-tbl th:nth-child(1), .dedet-tbl td:nth-child(1) { width: 7%; }
                    .dedet-tbl th:nth-child(2), .dedet-tbl td:nth-child(2) { width: 18%; }
                    .dedet-tbl th:nth-child(3), .dedet-tbl td:nth-child(3) { width: 10%; text-align: center; }
                    .dedet-tbl th:nth-child(4), .dedet-tbl td:nth-child(4) { width: 30%; }
                    .dedet-tbl th:nth-child(5), .dedet-tbl td:nth-child(5) { width: 9%; text-align: center; }
                    .dedet-tbl th:nth-child(6), .dedet-tbl td:nth-child(6) { width: 8%; text-align: center; }
                    .dedet-tbl th:nth-child(7), .dedet-tbl td:nth-child(7) { width: 10%; text-align: center; }
                    .dedet-tbl th:nth-child(8), .dedet-tbl td:nth-child(8) { width: 8%; text-align: center; }
                `}</style>
                <DataTable dense columns={columns} rows={paginados} empty={loading ? 'Carregando solicitações…' : 'Nenhuma solicitação. Clique em "Solicitar dedetização".'} />
            </div>

            {filtrados.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <span>{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtrados.length)} de {filtrados.length}</span>
                    <Btn variant="outline" color="#ff9f43" onClick={() => setPage(Math.max(1, pageSafe - 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe <= 1 ? 0.4 : 1, pointerEvents: pageSafe <= 1 ? 'none' : 'auto' }}>Anterior</Btn>
                    <span>Página {pageSafe} de {totalPages}</span>
                    <Btn variant="outline" color="#ff9f43" onClick={() => setPage(Math.min(totalPages, pageSafe + 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe >= totalPages ? 0.4 : 1, pointerEvents: pageSafe >= totalPages ? 'none' : 'auto' }}>Próxima</Btn>
                </div>
            )}

            {/* ── Modal: Nova solicitação ── */}
            {novo && (
                <Modal title="🪳 Solicitar Dedetização (FR 861)" onClose={() => setNovo(null)} width={640}>
                    <FormGrid cols={2}>
                        <Field label="Solicitante" required>
                            <div className="input-dark" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>{currentUser?.avatar || '👤'}</span>
                                <input value={novo.solicitante} onChange={(e) => setN('solicitante', e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text-main)', fontSize: 'inherit', minWidth: 0 }} />
                            </div>
                        </Field>
                        <Field label="Empresa"><Input value={novo.empresa} onChange={(e) => setN('empresa', e.target.value)} placeholder="Eletrodomésticos Mondial…" /></Field>
                        <Field label="Área solicitante" required span={2}>
                            <Input value={novo.area_solicitante} onChange={(e) => setN('area_solicitante', e.target.value)} placeholder="FAB'1, G100, Almoxarifado…" />
                            {areasSugeridas.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                                    {areasSugeridas.slice(0, 8).map((a) => (
                                        <span key={a} onClick={() => setN('area_solicitante', a)} style={{ cursor: 'pointer', fontSize: '0.62rem', padding: '2px 8px', borderRadius: 20, background: 'var(--bg-surface-2)', border: '1px solid var(--border-color-soft)', color: 'var(--color-text-muted)' }}>{a}</span>
                                    ))}
                                </div>
                            )}
                        </Field>
                        <Field label="Tipo de praga" required>
                            <Select value={novo.tipo_praga} onChange={(e) => setN('tipo_praga', e.target.value)} placeholder="O que foi avistado?">
                                <option value="">O que foi avistado?</option>
                                {PRAGAS.map((p) => <option key={p.nome} value={p.nome}>{p.emoji} {p.nome}</option>)}
                            </Select>
                        </Field>
                        <Field label="Prioridade">
                            <Select value={novo.prioridade} onChange={(e) => setN('prioridade', e.target.value)}>
                                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </Select>
                        </Field>
                        <Field label="Motivo" span={2}><Input value={novo.motivo} onChange={(e) => setN('motivo', e.target.value)} placeholder="Ex.: aparição recorrente próximo ao refeitório" /></Field>
                        <Field label="Endereço"><Input value={novo.endereco} onChange={(e) => setN('endereco', e.target.value)} placeholder="Unidade / planta" /></Field>
                        <Field label="Localização exata do serviço" required><Input value={novo.localizacao} onChange={(e) => setN('localizacao', e.target.value)} placeholder="Ex.: corredor entre G100 e doca 3" /></Field>
                        <Field label="Descrição" span={2}><Textarea rows={3} value={novo.descricao} onChange={(e) => setN('descricao', e.target.value)} placeholder="Detalhe o que foi visto, quantidade, horário, há quanto tempo ocorre…" /></Field>
                    </FormGrid>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                        <Btn variant="outline" color="#8b9bb4" onClick={() => setNovo(null)}>Cancelar</Btn>
                        <Btn color="#ff9f43" onClick={salvarNovo}><FaPlus size={12} /> {salvando ? 'Enviando…' : 'Enviar solicitação'}</Btn>
                    </div>
                </Modal>
            )}

            {/* ── Modal: Análise da solicitação (operador) ── */}
            {analise && (
                <Modal title={`Análise da Solicitação · Nº ${String(analise.row.id).padStart(3, '0')}`} onClose={() => setAnalise(null)} width={720}>
                    {/* Resumo da solicitação */}
                    <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-color-soft)', borderRadius: 10, padding: '0.7rem 0.9rem', marginBottom: '1rem', fontSize: '0.76rem', lineHeight: 1.55, color: 'var(--color-text-main)' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                            <Pill text={`${pragaEmoji(analise.row.tipo_praga)} ${analise.row.tipo_praga || 'Praga não informada'}`} color="#ff9f43" />
                            <Pill text={analise.row.prioridade} color={corPrioridade(analise.row.prioridade)} />
                            {(ocorrencias.idx[analise.row.id] || 0) >= 2 && <Pill text={`↻ ${ocorrencias.idx[analise.row.id]}ª ocorrência na área`} color="#ff6b6b" />}
                        </div>
                        <strong>{analise.row.area_solicitante}</strong> · {analise.row.solicitante} · {brData(analise.row.created_at)}<br />
                        <span style={{ color: 'var(--color-text-muted)' }}>{analise.row.motivo}{analise.row.localizacao ? ` — ${analise.row.localizacao}` : ''}</span>
                        {analise.row.descricao && <div style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>{analise.row.descricao}</div>}
                    </div>

                    <FormGrid cols={2}>
                        <Field label="Situação">
                            <Select value={analise.form.situacao} onChange={(e) => setA('situacao', e.target.value)}>
                                {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </Field>
                        <Field label="Data do agendamento"><Input type="date" value={analise.form.data_agendamento} onChange={(e) => setA('data_agendamento', e.target.value)} /></Field>
                        <Field label="Necessidade de isolamento?">
                            <Select value={analise.form.necessidade_isolamento} onChange={(e) => setA('necessidade_isolamento', e.target.value)} placeholder="—">
                                <option value="">—</option>
                                <option value="sim">Sim</option>
                                <option value="nao">Não</option>
                            </Select>
                        </Field>
                        <Field label="Tempo estimado de isolamento"><Input value={analise.form.tempo_isolamento} onChange={(e) => setA('tempo_isolamento', e.target.value)} placeholder="Ex.: 4 horas" /></Field>
                        <Field label="Está no escopo do contrato?">
                            <Select value={analise.form.escopo_contrato} onChange={(e) => setA('escopo_contrato', e.target.value)} placeholder="—">
                                <option value="">—</option>
                                <option value="sim">Sim</option>
                                <option value="nao">Não</option>
                            </Select>
                        </Field>
                        <Field label="Tamanho da área para aplicação"><Input value={analise.form.tamanho_area} onChange={(e) => setA('tamanho_area', e.target.value)} placeholder="Ex.: 120 m²" /></Field>
                        <Field label="Justificativa (situação)" span={2}><Textarea rows={2} value={analise.form.justificativa} onChange={(e) => setA('justificativa', e.target.value)} placeholder="Justifique quando não realizado / reagendado…" /></Field>
                        <Field label="Parecer da empresa responsável pela aplicação" span={2}><Textarea rows={3} value={analise.form.parecer_empresa} onChange={(e) => setA('parecer_empresa', e.target.value)} placeholder="Produto aplicado, orientações de segurança, recomendações…" /></Field>
                        <Field label="Ciência do Sistema de Gestão" span={2}><Textarea rows={2} value={analise.form.ciencia_gestao} onChange={(e) => setA('ciencia_gestao', e.target.value)} placeholder="Registro de ciência / observações do SGI…" /></Field>
                    </FormGrid>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)' }}>
                            {analise.row.analisado_em ? `1ª análise: ${brData(analise.row.analisado_em)} · ${analise.row.analisado_por || '—'}` : `Análise será registrada por ${nomeUsuario}`}
                        </span>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <Btn variant="outline" color="#8b9bb4" onClick={() => setAnalise(null)}>Cancelar</Btn>
                            <Btn color="#ff9f43" onClick={salvarAnalise}><FaClipboardCheck size={12} /> {salvando ? 'Salvando…' : 'Salvar análise'}</Btn>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Impressão FR 861 */}
            {printItem && <FR861Print data={printItem} onClose={() => setPrintItem(null)} />}

            {/* Confirmação de exclusão */}
            {confirmDel && (
                <div onClick={() => setConfirmDel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.6rem', textAlign: 'center' }}>
                        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#ff47571a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}><FaTrash size={22} color="#ff4757" /></div>
                        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Excluir solicitação?</h3>
                        <p style={{ margin: '0 0 1.4rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            A solicitação <strong style={{ color: 'var(--color-text-main)' }}>Nº {String(confirmDel.id).padStart(3, '0')}</strong> ({confirmDel.area_solicitante || 'sem área'}) será removida permanentemente.
                        </p>
                        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                            <Btn variant="outline" color="#8b9bb4" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
                            <Btn color="#ff4757" onClick={() => { remove(confirmDel.id); setConfirmDel(null); }}><FaTrash size={12} /> Excluir</Btn>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}

function SemDados() {
    return <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-subtle)', fontSize: '0.78rem' }}>Sem dados ainda — registre a primeira solicitação.</div>;
}

export default DedetizacaoView;
