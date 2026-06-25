import { useMemo } from 'react';
import {
    FaChartPie, FaTruckMoving, FaFileSignature, FaSmog, FaRecycle, FaLeaf,
    FaCheckCircle, FaExclamationTriangle, FaWeightHanging,
} from 'react-icons/fa';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { PageShell, Card, Kpi } from '../components/ui';
import { useCollection, COL } from '../lib/store';
import { apuradoInfo } from '../lib/constants';

const PIE_COLORS = ['#00ff9d', '#54a0ff', '#ffb700', '#a78bfa', '#ff9f43', '#06b6d4', '#ff4757', '#10b981'];

function DashboardAmbiental({ onBack, onNavigate }) {
    const { items: autorizacoes } = useCollection(COL.AUTORIZACOES);
    const { items: manifestos } = useCollection(COL.MANIFESTOS);
    const { items: fumaca } = useCollection(COL.FUMACA);
    const { items: residuos } = useCollection(COL.RESIDUOS);

    const data = useMemo(() => {
        // Total destinado em kg (autorizações em kg)
        const kgTotal = autorizacoes.filter((a) => a.unidade === 'kg').reduce((s, a) => s + Number(a.quantidade || 0), 0);

        // Por destinação (a partir dos manifestos, usando cadastro p/ classificar)
        const porDestinacao = {};
        manifestos.forEach((m) => {
            const d = m.destinacao || 'Outros';
            porDestinacao[d] = (porDestinacao[d] || 0) + Number(m.quantidade || 0);
        });
        const pieDestinacao = Object.entries(porDestinacao).map(([name, value]) => ({ name, value }));

        // Reciclado vs aterro (indicador de valorização ISO 14001)
        const recicladoTipos = ['Reciclagem', 'Reutilização', 'Compostagem', 'Coprocessamento'];
        let valorizado = 0, disposto = 0;
        manifestos.forEach((m) => {
            const q = Number(m.quantidade || 0);
            if (recicladoTipos.includes(m.destinacao)) valorizado += q; else disposto += q;
        });
        const taxaValorizacao = (valorizado + disposto) ? Math.round((valorizado / (valorizado + disposto)) * 100) : 0;

        // Manifestos por status
        const statusCount = {};
        manifestos.forEach((m) => { statusCount[m.status] = (statusCount[m.status] || 0) + 1; });
        const barStatus = Object.entries(statusCount).map(([name, qtd]) => ({ name, qtd }));

        // Conformidade fumaça — percorre todas as medições de todos os relatórios
        let fumTotal = 0, fumOk = 0;
        fumaca.forEach((rel) => (rel.rounds || []).forEach((r) => r.medicoes.forEach((m) => {
            fumTotal++;
            if (apuradoInfo(m.apurado).conforme) fumOk++;
        })));
        const taxaFumaca = fumTotal ? Math.round((fumOk / fumTotal) * 100) : 100;

        return { kgTotal, pieDestinacao, taxaValorizacao, barStatus, taxaFumaca, fumReprov: fumTotal - fumOk };
    }, [autorizacoes, manifestos, fumaca]);

    const pendentes = autorizacoes.filter((a) => a.status === 'Pendente').length;

    return (
        <PageShell icon={<FaChartPie size={20} />} color="#00ccff" title="Dashboard Ambiental" subtitle="Indicadores de desempenho · ISO 14001" onBack={onBack}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Kpi icon={<FaWeightHanging size={13} />} label="Resíduo destinado" value={`${data.kgTotal.toLocaleString('pt-BR')} kg`} color="#00ff9d" />
                <Kpi icon={<FaRecycle size={13} />} label="Taxa de valorização" value={`${data.taxaValorizacao}%`} sub="reciclado / coprocessado" color="#10b981" />
                <Kpi icon={<FaTruckMoving size={13} />} label="Manifestos (MTR)" value={manifestos.length} color="#54a0ff" />
                <Kpi icon={data.taxaFumaca >= 100 ? <FaCheckCircle size={13} /> : <FaExclamationTriangle size={13} />} label="Conformidade fumaça" value={`${data.taxaFumaca}%`} sub={`${data.fumReprov} reprovado(s)`} color={data.taxaFumaca >= 100 ? '#10b981' : '#ff4757'} />
                <Kpi icon={<FaFileSignature size={13} />} label="Autorizações pendentes" value={pendentes} color="#ffb700" />
            </div>

            {/* Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Card>
                    <h3 style={chartTitle}><FaRecycle size={13} color="#00ff9d" /> Destinação de Resíduos</h3>
                    {data.pieDestinacao.length === 0 ? <Empty /> : (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={data.pieDestinacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e) => e.name}>
                                    {data.pieDestinacao.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card>
                    <h3 style={chartTitle}><FaTruckMoving size={13} color="#54a0ff" /> Manifestos por Status</h3>
                    {data.barStatus.length === 0 ? <Empty /> : (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={data.barStatus}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="name" tick={{ fill: '#8b9bb4', fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fill: '#8b9bb4', fontSize: 11 }} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                <Bar dataKey="qtd" fill="#54a0ff" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            {/* Atalhos rápidos */}
            <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', color: 'var(--color-text-main)' }}>Acesso rápido</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem' }}>
                <Shortcut color="#00ff9d" icon={<FaFileSignature size={16} />} label="Autorização de Saída" onClick={() => onNavigate('autorizacoes')} />
                <Shortcut color="#54a0ff" icon={<FaTruckMoving size={16} />} label="Manifesto MTR" onClick={() => onNavigate('manifestos')} />
                <Shortcut color="#a78bfa" icon={<FaSmog size={16} />} label="Fumaça Preta" onClick={() => onNavigate('fumaca')} />
                <Shortcut color="#10b981" icon={<FaLeaf size={16} />} label="Controle de Saída" onClick={() => onNavigate('controle-residuos')} />
            </div>
        </PageShell>
    );
}

const chartTitle = { margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' };
const tooltipStyle = { background: '#1c1d26', border: '1px solid #2a2b32', borderRadius: 8, color: '#fff', fontSize: '0.8rem' };
const Empty = () => <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>Sem dados ainda.</div>;

function Shortcut({ color, icon, label, onClick }) {
    return (
        <button onClick={onClick} className="glass-panel" style={{
            padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer',
            border: '1px solid var(--border-color-soft)', transition: 'all 0.2s', textAlign: 'left',
        }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color-soft)'; e.currentTarget.style.transform = 'none'; }}
        >
            <span style={{ width: 28, height: 28, borderRadius: 8, background: color + '1f', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{label}</span>
        </button>
    );
}

export default DashboardAmbiental;
