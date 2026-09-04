import { useMemo, useState } from 'react';
import { FaWeightHanging, FaFileExcel, FaChartBar, FaDollarSign, FaRecycle, FaIndustry, FaPrint, FaTimes, FaTrophy } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageShell, Btn, Card, Select, Kpi } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useManifestos } from '../lib/manifestosRepo';
import { useRefunds } from '../lib/refundsRepo';
import { exportToExcel } from '../lib/excel';

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MES_NUM = { '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR', '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO', '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ' };

const trunca = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };
const tooltipStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.74rem', color: 'var(--color-text-main)' };
const chartTitle = { margin: '0 0 0.6rem', fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 };

function ConciliacaoFornecedoresView({ onBack }) {
    const { items: manifestos, loading: mLoading } = useManifestos();
    const { items: allRefunds, loading: rLoading } = useRefunds();
    const { currentUser } = useAuth();
    const nomeUsuario = currentUser?.name || currentUser?.username || '';
    const loading = mLoading || rLoading;

    // O que reconciliar: PESO (kg) — o que o fornecedor de fato reporta ao
    // final do mês — ou, se precisar, o Valor (R$) calculado a partir do
    // peso × preço unitário. Peso é o padrão porque é o controle real.
    const [metrica, setMetrica] = useState('peso'); // 'peso' | 'valor'
    const campo = metrica === 'peso' ? 'quantity' : 'total_price';
    const unidade = metrica === 'peso' ? 'kg' : 'R$';

    const [showReport, setShowReport] = useState(false);

    // Filtro de ano
    const anos = useMemo(() => {
        const set = new Set();
        manifestos.forEach((m) => {
            const yr = (m.data || '').slice(0, 4);
            if (yr && yr !== '0000') set.add(yr);
        });
        return [...set].sort().reverse();
    }, [manifestos]);

    const [anoFiltro, setAnoFiltro] = useState(() => new Date().getFullYear().toString());

    // Constrói a pivot: { 'RESÍDUO|||FORNECEDOR': { JAN: peso/valor, FEV: ..., SOMA } }
    const { linhas, totaisMes, totalGeral } = useMemo(() => {
        const manifestoMap = {};
        manifestos.forEach((m) => {
            if (m.status === 'Cancelado') return;
            const yr = (m.data || '').slice(0, 4);
            if (anoFiltro && yr !== anoFiltro) return;
            const mesNum = (m.data || '').slice(5, 7);
            const mes = MES_NUM[mesNum] || '';
            if (!mes) return;

            const residuoCompleto = (m.residuo || '').trim().toUpperCase();
            const residuoPrincipal = residuoCompleto.split(/\s*\|\s*/)[0] || residuoCompleto;
            const fornecedor = (m.destinador || '').trim().toUpperCase();

            manifestoMap[m.id] = { residuo: residuoPrincipal, fornecedor, mes };
        });

        const pivot = {};
        allRefunds.forEach((ref) => {
            const mid = String(ref.manifest_id);
            const info = manifestoMap[mid];
            if (!info) return;

            const key = `${info.residuo}|||${info.fornecedor}`;
            if (!pivot[key]) {
                pivot[key] = { residuo: info.residuo, fornecedor: info.fornecedor };
                MESES.forEach((m) => { pivot[key][m] = 0; });
            }
            pivot[key][info.mes] += Number(ref[campo] || 0);
        });

        const linhas = Object.values(pivot).sort((a, b) => {
            const cmp = a.residuo.localeCompare(b.residuo);
            return cmp !== 0 ? cmp : a.fornecedor.localeCompare(b.fornecedor);
        });

        linhas.forEach((row) => { row.SOMA = MESES.reduce((acc, m) => acc + row[m], 0); });

        const totaisMes = {};
        MESES.forEach((m) => { totaisMes[m] = linhas.reduce((acc, row) => acc + row[m], 0); });
        const totalGeral = linhas.reduce((acc, row) => acc + row.SOMA, 0);

        return { linhas, totaisMes, totalGeral };
    }, [manifestos, allRefunds, anoFiltro, campo]);

    // KPIs
    const kpis = useMemo(() => {
        const residuosUnicos = new Set(linhas.map((r) => r.residuo)).size;
        const fornecedoresUnicos = new Set(linhas.map((r) => r.fornecedor)).size;
        const mesAtual = MESES[new Date().getMonth()];
        const totalMesAtual = totaisMes[mesAtual] || 0;
        return { residuosUnicos, fornecedoresUnicos, totalGeral, totalMesAtual, mesAtual };
    }, [linhas, totaisMes, totalGeral]);

    // ── Indicadores: quem mais pesa no recebimento, ranking e evolução ──
    const indicadores = useMemo(() => {
        const porFornecedor = {};
        const porResiduo = {};
        linhas.forEach((row) => {
            porFornecedor[row.fornecedor] = (porFornecedor[row.fornecedor] || 0) + row.SOMA;
            porResiduo[row.residuo] = (porResiduo[row.residuo] || 0) + row.SOMA;
        });
        const topFornecedores = Object.entries(porFornecedor)
            .map(([nome, valor]) => ({ nome: trunca(nome, 18), nomeCompleto: nome, valor }))
            .sort((a, b) => b.valor - a.valor).slice(0, 8);
        const topResiduos = Object.entries(porResiduo)
            .map(([nome, valor]) => ({ nome: trunca(nome, 18), nomeCompleto: nome, valor }))
            .sort((a, b) => b.valor - a.valor).slice(0, 8);
        const evolucaoMensal = MESES.map((m) => ({ mes: m, valor: totaisMes[m] || 0 }));
        const liderFornecedor = topFornecedores[0] || null;
        return { topFornecedores, topResiduos, evolucaoMensal, liderFornecedor };
    }, [linhas, totaisMes]);

    // Formata número no padrão brasileiro (sem símbolo — o símbolo/unidade
    // aparece no rótulo do KPI/coluna, não em cada célula)
    const fmt = (v) => {
        if (!v || v === 0) return '-';
        return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const fmtUnidade = (v) => (metrica === 'peso' ? `${fmt(v)} kg` : `R$ ${fmt(v)}`);

    // Exportar Excel
    const exportar = () => {
        const dados = linhas.map((row) => {
            const obj = { 'RESÍDUO': row.residuo, 'FORNECEDOR': row.fornecedor };
            MESES.forEach((m) => { obj[m] = row[m] || 0; });
            obj['SOMA'] = row.SOMA || 0;
            return obj;
        });
        const totaisRow = { 'RESÍDUO': 'TOTAL', 'FORNECEDOR': '-' };
        MESES.forEach((m) => { totaisRow[m] = totaisMes[m] || 0; });
        totaisRow['SOMA'] = totalGeral;
        dados.push(totaisRow);

        exportToExcel(dados, `conciliacao_${metrica}_fornecedores_${anoFiltro}`, 'Conciliação');
    };

    // Meses que já passaram ou são o atual (para destacar coluna ativa)
    const mesIdxAtual = new Date().getMonth();

    // Agrupa linhas por resíduo para visual
    let lastResiduo = '';

    return (
        <PageShell
            icon={<FaWeightHanging size={20} />} color="var(--color-success)"
            title="Conciliação Mensal por Fornecedor"
            subtitle={metrica === 'peso' ? 'Peso recebido (kg) · relatório mensal do fornecedor, agrupado por resíduo' : 'Valores de reembolso (R$) · agrupados por resíduo e fornecedor'}
            onBack={onBack}
            maxWidth="100%"
            actions={<>
                <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                    <button onClick={() => setMetrica('peso')} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: metrica === 'peso' ? 'var(--color-success)' : 'transparent', color: metrica === 'peso' ? 'var(--color-on-accent)' : 'var(--color-text-muted)' }}>
                        <FaWeightHanging size={10} style={{ marginRight: 5 }} />Peso
                    </button>
                    <button onClick={() => setMetrica('valor')} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: metrica === 'valor' ? 'var(--color-warning)' : 'transparent', color: metrica === 'valor' ? 'var(--color-on-accent)' : 'var(--color-text-muted)' }}>
                        <FaDollarSign size={10} style={{ marginRight: 5 }} />Valor
                    </button>
                </div>
                <Select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)} style={{ width: 100, fontSize: '0.72rem' }}>
                    {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
                <Btn variant="outline" color="var(--color-text-muted)" onClick={() => setShowReport(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaChartBar size={10} /> Relatório de indicadores
                </Btn>
                <Btn variant="outline" color="var(--color-text-muted)" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaFileExcel size={10} /> Exportar Excel
                </Btn>
            </>}
        >
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaRecycle size={12} />} label="Resíduos" value={kpis.residuosUnicos} sub="tipos distintos" color="var(--color-success)" />
                <Kpi icon={<FaIndustry size={12} />} label="Fornecedores" value={kpis.fornecedoresUnicos} sub="parceiros ativos" color="var(--color-info)" />
                <Kpi icon={metrica === 'peso' ? <FaWeightHanging size={12} /> : <FaDollarSign size={12} />} label={`Total ${kpis.mesAtual}`} value={fmtUnidade(kpis.totalMesAtual)} sub="mês corrente" color="var(--color-orange)" />
                <Kpi icon={<FaChartBar size={12} />} label={`Total ${anoFiltro}`} value={fmtUnidade(kpis.totalGeral)} sub="acumulado no ano" color="var(--color-purple)" />
                <Kpi icon={<FaTrophy size={12} />} label="Maior fornecedor" value={indicadores.liderFornecedor ? fmtUnidade(indicadores.liderFornecedor.valor) : '—'} sub={indicadores.liderFornecedor?.nomeCompleto || 'sem dados'} color="var(--color-warning)" />
            </div>

            {/* Indicadores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                <Card style={{ padding: '0.9rem 1rem' }}>
                    <h3 style={chartTitle}><FaIndustry size={11} color="var(--color-info)" /> Por fornecedor (top 8)</h3>
                    {indicadores.topFornecedores.length === 0 ? <SemDados /> : (
                        <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={indicadores.topFornecedores} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="nome" width={108} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmtUnidade(v), null]} labelFormatter={(l, p) => p?.[0]?.payload?.nomeCompleto || l} separator="" />
                                <Bar dataKey="valor" fill="var(--color-info)" radius={[0, 4, 4, 0]} maxBarSize={14} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
                <Card style={{ padding: '0.9rem 1rem' }}>
                    <h3 style={chartTitle}><FaRecycle size={11} color="var(--color-success)" /> Por resíduo (top 8)</h3>
                    {indicadores.topResiduos.length === 0 ? <SemDados /> : (
                        <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={indicadores.topResiduos} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="nome" width={108} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmtUnidade(v), null]} labelFormatter={(l, p) => p?.[0]?.payload?.nomeCompleto || l} separator="" />
                                <Bar dataKey="valor" fill="var(--color-success)" radius={[0, 4, 4, 0]} maxBarSize={14} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
                <Card style={{ padding: '0.9rem 1rem' }}>
                    <h3 style={chartTitle}><FaChartBar size={11} color="var(--color-orange)" /> Evolução mensal ({anoFiltro})</h3>
                    <ResponsiveContainer width="100%" height={190}>
                        <BarChart data={indicadores.evolucaoMensal} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-soft)" vertical={false} />
                            <XAxis dataKey="mes" tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-subtle)', fontSize: 10 }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmtUnidade(v), null]} separator="" />
                            <Bar dataKey="valor" fill="var(--color-orange)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Tabela Pivot */}
            <div className="conciliacao-tbl" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color-soft)' }}>
                <style>{`
                    .conciliacao-tbl table { width: 100%; border-collapse: collapse; font-size: 0.68rem; font-variant-numeric: tabular-nums; }
                    .conciliacao-tbl thead th {
                        position: sticky; top: 0; z-index: 2;
                        padding: 0.5rem 0.55rem; font-size: 0.56rem; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.7px;
                        color: #fff; background: #2d3a2e;
                        border-bottom: 2px solid #4a5f4b;
                        white-space: nowrap; text-align: center;
                    }
                    .conciliacao-tbl thead th:first-child,
                    .conciliacao-tbl thead th:nth-child(2) { text-align: left; position: sticky; z-index: 3; }
                    .conciliacao-tbl thead th:first-child { left: 0; min-width: 180px; }
                    .conciliacao-tbl thead th:nth-child(2) { left: 180px; min-width: 130px; border-right: 2px solid #4a5f4b; }
                    .conciliacao-tbl thead th:last-child { background: #3a4a3b; font-weight: 800; }
                    .conciliacao-tbl tbody td {
                        padding: 0.38rem 0.55rem; text-align: right; color: var(--color-text-main);
                        border-bottom: 1px solid var(--border-color-soft); white-space: nowrap;
                        transition: background 0.1s;
                    }
                    .conciliacao-tbl tbody td:first-child,
                    .conciliacao-tbl tbody td:nth-child(2) {
                        text-align: left; font-weight: 600; position: sticky; z-index: 1;
                        background: var(--bg-surface);
                    }
                    .conciliacao-tbl tbody td:first-child { left: 0; min-width: 180px; }
                    .conciliacao-tbl tbody td:nth-child(2) { left: 180px; min-width: 130px; border-right: 2px solid var(--border-color-soft); font-weight: 500; color: var(--color-text-muted); font-size: 0.62rem; }
                    .conciliacao-tbl tbody td:last-child { font-weight: 700; background: rgba(255,255,255,0.02); }
                    .conciliacao-tbl tbody td.val-zero { color: var(--color-text-subtle); }
                    .conciliacao-tbl tbody tr:hover td { background: var(--bg-surface-2) !important; }
                    .conciliacao-tbl tbody tr:hover td:first-child,
                    .conciliacao-tbl tbody tr:hover td:nth-child(2) { background: var(--bg-surface-2) !important; }
                    .conciliacao-tbl tbody tr.row-group-start td { border-top: 2px solid var(--border-color); }
                    .conciliacao-tbl tfoot td {
                        padding: 0.5rem 0.55rem; font-weight: 800; text-align: right;
                        color: #fff; background: #2d3a2e; border-top: 2px solid #4a5f4b;
                        white-space: nowrap; font-size: 0.7rem; position: sticky; bottom: 0; z-index: 2;
                    }
                    .conciliacao-tbl tfoot td:first-child,
                    .conciliacao-tbl tfoot td:nth-child(2) { text-align: left; position: sticky; z-index: 3; }
                    .conciliacao-tbl tfoot td:first-child { left: 0; }
                    .conciliacao-tbl tfoot td:nth-child(2) { left: 180px; border-right: 2px solid #4a5f4b; }
                    .conciliacao-tbl tfoot td:last-child { background: #3a4a3b; color: var(--color-success); }
                    .conciliacao-tbl .col-active { background: rgba(16, 185, 129, 0.04) !important; }
                    .conciliacao-tbl thead .col-active { background: #3a5a3b !important; }
                `}</style>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                        Carregando dados do Supabase…
                    </div>
                ) : linhas.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                        Nenhum registro encontrado para {anoFiltro}. Lance o peso recebido (relatório do fornecedor) nos manifestos para preencher esta tabela.
                    </div>
                ) : (
                    <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Resíduo</th>
                                    <th>Fornecedor</th>
                                    {MESES.map((m, i) => (
                                        <th key={m} className={i === mesIdxAtual && anoFiltro === new Date().getFullYear().toString() ? 'col-active' : ''}>{m}</th>
                                    ))}
                                    <th>SOMA{unidade === 'kg' ? ' (kg)' : ''}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.map((row, idx) => {
                                    const isGroupStart = row.residuo !== lastResiduo;
                                    lastResiduo = row.residuo;
                                    const sameResiduo = linhas.filter((r) => r.residuo === row.residuo);
                                    const isFirstOfGroup = sameResiduo[0] === row;
                                    const rowSpan = sameResiduo.length;

                                    return (
                                        <tr key={idx} className={isGroupStart ? 'row-group-start' : ''}>
                                            {isFirstOfGroup ? (
                                                <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', fontSize: '0.66rem', lineHeight: 1.3, whiteSpace: 'normal', wordBreak: 'break-word', borderRight: '1px solid var(--border-color-soft)' }}>
                                                    {row.residuo || '—'}
                                                </td>
                                            ) : null}
                                            <td>{row.fornecedor || '—'}</td>
                                            {MESES.map((m, i) => (
                                                <td key={m} className={`${!row[m] ? 'val-zero' : ''} ${i === mesIdxAtual && anoFiltro === new Date().getFullYear().toString() ? 'col-active' : ''}`}>
                                                    {fmt(row[m])}
                                                </td>
                                            ))}
                                            <td style={{ color: row.SOMA > 0 ? 'var(--color-success)' : 'var(--color-text-subtle)' }}>{fmt(row.SOMA)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>TOTAL</td>
                                    <td>-</td>
                                    {MESES.map((m, i) => (
                                        <td key={m} className={i === mesIdxAtual && anoFiltro === new Date().getFullYear().toString() ? 'col-active' : ''}>
                                            {fmt(totaisMes[m])}
                                        </td>
                                    ))}
                                    <td>{fmt(totalGeral)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {showReport && (
                <RelatorioIndicadores
                    onClose={() => setShowReport(false)}
                    ano={anoFiltro}
                    metrica={metrica}
                    unidade={unidade}
                    fmtUnidade={fmtUnidade}
                    kpis={kpis}
                    indicadores={indicadores}
                    emissor={nomeUsuario}
                />
            )}
        </PageShell>
    );
}

function SemDados() {
    return <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-subtle)', fontSize: '0.78rem' }}>Sem dados ainda.</div>;
}

// ── Relatório de Indicadores — modal imprimível (A4) ──
function RelatorioIndicadores({ onClose, ano, metrica, unidade, fmtUnidade, kpis, indicadores, emissor }) {
    const agora = new Date();
    const kpiBox = { border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.6rem 0.8rem', textAlign: 'center' };
    const kpiVal = { fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 };
    const kpiLbl = { fontSize: '0.56rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-subtle)' };
    const th = { textAlign: 'left', padding: '0.4rem 0.55rem', fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-subtle)', borderBottom: '1px solid var(--border-color)' };
    const td = { padding: '0.4rem 0.55rem', fontSize: '0.74rem', borderBottom: '1px solid var(--border-color-soft)', color: 'var(--color-text-main)' };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 12mm; }
                    body * { visibility: hidden !important; }
                    .conc-report, .conc-report * { visibility: visible !important; }
                    .conc-report { position: absolute !important; left: 0; top: 0; width: 100% !important; max-height: none !important; background: #fff !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
                    .conc-report * { color: #000 !important; background: transparent !important; border-color: #999 !important; }
                    .conc-report .no-print { display: none !important; }
                }
            `}</style>
            <div className="conc-report" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 14, maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.4rem 1.6rem' }}>
                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.8rem' }}>
                    <Btn color="var(--color-success)" onClick={() => window.print()} style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}><FaPrint size={11} /> Imprimir</Btn>
                    <Btn variant="outline" color="var(--color-text-muted)" onClick={onClose} style={{ padding: '0.35rem 0.55rem', fontSize: '0.7rem' }}><FaTimes size={12} /></Btn>
                </div>

                <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.7rem', marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Relatório de Indicadores — Conciliação por Fornecedor</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                        Métrica: <strong>{metrica === 'peso' ? 'Peso recebido (kg)' : 'Valor de reembolso (R$)'}</strong> · Ano: <strong>{ano}</strong> · Emitido em {agora.toLocaleDateString('pt-BR')} às {agora.toTimeString().slice(0, 5)}{emissor ? ` por ${emissor}` : ''} · SGA — Sistema de Gestão Ambiental
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={kpiBox}><div style={kpiVal}>{kpis.residuosUnicos}</div><div style={kpiLbl}>Resíduos distintos</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{kpis.fornecedoresUnicos}</div><div style={kpiLbl}>Fornecedores ativos</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{fmtUnidade(kpis.totalMesAtual)}</div><div style={kpiLbl}>Total {kpis.mesAtual}</div></div>
                    <div style={kpiBox}><div style={kpiVal}>{fmtUnidade(kpis.totalGeral)}</div><div style={kpiLbl}>Total {ano}</div></div>
                </div>

                <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 0.4rem' }}>Ranking por fornecedor</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead><tr><th style={th}>#</th><th style={th}>Fornecedor</th><th style={{ ...th, textAlign: 'right' }}>{unidade === 'kg' ? 'Peso (kg)' : 'Valor (R$)'}</th></tr></thead>
                    <tbody>
                        {indicadores.topFornecedores.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: 'var(--color-text-subtle)' }}>Sem dados.</td></tr>}
                        {indicadores.topFornecedores.map((f, i) => (
                            <tr key={f.nomeCompleto}><td style={td}>{i + 1}º</td><td style={td}>{f.nomeCompleto}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtUnidade(f.valor)}</td></tr>
                        ))}
                    </tbody>
                </table>

                <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 0.4rem' }}>Ranking por resíduo</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead><tr><th style={th}>#</th><th style={th}>Resíduo</th><th style={{ ...th, textAlign: 'right' }}>{unidade === 'kg' ? 'Peso (kg)' : 'Valor (R$)'}</th></tr></thead>
                    <tbody>
                        {indicadores.topResiduos.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: 'var(--color-text-subtle)' }}>Sem dados.</td></tr>}
                        {indicadores.topResiduos.map((r, i) => (
                            <tr key={r.nomeCompleto}><td style={td}>{i + 1}º</td><td style={td}>{r.nomeCompleto}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtUnidade(r.valor)}</td></tr>
                        ))}
                    </tbody>
                </table>

                <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 0.4rem' }}>Evolução mensal ({ano})</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{MESES.map((m) => <th key={m} style={{ ...th, textAlign: 'center' }}>{m}</th>)}</tr></thead>
                    <tbody><tr>{indicadores.evolucaoMensal.map((m) => <td key={m.mes} style={{ ...td, textAlign: 'center' }}>{m.valor ? fmtUnidade(m.valor) : '—'}</td>)}</tr></tbody>
                </table>
            </div>
        </div>
    );
}

export default ConciliacaoFornecedoresView;
