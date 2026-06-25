import { useState, useMemo } from 'react';
import { FaFileInvoiceDollar, FaPlus, FaTrash, FaFileExcel, FaWeightHanging, FaDollarSign, FaReceipt } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, FormGrid, DataTable, StatusBadge, Kpi, RowAction } from '../components/ui';
import { useCollection, COL } from '../lib/store';
import { STATUS_NF } from '../lib/constants';
import { exportToExcel } from '../lib/excel';

const STATUS_COLORS = { Emitida: '#ffb700', Enviada: '#54a0ff', Faturada: '#a78bfa', Paga: '#10b981' };

const brl = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const empty = () => ({ numeroNF: '', data: new Date().toISOString().slice(0, 10), peso: '', valorKg: '', fornecedor: 'VIAMED', status: 'Emitida' });

function NFSucataView({ onBack }) {
    const { items, add, update, remove } = useCollection(COL.NFSUCATA);
    const [form, setForm] = useState(empty());
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const valorTotalForm = (Number(form.peso) || 0) * (Number(form.valorKg) || 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        add({ ...form, peso: Number(form.peso), valorKg: Number(form.valorKg), valorTotal: valorTotalForm });
        setForm(empty());
    };

    const stats = useMemo(() => {
        const pesoTotal = items.reduce((s, i) => s + Number(i.peso || 0), 0);
        const valorTotal = items.reduce((s, i) => s + (Number(i.peso || 0) * Number(i.valorKg || 0)), 0);
        const aReceber = items.filter((i) => i.status !== 'Paga').reduce((s, i) => s + (Number(i.peso || 0) * Number(i.valorKg || 0)), 0);
        return { pesoTotal, valorTotal, aReceber };
    }, [items]);

    const exportar = () => {
        exportToExcel(items.map((i) => ({
            'NF Nº': i.numeroNF, 'Data': i.data?.split('-').reverse().join('/'), 'Fornecedor': i.fornecedor,
            'Peso (kg)': i.peso, 'Valor/kg': i.valorKg, 'Valor Total': Number(i.peso || 0) * Number(i.valorKg || 0), 'Status': i.status,
        })), 'controle_NF_sucata_VIAMED', 'NF Sucata');
    };

    const columns = [
        { key: 'numeroNF', label: 'NF Nº', render: (r) => <strong>{r.numeroNF}</strong> },
        { key: 'data', label: 'Data', render: (r) => r.data?.split('-').reverse().join('/') },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'peso', label: 'Peso', align: 'right', render: (r) => `${Number(r.peso).toLocaleString('pt-BR')} kg` },
        { key: 'valorKg', label: 'Valor/kg', align: 'right', render: (r) => brl(r.valorKg) },
        { key: 'total', label: 'Total', align: 'right', render: (r) => <strong style={{ color: '#10b981' }}>{brl(Number(r.peso || 0) * Number(r.valorKg || 0))}</strong> },
        {
            key: 'status', label: 'Status', render: (r) => (
                <Select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                    style={{ padding: '0.25rem 1.6rem 0.25rem 0.5rem', fontSize: '0.74rem', width: 'auto', minWidth: 120 }}>
                    {STATUS_NF.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
            ),
        },
        { key: 'acoes', label: '', align: 'right', render: (r) => <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir NF?') && remove(r.id)} /> },
    ];

    return (
        <PageShell
            icon={<FaFileInvoiceDollar size={20} />} color="#ffb700"
            title="NF de Sucata Plástica — VIAMED"
            subtitle="Emissão e controle de notas fiscais de sucata destinada à VIAMED"
            onBack={onBack}
            actions={<Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={10} /> Exportar Excel</Btn>}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Kpi icon={<FaReceipt size={15} />} label="Notas emitidas" value={items.length} color="#ffb700" />
                <Kpi icon={<FaWeightHanging size={15} />} label="Peso total" value={`${stats.pesoTotal.toLocaleString('pt-BR')} kg`} color="#00ff9d" />
                <Kpi icon={<FaDollarSign size={15} />} label="Valor total" value={brl(stats.valorTotal)} color="#10b981" />
                <Kpi icon={<FaDollarSign size={15} />} label="A receber" value={brl(stats.aReceber)} sub="não pagas" color="#54a0ff" />
            </div>

            <Card style={{ marginBottom: '1.5rem', borderLeft: '3px solid #ffb700' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaPlus size={13} color="#ffb700" /> Nova Nota Fiscal
                </h3>
                <form onSubmit={handleSubmit}>
                    <FormGrid cols={3}>
                        <Field label="Nº da NF" required><Input value={form.numeroNF} onChange={(e) => set('numeroNF', e.target.value)} placeholder="001234" required /></Field>
                        <Field label="Data" required><Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} required /></Field>
                        <Field label="Fornecedor"><Input value={form.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} /></Field>
                        <Field label="Peso (kg)" required><Input type="number" step="any" min="0" value={form.peso} onChange={(e) => set('peso', e.target.value)} required /></Field>
                        <Field label="Valor por kg (R$)" required><Input type="number" step="any" min="0" value={form.valorKg} onChange={(e) => set('valorKg', e.target.value)} required /></Field>
                        <Field label="Status">
                            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                                {STATUS_NF.map((s) => <option key={s} value={s}>{s}</option>)}
                            </Select>
                        </Field>
                    </FormGrid>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            Valor total: <strong style={{ color: '#10b981', fontSize: '1.05rem' }}>{brl(valorTotalForm)}</strong>
                        </span>
                        <Btn type="submit" color="#ffb700"><FaPlus size={12} /> Registrar NF</Btn>
                    </div>
                </form>
            </Card>

            <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.95rem', color: 'var(--color-text-main)' }}>Controle de Notas Fiscais</h3>
            <DataTable columns={columns} rows={items} empty="Nenhuma nota fiscal registrada." />
        </PageShell>
    );
}

export default NFSucataView;
