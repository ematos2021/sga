import { useEffect, useMemo, useState } from 'react';
import { FaTruckMoving, FaPlus, FaTrash, FaFileExcel, FaExternalLinkAlt, FaEdit, FaForward, FaPrint, FaClipboardList } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, DataTable, RowAction, Modal, Kpi } from '../components/ui';
import { uid } from '../lib/store';
import { useAuth } from '../contexts/AuthContext';
import { useManifestos } from '../lib/manifestosRepo';
import { useWasteRegistry } from '../lib/wasteRegistryRepo';
import { STATUS_MANIFESTO, TIPOS_DESTINACAO, SINIR_URL } from '../lib/constants';
import { exportToExcel } from '../lib/excel';
import { parseWasteManifestsSQL } from '../lib/importManifestos';
import ProcessGuide from '../components/ProcessGuide';
import FichaPicker from '../components/FichaPicker';
import FR231Print from '../components/FR231Print';

// ── Fluxograma: Solicitação de Manifesto ──
const MANIFESTO_STEPS = [
    {
        type: 'action', icon: '📱',
        title: 'Receber a solicitação de manifesto',
        description: 'A solicitação chega pelo grupo do WhatsApp. Verifique o tipo de resíduo e o fornecedor/destinador solicitado.',
    },
    {
        type: 'action', icon: '📄',
        title: 'Pegar a Nota Fiscal na pasta de notas',
        description: 'Localize a Nota Fiscal referente ao resíduo na pasta de notas fiscais. A NF será grampeada ao manifesto ao final do processo.',
    },
    {
        type: 'action', icon: '📋',
        title: 'Abrir a IT.40001 — copiar código e especificações',
        description: 'Consulte o documento IT.40001 e copie o código e as especificações do resíduo que será manifesto.',
    },
    {
        type: 'action', icon: '🌐',
        title: 'Entrar no SINIR para emissão do manifesto',
        description: 'Acesse a plataforma SINIR (mtr.sinir.gov.br) para iniciar a emissão do Manifesto de Transporte de Resíduos.',
    },
    {
        type: 'decision', icon: '◆',
        title: 'Verificar: é apenas 1 MTR ou são 2 MTRs?',
        description: 'Determine a quantidade de MTRs necessários para esta solicitação.',
        branches: [
            {
                label: 'Apenas 1 MTR',
                color: '#10b981',
                description: 'Fluxo padrão com um único manifesto:',
                steps: [
                    'Entrar no login da MK BR ou NE',
                    'Cadastrar o resíduo, incluindo transportador e destinador',
                    'Emitir o MTR no SINIR',
                ],
            },
            {
                label: 'São 2 MTRs',
                color: '#54a0ff',
                description: 'Dois manifestos são necessários (ex.: MK BR + Sanches):',
                steps: [
                    'Entrar primeiro no login da MK BR para cadastrar o resíduo e emitir o MTR',
                    'Em seguida, fazer o cadastro no login da Sanches',
                    'Cadastrar o resíduo com transportador e destinador na Sanches',
                    'Imprimir apenas a via da Sanches',
                ],
            },
        ],
    },
    {
        type: 'action', icon: '🖨️',
        title: 'Imprimir e grampear documentos',
        description: 'Imprima o manifesto, grampeie-o junto com a Nota Fiscal e a Liberação de Saída de Resíduos.',
    },
    {
        type: 'action', icon: '💬',
        title: 'Responder no grupo do WhatsApp',
        description: 'Comunique no grupo que o manifesto está pronto e disponível para retirada.',
    },
    {
        type: 'action', icon: '📝',
        title: 'Preencher a FR 615',
        description: 'Registre os dados do manifesto emitido na planilha FR 615 para controle interno.',
    },
    {
        type: 'end',
        title: 'Tarefa concluída',
        description: 'O processo de solicitação de manifesto foi finalizado com sucesso.',
    },
];

const MANIFESTO_NOTES = [
    'Se for manifesto da Realce, a solicitação é via SGI devido à quantidade de material. O manifesto é sem Nota Fiscal e segue o fluxo de 1 MTR.',
    'Se for manifesto da PCHC com solicitação do almoxarifado, reimprima o último da planilha. Se for solicitação do Conserto, vai chegar um e-mail com os dados e segue o fluxo de 1 MTR.',
    'Manifesto de Classe I é solicitado pelo SGI e segue o fluxo de 1 MTR.',
    'Manifesto da LWART é solicitado pela manutenção. A Nota Fiscal é enviada posteriormente pelo e-mail devido à confirmação da quantidade coletada e segue o fluxo de 1 MTR.',
    'Manifesto Ambulatorial é feito apenas na última sexta-feira do mês e segue o fluxo de 1 MTR.',
];

