import { useState } from 'react';
import { FaDatabase, FaRecycle, FaIndustry, FaPlus, FaTrash } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, FormGrid, DataTable, RowAction } from '../components/ui';
import { useCollection, COL } from '../lib/store';
import { CLASSES_RESIDUO, ESTADOS_FISICOS, UNIDADES, TIPOS_DESTINACAO, classeColor, INJECAO_TIPOS } from '../lib/constants';

function CadastrosView({ onBack }) {
    const [tab, setTab] = useState('residuos');
    return (
        <PageShell icon={<FaDatabase size={20} />} color="#9d4edd" title="Cadastros" subtitle="Resíduos e geradores" onBack={onBack}
            actions={
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <TabBtn active={tab === 'residuos'} onClick={() => setTab('residuos')} icon={<FaRecycle size={10} />}>Resíduos</TabBtn>
                    <TabBtn active={tab === 'geradores'} onClick={() => setTab('geradores')} icon={<FaIndustry size={10} />}>Geradores</TabBtn>
                </div>
            }
        >
            {tab === 'residuos' ? <ResiduosTab /> : <GeradoresTab />}
        </PageShell>
    );
}

function TabBtn({ active, onClick, icon, children }) {
    return (
        <button onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.7rem', borderRadius: 8,
            fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s',
            background: active ? '#9d4edd22' : 'transparent', color: active ? '#9d4edd' : '#8b9bb4',
            border: `1px solid ${active ? '#9d4edd55' : 'var(--border-color-soft)'}`,
        }}>{icon}{children}</button>
    );
}

function ResiduosTab() {
    const { items, add, remove } = useCollection(COL.RESIDUOS);
    const [f, setF] = useState({ nome: '', classe: 'IIB', codigoIbama: '', estado: 'Sólido', unidade: 'kg', destinacao: 'Reciclagem', destinador: '' });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

    const columns = [
        { key: 'nome', label: 'Resíduo', render: (r) => <strong>{r.nome}</strong> },
        { key: 'classe', label: 'Classe', render: (r) => <span style={{ color: classeColor(r.classe), fontWeight: 600 }}>{r.classe}</span> },
        { key: 'codigoIbama', label: 'Cód. IBAMA' },
        { key: 'estado', label: 'Estado' },
        { key: 'destinacao', label: 'Destinação' },
        { key: 'destinador', label: 'Destinador' },
        { key: 'acoes', label: '', align: 'right', render: (r) => <RowAction icon={<FaTrash size={13} />} color="#ff4757" onClick={() => window.confirm('Excluir resíduo?') && remove(r.id)} /> },
    ];

    return (
        <>
            <Card style={{ marginBottom: '1.5rem' }}>
                <form onSubmit={(e) => { e.preventDefault(); add(f); setF({ ...f, nome: '', codigoIbama: '', destinador: '' }); }}>
                    <FormGrid cols={3}>
                        <Field label="Nome do resíduo" required span={2}><Input value={f.nome} onChange={(e) => set('nome', e.target.value)} required /></Field>
                        <Field label="Classe (NBR 10004)">
                            <Select value={f.classe} onChange={(e) => set('classe', e.target.value)}>
                                {CLASSES_RESIDUO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </Select>
                        </Field>
                        <Field label="Código IBAMA"><Input value={f.codigoIbama} onChange={(e) => set('codigoIbama', e.target.value)} placeholder="070213" /></Field>
                        <Field label="Estado físico">
                            <Select value={f.estado} onChange={(e) => set('estado', e.target.value)}>{ESTADOS_FISICOS.map((x) => <option key={x}>{x}</option>)}</Select>
                        </Field>
                        <Field label="Unidade padrão">
                            <Select value={f.unidade} onChange={(e) => set('unidade', e.target.value)}>{UNIDADES.map((x) => <option key={x}>{x}</option>)}</Select>
                        </Field>
                        <Field label="Destinação">
                            <Select value={f.destinacao} onChange={(e) => set('destinacao', e.target.value)}>{TIPOS_DESTINACAO.map((x) => <option key={x}>{x}</option>)}</Select>
                        </Field>
                        <Field label="Destinador padrão" span={2}><Input value={f.destinador} onChange={(e) => set('destinador', e.target.value)} placeholder="Empresa destinadora" /></Field>
                    </FormGrid>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <Btn type="submit" color="#9d4edd"><FaPlus size={12} /> Adicionar Resíduo</Btn>
                    </div>
                </form>
            </Card>
            <DataTable columns={columns} rows={items} empty="Nenhum resíduo cadastrado." />
        </>
    );
}

function GeradoresTab() {
    const { items, add, remove } = useCollection(COL.GERADORES);
    const [f, setF] = useState({ tag: '', descricao: 'Motor Scania / óleo diesel', injecao: 'Eletrônica', fabricante: 'Scania', potencia: '550 hp' });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

    const columns = [
        { key: 'tag', label: 'TAG', render: (r) => <strong>{r.tag}</strong> },
        { key: 'descricao', label: 'Descrição' },
        { key: 'injecao', label: 'Injeção' },
        { key: 'fabricante', label: 'Fabricante' },
        { key: 'potencia', label: 'Potência' },
        { key: 'acoes', label: '', align: 'right', render: (r) => <RowAction icon={<FaTrash size={13} />} color="#ff4757" onClick={() => window.confirm('Excluir gerador?') && remove(r.id)} /> },
    ];

    return (
        <>
            <Card style={{ marginBottom: '1.5rem' }}>
                <form onSubmit={(e) => { e.preventDefault(); add(f); setF({ ...f, tag: '' }); }}>
                    <FormGrid cols={4}>
                        <Field label="TAG / Nome" required><Input value={f.tag} onChange={(e) => set('tag', e.target.value)} placeholder="Gerador 8" required /></Field>
                        <Field label="Descrição" span={2}><Input value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></Field>
                        <Field label="Injeção">
                            <Select value={f.injecao} onChange={(e) => set('injecao', e.target.value)}>{INJECAO_TIPOS.map((x) => <option key={x}>{x}</option>)}</Select>
                        </Field>
                        <Field label="Potência"><Input value={f.potencia} onChange={(e) => set('potencia', e.target.value)} placeholder="550 hp" /></Field>
                        <Field label="Fabricante" span={2}><Input value={f.fabricante} onChange={(e) => set('fabricante', e.target.value)} /></Field>
                    </FormGrid>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <Btn type="submit" color="#9d4edd"><FaPlus size={12} /> Adicionar Gerador</Btn>
                    </div>
                </form>
            </Card>
            <DataTable columns={columns} rows={items} empty="Nenhum gerador cadastrado." />
        </>
    );
}

export default CadastrosView;
