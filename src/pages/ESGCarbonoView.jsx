import { useMemo, useState } from 'react';
import {
    FaGlobeAmericas, FaIndustry, FaBolt, FaTruckMoving, FaSeedling,
    FaPlus, FaEdit, FaTrash, FaFileExcel, FaBullseye, FaChartLine,
    FaBalanceScale, FaArrowDown, FaArrowUp, FaCheckCircle, FaCog, FaCloud, FaCalculator,
    FaBookOpen, FaClipboardCheck, FaUsers, FaMapMarkedAlt, FaPhone, FaEnvelope, FaUserCheck,
} from 'react-icons/fa';
import {
    AreaChart, Area, ComposedChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { PageShell, Card, Btn, Field, Input, Select, FormGrid, Modal, RowAction, StatusBadge } from '../components/ui';
import { InfoTip, MemoriaCalculo, ExplicaBox, GlossarioModal } from '../components/didatico';
import { useCollection, COL, saveConfig } from '../lib/store';
import { exportToExcel } from '../lib/excel';
import {
    GEE_ESCOPOS, FATORES_EMISSAO, fatorEmissao, calcCO2e, ESG_PILARES, ESG_PROGRAMA_DEFAULT,
    STATUS_INICIATIVA, ESG_STATUS_COLORS, progressoIndicador, scoreColor, scoreRating, apuradoInfo,
    MESES, COLETA_STATUS, proximoStatusColeta, escopoDaCategoria,
    TAXONOMIA_EMISSOES, CATEGORIAS_EMISSAO, taxonomiaPorRotulo, unidadeMedidaPadrao,
    STATUS_FONTE, PERFIS_CARBONO,
} from '../lib/constants';

// ─── Formatação ───
const fmt = (n, d = 1) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt0 = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const co2eDe = (e) => calcCO2e(e.consumo, e.fator);
const tooltipStyle = { background: '#1c1d26', border: '1px solid #2a2b32', borderRadius: 8, color: '#fff', fontSize: '0.8rem' };

const TABS = [
    { id: 'visao', label: 'Visão Geral', icon: <FaGlobeAmericas size={13} /> },
    { id: 'inventario', label: 'Inventário GEE', icon: <FaCloud size={13} /> },
    { id: 'coleta', label: 'Coleta & Responsáveis', icon: <FaClipboardCheck size={13} /> },
    { id: 'indicadores', label: 'Indicadores ESG', icon: <FaBalanceScale size={13} /> },
    { id: 'descarbonizacao', label: 'Descarbonização', icon: <FaArrowDown size={13} /> },
];

const ESCOPO_ICON = { 1: <FaIndustry size={13} />, 2: <FaBolt size={13} />, 3: <FaTruckMoving size={13} /> };

function ESGCarbonoView({ onBack }) {
    const { items: emissoes, add: addEmissao, update: updEmissao, remove: rmEmissao } = useCollection(COL.EMISSOES);
    const { items: esgInd, update: updInd } = useCollection(COL.ESG_IND);
    const { items: iniciativas, add: addIni, update: updIni, remove: rmIni } = useCollection(COL.INICIATIVAS);
    const { items: cfgArr } = useCollection(COL.ESG_CFG);
    const { items: manifestos } = useCollection(COL.MANIFESTOS);
    const { items: fumaca } = useCollection(COL.FUMACA);
    const { items: mapa, update: updMapa, add: addMapa, remove: rmMapa } = useCollection(COL.MAPA_EMISSOES);
    const { items: contatos } = useCollection(COL.CONTATOS);

    const cfg = cfgArr[0] || ESG_PROGRAMA_DEFAULT;
    const [tab, setTab] = useState('visao');
    const [showGlossario, setShowGlossario] = useState(false);

    // ─── Núcleo de cálculo ───
    const calc = useMemo(() => {
        const anos = [...new Set(emissoes.map((e) => e.ano))].sort();
        const anoCorrente = anos.length ? anos[anos.length - 1] : new Date().getFullYear();

        const porAno = {};
        anos.forEach((a) => { porAno[a] = 0; });
        emissoes.forEach((e) => { porAno[e.ano] = (porAno[e.ano] || 0) + co2eDe(e); });

        // Emissões por escopo no ano corrente
        const porEscopoCorrente = { 1: 0, 2: 0, 3: 0 };
        emissoes.filter((e) => e.ano === anoCorrente).forEach((e) => { porEscopoCorrente[e.escopo] += co2eDe(e); });

        const baseline = porAno[cfg.anoBase] || (anos.length ? porAno[anos[0]] : 0);
        const totalCorrente = porAno[anoCorrente] || 0;

        // Trajetória meta (linear entre ano base e ano meta)
        const metaFinal = baseline * (1 - (cfg.reducaoMetaPct || 0) / 100);
        const anosTraj = [];
        for (let y = cfg.anoBase; y <= cfg.anoMeta; y++) {
            const frac = (y - cfg.anoBase) / Math.max(1, cfg.anoMeta - cfg.anoBase);
            anosTraj.push({
                ano: String(y),
                meta: Math.round((baseline - (baseline - metaFinal) * frac) * 10) / 10,
                realizado: porAno[y] != null ? Math.round(porAno[y] * 10) / 10 : null,
            });
        }

        // Redução já alcançada (ano corrente vs base) — usa último ano cheio se corrente é parcial
        const reducaoPct = baseline ? Math.max(0, Math.round((1 - totalCorrente / baseline) * 100)) : 0;
        const progressoMeta = cfg.reducaoMetaPct ? Math.min(100, Math.round((reducaoPct / cfg.reducaoMetaPct) * 100)) : 0;

        // Intensidade de carbono
        const intensidade = cfg.producaoAnual ? totalCorrente / cfg.producaoAnual : 0;

        return { anos, anoCorrente, porAno, porEscopoCorrente, baseline, totalCorrente, metaFinal, anosTraj, reducaoPct, progressoMeta, intensidade };
    }, [emissoes, cfg]);

    // ─── Indicadores ambientais derivados (das outras coleções) ───
    const derivadosE = useMemo(() => {
        const recicladoTipos = ['Reciclagem', 'Reutilização', 'Compostagem', 'Coprocessamento'];
        let val = 0, total = 0;
        manifestos.forEach((m) => {
            const q = Number(m.quantidade || 0); total += q;
            if (recicladoTipos.includes(m.destinacao)) val += q;
        });
        const valorizacao = total ? Math.round((val / total) * 100) : 0;

        let fumT = 0, fumOk = 0;
        fumaca.forEach((rel) => (rel.rounds || []).forEach((r) => r.medicoes.forEach((m) => {
            fumT++; if (apuradoInfo(m.apurado).conforme) fumOk++;
        })));
        const conformidadeFumaca = fumT ? Math.round((fumOk / fumT) * 100) : 100;

        return [
            { nome: 'Redução de emissões vs. ano base', valor: calc.reducaoPct, meta: cfg.reducaoMetaPct, unidade: '%', melhor: 'maior', derivado: true },
            { nome: 'Valorização de resíduos (não-aterro)', valor: valorizacao, meta: 95, unidade: '%', melhor: 'maior', derivado: true },
            { nome: 'Conformidade de emissões atmosféricas', valor: conformidadeFumaca, meta: 100, unidade: '%', melhor: 'maior', derivado: true },
        ];
    }, [manifestos, fumaca, calc.reducaoPct, cfg.reducaoMetaPct]);

    // ─── Scores ESG por pilar ───
    const scores = useMemo(() => {
        const indByPilar = (p) => esgInd.filter((i) => i.pilar === p);
        const mediaProg = (arr) => arr.length ? Math.round(arr.reduce((s, i) => s + progressoIndicador(i.valor, i.meta, i.melhor), 0) / arr.length) : 0;

        const eItems = [...derivadosE, ...indByPilar('E')];
        const E = mediaProg(eItems);
        const S = mediaProg(indByPilar('S'));
        const G = mediaProg(indByPilar('G'));
        const geral = Math.round((E + S + G) / 3);
        return { E, S, G, geral, eItems };
    }, [esgInd, derivadosE]);

    const potencialReducao = iniciativas.reduce((s, i) => s + Number(i.reducao || 0), 0);

    // ─── Progresso da coleta de dados (mapa multiunidade) ───
    // Fontes "Não aplicável" ficam fora das fronteiras de emissão e não contam.
    const coleta = useMemo(() => {
        let coletado = 0, aplicaveis = 0, naoAplicavel = 0;
        const unidades = new Set();
        mapa.forEach((m) => {
            unidades.add(m.unidade);
            if (m.status === 'Não aplicável') { naoAplicavel++; return; }
            MESES.forEach((mes) => {
                const st = (m.meses || {})[mes] || 'pendente';
                if (st === 'na') return;
                aplicaveis++;
                if (st === 'coletado') coletado++;
            });
        });
        const pct = aplicaveis ? Math.round((coletado / aplicaveis) * 100) : 0;
        const mapeadas = mapa.filter((m) => m.status !== 'Não aplicável');
        const semFornecedor = mapeadas.filter((m) => !(m.fornecedor?.nome || m.responsavel)).length;
        return { fontes: mapeadas.length, total: mapa.length, unidades: unidades.size, pct, coletado, aplicaveis, semFornecedor, naoAplicavel };
    }, [mapa]);

    return (
        <PageShell
            icon={<FaGlobeAmericas size={20} />} color="#10b981"
            title="ESG & Carbono" subtitle="Inventário de GEE · GHG Protocol · Trajetória Net Zero"
            onBack={onBack}
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={() => setShowGlossario(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaBookOpen size={10} /> Glossário</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={() => exportInventario(emissoes)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={10} /> Exportar inventário</Btn>
            </>}
        >
            {/* Abas */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 0.9rem',
                        borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        background: tab === t.id ? '#10b98122' : 'transparent',
                        color: tab === t.id ? '#10b981' : 'var(--color-text-muted)',
                        border: `1px solid ${tab === t.id ? '#10b98155' : 'var(--border-color-soft)'}`,
                    }}>{t.icon} {t.label}</button>
                ))}
            </div>

            {tab === 'visao' && <VisaoGeral calc={calc} scores={scores} cfg={cfg} potencialReducao={potencialReducao} coleta={coleta} onIrColeta={() => setTab('coleta')} />}
            {tab === 'inventario' && <Inventario emissoes={emissoes} calc={calc} addEmissao={addEmissao} updEmissao={updEmissao} rmEmissao={rmEmissao} />}
            {tab === 'coleta' && <MapaColeta mapa={mapa} updMapa={updMapa} addMapa={addMapa} rmMapa={rmMapa} contatos={contatos} coleta={coleta} />}
            {tab === 'indicadores' && <Indicadores scores={scores} esgInd={esgInd} updInd={updInd} />}
            {tab === 'descarbonizacao' && <Descarbonizacao calc={calc} cfg={cfg} iniciativas={iniciativas} addIni={addIni} updIni={updIni} rmIni={rmIni} potencialReducao={potencialReducao} />}

            {showGlossario && <GlossarioModal onClose={() => setShowGlossario(false)} />}
        </PageShell>
    );
}