const empty = () => ({
    numeroMTR: '', data: new Date().toISOString().slice(0, 10), hora: new Date().toTimeString().slice(0, 5), residuo: '',
    solicitante: '', motorista: '', placa: '', responsavelSGI: '',
    notaFiscal: '', ticketSustentare: '', manifestoSupertrans: '', setorColeta: '',
    destinador: '', destinacao: 'Reciclagem', status: 'Emitido', sinir: false,
    tipoRecebedor: 'Fornecedor',
});

const MESES_PT = { '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR', '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO', '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ' };
const mesDe = (m) => m.mes || MESES_PT[(m.data || '').slice(5, 7)] || '';

// Mapeia o "tratamento" do cadastro para a Destinação do manifesto
const destinacaoDeTratamento = (t = '') => {
    const s = t.toUpperCase();
    if (/RECICLA|REREFINO|REUTILIZ/.test(s)) return 'Reciclagem';
    if (/COPROCESS/.test(s)) return 'Coprocessamento';
    if (/COMPOST/.test(s)) return 'Compostagem';
    if (/INCINER/.test(s)) return 'Incineração';
    if (/CLASSE I\b|CLASSE 1|ATERRO CLASSE I/.test(s)) return 'Aterro Industrial';
    if (/CLASSE II|ATERRO/.test(s)) return 'Aterro Sanitário';
    if (/EFLUENTE|AUTOCLAVE|DESCONTAMINA|TRATAMENTO/.test(s)) return 'Tratamento';
    return '';
};

// Emoji por resíduo (leitura rápida na tabela)
const iconeResiduo = (nome = '') => {
    const t = nome.toUpperCase();
    if (/ISOPOR|PLÁSTIC|PLASTIC/.test(t)) return '🧴';
    if (/PAPEL|PAPELÃO|PAPELAO|TUBETE/.test(t)) return '📦';
    if (/METAL|SUCATA|AÇO|ACO/.test(t)) return '🔩';
    if (/VIDRO/.test(t)) return '🫙';
    if (/MADEIRA|LENHA|PALLET|ENGRAD/.test(t)) return '🪵';
    if (/ÓLEO|OLEO|LUBRIF/.test(t)) return '🛢️';
    if (/BORRACHA|PNEU/.test(t)) return '🛞';
    if (/LÂMPADA|LAMPADA/.test(t)) return '💡';
    if (/PILHA|BATERIA/.test(t)) return '🔋';
    if (/ELETRÔNIC|ELETRONIC|INFORMÁTIC|INFORMATIC/.test(t)) return '💻';
    if (/AMBULATORIAL|INFECT|RSS/.test(t)) return '⚕️';
    if (/EFLUENTE|SANITÁRIO|SANITARIO/.test(t)) return '💧';
    if (/ENTULHO/.test(t)) return '🧱';
    if (/CONTAMINAD/.test(t)) return '☣️';
    if (/ATERRO|LIXO|COMUM/.test(t)) return '🗑️';
    return '♻️';
};

