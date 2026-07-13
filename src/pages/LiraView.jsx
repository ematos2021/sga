import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaBalanceScale, FaClipboardCheck, FaEdit, FaFileExcel, FaHourglassHalf, FaCheckCircle, FaCalendarCheck, FaBullseye, FaForward, FaChartBar, FaPrint, FaTimes } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, DataTable, RowAction, Modal, Kpi } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLira, foiAnalisado } from '../lib/liraRepo';
import { exportToExcel } from '../lib/excel';

// Meta mínima de análises por dia (combinado com a analista)
const META_DIA = 5;

const CONF_OPCOES = ['Conforme', 'Não Conforme', 'Parcialmente Conforme', 'Não Aplicável', 'Em Adequação'];

const MESES_OPCOES = [
    { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' }, { v: '04', l: 'Abril' },
    { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' }, { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' },
    { v: '09', l: 'Setembro' }, { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
];

// ── Setores responsáveis ──
export const SETORES = [
    { nome: 'Manutenção', emoji: '🔧', cor: '#ff9f43' },
    { nome: 'Logística', emoji: '🚚', cor: '#06b6d4' },
    { nome: 'SESMT', emoji: '🦺', cor: '#ffb700' },
    { nome: 'Ambiental', emoji: '🌱', cor: '#10b981' },
    { nome: 'RH', emoji: '👥', cor: '#a78bfa' },
    { nome: 'Administrativo', emoji: '🏛️', cor: '#54a0ff' },
];
const SETOR_INDEFINIDO = 'A classificar';
const setorInfo = (nome) => SETORES.find((s) => s.nome === nome) || { nome: nome || SETOR_INDEFINIDO, emoji: '❓', cor: '#5b6275' };

// Normaliza p/ comparação (sem acento, maiúsculas)
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

// NRs com destino específico; as demais são de segurança do trabalho → SESMT
const NR_SETOR = { 10: 'Manutenção', 12: 'Manutenção', 13: 'Manutenção', 20: 'Manutenção', 11: 'Logística', 25: 'Ambiental' };

// Classificação automática: analisa requisito + sumário + temas/macrotemas.
// Regras calibradas nos 800 registros reais (NR 32/13/20/10, CONAMA, CBMBA…).
export const inferirSetor = (r) => {
    const alvo = norm(`${r.requisito || ''} ${r.sumario || ''} ${r.temas || ''} ${r.macrotemas || ''}`);

    // 1) NR específica citada no requisito
    const nr = alvo.match(/NORMA REGULAMENTADORA N.{0,2}\s*(\d{1,2})\b/) || alvo.match(/\bNR\s*[-–]?\s*(\d{1,2})\b/);
    if (nr) return NR_SETOR[Number(nr[1])] || 'SESMT';

    // 2) Palavras-chave por setor (ordem importa)
    if (/TRANSPORTE|VEICULO|TRANSITO|\bCTB\b|\bMOPP\b|\bANTT\b|LOGISTICA|EMPILHADEIRA|MOVIMENTACAO DE CARGA/.test(alvo)) return 'Logística';
    if (/CONAMA|IBAMA|CEPRAM|INEMA|AGERSA|\bMMA\b|AMBIENT|RESIDUO|EFLUENTE|EMISSO|RECURSOS HIDRIC|SANEAMENTO|ESGOTO|FLORA|FAUNA|\bSOLO\b|LICENCIAMENTO|CADASTRO TECNICO FEDERAL|\bCTF\b|OLEO LUBRIFICANTE|PRAGAS E VETORES|QUALIDADE DO AR|AGENDA 21|CAPTACAO/.test(alvo)) return 'Ambiental';
    if (/CALDEIRA|VASO DE PRESS|ELETRICIDADE|ELETRICA|ENERGIA|SPDA|PARA.?RAIOS|ELEVADOR|INFLAMAV|COMBUSTIV|INMETRO|CONFEA|\bCREA\b|\bART\b|RESPONSABILIDADE TECNICA|EDIFICAC|MAQUINAS E EQUIPAMENTOS/.test(alvo)) return 'Manutenção';
    if (/INCENDIO|BOMBEIRO|CBMBA|AVCB|BRIGADA|\bEPI\b|ACIDENTE DE TRABALHO|INSALUBR|PERICULOS|ERGONOM|SINALIZAC|ANVISA|VIGILANCIA SANIT|SERVICOS DE SAUDE|\bSAUDE\b|RADIAC|\bCNEN\b|RUIDO|AMBULATOR|APPCC|\bSVS\b|PRODUTOS QUIMICOS/.test(alvo)) return 'SESMT';
    if (/TRABALHISTA|APRENDIZ|\bPCD\b|JORNADA|ESOCIAL|FERIAS|EMPREGAD/.test(alvo)) return 'RH';
    if (/TRIBUT|ANTISSUBORNO|SUBORNO|COMPLIANCE|FISCALIZACAO E PENALIDADES|\bCIVEL\b|\bCIVIL\b|ANATEL|RADIO.?COMUNICACAO|POLITICA DA EMPRESA|CONTROLE E ATUALIZACAO DE DOCUMENTOS/.test(alvo)) return 'Administrativo';
    return SETOR_INDEFINIDO;
};

// Setor efetivo: o gravado no banco vence; senão usa a inferência
export const setorDe = (r) => r.setor || inferirSetor(r);

// ── Helpers de data ──
const hojeISO = () => new Date().toISOString().slice(0, 10);
const diaDe = (ts) => (ts ? new Date(ts).toLocaleDateString('sv-SE') : null); // yyyy-mm-dd local
const brCurto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const brDataHora = (ts) => (ts ? new Date(ts).toLocaleDateString('pt-BR') : null);

// ── Pills ── (null-safe: colunas podem vir nulas do banco)
const corPrioridade = (p) => { const s = String(p ?? ''); return /alta/i.test(s) ? '#ff4757' : /m[eé]dia/i.test(s) ? '#ffb700' : /baixa/i.test(s) ? '#54a0ff' : '#8b9bb4'; };
const corConformidade = (c) => {
    const s = String(c ?? '').trim().toLowerCase();
    if (/^conforme/i.test(s)) return '#10b981'; // Green
    if (/n[aã]o conforme/i.test(s)) return '#ff4757'; // Red
    if (/parcial/i.test(s)) return '#ff9f43'; // Orange
    if (/aplic[aá]vel|aplica/i.test(s)) return '#ffd32a'; // Yellow (Não Aplicável / Não se aplica)
    if (/adequa/i.test(s)) return '#54a0ff'; // Blue (Em Adequação)
    return '#8b9bb4'; // Default Gray
};
function Pill({ text, color }) {
    if (!text) return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
    return <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px', color, background: color + '1a', border: `1px solid ${color}45`, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{text}</span>;
}

const trunca = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };

const tooltipStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.74rem', color: 'var(--color-text-main)' };

function LiraView({ onBack }) {
    const { items, loading, error, needsSetup, getFull, salvarAnalise, classificarSetores } = useLira();
    const { currentUser } = useAuth();
    const nomeUsuario = currentUser?.name || currentUser?.username || '';
    const podeGerenciar = currentUser?.is_admin || ['gestor', 'analista'].includes(currentUser?.role);

    // Filtros
    const [busca, setBusca] = useState('');
    const [fStatus, setFStatus] = useState('todos');       // todos | pendentes | analisados
    const [fOrigem, setFOrigem] = useState('todos');
    const [fPrioridade, setFPrioridade] = useState('todos');
    const [fSetor, setFSetor] = useState('todos');
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    // Seleção por checkbox → cobrança em PDF para o setor
    const [selecionados, setSelecionados] = useState(new Set());
    const [showCobranca, setShowCobranca] = useState(false);
    const [classificando, setClassificando] = useState(false);

    // Filtro por data da análise (dia exato, mês e/ou ano)
    const [fDia, setFDia] = useState('');
    const [fMes, setFMes] = useState('todos');
    const [fAno, setFAno] = useState('todos');
    const temFiltroData = !!fDia || fMes !== 'todos' || fAno !== 'todos';

    // Relatório de desempenho
    const [showReport, setShowReport] = useState(false);

    // Modal de análise: { row, full, observacoes, conformidade }
    const [modal, setModal] = useState(null);
    const [salvando, setSalvando] = useState(false);

    // ── Derivados ──
    const origens = useMemo(() => [...new Set(items.map((r) => r.origem).filter(Boolean))].sort(), [items]);
    const prioridades = useMemo(() => [...new Set(items.map((r) => r.prioridade).filter(Boolean))].sort(), [items]);
    const anos = useMemo(() => [...new Set(items.map((r) => diaDe(r.analisado_em)).filter(Boolean).map((d) => d.slice(0, 4)))].sort().reverse(), [items]);

    // Registro dentro do período selecionado (compara a DATA DA ANÁLISE)
    const dentroPeriodo = useCallback((r) => {
        if (!temFiltroData) return true;
        const d = diaDe(r.analisado_em); // yyyy-mm-dd local
        if (!d) return false;
        if (fDia && d !== fDia) return false;
        if (fAno !== 'todos' && d.slice(0, 4) !== fAno) return false;
        if (fMes !== 'todos' && d.slice(5, 7) !== fMes) return false;
        return true;
    }, [temFiltroData, fDia, fMes, fAno]);

    const filtrados = useMemo(() => items.filter((r) => {
        if (fStatus === 'pendentes' && foiAnalisado(r)) return false;
        if (fStatus === 'analisados' && !foiAnalisado(r)) return false;
        if (fOrigem !== 'todos' && r.origem !== fOrigem) return false;
        if (fPrioridade !== 'todos' && r.prioridade !== fPrioridade) return false;
        if (fSetor !== 'todos' && setorDe(r) !== fSetor) return false;
        if (!dentroPeriodo(r)) return false;
        if (busca) {
            const alvo = `${r.codigo} ${r.requisito} ${r.sumario || ''} ${r.obrigacao} ${r.origem} ${r.observacoes || ''}`.toLowerCase();
            if (!alvo.includes(busca.toLowerCase())) return false;
        }
        return true;
    }), [items, fStatus, fOrigem, fPrioridade, fSetor, busca, dentroPeriodo]);

    useEffect(() => { setPage(1); }, [busca, fStatus, fOrigem, fPrioridade, fSetor, pageSize, fDia, fMes, fAno]);
    const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const paginados = filtrados.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

    // ── Estatísticas de produtividade ──
    const stats = useMemo(() => {
        const total = items.length;
        const analisados = items.filter(foiAnalisado).length;
        const pendentes = total - analisados;
        const porDia = {};
        items.forEach((r) => {
            const d = diaDe(r.analisado_em);
            if (d) porDia[d] = (porDia[d] || 0) + 1;
        });
        const hoje = porDia[hojeISO()] || 0;

        // Série dos últimos 30 dias (inclui dias com zero)
        const serie = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toLocaleDateString('sv-SE');
            serie.push({ iso, dia: brCurto(iso), analises: porDia[iso] || 0 });
        }
        const diasComMeta = serie.filter((s) => s.analises >= META_DIA).length;
        const pct = total ? Math.round((analisados / total) * 100) : 0;
        return { total, analisados, pendentes, hoje, serie, diasComMeta, pct };
    }, [items]);

    // ── Relatório de desempenho (segue o período filtrado) ──
    const periodoLabel = useMemo(() => {
        if (fDia) return `Dia ${fDia.split('-').reverse().join('/')}`;
        const mesL = MESES_OPCOES.find((m) => m.v === fMes)?.l;
        if (fMes !== 'todos' && fAno !== 'todos') return `${mesL} de ${fAno}`;
        if (fAno !== 'todos') return `Ano de ${fAno}`;
        if (fMes !== 'todos') return `${mesL} (todos os anos)`;
        return 'Todo o período';
    }, [fDia, fMes, fAno]);

    const relatorio = useMemo(() => {
        const noPeriodo = items.filter((r) => r.analisado_em && dentroPeriodo(r));
        const porDia = {};
        noPeriodo.forEach((r) => {
            const d = diaDe(r.analisado_em);
            if (!porDia[d]) porDia[d] = { count: 0, analistas: new Set() };
            porDia[d].count++;
            if (r.analisado_por) porDia[d].analistas.add(r.analisado_por);
        });
        const dias = Object.entries(porDia)
            .map(([iso, v]) => ({ iso, data: iso.split('-').reverse().join('/'), count: v.count, analistas: [...v.analistas].join(', ') || '—', metaOk: v.count >= META_DIA }))
            .sort((a, b) => b.iso.localeCompare(a.iso));
        const totalPeriodo = noPeriodo.length;
        const diasAtivos = dias.length;
        const diasMeta = dias.filter((d) => d.metaOk).length;
        const media = diasAtivos ? totalPeriodo / diasAtivos : 0;
        const semData = items.filter((r) => foiAnalisado(r) && !r.analisado_em).length;
        return { dias, totalPeriodo, diasAtivos, diasMeta, media, semData };
    }, [items, dentroPeriodo]);

    const exportarRelatorio = () => {
        exportToExcel([
            ...relatorio.dias.map((d) => ({
                'Data': d.data, 'Análises': d.count, 'Meta (≥5)': d.metaOk ? 'Atingida' : 'Não atingida', 'Analista(s)': d.analistas,
            })),
            { 'Data': 'TOTAL', 'Análises': relatorio.totalPeriodo, 'Meta (≥5)': `${relatorio.diasMeta} de ${relatorio.diasAtivos} dias`, 'Analista(s)': '' },
        ], 'relatorio_desempenho_lira', 'Desempenho');
    };

    // ── Avaliação por setor: qual setor está melhor/pior avaliado ──
    const radarSetores = useMemo(() => {
        const mapa = {};
        items.forEach((r) => {
            const s = setorDe(r);
            if (!mapa[s]) mapa[s] = { setor: s, total: 0, analisados: 0, conformes: 0, naoConformes: 0 };
            mapa[s].total++;
            if (foiAnalisado(r)) mapa[s].analisados++;
            const c = norm(r.conformidade || '');
            if (/^CONFORME/.test(c)) mapa[s].conformes++;
            else if (/NAO CONFORME/.test(c)) mapa[s].naoConformes++;
        });
        return Object.values(mapa)
            .map((s) => ({ ...s, pctAnalisado: s.total ? Math.round((s.analisados / s.total) * 100) : 0, pctConforme: s.total ? Math.round((s.conformes / s.total) * 100) : 0 }))
            .sort((a, b) => b.total - a.total);
    }, [items]);

    const pendentesClassificacao = useMemo(() => items.filter((r) => !r.setor).length, [items]);

    // Grava a classificação automática nos itens ainda sem setor no banco
    const aplicarClassificacao = async () => {
        const alvo = items.filter((r) => !r.setor);
        if (!alvo.length) { alert('Todos os itens já possuem setor gravado.'); return; }
        const mapa = {};
        alvo.forEach((r) => {
            const s = inferirSetor(r);
            (mapa[s] = mapa[s] || []).push(r.id);
        });
        const resumo = Object.entries(mapa).map(([s, ids]) => `${setorInfo(s).emoji} ${s}: ${ids.length}`).join('\n');
        if (!window.confirm(`Gravar a classificação automática de ${alvo.length} itens?\n\n${resumo}\n\nVocê poderá corrigir setor por setor no modal de análise.`)) return;
        setClassificando(true);
        const ok = await classificarSetores(mapa);
        setClassificando(false);
        if (ok) alert('Classificação gravada com sucesso.');
    };

    // ── Seleção por checkbox ──
    const toggleSel = (id) => setSelecionados((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });
    const paginaToda = paginados.length > 0 && paginados.every((r) => selecionados.has(r.id));
    const togglePagina = () => setSelecionados((prev) => {
        const n = new Set(prev);
        if (paginaToda) paginados.forEach((r) => n.delete(r.id));
        else paginados.forEach((r) => n.add(r.id));
        return n;
    });
    const itensSelecionados = useMemo(() => items.filter((r) => selecionados.has(r.id)), [items, selecionados]);

    // ── Abrir análise (carrega registro completo) ──
    const abrirAnalise = async (row) => {
        const full = await getFull(row.id);
        if (!full) return;
        setModal({ row, full, observacoes: full.observacoes || '', conformidade: full.conformidade || '', setor: setorDe(full) === SETOR_INDEFINIDO ? '' : setorDe(full) });
    };

    const proximaPendente = (aposId = null) => {
        const fila = items.filter((r) => !foiAnalisado(r));
        if (!fila.length) { alert('Não há requisitos pendentes. Trabalho concluído! 🎯'); return null; }
        if (aposId != null) {
            const dep = fila.find((r) => r.id > aposId);
            return dep || fila[0];
        }
        return fila[0];
    };

    const salvar = async (abrirProxima = false) => {
        if (!modal) return;
        if (!modal.observacoes.trim()) { alert('Preencha as observações/conclusões da análise.'); return; }
        setSalvando(true);
        const ok = await salvarAnalise(modal.full, { observacoes: modal.observacoes.trim(), conformidade: modal.conformidade, setor: modal.setor, autor: nomeUsuario });
        setSalvando(false);
        if (!ok) return;
        if (abrirProxima) {
            const prox = proximaPendente(modal.row.id);
            setModal(null);
            if (prox) abrirAnalise(prox);
        } else {
            setModal(null);
        }
    };

    const exportar = () => {
        const fonte = filtrados.length ? filtrados : items;
        exportToExcel(fonte.map((r) => ({
            'ID': r.id, 'Código': r.codigo || '', 'Requisito': r.requisito || '', 'Sumário': r.sumario || '', 'Obrigação': r.obrigacao || '',
            'Origem': r.origem || '', 'Prioridade': r.prioridade || '', 'Situação': r.situacao || '',
            'Conformidade': r.conformidade || '', 'Observações/Conclusões': r.observacoes || '',
            'Analisado em': brDataHora(r.analisado_em) || '', 'Analisado por': r.analisado_por || '',
        })), 'lira_requisitos_legais', 'LIRA');
    };

    const columns = [
        {
            key: 'sel',
            label: <input type="checkbox" checked={paginaToda} onChange={togglePagina} title="Selecionar página" style={{ cursor: 'pointer' }} />,
            align: 'center',
            render: (r) => <input type="checkbox" checked={selecionados.has(r.id)} onChange={() => toggleSel(r.id)} style={{ cursor: 'pointer' }} />,
        },
        { key: 'codigo', label: 'Cód.', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }}>{r.codigo || '—'}</span> },
        {
            key: 'requisito', label: 'Requisito legal', wrap: true, render: (r) => (
                <span title={`${r.requisito || ''}${r.sumario ? '\n\n' + r.sumario : ''}`}>
                    <span style={{ fontWeight: 600 }}>{trunca(r.requisito || '—', 52)}</span>
                    {r.sumario ? <div style={{ color: 'var(--color-text-muted)', fontSize: '0.66rem' }}>{trunca(r.sumario, 64)}</div> : null}
                    <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem' }}>{[r.origem, r.situacao].filter(Boolean).join(' · ') || ''}</div>
                </span>
            ),
        },
        { key: 'obrigacao', label: 'Obrigação', wrap: true, render: (r) => <span title={r.obrigacao} style={{ fontSize: '0.72rem' }}>{trunca(r.obrigacao || '—', 96)}</span> },
        {
            key: 'setor', label: 'Setor', align: 'center', render: (r) => {
                const s = setorInfo(setorDe(r));
                return <span title={r.setor ? 'Setor gravado' : 'Sugestão automática (não gravado)'}><Pill text={`${s.emoji} ${s.nome}`} color={s.cor} />{!r.setor && <div style={{ fontSize: '0.56rem', color: 'var(--color-text-subtle)', marginTop: 1 }}>auto</div>}</span>;
            },
        },
        { key: 'prioridade', label: 'Prioridade', align: 'center', render: (r) => <Pill text={r.prioridade} color={corPrioridade(r.prioridade)} /> },
        { key: 'conformidade', label: 'Conformidade', align: 'center', render: (r) => <Pill text={r.conformidade} color={corConformidade(r.conformidade)} /> },
        {
            key: 'analise', label: 'Análise', align: 'center', render: (r) => foiAnalisado(r)
                ? <span><Pill text="Analisado" color="#10b981" />{r.analisado_em ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem', marginTop: 2 }}>{brDataHora(r.analisado_em)}</div> : null}</span>
                : <Pill text="Pendente" color="#ffb700" />,
        },
        {
            key: 'acoes', label: '', align: 'center', render: (r) => (
                <RowAction
                    icon={foiAnalisado(r) ? <FaEdit size={13} /> : <FaClipboardCheck size={14} />}
                    color={foiAnalisado(r) ? '#54a0ff' : '#00ccff'}
                    title={foiAnalisado(r) ? 'Editar análise' : 'Analisar'}
                    onClick={() => abrirAnalise(r)}
                />
            ),
        },
    ];

    const metaBatida = stats.hoje >= META_DIA;

    return (
        <PageShell
            icon={<FaBalanceScale size={20} />} color="#00ccff"
            title="LIRA · Requisitos Legais"
            subtitle="Análise de conformidade legal · meta diária de preenchimento"
            onBack={onBack}
            maxWidth="100%"
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={() => setShowReport(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaChartBar size={11} /> Relatório de desempenho</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={11} /> Exportar Excel</Btn>
                <Btn color="#00ccff" onClick={() => { const p = proximaPendente(); if (p) abrirAnalise(p); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.72rem' }}>
                    <FaForward size={11} /> Analisar próxima pendente
                </Btn>
            </>}
        >
            {needsSetup && (
                <div style={{ padding: '0.8rem 1rem', borderRadius: 10, background: '#ffb7001a', border: '1px solid #ffb70055', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    <strong>Configuração pendente:</strong> rode o script <code>database/lira.sql</code> no SQL Editor do Supabase.
                    Ele cria as colunas de rastreio (<code>analisado_em</code>/<code>analisado_por</code>) e a view <code>lira_analises</code> que esta tela utiliza.
                </div>
            )}
            {error && (
                <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: '#ff47571a', border: '1px solid #ff475755', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>
                    Falha ao carregar: {error}
                </div>
            )}

            {/* Meta do dia */}
            <Card style={{ marginBottom: '1rem', padding: '0.7rem 1rem', borderLeft: `3px solid ${metaBatida ? '#10b981' : '#00ccff'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <FaBullseye size={16} color={metaBatida ? '#10b981' : '#00ccff'} />
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {metaBatida
                                ? `Meta do dia concluída — ${stats.hoje} análise${stats.hoje > 1 ? 's' : ''} registradas hoje.`
                                : `Hoje: ${stats.hoje} de ${META_DIA} análises da meta diária.`}
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-surface-2)', marginTop: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, (stats.hoje / META_DIA) * 100)}%`, background: metaBatida ? '#10b981' : '#00ccff', transition: 'width 0.4s' }} />
                        </div>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>{stats.pendentes} pendentes no total</span>
                </div>
            </Card>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaBalanceScale size={12} />} label="Requisitos" value={stats.total} sub="registros no LIRA" color="#00ccff" onClick={() => setFStatus('todos')} active={fStatus === 'todos'} />
                <Kpi icon={<FaCheckCircle size={12} />} label="Analisados" value={stats.analisados} sub={`${stats.pct}% do total`} color="#10b981" onClick={() => setFStatus('analisados')} active={fStatus === 'analisados'} />
                <Kpi icon={<FaHourglassHalf size={12} />} label="Pendentes" value={stats.pendentes} sub="aguardando análise" color="#ffb700" onClick={() => setFStatus('pendentes')} active={fStatus === 'pendentes'} />
                <Kpi icon={<FaBullseye size={12} />} label="Hoje" value={`${stats.hoje}/${META_DIA}`} sub="meta diária" color={metaBatida ? '#10b981' : '#54a0ff'} />
                <Kpi icon={<FaCalendarCheck size={12} />} label="Dias com meta" value={stats.diasComMeta} sub="últimos 30 dias" color="#a78bfa" />
            </div>

            {/* Produtividade diária */}
            <Card style={{ marginBottom: '1rem', padding: '0.9rem 1rem' }}>
                <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaCalendarCheck size={12} color="#00ccff" /> Análises por dia — últimos 30 dias
                </h3>
                <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={stats.serie} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            formatter={(v) => [`${v} análise${v === 1 ? '' : 's'}`, null]} labelFormatter={(l) => `Dia ${l}`} separator="" />
                        <ReferenceLine y={META_DIA} stroke="#8b9bb4" strokeDasharray="5 4" label={{ value: `Meta · ${META_DIA}/dia`, position: 'insideTopRight', fill: 'var(--color-text-subtle)', fontSize: 10 }} />
                        <Bar dataKey="analises" fill="#00ccff" radius={[4, 4, 0, 0]} maxBarSize={16} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            {/* Avaliação por setor responsável */}
            <Card style={{ marginBottom: '1rem', padding: '0.9rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        🏭 Avaliação por setor responsável
                        <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>· para onde as análises estão inclinando</span>
                    </h3>
                    {podeGerenciar && pendentesClassificacao > 0 && (
                        <Btn variant="outline" color="#00ccff" onClick={aplicarClassificacao} style={{ padding: '0.3rem 0.7rem', fontSize: '0.66rem' }}>
                            {classificando ? 'Gravando…' : `Classificar ${pendentesClassificacao} itens automaticamente`}
                        </Btn>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.5rem' }}>
                    {radarSetores.map((s) => {
                        const info = setorInfo(s.setor);
                        const ativo = fSetor === s.setor;
                        return (
                            <div
                                key={s.setor}
                                onClick={() => setFSetor(ativo ? 'todos' : s.setor)}
                                title="Clique para filtrar a tabela por este setor"
                                style={{
                                    border: `1px solid ${ativo ? info.cor + 'aa' : 'var(--border-color-soft)'}`,
                                    background: ativo ? info.cor + '10' : 'var(--bg-card)',
                                    borderRadius: 10, padding: '0.55rem 0.7rem', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{info.emoji} {s.setor}</span>
                                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)' }}>{s.total} itens</span>
                                </div>
                                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-surface-2)', overflow: 'hidden', marginBottom: 4 }}>
                                    <div style={{ height: '100%', width: `${s.pctAnalisado}%`, background: info.cor }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--color-text-subtle)' }}>
                                    <span>{s.analisados}/{s.total} analisados ({s.pctAnalisado}%)</span>
                                    <span>
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>{s.conformes}✓</span>
                                        {' · '}
                                        <span style={{ color: s.naoConformes ? '#ff4757' : 'var(--color-text-subtle)', fontWeight: 700 }}>{s.naoConformes}✗</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)', marginRight: 'auto' }}>
                    Requisitos <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>({filtrados.length})</span>
                </h3>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={{ width: 180, fontSize: '0.68rem', padding: '0.3rem 0.55rem' }} />
                <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ width: 125, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Status</option>
                    <option value="pendentes">Pendentes</option>
                    <option value="analisados">Analisados</option>
                </Select>
                <Select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} style={{ width: 120, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Origem</option>
                    {origens.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Select value={fPrioridade} onChange={(e) => setFPrioridade(e.target.value)} style={{ width: 125, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Prioridade</option>
                    {prioridades.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select value={fSetor} onChange={(e) => setFSetor(e.target.value)} style={{ width: 138, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Setor</option>
                    {SETORES.map((s) => <option key={s.nome} value={s.nome}>{s.emoji} {s.nome}</option>)}
                    <option value={SETOR_INDEFINIDO}>❓ {SETOR_INDEFINIDO}</option>
                </Select>
                <Select value={fAno} onChange={(e) => setFAno(e.target.value)} style={{ width: 92, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Ano</option>
                    {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
                <Select value={fMes} onChange={(e) => setFMes(e.target.value)} style={{ width: 110, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Mês</option>
                    {MESES_OPCOES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                </Select>
                <Input type="date" value={fDia} onChange={(e) => setFDia(e.target.value)} title="Dia exato da análise" style={{ width: 128, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }} />
                <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: 90, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n}/pág</option>)}
                </Select>
                {(temFiltroData || busca || fStatus !== 'todos' || fOrigem !== 'todos' || fPrioridade !== 'todos' || fSetor !== 'todos') && (
                    <Btn variant="outline" color="#ff4757" onClick={() => { setBusca(''); setFStatus('todos'); setFOrigem('todos'); setFPrioridade('todos'); setFSetor('todos'); setFDia(''); setFMes('todos'); setFAno('todos'); }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.66rem' }}>
                        Limpar
                    </Btn>
                )}
            </div>

            <div className="lira-tbl">
                <style>{`
                    .lira-tbl > div { border: none !important; border-radius: 0 !important; border-top: 1px solid var(--border-color-soft) !important; }
                    .lira-tbl table { font-size: 0.74rem !important; font-variant-numeric: tabular-nums; table-layout: fixed; width: 100%; }
                    .lira-tbl thead th { font-size: 0.6rem !important; font-weight: 600 !important; letter-spacing: 0.7px; padding: 0.5rem 0.6rem !important; }
                    .lira-tbl tbody td { padding: 0.5rem 0.6rem !important; line-height: 1.35; overflow: hidden; }
                    .lira-tbl th:nth-child(1), .lira-tbl td:nth-child(1) { width: 3%; text-align: center; }
                    .lira-tbl th:nth-child(2), .lira-tbl td:nth-child(2) { width: 4%; }
                    .lira-tbl th:nth-child(3), .lira-tbl td:nth-child(3) { width: 27%; }
                    .lira-tbl th:nth-child(4), .lira-tbl td:nth-child(4) { width: 29%; }
                    .lira-tbl th:nth-child(5), .lira-tbl td:nth-child(5) { width: 10%; text-align: center; }
                    .lira-tbl th:nth-child(6), .lira-tbl td:nth-child(6) { width: 7%; text-align: center; }
                    .lira-tbl th:nth-child(7), .lira-tbl td:nth-child(7) { width: 8%; text-align: center; }
                    .lira-tbl th:nth-child(8), .lira-tbl td:nth-child(8) { width: 8%; text-align: center; }
                    .lira-tbl th:nth-child(9), .lira-tbl td:nth-child(9) { width: 4%; text-align: center; }
                `}</style>
                <DataTable dense columns={columns} rows={paginados} empty={loading ? 'Carregando requisitos…' : 'Nenhum requisito encontrado com esses filtros.'} />
            </div>

            {filtrados.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <span>{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtrados.length)} de {filtrados.length}</span>
                    <Btn variant="outline" color="#00ccff" onClick={() => setPage(Math.max(1, pageSafe - 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe <= 1 ? 0.4 : 1, pointerEvents: pageSafe <= 1 ? 'none' : 'auto' }}>Anterior</Btn>
                    <span>Página {pageSafe} de {totalPages}</span>
                    <Btn variant="outline" color="#00ccff" onClick={() => setPage(Math.min(totalPages, pageSafe + 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe >= totalPages ? 0.4 : 1, pointerEvents: pageSafe >= totalPages ? 'none' : 'auto' }}>Próxima</Btn>
                </div>
            )}

            {/* Barra de seleção → cobrança ao setor */}
            {selecionados.size > 0 && (
                <div style={{
                    position: 'sticky', bottom: 12, zIndex: 30, marginTop: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 12,
                    padding: '0.6rem 1rem', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {selecionados.size} requisito{selecionados.size > 1 ? 's' : ''} selecionado{selecionados.size > 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', marginRight: 'auto' }}>
                        gere o formulário de cobrança e envie ao setor responder
                    </span>
                    <Btn variant="outline" color="#8b9bb4" onClick={() => setSelecionados(new Set())} style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}>Limpar seleção</Btn>
                    <Btn color="#00ccff" onClick={() => setShowCobranca(true)} style={{ padding: '0.35rem 0.9rem', fontSize: '0.72rem' }}>
                        <FaPrint size={11} /> Gerar cobrança (PDF)
                    </Btn>
                </div>
            )}

            {/* Cobrança ao setor (imprimível → PDF) */}
            {showCobranca && (
                <CobrancaSetor
                    itens={itensSelecionados}
                    emissor={nomeUsuario}
                    onClose={() => setShowCobranca(false)}
                />
            )}

            {/* Relatório de desempenho (imprimível) */}
            {showReport && (
                <RelatorioDesempenho
                    onClose={() => setShowReport(false)}
                    periodo={periodoLabel}
                    rel={relatorio}
                    stats={stats}
                    emissor={nomeUsuario}
                    onExcel={exportarRelatorio}
                />
            )}

            {/* Modal de análise */}
            {modal && (
                <Modal title={`Análise · Cód. ${modal.full.codigo || modal.full.id}`} onClose={() => setModal(null)} width={820}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.4, marginBottom: '0.35rem' }}>
                        {modal.full.requisito}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                        <Pill text={modal.full.origem} color="#54a0ff" />
                        <Pill text={modal.full.prioridade} color={corPrioridade(modal.full.prioridade)} />
                        <Pill text={modal.full.situacao} color="#8b9bb4" />
                        {modal.full.aplicabilidade && <Pill text={`Aplicabilidade: ${modal.full.aplicabilidade}`} color="#a78bfa" />}
                        {modal.full.analisado_em && <Pill text={`1ª análise: ${brDataHora(modal.full.analisado_em)} · ${modal.full.analisado_por || '—'}`} color="#10b981" />}
                    </div>

                    {modal.full.sumario && <BlocoLeitura titulo="Sumário do requisito" texto={modal.full.sumario} />}
                    <BlocoLeitura titulo="Obrigação a avaliar" texto={modal.full.obrigacao} destaque />
                    {modal.full.evidencia && <BlocoLeitura titulo="Evidência registrada" texto={modal.full.evidencia} />}
                    {modal.full.grupo_evidencia && <BlocoLeitura titulo="Grupo de evidência" texto={modal.full.grupo_evidencia} />}
                    {modal.full.penalidade && <BlocoLeitura titulo="Penalidade aplicável" texto={modal.full.penalidade} />}

                    <FormGrid cols={2}>
                        <Field label="Conformidade da obrigação">
                            <Select value={modal.conformidade} onChange={(e) => setModal((m) => ({ ...m, conformidade: e.target.value }))} placeholder="Selecione…">
                                <option value="">Selecione…</option>
                                {modal.conformidade && !CONF_OPCOES.includes(modal.conformidade) && <option value={modal.conformidade}>{modal.conformidade}</option>}
                                {CONF_OPCOES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </Field>
                        <Field label="Setor responsável">
                            <Select value={modal.setor} onChange={(e) => setModal((m) => ({ ...m, setor: e.target.value }))} placeholder={`Sugestão: ${setorInfo(inferirSetor(modal.full)).emoji} ${inferirSetor(modal.full)}`}>
                                <option value="">{`Sugestão: ${inferirSetor(modal.full)}`}</option>
                                {SETORES.map((s) => <option key={s.nome} value={s.nome}>{s.emoji} {s.nome}</option>)}
                            </Select>
                        </Field>
                        <Field label="Observações / Conclusões" required span={2}>
                            <Textarea rows={5} value={modal.observacoes} onChange={(e) => setModal((m) => ({ ...m, observacoes: e.target.value }))}
                                placeholder="Registre a conclusão da análise: como está o atendimento a esta obrigação, evidências verificadas, pendências e próximos passos…" />
                        </Field>
                    </FormGrid>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>
                            Hoje: {stats.hoje}/{META_DIA} análises
                        </span>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <Btn variant="outline" color="#8b9bb4" onClick={() => setModal(null)}>Cancelar</Btn>
                            <Btn variant="outline" color="#00ccff" onClick={() => salvar(false)}>{salvando ? 'Salvando…' : 'Salvar'}</Btn>
                            <Btn color="#00ccff" onClick={() => salvar(true)}><FaForward size={11} /> {salvando ? 'Salvando…' : 'Salvar e próxima'}</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </PageShell>
    );
}

// Bloco de leitura (conteúdo do requisito) — texto longo com rolagem própria
function BlocoLeitura({ titulo, texto, destaque }) {
    return (
        <div style={{ marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: destaque ? '#00ccff' : 'var(--color-text-subtle)', marginBottom: '0.3rem' }}>{titulo}</div>
            <div style={{
                fontSize: '0.78rem', lineHeight: 1.55, color: 'var(--color-text-main)', whiteSpace: 'pre-wrap',
                background: destaque ? 'rgba(0,204,255,0.06)' : 'var(--bg-surface-2)',
                border: `1px solid ${destaque ? 'rgba(0,204,255,0.25)' : 'var(--border-color-soft)'}`,
                borderRadius: 8, padding: '0.6rem 0.75rem', maxHeight: 150, overflowY: 'auto',
            }}>{texto}</div>
        </div>
    );
}

// ── Relatório de Desempenho — modal imprimível (A4) ──
function RelatorioDesempenho({ onClose, periodo, rel, stats, emissor, onExcel }) {
    const agora = new Date();
    const kpiBox = { border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.6rem 0.8rem', textAlign: 'center' };
    const kpiVal = { fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 };
    const kpiLbl = { fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-subtle)' };
    const th = { textAlign: 'left', padding: '0.45rem 0.6rem', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-subtle)', borderBottom: '1px solid var(--border-color)' };
    const td = { padding: '0.45rem 0.6rem', fontSize: '0.76rem', borderBottom: '1px solid var(--border-color-soft)', color: 'var(--color-text-main)' };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 12mm; }
                    body * { visibility: hidden !important; }
                    .lira-report, .lira-report * { visibility: visible !important; }
                    .lira-report { position: absolute !important; left: 0; top: 0; width: 100% !important; max-height: none !important; background: #fff !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
                    .lira-report * { color: #000 !important; background: transparent !important; border-color: #999 !important; }
                    .lira-report .no-print { display: none !important; }
                }
            `}</style>
            <div className="lira-report" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 14, maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.4rem 1.6rem' }}>
                {/* Toolbar (não imprime) */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.8rem' }}>
                    <Btn variant="outline" color="#10b981" onClick={onExcel} style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={11} /> Excel</Btn>
                    <Btn color="#00ccff" onClick={() => window.print()} style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}><FaPrint size={11} /> Imprimir</Btn>
                    <Btn variant="outline" color="#8b9bb4" onClick={onClose} style={{ padding: '0.35rem 0.55rem', fontSize: '0.7rem' }}><FaTimes size={12} /></Btn>
                </div>

                {/* Cabeçalho */}
                <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.7rem', marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Relatório de Desempenho — LIRA · Requisitos Legais</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                        Período: <strong>{periodo}</strong> · Emitido em {agora.toLocaleDateString('pt-BR')} às {agora.toTimeString().slice(0, 5)}{emissor ? ` por ${emissor}` : ''} · SGA — Sistema de Gestão Ambiental
                    </div>
                </div>

                {/* Resumo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={kpiBox}><div style={kpiVal}>{rel.totalPeriodo}</div><div style={kpiLbl}>Análises no período</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{rel.diasAtivos}</div><div style={kpiLbl}>Dias com atividade</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{rel.media.toFixed(1)}</div><div style={kpiLbl}>Média / dia ativo</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{rel.diasMeta}/{rel.diasAtivos}</div><div style={kpiLbl}>Dias com meta (≥{META_DIA})</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{stats.pct}%</div><div style={kpiLbl}>Progresso geral ({stats.analisados}/{stats.total})</div></div>
                </div>

                {rel.semData > 0 && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.8rem' }}>
                        Obs.: {rel.semData} análise(s) concluída(s) sem data registrada (anteriores ao rastreio) não entram na contagem diária.
                    </div>
                )}

                {/* Detalhamento por dia */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                        <tr>
                            <th style={th}>Data</th>
                            <th style={{ ...th, textAlign: 'center' }}>Análises</th>
                            <th style={{ ...th, textAlign: 'center' }}>Meta diária (≥{META_DIA})</th>
                            <th style={th}>Analista(s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rel.dias.length === 0 && (
                            <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--color-text-subtle)', padding: '1.4rem' }}>Nenhuma análise com data registrada no período selecionado.</td></tr>
                        )}
                        {rel.dias.map((d) => (
                            <tr key={d.iso}>
                                <td style={td}>{d.data}</td>
                                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{d.count}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                    <span style={{ color: d.metaOk ? '#10b981' : '#ffb700', fontWeight: 700, fontSize: '0.7rem' }}>
                                        {d.metaOk ? '✔ Atingida' : '✖ Não atingida'}
                                    </span>
                                </td>
                                <td style={{ ...td, fontSize: '0.72rem' }}>{d.analistas}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Cobrança ao setor — formulário imprimível (A4 → PDF) ──
// Lista os requisitos selecionados com espaço de resposta para o setor
// preencher; a analista devolve as respostas alimentando o LIRA.
function CobrancaSetor({ itens, emissor, onClose }) {
    // Se todos os itens pendem para o mesmo setor, ele já vem selecionado
    const setoresDosItens = [...new Set(itens.map((r) => setorDe(r)))];
    const [destino, setDestino] = useState(setoresDosItens.length === 1 && setoresDosItens[0] !== SETOR_INDEFINIDO ? setoresDosItens[0] : '');
    const [prazo, setPrazo] = useState('');
    const [obs, setObs] = useState('');
    const agora = new Date();
    const info = setorInfo(destino);

    const th = { textAlign: 'left', padding: '0.4rem 0.55rem', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-subtle)', borderBottom: '1.5px solid var(--border-color)' };
    const td = { padding: '0.5rem 0.55rem', fontSize: '0.72rem', borderBottom: '1px solid var(--border-color-soft)', color: 'var(--color-text-main)', verticalAlign: 'top', lineHeight: 1.45 };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 12mm; }
                    body * { visibility: hidden !important; }
                    .lira-cobranca, .lira-cobranca * { visibility: visible !important; }
                    .lira-cobranca { position: absolute !important; left: 0; top: 0; width: 100% !important; max-height: none !important; background: #fff !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
                    .lira-cobranca * { color: #000 !important; background: transparent !important; border-color: #888 !important; }
                    .lira-cobranca .no-print { display: none !important; }
                    .lira-cobranca tr { page-break-inside: avoid; }
                }
            `}</style>
            <div className="lira-cobranca" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 14, maxWidth: 860, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.4rem 1.6rem' }}>
                {/* Toolbar + configuração (não imprime) */}
                <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '0.9rem', borderBottom: '1px dashed var(--border-color)' }}>
                    <div style={{ minWidth: 180 }}>
                        <label className="label-muted">Setor destinatário</label>
                        <Select value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Selecione o setor…">
                            <option value="">Selecione o setor…</option>
                            {SETORES.map((s) => <option key={s.nome} value={s.nome}>{s.emoji} {s.nome}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="label-muted">Prazo de resposta</label>
                        <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="label-muted">Observação (opcional)</label>
                        <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Instruções para o setor…" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Btn color="#00ccff" onClick={() => window.print()} style={{ padding: '0.45rem 0.9rem', fontSize: '0.72rem' }}><FaPrint size={11} /> Imprimir / PDF</Btn>
                        <Btn variant="outline" color="#8b9bb4" onClick={onClose} style={{ padding: '0.45rem 0.6rem', fontSize: '0.72rem' }}><FaTimes size={12} /></Btn>
                    </div>
                </div>

                {/* Cabeçalho do documento */}
                <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.7rem', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                            Solicitação de Resposta — Requisitos Legais (LIRA)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Grupo MK · SGA</div>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                        <strong>Setor destinatário:</strong> {destino ? `${info.emoji} ${destino}` : '________________'} ·{' '}
                        <strong>Prazo de resposta:</strong> {prazo ? prazo.split('-').reverse().join('/') : '____/____/______'}<br />
                        Emitido em {agora.toLocaleDateString('pt-BR')} às {agora.toTimeString().slice(0, 5)} por {emissor || '—'} · {itens.length} requisito{itens.length > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.55 }}>
                        Prezados, solicitamos avaliação e resposta dos itens abaixo quanto ao atendimento de cada obrigação legal
                        (evidências, situação atual e ações em andamento). {obs && <strong>{obs}</strong>}
                    </div>
                </div>

                {/* Itens */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ ...th, width: '6%' }}>Item</th>
                            <th style={{ ...th, width: '44%' }}>Requisito / Obrigação</th>
                            <th style={{ ...th, width: '12%' }}>Situação atual</th>
                            <th style={{ ...th, width: '38%' }}>Resposta do setor (evidência / ação / prazo)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itens.map((r, i) => (
                            <tr key={r.id}>
                                <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem' }}>{i + 1}<br /><span style={{ color: 'var(--color-text-subtle)', fontSize: '0.6rem' }}>#{r.id}</span></td>
                                <td style={td}>
                                    <strong>{r.requisito}</strong>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 3 }}>{r.obrigacao}</div>
                                </td>
                                <td style={{ ...td, fontSize: '0.68rem' }}>{r.conformidade || 'Não avaliado'}</td>
                                <td style={{ ...td }}>
                                    <div style={{ height: 62, borderBottom: '1px dotted var(--border-color)', marginBottom: 4 }} />
                                    <span style={{ fontSize: '0.58rem', color: 'var(--color-text-subtle)' }}>Responsável: ______________ Data: ___/___/___</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '1.2rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>Assinatura do responsável do setor: ______________________________</span>
                    <span>Devolver ao SGI/Ambiental até {prazo ? prazo.split('-').reverse().join('/') : '____/____/______'}</span>
                </div>
            </div>
        </div>
    );
}

export default LiraView;
