import { useEffect, useMemo, useState } from 'react';
import { FaRecycle, FaPlus, FaTrash, FaEdit, FaFileExcel } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, FormGrid, DataTable, RowAction, Modal, Kpi } from '../components/ui';
import { exportToExcel } from '../lib/excel';
import { useWasteRegistry, CAMPOS } from '../lib/wasteRegistryRepo';

// ── Formulário: campos agrupados por seção ──
const SECOES = [
    {
        titulo: 'Identificação do resíduo',
        campos: [
            { key: 'waste_type', label: 'Resíduo', span: 2, placeholder: 'PLÁSTICO, PAPEL/PAPELÃO…' },
            { key: 'category', label: 'Categoria', placeholder: 'ISOPOR, SACO E FILME…' },
            { key: 'ibama_code', label: 'Código IBAMA', placeholder: '200139' },
            { key: 'physical_state', label: 'Estado físico', placeholder: 'SÓLIDO, LÍQUIDO…' },
            { key: 'waste_class', label: 'Classe (NBR 10004)', placeholder: 'I, II A, II B…' },
            { key: 'packaging', label: 'Acondicionamento', placeholder: 'PALLET, CONTAINER…' },
            { key: 'unit', label: 'Unidade', placeholder: 'KG, LITRO, M³…' },
            { key: 'weight', label: 'Peso / Quantidade', placeholder: '100' },
            { key: 'treatment', label: 'Tratamento / Destinação', span: 2, placeholder: 'RECICLAGEM, ATERRO CLASSE II…' },
        ],
    },
    {
        titulo: 'Destinador (recebedor final)',
        campos: [
            { key: 'destinator_name', label: 'Destinador (nome)', span: 2 },
            { key: 'destinator_cnpj', label: 'Destinador (CNPJ)' },
        ],
    },
    {
        titulo: 'Armazenamento temporário',
        campos: [
            { key: 'temp_storage_name', label: 'Armazenador (nome)', span: 2 },
            { key: 'temp_storage_cnpj', label: 'Armazenador (CNPJ)' },
        ],
    },
    {
        titulo: 'Transportadores',
        campos: [
            { key: 'transporter_1_name', label: 'Transportador 1 (nome)', span: 2 },
            { key: 'transporter_1_cnpj', label: 'Transportador 1 (CNPJ)' },
            { key: 'transporter_2_name', label: 'Transportador 2 (nome)', span: 2 },
            { key: 'transporter_2_cnpj', label: 'Transportador 2 (CNPJ)' },
            { key: 'transporter_3_name', label: 'Transportador 3 (nome)', span: 2 },
            { key: 'transporter_3_cnpj', label: 'Transportador 3 (CNPJ)' },
            { key: 'transporter_4_name', label: 'Transportador 4 (nome)', span: 2 },
            { key: 'transporter_4_cnpj', label: 'Transportador 4 (CNPJ)' },
        ],
    },
    {
        titulo: 'Classificação de risco (ANTT / ONU)',
        campos: [
            { key: 'onu_number', label: 'Número ONU', placeholder: '3082' },
            { key: 'risk_class', label: 'Classe de risco', placeholder: '9' },
            { key: 'packaging_group', label: 'Grupo de embalagem', placeholder: 'III' },
            { key: 'shipping_name', label: 'Nome apropriado p/ embarque', span: 2 },
        ],
    },
];

const empty = () => Object.fromEntries(CAMPOS.map((k) => [k, '']));