function ManifestoMTRView({ onBack }) {
    const { items, add, update, remove, setAll, loading, error } = useManifestos();
    const { items: fichas } = useWasteRegistry();
    const { currentUser } = useAuth();
    const nomeUsuario = currentUser?.name || currentUser?.username || '';
    const [form, setForm] = useState(empty());
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // Preenche o Solicitante com o usuário logado (ao montar / login resolver)
    useEffect(() => {
        if (!editId) setForm((f) => (f.solicitante ? f : { ...f, solicitante: nomeUsuario }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nomeUsuario]);

    // Filtros
    const [fMes, setFMes] = useState('todos');
    const [fResiduo, setFResiduo] = useState('todos');
    const [fDestinador, setFDestinador] = useState('todos');
    const [fCard, setFCard] = useState('todos');
    const [busca, setBusca] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [printItem, setPrintItem] = useState(null);

    // Paginação (mantém a tela fluída com muitos registros)
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    // Destinador: alterna entre escolher na lista do cadastro ou digitar livre
    const [destLivre, setDestLivre] = useState(false);

    // Setor de coleta: escolher na lista (setores já usados) ou digitar novo
    const [setorLivre, setSetorLivre] = useState(false);

    // Edição de manifesto (null = criando novo)
    const [editId, setEditId] = useState(null);

    // Confirmação de exclusão (manifesto a excluir)
    const [confirmDel, setConfirmDel] = useState(null);

    // Exibição do guia de fluxo (acionado por botão no topo)
    const [showGuide, setShowGuide] = useState(false);

    const onResiduo = (nome) => {
        const f = fichas.find((x) => x.waste_type === nome);
        setForm((prev) => ({ 
            ...prev, 
            residuo: nome, 
            destinador: f?.destinator_name || prev.destinador, 
            destinacao: f ? destinacaoDeTratamento(f.treatment) || prev.destinacao : prev.destinacao 
        }));
    };

    // Auto-preenchimento a partir de uma ficha do Cadastro de Resíduos
    const carregarFicha = (id) => {
        const f = fichas.find((x) => String(x.id) === String(id));
        if (!f) return;
        const residuo = `${f.waste_type || ''}${f.category ? ' - ' + f.category : ''}`.trim();
        setForm((prev) => ({
            ...prev,
            residuo,
            destinador: f.destinator_name || prev.destinador,
            destinacao: destinacaoDeTratamento(f.treatment) || prev.destinacao,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editId) update(editId, { ...form });
        else add({ ...form });
        setForm({ ...empty(), solicitante: nomeUsuario });
        setEditId(null);
        setDestLivre(false);
    };

    // Carrega um manifesto no formulário para edição
    const editarManifesto = (m) => {
        setForm({ ...empty(), ...m });
        setEditId(m.id);
        setDestLivre(false);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicao = () => {
        setForm({ ...empty(), solicitante: nomeUsuario });
        setEditId(null);
        setDestLivre(false);
    };

    // Importação do dump SQL (INSERT INTO waste_manifests …)
    const importar = (registros) => {
        const existentes = new Set(items.map((m) => String(m.numeroMTR)).filter(Boolean));
        const novos = registros
            .filter((r) => !r.numeroMTR || !existentes.has(String(r.numeroMTR)))
            .map((r) => ({ id: uid(), createdAt: new Date().toISOString(), ...r }));
        setAll([...novos, ...items]);
        return novos.length;
    };

    // Opções de filtro
    const meses = [...new Set(items.map(mesDe).filter(Boolean))];
    const tiposResiduo = [...new Set(items.map((m) => m.residuo).filter(Boolean))].sort();
    const destinadores = [...new Set(items.map((m) => m.destinador).filter(Boolean))].sort();

    const filtrados = items.filter((m) => {
        let matchCard = true;
        if (fCard === 'reciclagem') matchCard = m.destinacao === 'Reciclagem' || m.destinacao === 'Reutilização';
        else if (fCard === 'aterro') matchCard = m.destinacao === 'Aterro Industrial' || m.destinacao === 'Aterro Sanitário';
        else if (fCard === 'outros') matchCard = m.destinacao !== 'Reciclagem' && m.destinacao !== 'Reutilização' && m.destinacao !== 'Aterro Industrial' && m.destinacao !== 'Aterro Sanitário';

        return matchCard &&
            (fMes === 'todos' || mesDe(m) === fMes) &&
            (fResiduo === 'todos' || m.residuo === fResiduo) &&
            (fDestinador === 'todos' || m.destinador === fDestinador) &&
            (!busca || `${m.numeroMTR} ${m.residuo} ${m.solicitante} ${m.motorista} ${m.placa} ${m.destinador} ${m.setorColeta}`.toLowerCase().includes(busca.toLowerCase()));
    });

    // Volta para a 1ª página sempre que filtros/busca/tamanho mudam
    useEffect(() => { setPage(1); }, [busca, fMes, fResiduo, fDestinador, fCard, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const paginados = filtrados.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

    // Resíduos únicos do cadastro (para o seletor de Resíduo)
    const residuosUnicos = useMemo(() => [...new Set(fichas.map((f) => f.waste_type).filter(Boolean))].sort(), [fichas]);

    // Setores de coleta já cadastrados nos manifestos
    const setoresUnicos = useMemo(() => [...new Set(items.map((m) => m.setorColeta).filter(Boolean))].sort(), [items]);

    // Destinadores sugeridos para o resíduo atual (do Cadastro de Resíduos).
    // Casamento tolerante: normaliza acentos/caixa e compara por tokens (com
    // inclusão parcial), pois os nomes no cadastro variam (PAPEL, PAPELÃO,
    // PAPEL/PAPELÃO, typos como PEPEL…). Assim todos os destinadores/CNPJs do
    // mesmo resíduo aparecem na lista.
    const destinadoresSugeridos = useMemo(() => {
        const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
        const tokens = (s) => norm(s).split(/[^A-Z0-9]+/).filter((t) => t.length >= 3);
        const rTokens = tokens(form.residuo);
        let base = fichas;
        if (rTokens.length) {
            const casa = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
            const m = fichas.filter((f) => {
                const fTokens = tokens(`${f.waste_type || ''} ${f.category || ''}`);
                return rTokens.some((a) => fTokens.some((b) => casa(a, b)));
            });
            if (m.length) base = m;
        }
        return [...new Set(base.map((f) => f.destinator_name).filter(Boolean))].sort();
    }, [fichas, form.residuo]);

    // KPIs — baseados em TODOS os itens (não filtrados)
    const kpis = useMemo(() => {
        const total = items.length;
        const recic = items.filter((m) =>
            m.destinacao === 'Reciclagem' || m.destinacao === 'Reutilização'
        ).length;
        const aterro = items.filter((m) =>
            m.destinacao === 'Aterro Industrial' || m.destinacao === 'Aterro Sanitário'
        ).length;
        const outros = total - recic - aterro; // Coprocessamento, Incineração, Tratamento, Outros…
        const taxaRecic = total ? Math.round((recic / total) * 100) : 0;
        const destCount = new Set(items.map((m) => m.destinador).filter(Boolean)).size;
        return { total, recic, aterro, outros, taxaRecic, destinadores: destCount };
    }, [items]);

    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');

    const exportar = () => {
        const fonte = filtrados.length ? filtrados : items;
        exportToExcel(fonte.map((m) => ({
            'Data': brData(m.data), 'Mês': mesDe(m), 'Hora': m.hora || '', 'Solicitante': m.solicitante || '',
            'Resíduo': m.residuo || '', 'Motorista': m.motorista || '', 'Placa': m.placa || '', 'Resp. SGI': m.responsavelSGI || '',
            'Nota Fiscal': m.notaFiscal || '', 'Ticket Sustentare': m.ticketSustentare || '',
            'Manifesto Mondial': m.numeroMTR || '', 'Manifesto Supertrans': m.manifestoSupertrans || '',
            'Destinador': m.destinador || '', 'Setor de Coleta': m.setorColeta || '', 'Destinação': m.destinacao || '',
            'SINIR': m.sinir ? 'Sim' : 'Não', 'Status': m.status || '',
        })), 'controle_manifestos_MTR', 'Manifestos');
    };

    const columns = [
        { key: 'data', label: 'Data', align: 'center', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{brData(r.data)}{r.hora ? <span style={{ color: 'var(--color-text-subtle)' }}> {r.hora}</span> : ''}</span> },
        { key: 'numeroMTR', label: 'Manifesto', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>{r.numeroMTR || '—'}{r.manifestoSupertrans ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.66rem' }}>ST {r.manifestoSupertrans}</div> : null}</span> },
        { key: 'residuo', label: 'Resíduo', align: 'center', wrap: true, render: (r) => <span title={r.residuo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: '0.95rem' }}>{iconeResiduo(r.residuo)}</span>{(r.residuo || '').length > 26 ? r.residuo.slice(0, 26) + '…' : (r.residuo || '—')}</span> },
        { key: 'notaFiscal', label: 'Nota Fiscal', align: 'center', render: (r) => r.notaFiscal || '—' },
        { key: 'solicitante', label: 'Solicitante', align: 'center', wrap: true, render: (r) => r.solicitante || '—' },
        { key: 'motorista', label: 'Motorista / Placa', align: 'center', wrap: true, render: (r) => <span>{r.motorista || '—'}{r.placa ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.66rem', fontFamily: 'ui-monospace, monospace' }}>{r.placa}</div> : null}</span> },
        { key: 'setorColeta', label: 'Setor de Coleta', align: 'center', render: (r) => r.setorColeta || '—' },
        { key: 'destinador', label: 'Destinador', align: 'center', wrap: true, render: (r) => r.destinador || '—' },
        { key: 'responsavelSGI', label: 'SGI', align: 'center', wrap: true, render: (r) => r.responsavelSGI || '—' },
        {
            key: 'status', label: 'Status', align: 'center', render: (r) => {
                const cor = r.status === 'Emitido' ? '#10b981' : '#ffb700';
                return (
                    <Select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                        style={{ padding: '0.22rem 0.7rem', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.3px', width: 'auto', minWidth: 132, margin: '0 auto', color: cor, background: cor + '1a', borderColor: cor + '55', borderRadius: 20 }}>
                        {STATUS_MANIFESTO.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                );
            },
        },
        {
            key: 'acoes', label: '', align: 'center', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <RowAction icon={<FaPrint size={13} />} color="#54a0ff" title="Imprimir FR 231" onClick={() => setPrintItem(r)} />
                    <RowAction icon={<FaEdit size={13} />} color="#10b981" title="Editar manifesto" onClick={() => editarManifesto(r)} />
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => setConfirmDel(r)} />
                </div>
            ),
        },
    ];

    return (
        <PageShell
            icon={<FaTruckMoving size={20} />} color="#54a0ff"
            title="Manifesto de Transporte de Resíduos (MTR)"
            subtitle="Emissão via SINIR · controle consolidado"
            onBack={onBack}
            maxWidth="100%"
            actions={<>
                <Btn variant="outline" color="#8b9bb4" onClick={() => window.open(SINIR_URL, '_blank')} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaExternalLinkAlt size={10} /> Abrir SINIR
                </Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={() => setShowGuide((s) => !s)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaClipboardList size={11} /> Fluxo
                </Btn>
            </>}
        >
            {/* Guia de Processo — exibido ao clicar em "Fluxo" */}
            {showGuide && (
                <div className="mtr-guide" style={{ marginBottom: '1rem' }}>
                    <style>{`
                        .mtr-guide .process-guide__toggle { padding: 0.5rem 0.8rem !important; background: transparent !important; border: 1px solid var(--border-color-soft) !important; }
                        .mtr-guide .process-guide__toggle-title { font-size: 0.76rem !important; font-weight: 600 !important; }
                        .mtr-guide .process-guide__toggle-hint { font-size: 0.62rem !important; }
                    `}</style>
                    <ProcessGuide
                        title="Fluxo de Solicitação de Manifesto"
                        color="#8b9bb4"
                        steps={MANIFESTO_STEPS}
                        notes={MANIFESTO_NOTES}
                        defaultOpen
                    />
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaTruckMoving size={12} />} label="Manifestos" value={kpis.total} sub="total registrados" color="#54a0ff" onClick={() => setFCard('todos')} active={fCard === 'todos'} />
                <Kpi icon={<FaFileExcel size={12} />} label="Reciclagem" value={kpis.recic} sub={`${kpis.taxaRecic}% do total`} color="#10b981" onClick={() => setFCard('reciclagem')} active={fCard === 'reciclagem'} />
                <Kpi icon={<FaTrash size={12} />} label="Aterro" value={kpis.aterro} sub={`${kpis.total ? Math.round((kpis.aterro / kpis.total) * 100) : 0}% do total`} color={kpis.aterro ? '#ffb700' : '#10b981'} onClick={() => setFCard('aterro')} active={fCard === 'aterro'} />
                <Kpi icon={<FaForward size={12} />} label="Outros destinos" value={kpis.outros} sub="copro · incin · trat" color="#a78bfa" onClick={() => setFCard('outros')} active={fCard === 'outros'} />
                <Kpi icon={<FaForward size={12} />} label="Destinadores" value={kpis.destinadores} sub="parceiros distintos" color="#00ccff" onClick={() => setFCard('todos')} />
            </div>

            <Card style={{ marginBottom: '1rem', borderLeft: '3px solid #54a0ff', padding: '0.6rem 0.9rem' }}>
                <div
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        marginBottom: showForm ? '0.8rem' : '0px'
                    }}
                >
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        📝 {editId ? 'Editar Manifesto' : 'Registrar Novo Manifesto'}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        {showForm ? '▲ Recolher formulário' : '▼ Expandir formulário'}
                    </span>
                </div>

                {showForm && (
                    <>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                            Registre a saída de resíduos com os dados do manifesto (Mondial/Supertrans), ticket Sustentare, NF, motorista e setor de coleta.
                            Para carga em lote, use <strong>Importar dados</strong> e cole o dump da planilha/banco.
                        </div>
                        <form onSubmit={handleSubmit} className="mtr-form">
                            <style>{`
                                .mtr-form .input-dark { padding: 0.34rem 0.55rem !important; font-size: 0.76rem !important; }
                                .mtr-form .label-muted { font-size: 0.58rem !important; display: block; margin-bottom: 0.12rem; }
                                .mtr-form > div[style*="grid"] { gap: 0.55rem 0.8rem !important; }
                            `}</style>
                            <FormGrid cols={3}>
                                <Field label="Carregar do cadastro de resíduos" span={3}>
                                    <FichaPicker fichas={fichas} onSelect={(f) => carregarFicha(f.id)} />
                                </Field>
                                <Field label="Nº manifesto (Mondial/SINIR)" required>
                                    <Input value={form.numeroMTR} onChange={(e) => set('numeroMTR', e.target.value)} placeholder="291028890965" required />
                                </Field>
                                <Field label="Data" required><Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} required /></Field>
                                <Field label="Hora"><Input type="time" value={form.hora} onChange={(e) => set('hora', e.target.value)} /></Field>
                                <Field label="Resíduo" required span={2}>
                                    <Select value={form.residuo} onChange={(e) => onResiduo(e.target.value)} placeholder="Selecione o resíduo…">
                                        <option value="">Selecione o resíduo…</option>
                                        {form.residuo && !residuosUnicos.includes(form.residuo) && <option value={form.residuo}>{form.residuo}</option>}
                                        {residuosUnicos.map((nome, idx) => <option key={idx} value={nome}>{nome}</option>)}
                                    </Select>
                                </Field>
                                <Field label="Destinação">
                                    <Select value={form.destinacao} onChange={(e) => set('destinacao', e.target.value)} placeholder="Selecione…">
                                        {TIPOS_DESTINACAO.map((d) => <option key={d} value={d}>{d}</option>)}
                                    </Select>
                                </Field>
                                <Field label="Solicitante">
                                    <div className="input-dark" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{currentUser?.avatar || '👤'}</span>
                                        <input
                                            value={form.solicitante}
                                            onChange={(e) => set('solicitante', e.target.value)}
                                            placeholder="Quem está solicitando…"
                                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text-main)', fontSize: 'inherit', minWidth: 0 }}
                                        />
                                    </div>
                                </Field>
                                <Field label="Motorista" required><Input value={form.motorista} onChange={(e) => set('motorista', e.target.value)} required /></Field>
                                <Field label="Placa" required><Input value={form.placa} onChange={(e) => set('placa', e.target.value)} placeholder="ABC1D23" required /></Field>
                                <Field label="Responsável SGI"><Input value={form.responsavelSGI} onChange={(e) => set('responsavelSGI', e.target.value)} /></Field>
                                <Field label="Setor de coleta">
                                    {(setorLivre || setoresUnicos.length === 0) ? (
                                        <Input
                                            value={form.setorColeta}
                                            onChange={(e) => set('setorColeta', e.target.value)}
                                            placeholder="FAB'1, G100…"
                                            onBlur={() => { if (setoresUnicos.length) setSetorLivre(false); }}
                                            autoFocus={setorLivre}
                                        />
                                    ) : (
                                        <Select
                                            value={setoresUnicos.includes(form.setorColeta) ? form.setorColeta : (form.setorColeta ? '__ATUAL__' : '')}
                                            onChange={(e) => {
                                                if (e.target.value === '__OUTRO__') { setSetorLivre(true); set('setorColeta', ''); }
                                                else if (e.target.value !== '__ATUAL__') set('setorColeta', e.target.value);
                                            }}
                                        >
                                            <option value="">Selecione o setor…</option>
                                            {form.setorColeta && !setoresUnicos.includes(form.setorColeta) && (
                                                <option value="__ATUAL__">{form.setorColeta}</option>
                                            )}
                                            {setoresUnicos.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                                            <option value="__OUTRO__">✏️ Digitar outro…</option>
                                        </Select>
                                    )}
                                </Field>
                                <Field label="Destinador (recebedor)">
                                    {(destLivre || destinadoresSugeridos.length === 0) ? (
                                        <Input
                                            value={form.destinador}
                                            onChange={(e) => set('destinador', e.target.value)}
                                            placeholder="SUSTENTARE, PENHA…"
                                            onBlur={() => { if (destinadoresSugeridos.length) setDestLivre(false); }}
                                            autoFocus={destLivre}
                                        />
                                    ) : (
                                        <Select
                                            value={destinadoresSugeridos.includes(form.destinador) ? form.destinador : (form.destinador ? '__ATUAL__' : '')}
                                            onChange={(e) => {
                                                if (e.target.value === '__OUTRO__') { setDestLivre(true); set('destinador', ''); }
                                                else if (e.target.value !== '__ATUAL__') set('destinador', e.target.value);
                                            }}
                                        >
                                            <option value="">Selecione o destinador…</option>
                                            {form.destinador && !destinadoresSugeridos.includes(form.destinador) && (
                                                <option value="__ATUAL__">{form.destinador}</option>
                                            )}
                                            {destinadoresSugeridos.map((nome, idx) => <option key={idx} value={nome}>{nome}</option>)}
                                            <option value="__OUTRO__">✏️ Digitar outro…</option>
                                        </Select>
                                    )}
                                </Field>
                                <Field label="Recebedor da doação">
                                    <Select value={form.tipoRecebedor} onChange={(e) => set('tipoRecebedor', e.target.value)}>
                                        <option value="Fornecedor">Fornecedor (sem matrícula)</option>
                                        <option value="Colaborador">Colaborador (com matrícula)</option>
                                    </Select>
                                </Field>
                                <Field label="Nota Fiscal"><Input value={form.notaFiscal} onChange={(e) => set('notaFiscal', e.target.value)} /></Field>
                                <Field label="Ticket Sustentare"><Input value={form.ticketSustentare} onChange={(e) => set('ticketSustentare', e.target.value)} /></Field>
                                <Field label="Manifesto Supertrans"><Input value={form.manifestoSupertrans} onChange={(e) => set('manifestoSupertrans', e.target.value)} /></Field>
                            </FormGrid>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.sinir} onChange={(e) => set('sinir', e.target.checked)} />
                                    Emitido no SINIR
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {editId && <Btn type="button" variant="outline" color="#8b9bb4" onClick={cancelarEdicao}>Cancelar edição</Btn>}
                                    <Btn type="submit" color={editId ? '#10b981' : '#54a0ff'}><FaPlus size={12} /> {editId ? 'Salvar alterações' : 'Registrar Manifesto'}</Btn>
                                </div>
                            </div>
                        </form>
                    </>
                )}
            </Card>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)', marginRight: 'auto' }}>Controle de Manifestos <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>({filtrados.length})</span></h3>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={{ width: 180 }} />
                <Select value={fMes} onChange={(e) => setFMes(e.target.value)} style={{ width: 110 }}>
                    <option value="todos">Mês</option>
                    {meses.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Select value={fResiduo} onChange={(e) => setFResiduo(e.target.value)} style={{ width: 170 }}>
                    <option value="todos">Resíduo</option>
                    {tiposResiduo.map((r) => <option key={r} value={r}>{r.length > 24 ? r.slice(0, 24) + '…' : r}</option>)}
                </Select>
                <Select value={fDestinador} onChange={(e) => setFDestinador(e.target.value)} style={{ width: 150 }}>
                    <option value="todos">Destinador</option>
                    {destinadores.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: 110 }}>
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / página</option>)}
                </Select>
                {(fMes !== 'todos' || fResiduo !== 'todos' || fDestinador !== 'todos' || busca !== '' || fCard !== 'todos') && (
                    <Btn variant="outline" color="#ff4757" onClick={() => {
                        setFMes('todos');
                        setFResiduo('todos');
                        setFDestinador('todos');
                        setBusca('');
                        setFCard('todos');
                    }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.74rem' }}>
                        Limpar Filtros
                    </Btn>
                )}
            </div>
            {error && (
                <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: '#ff47571a', border: '1px solid #ff475755', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>
                    Falha ao carregar do Supabase: {error}
                </div>
            )}
            <div className="mtr-tbl">
                <style>{`
                    .mtr-tbl > div { border: none !important; border-radius: 0 !important; border-top: 1px solid var(--border-color-soft) !important; }
                    .mtr-tbl table { font-size: 0.76rem !important; font-variant-numeric: tabular-nums; }
                    .mtr-tbl thead tr { background: transparent !important; }
                    .mtr-tbl thead th { font-size: 0.6rem !important; font-weight: 600 !important; letter-spacing: 0.7px; padding: 0.55rem 0.7rem !important; color: var(--color-text-subtle) !important; border-bottom: 1px solid var(--border-color) !important; }
                    .mtr-tbl tbody td { padding: 0.6rem 0.7rem !important; border-bottom: 1px solid var(--border-color-soft) !important; line-height: 1.4; font-weight: 400; }
                    .mtr-tbl tbody tr:hover { background: var(--bg-surface-2) !important; }
                    .mtr-tbl tbody td span, .mtr-tbl tbody td div { font-size: 0.76rem !important; }
                    .mtr-tbl tbody td div { font-size: 0.66rem !important; color: var(--color-text-subtle); }
                `}</style>
                <DataTable dense columns={columns} rows={paginados} empty={loading ? 'Carregando manifestos do Supabase…' : 'Nenhum manifesto. Registre acima ou use Importar dados.'} />
            </div>

            {filtrados.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <span>
                        {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtrados.length)} de {filtrados.length}
                    </span>
                    <Btn variant="outline" color="#54a0ff" onClick={() => setPage(Math.max(1, pageSafe - 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe <= 1 ? 0.4 : 1, pointerEvents: pageSafe <= 1 ? 'none' : 'auto' }}>Anterior</Btn>
                    <span>Página {pageSafe} de {totalPages}</span>
                    <Btn variant="outline" color="#54a0ff" onClick={() => setPage(Math.min(totalPages, pageSafe + 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe >= totalPages ? 0.4 : 1, pointerEvents: pageSafe >= totalPages ? 'none' : 'auto' }}>Próxima</Btn>
                </div>
            )}

            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importar} />}
            {printItem && <FR231Print data={printItem} onClose={() => setPrintItem(null)} />}

            {confirmDel && (
                <div
                    onClick={() => setConfirmDel(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.6rem', textAlign: 'center', animation: 'fadeIn 0.15s ease-out' }}
                    >
                        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#ff47571a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <FaTrash size={22} color="#ff4757" />
                        </div>
                        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Excluir manifesto?</h3>
                        <p style={{ margin: '0 0 1.4rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            Esta ação não pode ser desfeita. O manifesto{' '}
                            <strong style={{ color: 'var(--color-text-main)' }}>{confirmDel.numeroMTR || confirmDel.residuo || 'selecionado'}</strong>
                            {confirmDel.data ? ` (${brData(confirmDel.data)})` : ''} será removido permanentemente.
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

// ── Modal de importação de dump SQL ──
function ImportModal({ onClose, onImport }) {
    const [texto, setTexto] = useState('');
    const [previa, setPrevia] = useState(null);

    const processar = () => setPrevia(parseWasteManifestsSQL(texto));
    const confirmar = () => {
        const n = onImport(previa);
        alert(`${n} manifesto(s) importado(s).${previa.length - n > 0 ? ` ${previa.length - n} já existiam (ignorados).` : ''}`);
        onClose();
    };

    return (
        <Modal title="Importar manifestos (dump SQL / planilha)" onClose={onClose} width={680}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '0.8rem' }}>
                Cole abaixo os comandos <code>INSERT INTO waste_manifests … VALUES …;</code> do dump. O sistema lê as colunas automaticamente,
                trata aspas, <code>NULL</code> e o placeholder <code>-</code>, classifica a destinação pelo tipo de resíduo e ignora manifestos já existentes (pelo nº Mondial).
            </div>
            <Textarea rows={9} value={texto} onChange={(e) => { setTexto(e.target.value); setPrevia(null); }}
                placeholder="INSERT INTO waste_manifests (date, month, time, requester, waste_type, ...) VALUES (...);" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }} />

            {previa && (
                <div style={{ marginTop: '0.8rem', padding: '0.7rem 0.9rem', borderRadius: 10, background: previa.length ? '#10b9811a' : '#ff47571a', border: `1px solid ${previa.length ? '#10b98155' : '#ff475755'}`, fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                    {previa.length
                        ? <>Reconhecidos <strong>{previa.length}</strong> manifesto(s). Ex.: <em>{previa[0].data} · {previa[0].residuo} · {previa[0].destinador || '—'}</em></>
                        : 'Nenhum registro reconhecido. Verifique se colou os comandos INSERT completos.'}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                {!previa
                    ? <Btn color="#a78bfa" onClick={processar}><FaFileImport size={12} /> Processar</Btn>
                    : <Btn color="#10b981" onClick={confirmar} ><FaPlus size={12} /> Importar {previa.length || ''}</Btn>}
            </div>
        </Modal>
    );
}

export default ManifestoMTRView;