// ════════════════════════════════════════════════════════════════
//  ABA 1 — VISÃO GERAL
// ════════════════════════════════════════════════════════════════
function VisaoGeral({ calc, scores, cfg, potencialReducao, coleta, onIrColeta }) {
    return (
        <>
            <ExplicaBox titulo="Como ler o Painel ESG & Carbono" color="#10b981">
                <p style={{ margin: '0 0 0.5rem' }}>
                    Esta tela consolida a <strong>pegada de carbono</strong> da operação e o <strong>desempenho ESG</strong> em quatro abas:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    <li><strong>Visão Geral</strong> — os números-chave do ano e o caminho até a meta climática.</li>
                    <li><strong>Inventário GEE</strong> — cada fonte de emissão, com o cálculo auditável (consumo × fator de emissão).</li>
                    <li><strong>Indicadores ESG</strong> — Ambiental, Social e Governança, com metas e progresso.</li>
                    <li><strong>Descarbonização</strong> — as iniciativas que reduzem emissões e o quanto cobrem da meta.</li>
                </ul>
                <p style={{ margin: '0.5rem 0 0' }}>
                    Passe o mouse no ícone <span style={{ color: '#00ccff' }}>ⓘ</span> de qualquer indicador para ver a definição e a fórmula. O botão <strong>Glossário</strong> (topo) reúne todos os termos técnicos.
                </p>
            </ExplicaBox>

            {/* KPIs principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <BigKpi icon={<FaCloud size={16} />} color="#10b981"
                    label={`Emissões ${calc.anoCorrente}`} value={fmt(calc.totalCorrente)} unit="tCO₂e"
                    trend={calc.reducaoPct > 0 ? { dir: 'down', txt: `${calc.reducaoPct}% vs ${cfg.anoBase}` } : null}
                    info={<InfoTip title={`Emissões totais de ${calc.anoCorrente}`} color="#10b981">
                        Soma de todos os gases de efeito estufa do ano, convertidos em <strong>toneladas de CO₂ equivalente (tCO₂e)</strong> e somando os Escopos 1, 2 e 3.
                    </InfoTip>} />
                <BigKpi icon={<FaBullseye size={16} />} color="#54a0ff"
                    label="Progresso da meta" value={calc.progressoMeta} unit="%"
                    sub={`Meta: −${cfg.reducaoMetaPct}% até ${cfg.anoMeta}`}
                    info={<InfoTip title="Progresso da meta de redução" color="#54a0ff">
                        Quanto da meta climática já foi cumprido. 100% significa atingir a redução de <strong>{cfg.reducaoMetaPct}%</strong> prevista para {cfg.anoMeta} (alinhada à <strong>SBTi</strong>).
                    </InfoTip>} />
                <BigKpi icon={<FaChartLine size={16} />} color={scoreColor(scores.geral)}
                    label="Score ESG" value={scores.geral} unit={`/100 · ${scoreRating(scores.geral)}`}
                    info={<InfoTip title="Score ESG (0–100)" color={scoreColor(scores.geral)}>
                        Média do desempenho nos três pilares — <strong>Ambiental, Social e Governança</strong> — onde cada indicador é medido contra sua meta. O rating (AAA–CCC) traduz a faixa atingida.
                    </InfoTip>} />
                <BigKpi icon={<FaIndustry size={16} />} color="#ffb700"
                    label="Intensidade de carbono" value={fmt(calc.intensidade, 3)} unit={`tCO₂e/${(cfg.unidadeProducao || 't').replace('produzida', 't')}`}
                    sub={`Base: ${fmt0(cfg.producaoAnual)} ${cfg.unidadeProducao}`}
                    info={<InfoTip title="Intensidade de carbono" color="#ffb700">
                        Emissões por unidade produzida. Mede a <strong>eficiência climática</strong>: é possível crescer a produção e ainda assim emitir menos por produto.
                    </InfoTip>} />
                {coleta && (
                    <div onClick={onIrColeta} style={{ cursor: 'pointer' }} title="Abrir Coleta & Responsáveis">
                        <BigKpi icon={<FaClipboardCheck size={16} />} color={coleta.pct >= 80 ? '#10b981' : '#54a0ff'}
                            label="Coleta de dados" value={`${coleta.pct}%`} unit={`· ${coleta.unidades} unidades`}
                            sub={`${coleta.coletado}/${coleta.aplicaveis} dados mensais · ${coleta.fontes} fontes`}
                            info={<InfoTip title="Progresso da coleta do inventário" color="#54a0ff">
                                Percentual dos dados mensais já coletados nas unidades (Manaus, Barueri, Cajamar, Araçariguama, MK Sul, Jacuípe). Cada fonte tem um <strong>responsável</strong> e 12 meses a preencher.
                            </InfoTip>} />
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Trajetória Net Zero */}
                <Card>
                    <SecTitle icon={<FaArrowDown size={13} color="#10b981" />}>Trajetória rumo ao Net Zero</SecTitle>
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={calc.anosTraj} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="ano" tick={{ fill: '#8b9bb4', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#8b9bb4', fontSize: 11 }} unit=" t" width={56} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v) => v == null ? '—' : `${fmt(v)} tCO₂e`} />
                            <Area type="monotone" dataKey="realizado" name="Realizado" stroke="#10b981" strokeWidth={2.5} fill="url(#gReal)" connectNulls dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="meta" name="Meta (SBTi)" stroke="#54a0ff" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                            <ReferenceLine y={calc.metaFinal} stroke="#54a0ff" strokeOpacity={0.4} strokeDasharray="2 4" />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>
                        <Legenda color="#10b981" label="Emissões realizadas" />
                        <Legenda color="#54a0ff" label={`Meta −${cfg.reducaoMetaPct}% (${cfg.anoMeta})`} />
                    </div>
                </Card>

                {/* Score ESG gauge */}
                <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <SecTitle icon={<FaBalanceScale size={13} color="#a78bfa" />} style={{ alignSelf: 'flex-start' }}>Desempenho ESG</SecTitle>
                    <ScoreGauge score={scores.geral} />
                    <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem', width: '100%' }}>
                        {[['E', scores.E], ['S', scores.S], ['G', scores.G]].map(([p, s]) => (
                            <div key={p} style={{ flex: 1, textAlign: 'center', padding: '0.6rem 0.3rem', borderRadius: 10, background: ESG_PILARES[p].color + '12', border: `1px solid ${ESG_PILARES[p].color}33` }}>
                                <div style={{ fontSize: '0.62rem', color: ESG_PILARES[p].color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{ESG_PILARES[p].label}</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{s}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Cards de escopo + potencial */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {Object.values(GEE_ESCOPOS).map((esc) => (
                    <EscopoCardResumo key={esc.id} esc={esc} valor={calc.porEscopoCorrente[esc.id]} ano={calc.anoCorrente} />
                ))}
                <Card style={{ borderLeft: '3px solid #00ff9d' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <FaSeedling size={14} color="#00ff9d" />
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Potencial em carteira</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)' }}>−{fmt(potencialReducao)} <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>tCO₂e/ano</span></div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>Soma das iniciativas de descarbonização</div>
                </Card>
            </div>

            {/* Memórias de cálculo — transparência e auditabilidade */}
            <h3 style={{ margin: '1.6rem 0 0.8rem', fontSize: '0.9rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaCalculator size={13} color="#10b981" /> Memórias de cálculo
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>— como cada número desta tela é obtido</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <MemoriaCalculo titulo="Redução vs. ano base" color="#10b981"
                    formula="Redução (%) = (1 − emissões do ano ÷ linha de base) × 100"
                    passos={[
                        { label: `Emissões ${calc.anoCorrente}`, valor: `${fmt(calc.totalCorrente)} tCO₂e` },
                        { label: `Linha de base (${cfg.anoBase})`, valor: `${fmt(calc.baseline)} tCO₂e` },
                    ]}
                    resultado={`${calc.reducaoPct}% de redução`} />
                <MemoriaCalculo titulo="Progresso da meta" color="#54a0ff"
                    formula="Progresso (%) = redução atingida ÷ redução-meta × 100"
                    passos={[
                        { label: 'Redução atingida', valor: `${calc.reducaoPct}%` },
                        { label: `Redução-meta (${cfg.anoMeta})`, valor: `${cfg.reducaoMetaPct}%` },
                    ]}
                    resultado={`${calc.progressoMeta}% da meta`} />
                <MemoriaCalculo titulo="Intensidade de carbono" color="#ffb700"
                    formula="Intensidade = emissões do ano ÷ produção do ano"
                    passos={[
                        { label: `Emissões ${calc.anoCorrente}`, valor: `${fmt(calc.totalCorrente)} tCO₂e` },
                        { label: 'Produção anual', valor: `${fmt0(cfg.producaoAnual)} ${cfg.unidadeProducao}` },
                    ]}
                    resultado={`${fmt(calc.intensidade, 3)} tCO₂e/${(cfg.unidadeProducao || 't').replace('produzida', 't')}`} />
                <MemoriaCalculo titulo="Score ESG" color={scoreColor(scores.geral)}
                    formula="Score = média dos pilares (E + S + G) ÷ 3"
                    passos={[
                        { label: 'Ambiental (E)', valor: `${scores.E}` },
                        { label: 'Social (S)', valor: `${scores.S}` },
                        { label: 'Governança (G)', valor: `${scores.G}` },
                    ]}
                    resultado={`${scores.geral} / 100 · ${scoreRating(scores.geral)}`} />
                <MemoriaCalculo titulo="Meta de emissões (ano-alvo)" color="#a78bfa"
                    formula="Meta = linha de base × (1 − redução-meta ÷ 100)"
                    passos={[
                        { label: `Linha de base (${cfg.anoBase})`, valor: `${fmt(calc.baseline)} tCO₂e` },
                        { label: 'Redução-meta', valor: `${cfg.reducaoMetaPct}%` },
                    ]}
                    resultado={`${fmt(calc.metaFinal)} tCO₂e em ${cfg.anoMeta}`} />
                <MemoriaCalculo titulo="Emissão de cada fonte (GEE)" color="#ff6b6b"
                    formula="Emissão (tCO₂e) = consumo × fator de emissão ÷ 1000"
                    passos={[
                        { label: 'Ex.: diesel geradores', valor: `${fmt0(18000)} L` },
                        { label: 'Fator (kgCO₂e/L)', valor: '2,603' },
                    ]}
                    resultado={`${fmt(18000 * 2.603 / 1000, 1)} tCO₂e`} />
            </div>
        </>
    );
}

// Card resumo de escopo: emissões do ano corrente
function EscopoCardResumo({ esc, valor, ano }) {
    return (
        <Card style={{ borderLeft: `3px solid ${esc.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: esc.color }}>
                {ESCOPO_ICON[esc.id]}
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{esc.label} · {esc.titulo}</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{fmt(valor)} <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>tCO₂e · {ano}</span></div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 2, lineHeight: 1.4 }}>{esc.desc}</div>
        </Card>
    );
}

// ════════════════════════════════════════════════════════════════
//  ABA 2 — INVENTÁRIO GEE
// ════════════════════════════════════════════════════════════════
function Inventario({ emissoes, calc, addEmissao, updEmissao, rmEmissao }) {
    const [filtroAno, setFiltroAno] = useState('todos');
    const [filtroEscopo, setFiltroEscopo] = useState('todos');
    const [editing, setEditing] = useState(null); // objeto ou null
    const [showModal, setShowModal] = useState(false);

    const filtradas = emissoes.filter((e) =>
        (filtroAno === 'todos' || String(e.ano) === filtroAno) &&
        (filtroEscopo === 'todos' || String(e.escopo) === filtroEscopo)
    ).sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    // Totais por escopo (do conjunto filtrado)
    const porEscopo = { 1: 0, 2: 0, 3: 0 };
    filtradas.forEach((e) => { porEscopo[e.escopo] += co2eDe(e); });
    const totalFiltrado = porEscopo[1] + porEscopo[2] + porEscopo[3];

    // Emissões por categoria (barra)
    const porCategoria = {};
    filtradas.forEach((e) => { porCategoria[e.categoria] = (porCategoria[e.categoria] || 0) + co2eDe(e); });
    const barCat = Object.entries(porCategoria).map(([name, v]) => ({ name, t: Math.round(v * 10) / 10 })).sort((a, b) => b.t - a.t);

    const abrirNovo = () => { setEditing(null); setShowModal(true); };
    const abrirEdit = (e) => { setEditing(e); setShowModal(true); };
    const salvar = (dados) => {
        if (editing) updEmissao(editing.id, dados); else addEmissao(dados);
        setShowModal(false); setEditing(null);
    };

    return (
        <>
            {/* Donut por escopo + barra por categoria */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <Card>
                    <SecTitle icon={<FaCloud size={13} color="#10b981" />}>
                        Emissões por escopo
                        <InfoTip title="O que são os Escopos 1, 2 e 3" color="#10b981">
                            Classificação do GHG Protocol: <strong>Escopo 1</strong> = fontes próprias (geradores, frota, GLP); <strong>Escopo 2</strong> = energia elétrica comprada; <strong>Escopo 3</strong> = cadeia de valor (logística, resíduos, viagens).
                        </InfoTip>
                    </SecTitle>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <ResponsiveContainer width="55%" height={180}>
                            <PieChart>
                                <Pie data={[1, 2, 3].map((s) => ({ name: GEE_ESCOPOS[s].label, value: Math.round(porEscopo[s] * 10) / 10, s }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2}>
                                    {[1, 2, 3].map((s) => <Cell key={s} fill={GEE_ESCOPOS[s].color} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${fmt(v)} tCO₂e`} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex: 1 }}>
                            {[1, 2, 3].map((s) => (
                                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color-soft)' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                        <span style={{ width: 9, height: 9, borderRadius: 2, background: GEE_ESCOPOS[s].color }} /> {GEE_ESCOPOS[s].label}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{fmt(porEscopo[s])} t</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.45rem', fontWeight: 800 }}>
                                <span style={{ fontSize: '0.76rem', color: 'var(--color-text-subtle)' }}>TOTAL</span>
                                <span style={{ fontSize: '0.9rem', color: '#10b981' }}>{fmt(totalFiltrado)} t</span>
                            </div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <SecTitle icon={<FaIndustry size={13} color="#ffb700" />}>Emissões por categoria de fonte</SecTitle>
                    {barCat.length === 0 ? <Vazio /> : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={barCat} layout="vertical" margin={{ left: 10, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#8b9bb4', fontSize: 10 }} unit=" t" />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#8b9bb4', fontSize: 10 }} width={130} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => `${fmt(v)} tCO₂e`} />
                                <Bar dataKey="t" fill="#ffb700" radius={[0, 5, 5, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)', marginRight: 'auto' }}>Lançamentos do inventário</span>
                <Select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} style={{ width: 120 }}>
                    <option value="todos">Todos os anos</option>
                    {calc.anos.map((a) => <option key={a} value={String(a)}>{a}</option>)}
                </Select>
                <Select value={filtroEscopo} onChange={(e) => setFiltroEscopo(e.target.value)} style={{ width: 150 }}>
                    <option value="todos">Todos os escopos</option>
                    {[1, 2, 3].map((s) => <option key={s} value={String(s)}>{GEE_ESCOPOS[s].label}</option>)}
                </Select>
                <Btn color="#10b981" onClick={abrirNovo}><FaPlus size={11} /> Novo lançamento</Btn>
            </div>

            {/* Tabela */}
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color-soft)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-surface-2)' }}>
                            {['Ano', 'Escopo', 'Fonte', 'Atividade', 'Consumo', 'Fator', 'tCO₂e', ''].map((h, i) => (
                                <th key={i} style={{ textAlign: i >= 4 && i <= 6 ? 'right' : 'left', padding: '0.65rem 0.8rem', color: 'var(--color-text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtradas.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-subtle)' }}>Nenhum lançamento para o filtro.</td></tr>}
                        {filtradas.map((e) => (
                            <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                <td style={{ padding: '0.55rem 0.8rem', color: 'var(--color-text-main)' }}>{e.ano}</td>
                                <td style={{ padding: '0.55rem 0.8rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, background: GEE_ESCOPOS[e.escopo].color + '1f', color: GEE_ESCOPOS[e.escopo].color }}>
                                        {ESCOPO_ICON[e.escopo]} {e.escopo}
                                    </span>
                                </td>
                                <td style={{ padding: '0.55rem 0.8rem', color: 'var(--color-text-main)' }}>{e.fonte}</td>
                                <td style={{ padding: '0.55rem 0.8rem', color: 'var(--color-text-subtle)', fontSize: '0.76rem' }}>{e.atividade || '—'}</td>
                                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmt0(e.consumo)} {e.unidade}</td>
                                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', color: 'var(--color-text-subtle)', fontSize: '0.76rem' }}>{e.fator}</td>
                                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)' }}>{fmt(co2eDe(e))}</td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <RowAction icon={<FaEdit size={12} />} title="Editar" onClick={() => abrirEdit(e)} />
                                    <RowAction icon={<FaTrash size={12} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir lançamento?') && rmEmissao(e.id)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && <EmissaoModal inicial={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={salvar} />}
        </>
    );
}

function EmissaoModal({ inicial, onClose, onSave }) {
    const [f, setF] = useState(() => inicial || {
        ano: new Date().getFullYear(), fatorId: FATORES_EMISSAO[0].id, consumo: '', atividade: '',
        data: `${new Date().getFullYear()}-01-31`,
    });
    const fator = fatorEmissao(f.fatorId) || FATORES_EMISSAO[0];
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const co2e = calcCO2e(f.consumo, fator.fator);

    const submit = () => {
        if (!f.consumo) return;
        onSave({
            ano: Number(f.ano), data: f.data || `${f.ano}-01-31`,
            escopo: fator.escopo, categoria: fator.categoria, fonte: fator.nome,
            atividade: f.atividade, fatorId: fator.id, consumo: Number(f.consumo), unidade: fator.unidade, fator: fator.fator,
        });
    };

    return (
        <Modal title={inicial ? 'Editar lançamento de GEE' : 'Novo lançamento de GEE'} onClose={onClose} width={560}>
            <FormGrid cols={2}>
                <Field label="Fonte de emissão (fator)" span={2}>
                    <Select value={f.fatorId} onChange={(e) => set('fatorId', e.target.value)}>
                        {FATORES_EMISSAO.map((x) => <option key={x.id} value={x.id}>{GEE_ESCOPOS[x.escopo].label} · {x.nome}</option>)}
                    </Select>
                </Field>
                <Field label="Ano" required><Input type="number" value={f.ano} onChange={(e) => set('ano', e.target.value)} /></Field>
                <Field label="Data de referência"><Input type="date" value={f.data} onChange={(e) => set('data', e.target.value)} /></Field>
                <Field label={`Consumo / atividade (${fator.unidade})`} required>
                    <Input type="number" value={f.consumo} onChange={(e) => set('consumo', e.target.value)} placeholder={`Valor em ${fator.unidade}`} />
                </Field>
                <Field label="Fator de emissão">
                    <Input value={`${fator.fator} kgCO₂e/${fator.unidade}`} disabled />
                </Field>
                <Field label="Descrição da atividade" span={2}>
                    <Input value={f.atividade} onChange={(e) => set('atividade', e.target.value)} placeholder="Ex.: Geradores Scania (7 un.)" />
                </Field>
            </FormGrid>

            <div style={{ marginTop: '1rem' }}>
                <MemoriaCalculo titulo={`Emissão calculada · ${GEE_ESCOPOS[fator.escopo].label} (${fator.categoria})`} color={GEE_ESCOPOS[fator.escopo].color}
                    formula="Emissão (tCO₂e) = consumo × fator de emissão ÷ 1000"
                    passos={[
                        { label: `Consumo (${fator.unidade})`, valor: fmt0(f.consumo || 0) },
                        { label: `Fator de emissão (kgCO₂e/${fator.unidade})`, valor: String(fator.fator).replace('.', ',') },
                    ]}
                    resultado={`${fmt(co2e, 3)} tCO₂e`} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#10b981" onClick={submit}>{inicial ? 'Salvar' : 'Adicionar'}</Btn>
            </div>
        </Modal>
    );
}

// ════════════════════════════════════════════════════════════════
//  ABA — COLETA & RESPONSÁVEIS (mapa de coleta multiunidade)
// ════════════════════════════════════════════════════════════════
function MapaColeta({ mapa, updMapa, addMapa, rmMapa, contatos, coleta }) {
    const [sub, setSub] = useState('mapa'); // mapa | contatos
    const [fUnidade, setFUnidade] = useState('todas');
    const [fCategoria, setFCategoria] = useState('todas');
    const [editing, setEditing] = useState(null);   // fonte em edição
    const [showModal, setShowModal] = useState(false);

    const unidades = [...new Set(mapa.map((m) => m.unidade))].sort();
    const categorias = [...new Set(mapa.map((m) => m.categoria))].sort((a, b) => escopoDaCategoria(a) - escopoDaCategoria(b) || a.localeCompare(b));

    const filtrados = mapa.filter((m) =>
        (fUnidade === 'todas' || m.unidade === fUnidade) &&
        (fCategoria === 'todas' || m.categoria === fCategoria)
    );
    // Agrupa por categoria
    const grupos = {};
    filtrados.forEach((m) => { (grupos[m.categoria] = grupos[m.categoria] || []).push(m); });
    const gruposOrd = Object.keys(grupos).sort((a, b) => escopoDaCategoria(a) - escopoDaCategoria(b) || a.localeCompare(b));

    const ciclar = (m, mes) => {
        if (m.status === 'Não aplicável') return;
        const atual = (m.meses || {})[mes] || 'pendente';
        updMapa(m.id, { meses: { ...(m.meses || {}), [mes]: proximoStatusColeta(atual) } });
    };
    const abrirNovo = () => { setEditing(null); setShowModal(true); };
    const abrirEdit = (m) => { setEditing(m); setShowModal(true); };
    const salvar = (dados) => {
        if (editing) updMapa(editing.id, dados); else addMapa(dados);
        setShowModal(false); setEditing(null);
    };

    return (
        <>
            <ExplicaBox titulo="O que é a Coleta & Responsáveis" color="#54a0ff">
                <p style={{ margin: '0 0 0.5rem' }}>
                    O inventário de GEE depende de dados que nascem em várias áreas e unidades. Aqui cada <strong>parâmetro</strong> tem um <strong>ID único</strong>, um <strong>Fornecedor de Informação</strong> (dono do dado) e, opcionalmente, um <strong>Validador</strong>; acompanha-se mês a mês se o dado já foi coletado.
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    <li><strong>Status da fonte:</strong> <em>Mapeado</em> = dentro das fronteiras (exige coleta); <em>Não aplicável</em> = equipamento inexistente ou de terceiros (fora das fronteiras, não conta).</li>
                    <li><strong>Clique numa célula de mês</strong> para alternar a coleta: Pendente → Coletado → Não aplicável.</li>
                    <li>Cobre Escopos 1, 2 e 3 — combustão, energia (ex.: Barueri), fugitivas, resíduos, transporte, viagens e deslocamento.</li>
                </ul>
            </ExplicaBox>

            <ExplicaBox titulo="Taxonomia, status e perfis de acesso (RBAC)" color="#a78bfa">
                <div style={{ fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 0.3rem' }}>Categorias por escopo (exemplos de tecnologias)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.4rem 1.2rem', marginBottom: '0.8rem' }}>
                    {TAXONOMIA_EMISSOES.map((t) => (
                        <div key={t.categoria} style={{ fontSize: '0.75rem' }}>
                            <span style={{ color: GEE_ESCOPOS[t.escopo].color, fontWeight: 700 }}>E{t.escopo} · {t.categoria}</span>
                            <span style={{ color: 'var(--color-text-subtle)' }}> — {t.tecnologias.join(', ')} <em>({t.unidade})</em></span>
                        </div>
                    ))}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 0.3rem' }}>Perfis de acesso</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.4rem 1.2rem' }}>
                    {Object.values(PERFIS_CARBONO).map((p) => (
                        <div key={p.label} style={{ fontSize: '0.75rem' }}>
                            <span style={{ color: p.color, fontWeight: 700 }}>{p.label}</span>
                            <span style={{ color: 'var(--color-text-subtle)' }}> — {p.desc}</span>
                        </div>
                    ))}
                </div>
            </ExplicaBox>

            {/* KPIs de coleta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '1rem', marginBottom: '1.3rem' }}>
                <BigKpi icon={<FaClipboardCheck size={16} />} color={coleta.pct >= 80 ? '#10b981' : '#54a0ff'} label="Progresso de coleta" value={`${coleta.pct}%`} sub={`${coleta.coletado} de ${coleta.aplicaveis} dados mensais`} />
                <BigKpi icon={<FaMapMarkedAlt size={16} />} color="#00ccff" label="Unidades" value={coleta.unidades} sub="no mapa de coleta" />
                <BigKpi icon={<FaCloud size={16} />} color="#ffb700" label="Fontes mapeadas" value={coleta.fontes} sub={`${coleta.naoAplicavel} não aplicável(is)`} />
                <BigKpi icon={<FaUserCheck size={16} />} color={coleta.semFornecedor ? '#ff4757' : '#10b981'} label="Sem fornecedor" value={coleta.semFornecedor} sub="parâmetros a designar" />
            </div>

            {/* Alternador mapa / contatos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-surface-2)', padding: 3, borderRadius: 10 }}>
                    {[['mapa', 'Mapa de coleta', <FaClipboardCheck size={11} key="a" />], ['contatos', 'Responsáveis', <FaUsers size={11} key="b" />]].map(([id, lbl, ic]) => (
                        <button key={id} onClick={() => setSub(id)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: 8,
                            fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: sub === id ? '#54a0ff' : 'transparent', color: sub === id ? '#0f1014' : 'var(--color-text-muted)',
                        }}>{ic} {lbl}</button>
                    ))}
                </div>
                {sub === 'mapa' && (
                    <>
                        <Select value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} style={{ width: 170, marginLeft: 'auto' }}>
                            <option value="todas">Todas as unidades</option>
                            {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                        </Select>
                        <Select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={{ width: 210 }}>
                            <option value="todas">Todas as categorias</option>
                            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <Btn color="#10b981" onClick={abrirNovo}><FaPlus size={11} /> Nova fonte</Btn>
                    </>
                )}
            </div>

            {sub === 'mapa' ? (
                <>
                    {/* Legenda */}
                    <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.8rem', fontSize: '0.72rem', color: 'var(--color-text-subtle)', flexWrap: 'wrap' }}>
                        {Object.entries(COLETA_STATUS).map(([k, v]) => (
                            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ width: 14, height: 14, borderRadius: 4, background: v.color + '33', border: `1px solid ${v.color}`, color: v.color, fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{v.sigla}</span> {v.label}
                            </span>
                        ))}
                    </div>

                    {gruposOrd.length === 0 && <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-subtle)' }}>Nenhuma fonte para o filtro.</div>}
                    {gruposOrd.map((cat) => {
                        const esc = escopoDaCategoria(cat);
                        const cor = GEE_ESCOPOS[esc]?.color || '#54a0ff';
                        return (
                            <div key={cat} style={{ marginBottom: '1.3rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '2px 9px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: cor + '1f', color: cor }}>{ESCOPO_ICON[esc]} {cat}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)' }}>{grupos[cat].length} fonte(s)</span>
                                </div>
                                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color-soft)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-surface-2)' }}>
                                                <th style={{ ...thMapa, textAlign: 'left', minWidth: 240 }}>Parâmetro · ID</th>
                                                <th style={{ ...thMapa, textAlign: 'left', minWidth: 150 }}>Fornecedor</th>
                                                <th style={{ ...thMapa, textAlign: 'center', minWidth: 96 }}>Status</th>
                                                {MESES.map((m) => <th key={m} style={{ ...thMapa, textAlign: 'center', padding: '0.5rem 0.2rem' }}>{m}</th>)}
                                                <th style={{ ...thMapa }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {grupos[cat].map((m) => {
                                                const na = m.status === 'Não aplicável';
                                                const sf = STATUS_FONTE[m.status] || STATUS_FONTE['Mapeado'];
                                                const fnome = m.fornecedor?.nome || m.responsavel;
                                                return (
                                                    <tr key={m.id} style={{ borderTop: '1px solid var(--border-color-soft)', opacity: na ? 0.55 : 1 }}>
                                                        <td style={{ padding: '0.5rem 0.7rem' }}>
                                                            <div style={{ color: 'var(--color-text-main)', fontSize: '0.78rem' }}>{m.parametro || m.tema}</div>
                                                            <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.66rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 1 }}>
                                                                <span style={{ fontFamily: 'ui-monospace, monospace', color: '#54a0ff' }}>{m.paramId || '—'}</span>
                                                                {m.unidadeMedida && <span>un.: {m.unidadeMedida}</span>}
                                                                <span>· {m.unidade}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.7rem' }}>
                                                            {fnome
                                                                ? <span title={m.fornecedor?.email || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-main)', cursor: m.fornecedor?.email ? 'help' : 'default' }}>
                                                                    <FaUserCheck size={11} color="#10b981" /> {fnome}
                                                                    {m.validador?.nome && <span title={`Validador: ${m.validador.nome}`} style={{ fontSize: '0.58rem', color: '#a78bfa', border: '1px solid #a78bfa55', borderRadius: 4, padding: '0 4px' }}>V</span>}
                                                                </span>
                                                                : <span style={{ color: '#ff4757', fontSize: '0.72rem' }} title="Designar fornecedor">a designar</span>}
                                                        </td>
                                                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.64rem', fontWeight: 700, color: sf.color, background: sf.color + '1f', padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }} title={sf.desc}>{sf.label}</span>
                                                        </td>
                                                        {MESES.map((mes) => {
                                                            if (na) return <td key={mes} style={{ textAlign: 'center', color: 'var(--color-text-faint)' }}>—</td>;
                                                            const st = (m.meses || {})[mes] || 'pendente';
                                                            const v = COLETA_STATUS[st];
                                                            return (
                                                                <td key={mes} style={{ padding: '2px', textAlign: 'center' }}>
                                                                    <button onClick={() => ciclar(m, mes)} title={`${mes}: ${v.label} (clique para alterar)`} style={{
                                                                        width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem',
                                                                        background: v.color + (st === 'coletado' ? '33' : '14'), color: v.color, border: `1px solid ${v.color}${st === 'pendente' ? '33' : '88'}`,
                                                                    }}>{v.sigla}</button>
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                            <RowAction icon={<FaEdit size={12} />} title="Editar fonte / governança" onClick={() => abrirEdit(m)} />
                                                            <RowAction icon={<FaTrash size={12} />} color="#ff4757" title="Excluir fonte" onClick={() => window.confirm('Excluir esta fonte do mapa?') && rmMapa(m.id)} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </>
            ) : (
                <ContatosLista contatos={contatos} />
            )}

            {showModal && <FonteModal inicial={editing} contatos={contatos} onClose={() => { setShowModal(false); setEditing(null); }} onSave={salvar} />}
        </>
    );
}

// Modal de edição/criação de fonte com o schema completo de governança
function FonteModal({ inicial, contatos, onClose, onSave }) {
    const [f, setF] = useState(() => inicial || {
        categoria: CATEGORIAS_EMISSAO[0], parametro: '', unidade: '', unidadeMedida: unidadeMedidaPadrao(CATEGORIAS_EMISSAO[0]),
        tecnologia: '', status: 'Mapeado', fornecedor: { nome: '', email: '' }, validador: { nome: '', email: '' },
        hierarquia: ['', '', '', '', '', '', ''], paramId: '',
    });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const setForn = (k, v) => setF((p) => ({ ...p, fornecedor: { ...p.fornecedor, [k]: v } }));
    const setVal = (k, v) => setF((p) => ({ ...p, validador: { ...p.validador, [k]: v } }));
    const tax = taxonomiaPorRotulo(f.categoria);

    const onCategoria = (rotulo) => setF((p) => ({ ...p, categoria: rotulo, unidadeMedida: unidadeMedidaPadrao(rotulo) }));
    // Autocompletar e-mail do fornecedor a partir do diretório
    const sugerirEmail = (nome) => {
        const first = (nome || '').split(/[/,]/)[0].trim().split(' ')[0].toLowerCase();
        const c = contatos.find((x) => (x.gestor || '').toLowerCase().includes(first) && first);
        return c?.email || '';
    };

    const submit = () => {
        if (!f.parametro) return;
        const escopo = escopoDaCategoria(f.categoria);
        const h1 = f.unidade || f.hierarquia?.[0] || '';
        const hierarquia = [h1, ...(f.hierarquia || []).slice(1, 7)];
        while (hierarquia.length < 7) hierarquia.push('');
        onSave({
            ...f, escopo, unidade: h1, hierarquia, tema: f.parametro,
            meses: inicial?.meses || MESES.reduce((a, m) => ({ ...a, [m]: 'pendente' }), {}),
        });
    };

    return (
        <Modal title={inicial ? 'Editar fonte de emissão' : 'Nova fonte de emissão'} onClose={onClose} width={620}>
            <FormGrid cols={2}>
                <Field label="Categoria (escopo)" span={2}>
                    <Select value={f.categoria} onChange={(e) => onCategoria(e.target.value)}>
                        {CATEGORIAS_EMISSAO.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                </Field>
                <Field label="Tecnologia (exemplo)">
                    <Select value={f.tecnologia} onChange={(e) => set('tecnologia', e.target.value)}>
                        <option value="">— selecione —</option>
                        {(tax?.tecnologias || []).map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                </Field>
                <Field label="Status da fonte">
                    <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
                        {Object.keys(STATUS_FONTE).map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </Field>
                <Field label="Parâmetro (dado a coletar)" span={2} required>
                    <Input value={f.parametro} onChange={(e) => set('parametro', e.target.value)} placeholder="Ex.: Consumo de Diesel" />
                </Field>
                <Field label="Unidade de medida"><Input value={f.unidadeMedida} onChange={(e) => set('unidadeMedida', e.target.value)} placeholder="L, kg, kWh, km…" /></Field>
                <Field label="ID do parâmetro"><Input value={f.paramId} onChange={(e) => set('paramId', e.target.value)} placeholder="MND-0000" /></Field>

                <Field label="Hierarquia 1 — Unidade / centro de custo" span={2}>
                    <Input value={f.unidade || f.hierarquia?.[0] || ''} onChange={(e) => set('unidade', e.target.value)} placeholder="Ex.: SP Barueri" />
                </Field>

                <Field label="Fornecedor — nome" required>
                    <Input value={f.fornecedor?.nome || ''} onChange={(e) => { setForn('nome', e.target.value); if (!f.fornecedor?.email) setForn('email', sugerirEmail(e.target.value)); }} placeholder="Dono do dado" />
                </Field>
                <Field label="Fornecedor — e-mail" required>
                    <Input type="email" value={f.fornecedor?.email || ''} onChange={(e) => setForn('email', e.target.value)} placeholder="nome@emondial.com" />
                </Field>
                <Field label="Validador — nome (opcional)"><Input value={f.validador?.nome || ''} onChange={(e) => setVal('nome', e.target.value)} /></Field>
                <Field label="Validador — e-mail (opcional)"><Input type="email" value={f.validador?.email || ''} onChange={(e) => setVal('email', e.target.value)} /></Field>
            </FormGrid>

            <div style={{ marginTop: '0.9rem', fontSize: '0.7rem', color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FaUsers size={11} color="#54a0ff" /> Níveis de hierarquia 2–7 (centro de custo) podem ser detalhados depois; H1 já amarra o dado à unidade.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#10b981" onClick={submit}>{inicial ? 'Salvar' : 'Adicionar'}</Btn>
            </div>
        </Modal>
    );
}

const thMapa = { padding: '0.55rem 0.7rem', color: 'var(--color-text-muted)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' };

function ContatosLista({ contatos }) {
    const [f, setF] = useState('todas');
    const [q, setQ] = useState('');
    const unidades = [...new Set(contatos.map((c) => c.unidade))].sort();
    const filtrados = contatos.filter((c) =>
        (f === 'todas' || c.unidade === f) &&
        (!q || `${c.gestor} ${c.setor} ${c.email}`.toLowerCase().includes(q.toLowerCase()))
    );
    return (
        <>
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <Input placeholder="Buscar nome, setor ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <Select value={f} onChange={(e) => setF(e.target.value)} style={{ width: 180 }}>
                    <option value="todas">Todas as unidades</option>
                    {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color-soft)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-surface-2)' }}>
                            {['Unidade', 'Setor', 'Responsável', 'Ramal', 'Telefone', 'E-mail'].map((h) => (
                                <th key={h} style={{ ...thMapa, textAlign: 'left' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-subtle)' }}>Nenhum contato encontrado.</td></tr>}
                        {filtrados.map((c, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border-color-soft)' }}>
                                <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', fontWeight: 600 }}>{c.unidade}</td>
                                <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)' }}>{c.setor}</td>
                                <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)' }}>{c.gestor}</td>
                                <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)' }}>{c.ramal || '—'}</td>
                                <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)' }}>
                                    {c.telefone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><FaPhone size={9} color="#54a0ff" /> {c.telefone}</span> : '—'}
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem' }}>
                                    {c.email ? <a href={`mailto:${c.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#00ccff', textDecoration: 'none' }}><FaEnvelope size={9} /> {c.email}</a> : <span style={{ color: 'var(--color-text-faint)' }}>—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

// ════════════════════════════════════════════════════════════════
//  ABA 3 — INDICADORES ESG
// ════════════════════════════════════════════════════════════════
function Indicadores({ scores, esgInd, updInd }) {
    const [editing, setEditing] = useState(null);

    const pilarItems = (p) => esgInd.filter((i) => i.pilar === p);
    const colData = {
        E: { itens: scores.eItems, score: scores.E },
        S: { itens: pilarItems('S'), score: scores.S },
        G: { itens: pilarItems('G'), score: scores.G },
    };

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {Object.keys(ESG_PILARES).map((p) => {
                    const pil = ESG_PILARES[p];
                    const { itens, score } = colData[p];
                    return (
                        <Card key={p} style={{ borderTop: `3px solid ${pil.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 9, background: pil.color + '1f', color: pil.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{pil.sigla}</div>
                                    <div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{pil.label}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>{pil.desc}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                    <InfoTip title={`Score ${pil.label}`} color={pil.color}>
                                        Média do <strong>progresso vs. meta</strong> de cada indicador do pilar. Cada indicador vale de 0 a 100 (100 = meta atingida); o score é a média deles.
                                    </InfoTip>
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)' }}>/ 100</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {itens.map((it, idx) => (
                                    <IndicadorLinha key={it.id || idx} it={it} color={pil.color} onEdit={it.derivado ? null : () => setEditing(it)} />
                                ))}
                                {itens.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)', padding: '0.5rem 0' }}>Sem indicadores.</div>}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Card style={{ marginTop: '1.2rem', borderLeft: '3px solid #54a0ff' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Os indicadores <strong>Ambientais derivados</strong> (redução de emissões, valorização de resíduos e conformidade atmosférica)
                    são calculados automaticamente a partir do inventário de GEE, dos manifestos (MTR) e das medições de fumaça preta.
                    Os demais indicadores Sociais e de Governança são atualizados manualmente — clique no ícone <FaEdit size={11} style={{ verticalAlign: 'middle' }} /> para registrar o valor do período.
                </div>
            </Card>

            {editing && <IndicadorModal it={editing} onClose={() => setEditing(null)} onSave={(patch) => { updInd(editing.id, patch); setEditing(null); }} />}
        </>
    );
}

function IndicadorLinha({ it, color, onEdit }) {
    const prog = progressoIndicador(it.valor, it.meta, it.melhor);
    const pColor = scoreColor(prog);
    const atingiu = prog >= 100;
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {it.nome}
                    {it.derivado && <span title="Calculado automaticamente" style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: 4, background: 'var(--bg-surface-2)', color: 'var(--color-text-subtle)' }}>auto</span>}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{fmt(it.valor, Number.isInteger(it.valor) ? 0 : 1)}{it.unidade === '%' ? '%' : ` ${it.unidade}`}</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)' }}>/ {it.meta}{it.unidade === '%' ? '%' : ''}</span>
                    {onEdit && <RowAction icon={<FaEdit size={11} />} title="Editar" onClick={onEdit} />}
                </span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-surface-2)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${prog}%`, background: pColor, borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: '0.62rem', color: atingiu ? '#10b981' : 'var(--color-text-subtle)', marginTop: 2, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {atingiu ? <><FaCheckCircle size={9} /> Meta atingida</> : `${prog}% da meta · ${it.melhor === 'menor' ? 'menor é melhor' : 'maior é melhor'}`}
            </div>
        </div>
    );
}

function IndicadorModal({ it, onClose, onSave }) {
    const [valor, setValor] = useState(it.valor);
    const [meta, setMeta] = useState(it.meta);
    return (
        <Modal title="Atualizar indicador" onClose={onClose} width={420}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-main)', fontWeight: 600, marginBottom: '0.2rem' }}>{it.nome}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginBottom: '1rem' }}>Pilar {ESG_PILARES[it.pilar].label} · {it.melhor === 'menor' ? 'menor é melhor' : 'maior é melhor'}</div>
            <FormGrid cols={2}>
                <Field label={`Valor atual (${it.unidade})`}><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
                <Field label={`Meta (${it.unidade})`}><Input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} /></Field>
            </FormGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#10b981" onClick={() => onSave({ valor: Number(valor), meta: Number(meta) })}>Salvar</Btn>
            </div>
        </Modal>
    );
}

// ════════════════════════════════════════════════════════════════
//  ABA 4 — DESCARBONIZAÇÃO
// ════════════════════════════════════════════════════════════════
function Descarbonizacao({ calc, cfg, iniciativas, addIni, updIni, rmIni }) {
    const [editing, setEditing] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showCfg, setShowCfg] = useState(false);

    const concluido = iniciativas.filter((i) => i.status === 'Concluída').reduce((s, i) => s + Number(i.reducao || 0), 0);
    const emCurso = iniciativas.filter((i) => i.status === 'Em andamento').reduce((s, i) => s + Number(i.reducao || 0), 0);
    const planejado = iniciativas.filter((i) => i.status === 'Planejada').reduce((s, i) => s + Number(i.reducao || 0), 0);
    const gapMeta = Math.max(0, calc.baseline - calc.metaFinal); // tCO2e a reduzir até a meta

    const abrirNovo = () => { setEditing(null); setShowModal(true); };
    const salvar = (dados) => { if (editing) updIni(editing.id, dados); else addIni(dados); setShowModal(false); setEditing(null); };

    return (
        <>
            {/* Resumo do programa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <BigKpi icon={<FaCloud size={16} />} color="#8b9bb4" label={`Linha de base ${cfg.anoBase}`} value={fmt(calc.baseline)} unit="tCO₂e" />
                <BigKpi icon={<FaBullseye size={16} />} color="#54a0ff" label={`Meta ${cfg.anoMeta}`} value={fmt(calc.metaFinal)} unit="tCO₂e" sub={`−${cfg.reducaoMetaPct}% absoluto`} />
                <BigKpi icon={<FaArrowDown size={16} />} color="#10b981" label="Gap até a meta" value={fmt(gapMeta)} unit="tCO₂e" sub="redução necessária" />
                <BigKpi icon={<FaSeedling size={16} />} color="#00ff9d" label="Potencial das iniciativas" value={fmt(concluido + emCurso + planejado)} unit="tCO₂e/ano" />
            </div>

            {/* Cobertura da meta pelas iniciativas */}
            <Card style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <SecTitle icon={<FaChartLine size={13} color="#10b981" />} style={{ margin: 0 }}>Cobertura do gap de descarbonização</SecTitle>
                    <Btn variant="outline" color="#54a0ff" onClick={() => setShowCfg(true)}><FaCog size={11} /> Metas do programa</Btn>
                </div>
                <CoberturaBar gap={gapMeta} concluido={concluido} emCurso={emCurso} planejado={planejado} />
            </Card>

            {/* Tabela de iniciativas */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)', marginRight: 'auto' }}>Iniciativas de descarbonização</span>
                <Btn color="#10b981" onClick={abrirNovo}><FaPlus size={11} /> Nova iniciativa</Btn>
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color-soft)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-surface-2)' }}>
                            {['Iniciativa', 'Escopo', 'Responsável', 'Prazo', 'Redução', 'Status', ''].map((h, i) => (
                                <th key={i} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '0.65rem 0.8rem', color: 'var(--color-text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {iniciativas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-subtle)' }}>Nenhuma iniciativa cadastrada.</td></tr>}
                        {[...iniciativas].sort((a, b) => Number(b.reducao) - Number(a.reducao)).map((i) => (
                            <tr key={i.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                <td style={{ padding: '0.55rem 0.8rem', color: 'var(--color-text-main)', maxWidth: 280 }}>{i.nome}</td>
                                <td style={{ padding: '0.55rem 0.8rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, background: GEE_ESCOPOS[i.escopo].color + '1f', color: GEE_ESCOPOS[i.escopo].color }}>{ESCOPO_ICON[i.escopo]} {i.escopo}</span>
                                </td>
                                <td style={{ padding: '0.55rem 0.8rem', color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>{i.responsavel || '—'}</td>
                                <td style={{ padding: '0.55rem 0.8rem', color: 'var(--color-text-muted)' }}>{i.prazo ? i.prazo.split('-').reverse().join('/') : '—'}</td>
                                <td style={{ padding: '0.55rem 0.8rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>−{fmt(i.reducao)} t</td>
                                <td style={{ padding: '0.55rem 0.8rem' }}><StatusBadge status={i.status} map={ESG_STATUS_COLORS} /></td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <RowAction icon={<FaEdit size={12} />} title="Editar" onClick={() => { setEditing(i); setShowModal(true); }} />
                                    <RowAction icon={<FaTrash size={12} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir iniciativa?') && rmIni(i.id)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && <IniciativaModal inicial={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={salvar} />}
            {showCfg && <ProgramaModal cfg={cfg} onClose={() => setShowCfg(false)} />}
        </>
    );
}

function CoberturaBar({ gap, concluido, emCurso, planejado }) {
    const total = gap || 1;
    const seg = (v) => Math.min(100, (v / total) * 100);
    const cobertura = Math.min(100, Math.round(((concluido + emCurso + planejado) / total) * 100));
    return (
        <div>
            <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface-2)', border: '1px solid var(--border-color-soft)' }}>
                <div style={{ width: `${seg(concluido)}%`, background: '#10b981' }} title={`Concluído: ${fmt(concluido)} t`} />
                <div style={{ width: `${seg(emCurso)}%`, background: '#ffb700' }} title={`Em andamento: ${fmt(emCurso)} t`} />
                <div style={{ width: `${seg(planejado)}%`, background: '#54a0ff' }} title={`Planejado: ${fmt(planejado)} t`} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.7rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.74rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                    <Legenda color="#10b981" label={`Concluído (${fmt(concluido)} t)`} />
                    <Legenda color="#ffb700" label={`Em andamento (${fmt(emCurso)} t)`} />
                    <Legenda color="#54a0ff" label={`Planejado (${fmt(planejado)} t)`} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cobertura >= 100 ? '#10b981' : '#ffb700' }}>
                    {cobertura}% do gap coberto
                </span>
            </div>
        </div>
    );
}

function IniciativaModal({ inicial, onClose, onSave }) {
    const [f, setF] = useState(() => inicial || { nome: '', escopo: 1, status: 'Planejada', reducao: '', prazo: '', responsavel: '' });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const submit = () => { if (!f.nome) return; onSave({ ...f, escopo: Number(f.escopo), reducao: Number(f.reducao || 0) }); };
    return (
        <Modal title={inicial ? 'Editar iniciativa' : 'Nova iniciativa de descarbonização'} onClose={onClose} width={560}>
            <FormGrid cols={2}>
                <Field label="Nome da iniciativa" span={2} required><Input value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Usina solar fotovoltaica" /></Field>
                <Field label="Escopo afetado">
                    <Select value={f.escopo} onChange={(e) => set('escopo', e.target.value)}>
                        {[1, 2, 3].map((s) => <option key={s} value={s}>{GEE_ESCOPOS[s].label} — {GEE_ESCOPOS[s].titulo}</option>)}
                    </Select>
                </Field>
                <Field label="Status">
                    <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
                        {STATUS_INICIATIVA.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                </Field>
                <Field label="Redução estimada (tCO₂e/ano)"><Input type="number" value={f.reducao} onChange={(e) => set('reducao', e.target.value)} /></Field>
                <Field label="Prazo"><Input type="month" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} /></Field>
                <Field label="Responsável" span={2}><Input value={f.responsavel} onChange={(e) => set('responsavel', e.target.value)} /></Field>
            </FormGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#10b981" onClick={submit}>{inicial ? 'Salvar' : 'Adicionar'}</Btn>
            </div>
        </Modal>
    );
}

function ProgramaModal({ cfg, onClose }) {
    const [f, setF] = useState(cfg);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const salvar = () => {
        saveConfig(COL.ESG_CFG, {
            ...f, anoBase: Number(f.anoBase), anoMeta: Number(f.anoMeta),
            reducaoMetaPct: Number(f.reducaoMetaPct), metaNetZero: Number(f.metaNetZero), producaoAnual: Number(f.producaoAnual),
        });
        onClose();
    };
    return (
        <Modal title="Metas do programa de descarbonização" onClose={onClose} width={520}>
            <FormGrid cols={2}>
                <Field label="Ano base do inventário"><Input type="number" value={f.anoBase} onChange={(e) => set('anoBase', e.target.value)} /></Field>
                <Field label="Ano da meta"><Input type="number" value={f.anoMeta} onChange={(e) => set('anoMeta', e.target.value)} /></Field>
                <Field label="Redução absoluta na meta (%)"><Input type="number" value={f.reducaoMetaPct} onChange={(e) => set('reducaoMetaPct', e.target.value)} /></Field>
                <Field label="Ano alvo de Net Zero"><Input type="number" value={f.metaNetZero} onChange={(e) => set('metaNetZero', e.target.value)} /></Field>
                <Field label="Produção anual (intensidade)"><Input type="number" value={f.producaoAnual} onChange={(e) => set('producaoAnual', e.target.value)} /></Field>
                <Field label="Unidade de produção"><Input value={f.unidadeProducao} onChange={(e) => set('unidadeProducao', e.target.value)} /></Field>
            </FormGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#10b981" onClick={salvar}>Salvar metas</Btn>
            </div>
        </Modal>
    );
}

// ════════════════════════════════════════════════════════════════
//  Componentes auxiliares
// ════════════════════════════════════════════════════════════════
const SecTitle = ({ children, icon, style }) => (
    <h3 style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', ...style }}>{icon}{children}</h3>
);
const Legenda = ({ color, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} /> {label}
    </span>
);
const Vazio = () => <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>Sem dados.</div>;

function BigKpi({ icon, label, value, unit, sub, trend, color = '#10b981', info }) {
    return (
        <div className="glass-panel" style={{ padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '1f', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</span>
                {info && <span style={{ marginLeft: 'auto' }}>{info}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1 }}>{value}</span>
                {unit && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>{unit}</span>}
            </div>
            {trend && (
                <div style={{ fontSize: '0.72rem', color: trend.dir === 'down' ? '#10b981' : '#ff4757', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    {trend.dir === 'down' ? <FaArrowDown size={9} /> : <FaArrowUp size={9} />} {trend.txt}
                </div>
            )}
            {sub && !trend && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>{sub}</div>}
        </div>
    );
}

function ScoreGauge({ score, size = 170 }) {
    const stroke = 14;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - score / 100);
    const color = scoreColor(score);
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface-2)" strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>de 100</span>
                <span style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 700, color, padding: '1px 10px', borderRadius: 20, background: color + '1f' }}>Rating {scoreRating(score)}</span>
            </div>
        </div>
    );
}

function exportInventario(emissoes) {
    const rows = emissoes.map((e) => ({
        'Ano': e.ano, 'Escopo': GEE_ESCOPOS[e.escopo].label, 'Categoria': e.categoria, 'Fonte': e.fonte,
        'Atividade': e.atividade || '', 'Consumo': e.consumo, 'Unidade': e.unidade,
        'Fator (kgCO2e/un)': e.fator, 'Emissão (tCO2e)': Math.round(co2eDe(e) * 1000) / 1000,
    }));
    exportToExcel(rows, 'inventario_gee', 'Inventário GEE');
}

export default ESGCarbonoView;