function FichaResiduosView({ onBack }) {
    const { items, add, update, remove, loading, error } = useWasteRegistry();

    const [busca, setBusca] = useState('');
    const [fTipo, setFTipo] = useState('todos');
    const [fTratamento, setFTratamento] = useState('todos');
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    const [modal, setModal] = useState(null); // { form, id|null }
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(empty());

    const tipos = useMemo(() => [...new Set(items.map((m) => m.waste_type).filter(Boolean))].sort(), [items]);
    const tratamentos = useMemo(() => [...new Set(items.map((m) => m.treatment).filter(Boolean))].sort(), [items]);

    const filtrados = useMemo(() => items.filter((m) =>
        (fTipo === 'todos' || m.waste_type === fTipo) &&
        (fTratamento === 'todos' || m.treatment === fTratamento) &&
        (!busca || CAMPOS.some((k) => String(m[k] || '').toLowerCase().includes(busca.toLowerCase())))
    ), [items, fTipo, fTratamento, busca]);

    useEffect(() => { setPage(1); }, [busca, fTipo, fTratamento, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const paginados = filtrados.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

    const kpis = useMemo(() => ({
        total: items.length,
        tipos: tipos.length,
        destinadores: new Set(items.map((m) => m.destinator_name).filter(Boolean)).size,
        perigosos: items.filter((m) => (m.waste_class || '').trim() === 'I' || /GRUPO A/i.test(m.waste_class || '')).length,
    }), [items, tipos.length]);

    const handleInclusao = async (e) => {
        e.preventDefault();
        if (!form.waste_type?.trim()) { alert('Informe ao menos o Resíduo.'); return; }
        await add(form);
        setForm(empty());
        setShowForm(false);
    };

    const salvar = async () => {
        if (!modal.form.waste_type?.trim()) { alert('Informe ao menos o Resíduo.'); return; }
        if (modal.id) await update(modal.id, modal.form);
        else await add(modal.form);
        setModal(null);
    };

    const exportar = () => {
        const fonte = filtrados.length ? filtrados : items;
        exportToExcel(fonte.map((m) => ({
            'Resíduo': m.waste_type || '', 'Categoria': m.category || '', 'Cód. IBAMA': m.ibama_code || '',
            'Classe': m.waste_class || '', 'Estado físico': m.physical_state || '', 'Acondicionamento': m.packaging || '',
            'Unidade': m.unit || '', 'Peso/Qtd': m.weight || '', 'Tratamento': m.treatment || '',
            'Destinador': m.destinator_name || '', 'CNPJ Destinador': m.destinator_cnpj || '',
            'Transportador 1': m.transporter_1_name || '', 'Transportador 2': m.transporter_2_name || '',
            'Transportador 3': m.transporter_3_name || '', 'Transportador 4': m.transporter_4_name || '',
            'Nº ONU': m.onu_number || '', 'Classe risco': m.risk_class || '', 'Grupo embalagem': m.packaging_group || '',
            'Nome embarque': m.shipping_name || '',
        })), 'cadastro_residuos', 'Resíduos');
    };

    const transportadores = (r) => [r.transporter_1_name, r.transporter_2_name, r.transporter_3_name, r.transporter_4_name].filter(Boolean).join(' · ') || '—';

    const columns = [
        { key: 'waste_type', label: 'Resíduo', align: 'center', wrap: true, render: (r) => <span style={{ fontWeight: 600 }}>{r.waste_type || '—'}{r.category ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.66rem', fontWeight: 400 }}>{r.category}</div> : null}</span> },
        { key: 'ibama_code', label: 'IBAMA', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>{r.ibama_code || '—'}</span> },
        { key: 'waste_class', label: 'Classe', align: 'center', render: (r) => r.waste_class || '—' },
        { key: 'treatment', label: 'Tratamento', align: 'center', wrap: true, render: (r) => r.treatment || '—' },
        { key: 'destinator_name', label: 'Destinador', align: 'center', wrap: true, render: (r) => <span>{r.destinator_name || '—'}{r.destinator_cnpj ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.66rem', fontFamily: 'ui-monospace, monospace' }}>{r.destinator_cnpj}</div> : null}</span> },
        { key: 'transportadores', label: 'Transportadores', align: 'center', wrap: true, render: (r) => <span style={{ fontSize: '0.72rem' }}>{transportadores(r)}</span> },
        { key: 'unit', label: 'Un.', align: 'center', render: (r) => r.unit || '—' },
        {
            key: 'acoes', label: '', align: 'center', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <RowAction icon={<FaEdit size={13} />} color="#54a0ff" title="Editar" onClick={() => setModal({ form: { ...empty(), ...r }, id: r.id })} />
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => window.confirm(`Excluir a ficha de "${r.waste_type}"?`) && remove(r.id)} />
                </div>
            ),
        },
    ];

    return (
        <PageShell
            icon={<FaRecycle size={20} />} color="#9d4edd"
            title="Cadastro de Resíduos"
            subtitle="Ficha mestre · destinadores, transportadores e classificação"
            onBack={onBack}
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaFileExcel size={10} /> Exportar Excel
                </Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={() => { setShowForm(!showForm); setTimeout(() => { document.querySelector('.ficha-form-card')?.scrollIntoView({ behavior: 'smooth' }); }, 50); }} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaPlus size={10} /> Adicionar resíduo
                </Btn>
            </>}
        >
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Kpi icon={<FaRecycle size={15} />} label="Fichas cadastradas" value={kpis.total} color="#9d4edd" />
                <Kpi icon={<FaRecycle size={15} />} label="Tipos de resíduo" value={kpis.tipos} color="#00ccff" />
                <Kpi icon={<FaRecycle size={15} />} label="Destinadores" value={kpis.destinadores} color="#10b981" />
                <Kpi icon={<FaTrash size={15} />} label="Classe I / RSS (perigosos)" value={kpis.perigosos} color={kpis.perigosos ? '#ff4757' : '#10b981'} />
            </div>

            {/* Form de Cadastro retrátil (mesmo design, tamanho, visual e ludicidade do MTR) */}
            <Card className="ficha-form-card" style={{ marginBottom: '1rem', borderLeft: '3px solid #9d4edd', padding: '0.6rem 0.9rem' }}>
                <div
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <FaRecycle size={14} color="#9d4edd" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            🆕 Registrar Novo Resíduo
                        </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {showForm ? 'Recolher formulário ▴' : 'Expandir formulário ▾'}
                    </span>
                </div>

                {showForm && (
                    <form onSubmit={handleInclusao} className="ficha-form" style={{ marginTop: '1.2rem', animation: 'slideDown 0.25s ease-out' }}>
                        <style>{`
                            .ficha-form .input-dark { padding: 0.34rem 0.55rem !important; font-size: 0.76rem !important; }
                            .ficha-form .label-muted { font-size: 0.58rem !important; display: block; margin-bottom: 0.12rem; }
                            .ficha-form > div[style*="grid"] { gap: 0.55rem 0.8rem !important; }
                            @keyframes slideDown {
                                from { opacity: 0; transform: translateY(-8px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                        
                        {SECOES.map((sec) => (
                            <div key={sec.titulo} style={{ marginBottom: '1.2rem' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#9d4edd', marginBottom: '0.6rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                                    {sec.titulo}
                                </div>
                                <FormGrid cols={3}>
                                    {sec.campos.map((c) => (
                                        <Field key={c.key} label={c.label} span={c.span}>
                                            <Input
                                                value={form[c.key] || ''}
                                                placeholder={c.placeholder}
                                                onChange={(e) => setForm((prev) => ({ ...prev, [c.key]: e.target.value }))}
                                                className="input-dark"
                                            />
                                        </Field>
                                    ))}
                                </FormGrid>
                            </div>
                        ))}
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                            <Btn variant="outline" color="#8b9bb4" onClick={() => { setShowForm(false); setForm(empty()); }}>Cancelar</Btn>
                            <Btn color="#9d4edd" type="submit"><FaPlus size={10} /> Adicionar resíduo</Btn>
                        </div>
                    </form>
                )}
            </Card>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)', marginRight: 'auto' }}>Resíduos <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>({filtrados.length})</span></h3>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={{ width: 170, fontSize: '0.68rem', padding: '0.3rem 0.55rem' }} />
                <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ width: 120, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Tipo</option>
                    {tipos.map((t) => <option key={t} value={t}>{t.length > 22 ? t.slice(0, 22) + '…' : t}</option>)}
                </Select>
                <Select value={fTratamento} onChange={(e) => setFTratamento(e.target.value)} style={{ width: 130, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    <option value="todos">Tratamento</option>
                    {tratamentos.map((t) => <option key={t} value={t}>{t.length > 24 ? t.slice(0, 24) + '…' : t}</option>)}
                </Select>
                <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: 90, fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}>
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n}/pág</option>)}
                </Select>
            </div>

            {error && (
                <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: '#ff47571a', border: '1px solid #ff475755', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>
                    Falha ao carregar do Supabase: {error}
                </div>
            )}

            <div className="ficha-tbl">
                <style>{`
                    .ficha-tbl table { font-size: 0.68rem !important; }
                    .ficha-tbl thead th { font-size: 0.54rem !important; padding: 0.4rem 0.45rem !important; }
                    .ficha-tbl tbody td { padding: 0.3rem 0.45rem !important; line-height: 1.25; }
                    .ficha-tbl tbody td span, .ficha-tbl tbody td div { font-size: 0.68rem !important; }
                    .ficha-tbl tbody td div { font-size: 0.6rem !important; }
                    .ficha-tbl th:nth-child(1), .ficha-tbl td:nth-child(1) { width: 17%; }
                    .ficha-tbl th:nth-child(2), .ficha-tbl td:nth-child(2) { width: 8%; }
                    .ficha-tbl th:nth-child(3), .ficha-tbl td:nth-child(3) { width: 7%; }
                    .ficha-tbl th:nth-child(4), .ficha-tbl td:nth-child(4) { width: 13%; }
                    .ficha-tbl th:nth-child(5), .ficha-tbl td:nth-child(5) { width: 25%; }
                    .ficha-tbl th:nth-child(6), .ficha-tbl td:nth-child(6) { width: 22%; }
                    .ficha-tbl th:nth-child(7), .ficha-tbl td:nth-child(7) { width: 5%; }
                    .ficha-tbl th:nth-child(8), .ficha-tbl td:nth-child(8) { width: 3%; }
                `}</style>
                <DataTable dense columns={columns} rows={paginados} empty={loading ? 'Carregando cadastro…' : 'Nenhum resíduo cadastrado. Clique em “Adicionar resíduo”.'} />
            </div>

            {filtrados.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <span>{(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtrados.length)} de {filtrados.length}</span>
                    <Btn variant="outline" color="#9d4edd" onClick={() => setPage(Math.max(1, pageSafe - 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe <= 1 ? 0.4 : 1, pointerEvents: pageSafe <= 1 ? 'none' : 'auto' }}>Anterior</Btn>
                    <span>Página {pageSafe} de {totalPages}</span>
                    <Btn variant="outline" color="#9d4edd" onClick={() => setPage(Math.min(totalPages, pageSafe + 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe >= totalPages ? 0.4 : 1, pointerEvents: pageSafe >= totalPages ? 'none' : 'auto' }}>Próxima</Btn>
                </div>
            )}

            {modal && (
                <Modal title={modal.id ? 'Editar ficha de resíduo' : 'Nova ficha de resíduo'} onClose={() => setModal(null)} width={780}>
                    {SECOES.map((sec) => (
                        <div key={sec.titulo} style={{ marginBottom: '1.2rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#9d4edd', marginBottom: '0.6rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                                {sec.titulo}
                            </div>
                            <FormGrid cols={2}>
                                {sec.campos.map((c) => (
                                    <Field key={c.key} label={c.label} span={c.span}>
                                        <Input
                                            value={modal.form[c.key] || ''}
                                            placeholder={c.placeholder}
                                            onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, [c.key]: e.target.value } }))}
                                        />
                                    </Field>
                                ))}
                            </FormGrid>
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                        <Btn variant="outline" color="#8b9bb4" onClick={() => setModal(null)}>Cancelar</Btn>
                        <Btn color="#9d4edd" onClick={salvar}><FaPlus size={12} /> {modal.id ? 'Salvar alterações' : 'Adicionar'}</Btn>
                    </div>
                </Modal>
            )}
        </PageShell>
    );
}

export default FichaResiduosView;
