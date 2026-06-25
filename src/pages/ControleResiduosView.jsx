import { useState, useMemo } from 'react';
import { FaFileExcel, FaFilter, FaRecycle, FaWeightHanging, FaBoxOpen } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, DataTable, StatusBadge, Kpi } from '../components/ui';
import { useCollection, COL } from '../lib/store';
import { exportToExcel } from '../lib/excel';

const STATUS_COLORS = { Pendente: '#ffb700', Autorizada: '#54a0ff', Liberada: '#10b981', Recusada: '#ff4757' };

function ControleResiduosView({ onBack }) {
    const { items } = useCollection(COL.AUTORIZACOES);
    const { items: residuos } = useCollection(COL.RESIDUOS);
    const [de, setDe] = useState('');
    const [ate, setAte] = useState('');
    const [residuo, setResiduo] = useState('');
    const [destino, setDestino] = useState('');

    const filtered = useMemo(() => items.filter((i) => {
        if (de && i.data < de) return false;
        if (ate && i.data > ate) return false;
        if (residuo && i.residuo !== residuo) return false;
        if (destino && !(i.destino || '').toLowerCase().includes(destino.toLowerCase())) return false;
        return true;
    }), [items, de, ate, residuo, destino]);

    // Totais por unidade
    const totais = useMemo(() => {
        const byUnit = {};
        filtered.forEach((i) => { byUnit[i.unidade] = (byUnit[i.unidade] || 0) + Number(i.quantidade || 0); });
        return byUnit;
    }, [filtered]);

    const kgTotal = totais['kg'] || 0;
    const destinos = [...new Set(filtered.map((i) => i.destino).filter(Boolean))].length;

    const exportar = () => {
        exportToExcel(filtered.map((i) => ({
            'Data': i.data?.split('-').reverse().join('/'), 'Dia': i.dia || '', 'Resíduo': i.residuo,
            'Quantidade': i.quantidade, 'Unidade': i.unidade, 'Transportadora': i.transportadora,
            'Motorista': i.motorista, 'Placa': i.placa, 'Destino': i.destino,
            'Responsável': i.responsavel, 'Status': i.status,
        })), 'controle_saida_residuos', 'Saídas');
    };

    const columns = [
        { key: 'data', label: 'Data', render: (r) => `${r.data?.split('-').reverse().join('/')} ${r.dia ? '(' + r.dia + ')' : ''}` },
        { key: 'residuo', label: 'Resíduo' },
        { key: 'quantidade', label: 'Qtd.', align: 'right', render: (r) => `${r.quantidade} ${r.unidade}` },
        { key: 'transportadora', label: 'Transportadora' },
        { key: 'destino', label: 'Destino' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} map={STATUS_COLORS} /> },
    ];

    return (
        <PageShell
            icon={<FaFileExcel size={20} />} color="#10b981"
            title="Controle de Saída de Resíduos"
            subtitle="Histórico consolidado · exportação para Excel"
            onBack={onBack}
            actions={<Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={10} /> Exportar Excel</Btn>}
        >
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Kpi icon={<FaBoxOpen size={15} />} label="Registros" value={filtered.length} color="#00ccff" />
                <Kpi icon={<FaWeightHanging size={15} />} label="Total (kg)" value={kgTotal.toLocaleString('pt-BR')} sub="somente itens em kg" color="#00ff9d" />
                <Kpi icon={<FaRecycle size={15} />} label="Destinos distintos" value={destinos} color="#10b981" />
                <Kpi icon={<FaFilter size={15} />} label="Outras unidades" value={Object.entries(totais).filter(([u]) => u !== 'kg').map(([u, v]) => `${v} ${u}`).join(' · ') || '—'} color="#ffb700" />
            </div>

            {/* Filtros */}
            <Card style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <FaFilter size={12} color="#10b981" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)' }}>Filtros</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.9rem' }}>
                    <Field label="De"><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
                    <Field label="Até"><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
                    <Field label="Resíduo">
                        <Select value={residuo} onChange={(e) => setResiduo(e.target.value)}>
                            <option value="">Todos</option>
                            {residuos.map((r) => <option key={r.id} value={r.nome}>{r.nome}</option>)}
                        </Select>
                    </Field>
                    <Field label="Destino contém"><Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex.: VIAMED" /></Field>
                </div>
            </Card>

            <DataTable columns={columns} rows={filtered} empty="Nenhum registro no período/filtros selecionados." />
        </PageShell>
    );
}

export default ControleResiduosView;
