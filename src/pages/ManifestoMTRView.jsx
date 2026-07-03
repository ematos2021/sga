import { useEffect, useMemo, useState } from 'react';
import { FaTruckMoving, FaPlus, FaTrash, FaFileExcel, FaExternalLinkAlt, FaEdit, FaForward, FaPrint, FaClipboardList, FaSave, FaTimes, FaDollarSign } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, DataTable, RowAction, Modal, Kpi } from '../components/ui';
import { uid } from '../lib/store';
import { useAuth } from '../contexts/AuthContext';
import { useManifestos } from '../lib/manifestosRepo';
import { useWasteRegistry } from '../lib/wasteRegistryRepo';
import { STATUS_MANIFESTO, TIPOS_DESTINACAO, SINIR_URL } from '../lib/constants';
import { exportToExcel } from '../lib/excel';
import { parseWasteManifestsSQL } from '../lib/importManifestos';
import { useRefunds, useRefundCatalog } from '../lib/refundsRepo';
import { useCashFlow } from '../lib/cashFlowRepo';
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

const emptyForm = () => ({
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

// Emoji por resíduo (leitura rápida na tabela, suporta múltiplos resíduos separados por ' | ')
const iconeResiduo = (nome = '') => {
    const partes = nome.split(/\s*\|\s*/).filter(Boolean);
    if (partes.length === 0) return '♻️';
    const icones = partes.map((p) => {
        const t = p.toUpperCase();
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
    });
    return [...new Set(icones)].join('');
};


// Componente para seleção e exibição de múltiplos resíduos no mesmo manifesto
function MultiWasteSelector({ value, onChange, residuosUnicos, fichas, onAddWasteDetails }) {
    const list = useMemo(() => (value ? value.split(/\s*\|\s*/).filter(Boolean) : []), [value]);
    const [selected, setSelected] = useState('');

    const handleAdd = () => {
        if (!selected || list.includes(selected)) return;
        const newList = [...list, selected];
        onChange(newList.join(' | '));
        if (onAddWasteDetails) {
            onAddWasteDetails(selected);
        }
        setSelected('');
    };

    const handleRemove = (itemToRemove) => {
        const newList = list.filter((item) => item !== itemToRemove);
        onChange(newList.join(' | '));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <Select value={selected} onChange={(e) => setSelected(e.target.value)} placeholder="Selecione um resíduo para adicionar…">
                        <option value="">Selecione um resíduo…</option>
                        {residuosUnicos.map((nome, idx) => (
                            <option key={idx} value={nome} disabled={list.includes(nome)}>
                                {nome}
                            </option>
                        ))}
                    </Select>
                </div>
                <Btn onClick={handleAdd} disabled={!selected} style={{ padding: '0.38rem 0.8rem', height: '100%', minHeight: '34px' }}>
                    <FaPlus size={10} /> Adicionar
                </Btn>
            </div>
            
            {list.length > 0 && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.15rem',
                    padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                    border: '1px solid var(--border-color-soft)'
                }}>
                    {list.map((item, idx) => (
                        <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.2rem 0.55rem', background: 'var(--bg-surface-3)',
                            borderRadius: '16px', border: '1px solid var(--border-color)',
                            fontSize: '0.74rem', color: 'var(--color-text-main)'
                        }}>
                            <span style={{ fontSize: '0.85rem' }}>{iconeResiduo(item)}</span>
                            <span>{item}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(item)}
                                style={{
                                    background: 'transparent', border: 'none', color: 'var(--color-danger)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '0 2px', fontSize: '0.74rem', fontWeight: 'bold'
                                }}
                            >
                                <FaTimes size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ManifestoMTRView({ onBack }) {
    const { items, add, update, remove, setAll, loading, error } = useManifestos();
    const { items: fichas } = useWasteRegistry();
    const { currentUser } = useAuth();
    const nomeUsuario = currentUser?.name || currentUser?.username || '';
    const isGestorOuAnalista = currentUser?.role === 'gestor' || currentUser?.role === 'analista';
    const [form, setForm] = useState(emptyForm());
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // Preenche o Solicitante com o usuário logado (ao montar / login resolver)
    useEffect(() => {
        setForm((f) => (f.solicitante ? f : { ...f, solicitante: nomeUsuario }));
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

    // Modal de edição (objeto do manifesto sendo editado, ou null)
    const [editModal, setEditModal] = useState(null);

    // Confirmação de exclusão (manifesto a excluir)
    const [confirmDel, setConfirmDel] = useState(null);

    // Exibição do guia de fluxo (acionado por botão no topo)
    const [showGuide, setShowGuide] = useState(false);

    // Reembolsos totais para cálculo de KPI e estado do modal de reembolso
    const { items: allRefunds, reload: reloadAllRefunds } = useRefunds();
    const [refundModalItem, setRefundModalItem] = useState(null);

    // Estado para o modal de visualização de detalhes do manifesto
    const [viewModalItem, setViewModalItem] = useState(null);

    // Estado para exibir o modal de Fluxo de Caixa
    const [showCashFlowModal, setShowCashFlowModal] = useState(false);

    const onAddWasteDetails = (nome) => {
        const f = fichas.find((x) => x.waste_type === nome);
        setForm((prev) => ({ 
            ...prev, 
            destinador: f?.destinator_name || prev.destinador, 
            destinacao: f ? destinacaoDeTratamento(f.treatment) || prev.destinacao : prev.destinacao 
        }));
    };

    // Auto-preenchimento a partir de uma ficha do Cadastro de Resíduos (adiciona à lista existente)
    const carregarFicha = (id) => {
        const f = fichas.find((x) => String(x.id) === String(id));
        if (!f) return;
        const residuo = `${f.waste_type || ''}${f.category ? ' - ' + f.category : ''}`.trim();
        setForm((prev) => {
            const list = prev.residuo ? prev.residuo.split(/\s*\|\s*/).filter(Boolean) : [];
            const novoResiduo = list.includes(residuo) ? prev.residuo : [...list, residuo].join(' | ');
            return {
                ...prev,
                residuo: novoResiduo,
                destinador: f.destinator_name || prev.destinador,
                destinacao: destinacaoDeTratamento(f.treatment) || prev.destinacao,
            };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        add({ ...form });
        setForm({ ...emptyForm(), solicitante: nomeUsuario });
        setDestLivre(false);
    };

    // Abre o modal de edição com os dados do manifesto
    const editarManifesto = (m) => {
        setEditModal({ ...m });
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

    // Cálculo do total geral de reembolsos
    const totalReembolsos = useMemo(() => {
        return allRefunds.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
    }, [allRefunds]);

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
        { key: 'data', label: 'Data', align: 'center', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{brData(r.data)}{r.hora ? <span style={{ color: 'var(--color-text-subtle)', display: 'block', fontSize: '0.62rem' }}>{r.hora}</span> : ''}</span> },
        { key: 'numeroMTR', label: 'Manifesto', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem' }}>{r.numeroMTR || '—'}{r.manifestoSupertrans ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem' }}>ST {r.manifestoSupertrans}</div> : null}</span> },
        {
            key: 'residuo',
            label: 'Resíduo',
            align: 'left',
            wrap: true,
            render: (r) => {
                const partes = (r.residuo || '').split(/\s*\|\s*/).filter(Boolean);
                if (partes.length === 0) return '—';
                const primeiro = partes[0];
                const temMais = partes.length > 1;
                
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} title={r.residuo}>
                        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{iconeResiduo(r.residuo)}</span>
                        <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{primeiro}</span>
                        {temMais && (
                            <span style={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                background: 'rgba(0, 204, 255, 0.12)',
                                color: '#00ccff',
                                padding: '1px 5px',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                border: '1px solid rgba(0, 204, 255, 0.25)',
                                flexShrink: 0,
                                whiteSpace: 'nowrap'
                            }}>
                                +{partes.length - 1} resíduo{partes.length - 1 > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                );
            }
        },
        { key: 'notaFiscal', label: 'Nota Fiscal', align: 'center', render: (r) => r.notaFiscal || '—' },
        { key: 'solicitante', label: 'Solicitante', align: 'center', wrap: true, render: (r) => r.solicitante || '—' },
        { key: 'motorista', label: 'Motorista / Placa', align: 'center', wrap: true, render: (r) => <span>{r.motorista || '—'}{r.placa ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem', fontFamily: 'ui-monospace, monospace' }}>{r.placa}</div> : null}</span> },
        { key: 'setorColeta', label: 'Setor de Coleta', align: 'center', render: (r) => r.setorColeta || '—' },
        { key: 'destinador', label: 'Fornecedor', align: 'center', wrap: true, render: (r) => r.destinador || '—' },
        { key: 'responsavelSGI', label: 'SGI', align: 'center', wrap: true, render: (r) => r.responsavelSGI || '—' },
        {
            key: 'reembolso', label: 'Reembolso', align: 'center', render: (r) => {
                const refundItems = allRefunds.filter(x => String(x.manifest_id) === String(r.id));
                const total = refundItems.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
                if (total === 0) return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
                return <span style={{ color: '#ff9f43', fontWeight: 600 }}>R$ {total.toFixed(2)}</span>;
            }
        },
        {
            key: 'status', label: 'Status', align: 'center', render: (r) => {
                const cor = r.status === 'Emitido' ? '#10b981' : '#ffb700';
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <Select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px', width: '120px', minWidth: '120px', color: cor, background: cor + '12', borderColor: cor + '40', borderRadius: 20, justifyContent: 'center', textAlign: 'center', gap: '6px' }}>
                            {STATUS_MANIFESTO.map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </div>
                );
            },
        },
        {
            key: 'acoes', label: '', align: 'center', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {isGestorOuAnalista && (
                        <RowAction icon={<FaDollarSign size={13} />} color="#ff9f43" title="Reembolsos" onClick={() => setRefundModalItem(r)} />
                    )}
                    <RowAction icon={<FaPrint size={13} />} color="#54a0ff" title="Imprimir FR 231" onClick={() => setPrintItem(r)} />
                    <RowAction icon={<FaEdit size={13} />} color="#10b981" title="Editar manifesto" onClick={() => editarManifesto(r)} />
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => setConfirmDel(r)} />
                </div>
            ),
        },
    ];

    const colunasExibidas = useMemo(() => {
        return columns.filter(col => col.key !== 'reembolso' || isGestorOuAnalista);
    }, [columns, isGestorOuAnalista]);

    return (
        <PageShell
            icon={<FaTruckMoving size={20} />} color="#54a0ff"
            title="Manifesto de Transporte de Resíduos (MTR)"
            subtitle="Emissão via SINIR · controle consolidado"
            onBack={onBack}
            maxWidth="100%"
            actions={<>
                {isGestorOuAnalista && (
                    <Btn variant="outline" color="#ff9f43" onClick={() => setShowCashFlowModal(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                        <FaDollarSign size={10} /> Fluxo de Caixa
                    </Btn>
                )}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaTruckMoving size={12} />} label="Manifestos" value={kpis.total} sub="total registrados" color="#54a0ff" onClick={() => setFCard('todos')} active={fCard === 'todos'} />
                <Kpi icon={<FaFileExcel size={12} />} label="Reciclagem" value={kpis.recic} sub={`${kpis.taxaRecic}% do total`} color="#10b981" onClick={() => setFCard('reciclagem')} active={fCard === 'reciclagem'} />
                <Kpi icon={<FaTrash size={12} />} label="Aterro" value={kpis.aterro} sub={`${kpis.total ? Math.round((kpis.aterro / kpis.total) * 100) : 0}% do total`} color={kpis.aterro ? '#ffb700' : '#10b981'} onClick={() => setFCard('aterro')} active={fCard === 'aterro'} />
                <Kpi icon={<FaForward size={12} />} label="Outros destinos" value={kpis.outros} sub="copro · incin · trat" color="#a78bfa" onClick={() => setFCard('outros')} active={fCard === 'outros'} />
                <Kpi icon={<FaForward size={12} />} label="Destinadores" value={kpis.destinadores} sub="parceiros distintos" color="#00ccff" onClick={() => setFCard('todos')} />
                {isGestorOuAnalista && (
                    <Kpi icon={<FaDollarSign size={12} />} label="Total Reembolsos" value={`R$ ${totalReembolsos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="acumulado" color="#ff9f43" onClick={() => {}} />
                )}
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
                        📝 Registrar Novo Manifesto
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
                                <Field label="Resíduos Selecionados" required span={2}>
                                    <MultiWasteSelector
                                        value={form.residuo}
                                        onChange={(val) => set('residuo', val)}
                                        residuosUnicos={residuosUnicos}
                                        fichas={fichas}
                                        onAddWasteDetails={onAddWasteDetails}
                                    />
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
                                <Field label="Fornecedor">
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
                                            <option value="">Selecione o fornecedor…</option>
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
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--color-text-muted)', cursor: 'pointer', marginRight: '0.6rem' }}>
                                        <input type="checkbox" checked={form.sinir} onChange={(e) => set('sinir', e.target.checked)} />
                                        Emitido no SINIR
                                    </label>
                                    <Btn type="submit" color="#54a0ff"><FaPlus size={12} /> Registrar Manifesto</Btn>
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
                    .mtr-tbl table { font-size: 0.7rem !important; font-variant-numeric: tabular-nums; }
                    .mtr-tbl thead tr { background: transparent !important; }
                    .mtr-tbl thead th { font-size: 0.58rem !important; font-weight: 600 !important; letter-spacing: 0.7px; padding: 0.45rem 0.6rem !important; color: var(--color-text-subtle) !important; border-bottom: 1px solid var(--border-color) !important; }
                    .mtr-tbl thead th:not(:last-child) { border-right: 1px solid rgba(255, 255, 255, 0.04) !important; }
                    .mtr-tbl tbody td { padding: 0.42rem 0.6rem !important; border-bottom: 1px solid var(--border-color-soft) !important; line-height: 1.35; font-weight: 400; }
                    .mtr-tbl tbody td:not(:last-child) { border-right: 1px solid rgba(255, 255, 255, 0.03) !important; }
                    .mtr-tbl tbody tr:nth-child(even) { background: rgba(255,255,255,0.015); }
                    .mtr-tbl tbody tr:hover { background: var(--bg-surface-2) !important; transition: background 0.15s ease; }
                    .mtr-tbl tbody td span, .mtr-tbl tbody td div { font-size: 0.7rem !important; }
                    .mtr-tbl tbody td div { font-size: 0.62rem !important; color: var(--color-text-subtle); }
                `}</style>
                <DataTable dense columns={colunasExibidas} rows={paginados} empty={loading ? 'Carregando manifestos do Supabase…' : 'Nenhum manifesto. Registre acima ou use Importar dados.'} onRowClick={(r) => setViewModalItem(r)} />
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

            {/* Modal de Edição */}
            {editModal && (
                <EditManifestoModal
                    manifesto={editModal}
                    fichas={fichas}
                    residuosUnicos={residuosUnicos}
                    setoresUnicos={setoresUnicos}
                    currentUser={currentUser}
                    onSave={(id, data) => { update(id, data); setEditModal(null); }}
                    onClose={() => setEditModal(null)}
                />
            )}

            {/* Modal de Reembolsos */}
            {refundModalItem && (
                <RefundsManagerModal
                    manifesto={refundModalItem}
                    currentUser={currentUser}
                    onClose={() => { setRefundModalItem(null); reloadAllRefunds(); }}
                />
            )}

            {/* Modal de Detalhes do Manifesto */}
            {viewModalItem && (
                <ViewManifestoModal
                    manifesto={viewModalItem}
                    isGestorOuAnalista={isGestorOuAnalista}
                    onClose={() => setViewModalItem(null)}
                />
            )}

            {/* Modal de Fluxo de Caixa */}
            {showCashFlowModal && (
                <CashFlowAuditModal
                    manifestos={items}
                    allRefunds={allRefunds}
                    currentUser={currentUser}
                    onClose={() => { setShowCashFlowModal(false); reloadAllRefunds(); }}
                />
            )}

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

// ── Modal de Visualização de Detalhes do Manifesto ──
function ViewManifestoModal({ manifesto, isGestorOuAnalista, onClose }) {
    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');
    const partesResiduos = (manifesto.residuo || '').split(/\s*\|\s*/).filter(Boolean);
    const corStatus = manifesto.status === 'Emitido' ? '#10b981' : '#ffb700';

    const { items: refundItems, loading: refundLoading } = useRefunds(manifesto.id);

    const totalReembolso = useMemo(() => {
        return refundItems.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
    }, [refundItems]);

    return (
        <Modal title="Detalhes do Manifesto" onClose={onClose} width={820}>
            {/* Header resumo */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.2rem',
                borderRadius: 12, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color-soft)',
                marginBottom: '1.5rem', flexWrap: 'wrap'
            }}>
                <div style={{ minWidth: 36, width: 'auto', padding: '0 0.55rem', height: 36, borderRadius: 10, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, gap: '4px' }}>
                    {iconeResiduo(manifesto.residuo)}
                </div>
                <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Manifesto MTR</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {manifesto.numeroMTR || 'Sem número'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600, textAlign: 'right' }}>Status</div>
                    <div style={{
                        display: 'inline-block', padding: '0.2rem 0.7rem', fontSize: '0.66rem', fontWeight: 700,
                        color: corStatus, background: corStatus + '15', border: `1px solid ${corStatus}35`, borderRadius: 20, textAlign: 'right', marginTop: '2px'
                    }}>
                        {manifesto.status}
                    </div>
                </div>
            </div>

            {/* Grid de Informações */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                
                {/* Bloco 1: Informações Gerais */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: '#54a0ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📋 Informações Gerais
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <DetailField label="Data de Saída" value={`${brData(manifesto.data)} ${manifesto.hora ? `às ${manifesto.hora}` : ''}`} />
                        <DetailField label="Setor de Coleta" value={manifesto.setorColeta} />
                        <DetailField label="Solicitante" value={manifesto.solicitante} />
                        <DetailField label="Responsável SGI" value={manifesto.responsavelSGI} />
                    </div>
                </div>

                {/* Bloco 2: Logística e Transporte */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🚚 Transporte e Destino
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <DetailField label="Motorista" value={manifesto.motorista} />
                        <DetailField label="Placa do Veículo" value={manifesto.placa} />
                        <DetailField label="Fornecedor" value={manifesto.destinador} />
                        <DetailField label="Tipo de Destinação" value={manifesto.destinacao} />
                    </div>
                </div>

                {/* Bloco 3: Documentação e Emissão */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem', gridColumn: 'span 1' }}>
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: '#ffb700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📑 Documentos e Controle
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <DetailField label="Nota Fiscal" value={manifesto.notaFiscal} />
                        <DetailField label="Ticket Sustentare" value={manifesto.ticketSustentare} />
                        <DetailField label="Manifesto Supertrans" value={manifesto.manifestoSupertrans} />
                        <DetailField label="Emitido no SINIR" value={manifesto.sinir ? 'Sim' : 'Não'} />
                        <DetailField label="Tipo Recebedor" value={manifesto.tipoRecebedor} />
                    </div>
                </div>

                {/* Bloco 4: Resíduos Transportados */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ♻️ Resíduos Vinculados ({partesResiduos.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {partesResiduos.map((res, idx) => (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: '0.45rem',
                                padding: '0.4rem 0.6rem', background: 'var(--bg-surface-3)',
                                borderRadius: '8px', border: '1px solid var(--border-color)',
                                fontSize: '0.76rem', color: 'var(--color-text-main)',
                                whiteSpace: 'normal', wordBreak: 'break-all'
                            }}>
                                <span style={{ fontSize: '0.9rem' }}>{iconeResiduo(res)}</span>
                                <span style={{ fontWeight: 500 }}>{res}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bloco 5: Demonstrativo de Reembolsos do Manifesto */}
                {isGestorOuAnalista && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem', gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#ff9f43', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                💰 Demonstrativo de Reembolso
                            </h3>
                            {totalReembolso > 0 && (
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ff9f43' }}>
                                    Total: R$ {totalReembolso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            )}
                        </div>

                        {refundLoading ? (
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', padding: '0.5rem 0' }}>Carregando reembolsos...</div>
                        ) : refundItems.length === 0 ? (
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                Nenhum reembolso cadastrado para este manifesto.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color-soft)', borderRadius: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-color-soft)' }}>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Item / Descrição</th>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Qtd</th>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center', width: 60 }}>Unidade</th>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Preço Unit.</th>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Valor Total</th>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center' }}>Operador</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {refundItems.map((it) => (
                                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-main)', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.description}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-main)', textAlign: 'right' }}>{Number(it.quantity).toLocaleString('pt-BR')}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{it.unit}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-main)', textAlign: 'right' }}>R$ {Number(it.unit_price).toFixed(2)}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: '#ff9f43', fontWeight: 600, textAlign: 'right' }}>R$ {Number(it.total_price).toFixed(2)}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.62rem' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                                                        <span>👤</span>
                                                        <span>{it.created_by || '—'}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <Btn onClick={onClose} color="#8b9bb4" variant="outline"><FaTimes size={11} /> Fechar</Btn>
            </div>
        </Modal>
    );
}

// Componente simples para renderizar campo e valor formatados
function DetailField({ label, value }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color-soft)', paddingBottom: '0.35rem', gap: '1rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', fontWeight: 500 }}>{label}:</span>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-main)', fontWeight: 600, textAlign: 'right', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {value || '—'}
            </span>
        </div>
    );
}

// ── Modal de Auditoria de Fluxo de Caixa (Entradas & Saídas) ──
function CashFlowAuditModal({ manifestos, allRefunds, currentUser, onClose }) {
    const { items: manualFlow, add: addFlowItem, remove: removeFlowItem, loading: flowLoading, isLocal } = useCashFlow();

    const [form, setForm] = useState({
        manifest_id: '',
        type: 'saida',
        description: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
    });

    const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    // Converte os reembolsos cadastrados em Entradas Automáticas do fluxo de caixa
    const autoFlow = useMemo(() => {
        return allRefunds.map((ref) => {
            const mtr = manifestos.find(m => String(m.id) === String(ref.manifest_id));
            return {
                id: `auto-${ref.id}`,
                isAuto: true,
                manifest_id: ref.manifest_id,
                manifest_number: mtr?.numeroMTR || 'Sem MTR',
                residuo: mtr?.residuo || '',
                type: 'entrada',
                description: `Reembolso: ${ref.description}`,
                amount: Number(ref.total_price || 0),
                date: mtr?.data || ref.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                created_by: ref.created_by || 'Sistema',
            };
        });
    }, [allRefunds, manifestos]);

    // Consolida reembolsos com os lançamentos manuais do caixa
    const consolidados = useMemo(() => {
        const manualMapped = manualFlow.map((f) => {
            const mtr = manifestos.find(m => String(m.id) === String(f.manifest_id));
            return {
                id: String(f.id),
                isAuto: false,
                manifest_id: f.manifest_id,
                manifest_number: mtr?.numeroMTR || '—',
                residuo: mtr?.residuo || '',
                type: f.type,
                description: f.description,
                amount: Number(f.amount || 0),
                date: f.date,
                created_by: f.created_by || '—',
            };
        });
        return [...autoFlow, ...manualMapped].sort((a, b) => b.date.localeCompare(a.date));
    }, [autoFlow, manualFlow, manifestos]);

    // Filtros de Data
    const [filtroMes, setFiltroMes] = useState('todos');
    const [filtroAno, setFiltroAno] = useState('todos');
    const [filtroDia, setFiltroDia] = useState('');

    const anosDisponiveis = useMemo(() => {
        const anos = consolidados.map(it => it.date ? it.date.split('-')[0] : null).filter(Boolean);
        return [...new Set(anos)].sort((a, b) => b.localeCompare(a));
    }, [consolidados]);

    const filtradosCaixa = useMemo(() => {
        return consolidados.filter((it) => {
            if (!it.date) return true;
            const [ano, mes] = it.date.split('-');
            
            if (filtroDia && it.date !== filtroDia) {
                return false;
            }
            if (filtroMes !== 'todos' && mes !== filtroMes) {
                return false;
            }
            if (filtroAno !== 'todos' && ano !== filtroAno) {
                return false;
            }
            return true;
        });
    }, [consolidados, filtroMes, filtroAno, filtroDia]);

    // Totais Consolidados (baseados no filtro para atualização dinâmica)
    const totais = useMemo(() => {
        let entradas = 0;
        let saidas = 0;
        filtradosCaixa.forEach((c) => {
            if (c.type === 'entrada') entradas += c.amount;
            else saidas += c.amount;
        });
        return { entradas, saidas, saldo: entradas - saidas };
    }, [filtradosCaixa]);

    const handleAddFlow = async (e) => {
        e.preventDefault();
        if (!form.description || Number(form.amount || 0) <= 0) {
            alert('Preencha os campos com valores válidos.');
            return;
        }
        const username = currentUser?.name || currentUser?.username || '';
        await addFlowItem(form, username);
        setForm({
            manifest_id: '',
            type: 'saida',
            description: '',
            amount: '',
            date: new Date().toISOString().slice(0, 10),
        });
    };

    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');

    return (
        <Modal title="Auditoria de Fluxo de Caixa (MTR)" onClose={onClose} width={1140}>
            {isLocal && (
                <div style={{
                    padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255, 183, 0, 0.08)',
                    border: '1px solid rgba(255, 183, 0, 0.3)', fontSize: '0.74rem',
                    color: 'var(--color-warning)', marginBottom: '0.8rem', lineHeight: 1.4
                }}>
                    ⚠️ <strong>Modo Local Ativo:</strong> A tabela <code>waste_cash_flow</code> ainda não foi criada no Supabase. Os dados estão sendo salvos localmente.
                </div>
            )}

            {/* Painel de Lançamento e KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.2rem' }}>
                <div style={{ padding: '0.8rem 1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 12 }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Total Entradas (Receitas)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                        R$ {totais.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div style={{ padding: '0.8rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12 }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Total Saídas (Custo/Despesas)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                        R$ {totais.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div style={{ padding: '0.8rem 1rem', background: totais.saldo >= 0 ? 'rgba(84, 160, 255, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${totais.saldo >= 0 ? 'rgba(84, 160, 255, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`, borderRadius: 12 }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Saldo Líquido</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: totais.saldo >= 0 ? '#54a0ff' : '#ef4444', marginTop: '4px' }}>
                        R$ {totais.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Novo Lançamento Manual */}
            <Card style={{ marginBottom: '1.5rem', padding: '0.9rem' }}>
                <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--color-text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🆕 Registrar Lançamento Manual (Despesas / Receitas extras)
                </h4>
                <form onSubmit={handleAddFlow} className="mtr-cashflow-form">
                    <style>{`
                        .mtr-cashflow-form .input-dark { padding: 0.35rem 0.55rem !important; font-size: 0.76rem !important; }
                        .mtr-cashflow-form .label-muted { font-size: 0.58rem !important; display: block; margin-bottom: 0.12rem; }
                    `}</style>
                    <FormGrid cols={5}>
                        <Field label="Tipo" required>
                            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                                <option value="saida">Saída (-) Despesa</option>
                                <option value="entrada">Entrada (+) Receita</option>
                            </Select>
                        </Field>
                        <Field label="MTR Vinculado (Opcional)">
                            <Select value={form.manifest_id} onChange={(e) => set('manifest_id', e.target.value)}>
                                <option value="">Sem manifesto vinculado</option>
                                {manifestos.map((m) => {
                                    const res = m.residuo.split(/\s*\|\s*/)[0];
                                    return (
                                        <option key={m.id} value={m.id}>
                                            {m.numeroMTR || 'S/N'} · {res}
                                        </option>
                                    );
                                })}
                            </Select>
                        </Field>
                        <Field label="Descrição / Destinação" required>
                            <Input
                                value={form.description}
                                onChange={(e) => set('description', e.target.value)}
                                placeholder="Ex: Pagamento Frete Mondial, Taxa Aterro"
                                required
                            />
                        </Field>
                        <Field label="Valor (R$)" required>
                            <Input
                                type="number"
                                step="any"
                                value={form.amount}
                                onChange={(e) => set('amount', e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </Field>
                        <Field label="Data Lançamento" required>
                            <Input
                                type="date"
                                value={form.date}
                                onChange={(e) => set('date', e.target.value)}
                                required
                            />
                        </Field>
                    </FormGrid>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
                        <Btn type="submit" color="#ff9f43" style={{ padding: '0.45rem 1rem' }}>
                            <FaPlus size={10} /> Registrar Lançamento
                        </Btn>
                    </div>
                </form>
            </Card>

            {/* Listagem de Auditoria */}
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-main)' }}>Demonstrativo de Auditoria Caixa</h3>

            {/* Barra de Filtros por Dias, Mês e Ano */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem', background: 'rgba(255,255,255,0.01)', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-color-soft)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', fontWeight: 600, textTransform: 'uppercase', marginRight: 'auto' }}>
                    🔍 Filtrar demonstrativo:
                </span>
                
                {/* Filtro por Dia */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Dia:</span>
                    <Input
                        type="date"
                        value={filtroDia}
                        onChange={(e) => {
                            setFiltroDia(e.target.value);
                            if (e.target.value) {
                                setFiltroMes('todos');
                                setFiltroAno('todos');
                            }
                        }}
                        style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', width: '130px', height: '28px' }}
                    />
                </div>

                {/* Filtro por Mês */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Mês:</span>
                    <Select
                        value={filtroMes}
                        onChange={(e) => {
                            setFiltroMes(e.target.value);
                            if (e.target.value !== 'todos') setFiltroDia('');
                        }}
                        style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', width: '120px', height: '28px' }}
                    >
                        <option value="todos">Todos</option>
                        <option value="01">Janeiro</option>
                        <option value="02">Fevereiro</option>
                        <option value="03">Março</option>
                        <option value="04">Abril</option>
                        <option value="05">Maio</option>
                        <option value="06">Junho</option>
                        <option value="07">Julho</option>
                        <option value="08">Agosto</option>
                        <option value="09">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                    </Select>
                </div>

                {/* Filtro por Ano */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Ano:</span>
                    <Select
                        value={filtroAno}
                        onChange={(e) => {
                            setFiltroAno(e.target.value);
                            if (e.target.value !== 'todos') setFiltroDia('');
                        }}
                        style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', width: '95px', height: '28px' }}
                    >
                        <option value="todos">Todos</option>
                        {anosDisponiveis.map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                        ))}
                    </Select>
                </div>

                {(filtroDia !== '' || filtroMes !== 'todos' || filtroAno !== 'todos') && (
                    <Btn
                        variant="outline"
                        color="#ff4757"
                        onClick={() => {
                            setFiltroDia('');
                            setFiltroMes('todos');
                            setFiltroAno('todos');
                        }}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.66rem', height: '28px' }}
                    >
                        Limpar Filtros
                    </Btn>
                )}
            </div>

            {flowLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-subtle)' }}>
                    Processando auditoria...
                </div>
            ) : consolidados.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginBottom: '1.5rem' }}>
                    Nenhum lançamento no fluxo de caixa cadastrado.
                </div>
            ) : filtradosCaixa.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginBottom: '1.5rem' }}>
                    Nenhum lançamento encontrado para os filtros selecionados.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color-soft)', borderRadius: '10px', marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-color-soft)' }}>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Data</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center', width: 100 }}>Tipo</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Manifesto (MTR)</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Descrição / Origem</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Valor</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center' }}>Operador</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtradosCaixa.map((it) => {
                                const corTipo = it.type === 'entrada' ? '#10b981' : '#ef4444';
                                return (
                                    <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                        <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)' }}>{brData(it.date)}</td>
                                        <td style={{ padding: '0.5rem 0.7rem', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '0.1rem 0.45rem', fontSize: '0.58rem', fontWeight: 800,
                                                color: corTipo, background: corTipo + '12', border: `1px solid ${corTipo}25`, borderRadius: 10, textTransform: 'uppercase'
                                            }}>
                                                {it.type === 'entrada' ? 'Receita' : 'Custo'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', fontWeight: 500 }}>
                                            {it.manifest_number !== '—' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{it.manifest_number}</span>
                                                    {it.residuo && (
                                                        <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                                            {iconeResiduo(it.residuo)} {it.residuo.split(/\s*\|\s*/)[0]}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                            {it.description}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.7rem', color: corTipo, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {it.type === 'entrada' ? '+' : '-'} R$ {Number(it.amount).toFixed(2)}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.7rem', textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.66rem' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                                                <span>👤</span>
                                                <span>{it.created_by || '—'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn onClick={onClose} color="#8b9bb4" variant="outline"><FaTimes size={11} /> Fechar</Btn>
            </div>
        </Modal>
    );
}

// ── Modal de Gerenciamento de Reembolsos ──
function RefundsManagerModal({ manifesto, currentUser, onClose }) {
    const { items, add, remove, loading, isLocal } = useRefunds(manifesto.id);
    const { items: catalog, add: addCatalogItem } = useRefundCatalog();
    
    const [form, setForm] = useState({
        description: '',
        quantity: '',
        unit: 'kg',
        unit_price: '',
    });

    const [descLivre, setDescLivre] = useState(false);
    const [descDigitada, setDescDigitada] = useState('');

    const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const handleAddItem = async (e) => {
        e.preventDefault();
        
        let finalDescription = form.description;
        
        if (descLivre) {
            const trimmedDigitado = descDigitada.trim();
            if (!trimmedDigitado) {
                alert('Preencha o nome do novo item para cadastrar.');
                return;
            }
            const catalogRecord = await addCatalogItem(trimmedDigitado);
            if (catalogRecord) {
                finalDescription = catalogRecord.name;
            } else {
                finalDescription = trimmedDigitado;
            }
        }

        if (!finalDescription || Number(form.quantity || 0) <= 0 || Number(form.unit_price || 0) <= 0) {
            alert('Preencha todos os campos com valores válidos.');
            return;
        }

        const username = currentUser?.name || currentUser?.username || '';
        await add({ ...form, description: finalDescription }, username);
        
        setForm({
            description: '',
            quantity: '',
            unit: 'kg',
            unit_price: '',
        });
        setDescDigitada('');
        setDescLivre(false);
    };

    const modalTotal = useMemo(() => {
        return items.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
    }, [items]);

    const itemTotal = Number(form.quantity || 0) * Number(form.unit_price || 0);

    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');

    return (
        <Modal title="Gerenciar Reembolsos" onClose={onClose} width={940}>
            {isLocal && (
                <div style={{
                    padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255, 183, 0, 0.08)',
                    border: '1px solid rgba(255, 183, 0, 0.3)', fontSize: '0.74rem',
                    color: 'var(--color-warning)', marginBottom: '0.8rem', lineHeight: 1.4
                }}>
                    ⚠️ <strong>Modo Local Ativo:</strong> A tabela <code>waste_refund_items</code> e <code>waste_refund_catalog</code> ainda não foram criadas no Supabase. Os dados estão sendo salvos localmente.
                </div>
            )}

            {/* Cabeçalho Resumo do Manifesto (sem cortes no nome completo) */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem',
                borderRadius: 12, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color-soft)',
                marginBottom: '1.2rem', flexWrap: 'wrap'
            }}>
                <div style={{ flex: '1 1 180px', minWidth: 180 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Manifesto MTR</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {manifesto.numeroMTR || 'Sem número'}
                    </div>
                </div>
                <div style={{ flex: '1 1 120px', minWidth: 120 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Data</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-main)', fontWeight: 500 }}>
                        {brData(manifesto.data)} {manifesto.hora ? `às ${manifesto.hora}` : ''}
                    </div>
                </div>
                <div style={{ flex: '2 1 300px', minWidth: 300 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Resíduos</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-main)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{iconeResiduo(manifesto.residuo)}</span>
                        <span style={{ whiteSpace: 'normal', wordBreak: 'break-all', display: 'inline-block' }}>
                            {manifesto.residuo || '—'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Formulário de Adicionar Item com seletor de cadastro */}
            <Card style={{ marginBottom: '1.2rem', padding: '0.9rem' }}>
                <form onSubmit={handleAddItem} className="mtr-refund-form">
                    <style>{`
                        .mtr-refund-form .input-dark { padding: 0.35rem 0.55rem !important; font-size: 0.76rem !important; }
                        .mtr-refund-form .label-muted { font-size: 0.58rem !important; display: block; margin-bottom: 0.12rem; }
                    `}</style>
                    <FormGrid cols={4}>
                        <Field label="Item Reembolso (Cadastro)" required span={2}>
                            {descLivre ? (
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <Input
                                        value={descDigitada}
                                        onChange={(e) => setDescDigitada(e.target.value)}
                                        placeholder="Nome do novo item a cadastrar…"
                                        autoFocus
                                        required
                                    />
                                    <Btn variant="outline" color="#8b9bb4" onClick={() => { setDescLivre(false); setDescDigitada(''); }} style={{ padding: '0.35rem 0.6rem' }}>
                                        Voltar
                                    </Btn>
                                </div>
                            ) : (
                                <Select
                                    value={form.description}
                                    onChange={(e) => {
                                        if (e.target.value === '__OUTRO__') {
                                            setDescLivre(true);
                                        } else {
                                            set('description', e.target.value);
                                        }
                                    }}
                                    placeholder="Selecione o item…"
                                >
                                    <option value="">Selecione o item do reembolso…</option>
                                    {catalog.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    <option value="__OUTRO__">✏️ Cadastrar novo item…</option>
                                </Select>
                            )}
                        </Field>
                        <Field label="Quantidade" required>
                            <Input
                                type="number"
                                step="any"
                                value={form.quantity}
                                onChange={(e) => set('quantity', e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </Field>
                        <Field label="Unidade" required>
                            <Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                                <option value="kg">kg (Quilograma)</option>
                                <option value="t">t (Tonelada)</option>
                                <option value="un">un (Unidade)</option>
                                <option value="m3">m³ (Metro cúbico)</option>
                                <option value="l">L (Litro)</option>
                                <option value="viagem">viagem (Viagem)</option>
                            </Select>
                        </Field>
                        <Field label="Preço Unitário (R$)" required>
                            <Input
                                type="number"
                                step="any"
                                value={form.unit_price}
                                onChange={(e) => set('unit_price', e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </Field>
                        <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            {itemTotal > 0 && (
                                <span>
                                    Cálculo da prévia: {Number(form.quantity).toLocaleString('pt-BR')} {form.unit} × R$ {Number(form.unit_price).toFixed(2)} = <strong style={{ color: '#ff9f43' }}>R$ {itemTotal.toFixed(2)}</strong>
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                            <Btn type="submit" color="#ff9f43" style={{ padding: '0.45rem 1rem' }}>
                                <FaPlus size={10} /> Adicionar Item
                            </Btn>
                        </div>
                    </FormGrid>
                </form>
            </Card>

            {/* Listagem de Itens Cadastrados */}
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-main)' }}>Itens do Reembolso</h3>
            {loading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-subtle)' }}>
                    Carregando itens…
                </div>
            ) : items.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginBottom: '1.5rem' }}>
                    Nenhum item de reembolso cadastrado para este manifesto.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color-soft)', borderRadius: '10px', marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-color-soft)' }}>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Descrição</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Qtd.</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center' }}>Un.</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Preço Unit.</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Total</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center', width: 50 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.description}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', textAlign: 'right' }}>{Number(it.quantity).toLocaleString('pt-BR')}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{it.unit}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', textAlign: 'right' }}>R$ {Number(it.unit_price).toFixed(2)}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: '#ff9f43', fontWeight: 600, textAlign: 'right' }}>R$ {Number(it.total_price).toFixed(2)}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => remove(it.id)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                                            title="Excluir item"
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                                <td colSpan={4} style={{ padding: '0.6rem 0.7rem', fontWeight: 700, color: 'var(--color-text-main)', textAlign: 'right' }}>TOTAL REEMBOLSADO:</td>
                                <td style={{ padding: '0.6rem 0.7rem', fontWeight: 800, color: '#ff9f43', textAlign: 'right', fontSize: '0.82rem' }}>R$ {modalTotal.toFixed(2)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Btn onClick={onClose} color="#8b9bb4" variant="outline"><FaTimes size={11} /> Fechar</Btn>
            </div>
        </Modal>
    );
}

// ── Modal de Edição de Manifesto ──
function EditManifestoModal({ manifesto, fichas, residuosUnicos, setoresUnicos, currentUser, onSave, onClose }) {
    const [f, setF] = useState({ ...manifesto });
    const s = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
    const [destLivre, setDestLivre] = useState(false);
    const [setorLivre, setSetorLivre] = useState(false);

    // Destinadores sugeridos (mesma lógica do componente pai)
    const norm = (str) => (str || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
    const tokens = (str) => norm(str).split(/[^A-Z0-9]+/).filter((t) => t.length >= 3);
    const destinadoresSugeridos = useMemo(() => {
        const rTokens = tokens(f.residuo);
        let base = fichas;
        if (rTokens.length) {
            const casa = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
            const m = fichas.filter((fi) => {
                const fTokens = tokens(`${fi.waste_type || ''} ${fi.category || ''}`);
                return rTokens.some((a) => fTokens.some((b) => casa(a, b)));
            });
            if (m.length) base = m;
        }
        return [...new Set(base.map((fi) => fi.destinator_name).filter(Boolean))].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fichas, f.residuo]);

    const onAddWasteDetails = (nome) => {
        const fi = fichas.find((x) => x.waste_type === nome);
        setF((prev) => ({
            ...prev,
            destinador: fi?.destinator_name || prev.destinador,
            destinacao: fi ? destinacaoDeTratamento(fi.treatment) || prev.destinacao : prev.destinacao
        }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        onSave(f.id, { ...f });
    };

    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');

    return (
        <Modal title="Editar Manifesto" onClose={onClose} width={820}>
            {/* Resumo do manifesto em edição */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 0.9rem',
                borderRadius: 12, background: '#10b9810d', border: '1px solid #10b98122',
                marginBottom: '1.2rem', flexWrap: 'wrap'
            }}>
                <div style={{ minWidth: 36, width: 'auto', padding: '0 0.55rem', height: 36, borderRadius: 10, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, gap: '4px' }}>
                    {iconeResiduo(f.residuo)}
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {f.numeroMTR || 'Sem número'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {f.residuo || 'Resíduo não informado'} · {brData(f.data)}
                    </div>
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', textAlign: 'right' }}>
                    <FaEdit size={10} style={{ marginRight: 4 }} />
                    Editando registro
                </div>
            </div>

            <form onSubmit={handleSave} className="mtr-edit-modal-form">
                <style>{`
                    .mtr-edit-modal-form .input-dark { padding: 0.38rem 0.6rem !important; font-size: 0.78rem !important; }
                    .mtr-edit-modal-form .label-muted { font-size: 0.6rem !important; display: block; margin-bottom: 0.15rem; }
                `}</style>
                <FormGrid cols={3}>
                    <Field label="Nº manifesto (Mondial/SINIR)" required>
                        <Input value={f.numeroMTR} onChange={(e) => s('numeroMTR', e.target.value)} placeholder="291028890965" required />
                    </Field>
                    <Field label="Data" required><Input type="date" value={f.data} onChange={(e) => s('data', e.target.value)} required /></Field>
                    <Field label="Hora"><Input type="time" value={f.hora} onChange={(e) => s('hora', e.target.value)} /></Field>
                    <Field label="Resíduos Selecionados" required span={2}>
                        <MultiWasteSelector
                            value={f.residuo}
                            onChange={(val) => s('residuo', val)}
                            residuosUnicos={residuosUnicos}
                            fichas={fichas}
                            onAddWasteDetails={onAddWasteDetails}
                        />
                    </Field>
                    <Field label="Destinação">
                        <Select value={f.destinacao} onChange={(e) => s('destinacao', e.target.value)} placeholder="Selecione…">
                            {TIPOS_DESTINACAO.map((d) => <option key={d} value={d}>{d}</option>)}
                        </Select>
                    </Field>
                    <Field label="Solicitante">
                        <div className="input-dark" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>{currentUser?.avatar || '👤'}</span>
                            <input
                                value={f.solicitante}
                                onChange={(e) => s('solicitante', e.target.value)}
                                placeholder="Quem está solicitando…"
                                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text-main)', fontSize: 'inherit', minWidth: 0 }}
                            />
                        </div>
                    </Field>
                    <Field label="Motorista" required><Input value={f.motorista} onChange={(e) => s('motorista', e.target.value)} required /></Field>
                    <Field label="Placa" required><Input value={f.placa} onChange={(e) => s('placa', e.target.value)} placeholder="ABC1D23" required /></Field>
                    <Field label="Responsável SGI"><Input value={f.responsavelSGI} onChange={(e) => s('responsavelSGI', e.target.value)} /></Field>
                    <Field label="Setor de coleta">
                        {(setorLivre || setoresUnicos.length === 0) ? (
                            <Input
                                value={f.setorColeta}
                                onChange={(e) => s('setorColeta', e.target.value)}
                                placeholder="FAB'1, G100…"
                                onBlur={() => { if (setoresUnicos.length) setSetorLivre(false); }}
                                autoFocus={setorLivre}
                            />
                        ) : (
                            <Select
                                value={setoresUnicos.includes(f.setorColeta) ? f.setorColeta : (f.setorColeta ? '__ATUAL__' : '')}
                                onChange={(e) => {
                                    if (e.target.value === '__OUTRO__') { setSetorLivre(true); s('setorColeta', ''); }
                                    else if (e.target.value !== '__ATUAL__') s('setorColeta', e.target.value);
                                }}
                            >
                                <option value="">Selecione o setor…</option>
                                {f.setorColeta && !setoresUnicos.includes(f.setorColeta) && (
                                    <option value="__ATUAL__">{f.setorColeta}</option>
                                )}
                                {setoresUnicos.map((setor, idx) => <option key={idx} value={setor}>{setor}</option>)}
                                <option value="__OUTRO__">✏️ Digitar outro…</option>
                            </Select>
                        )}
                    </Field>
                    <Field label="Fornecedor">
                        {(destLivre || destinadoresSugeridos.length === 0) ? (
                            <Input
                                value={f.destinador}
                                onChange={(e) => s('destinador', e.target.value)}
                                placeholder="SUSTENTARE, PENHA…"
                                onBlur={() => { if (destinadoresSugeridos.length) setDestLivre(false); }}
                                autoFocus={destLivre}
                            />
                        ) : (
                            <Select
                                value={destinadoresSugeridos.includes(f.destinador) ? f.destinador : (f.destinador ? '__ATUAL__' : '')}
                                onChange={(e) => {
                                    if (e.target.value === '__OUTRO__') { setDestLivre(true); s('destinador', ''); }
                                    else if (e.target.value !== '__ATUAL__') s('destinador', e.target.value);
                                }}
                            >
                                <option value="">Selecione o fornecedor…</option>
                                {f.destinador && !destinadoresSugeridos.includes(f.destinador) && (
                                    <option value="__ATUAL__">{f.destinador}</option>
                                )}
                                {destinadoresSugeridos.map((nome, idx) => <option key={idx} value={nome}>{nome}</option>)}
                                <option value="__OUTRO__">✏️ Digitar outro…</option>
                            </Select>
                        )}
                    </Field>
                    <Field label="Recebedor da doação">
                        <Select value={f.tipoRecebedor} onChange={(e) => s('tipoRecebedor', e.target.value)}>
                            <option value="Fornecedor">Fornecedor (sem matrícula)</option>
                            <option value="Colaborador">Colaborador (com matrícula)</option>
                        </Select>
                    </Field>
                    <Field label="Nota Fiscal"><Input value={f.notaFiscal} onChange={(e) => s('notaFiscal', e.target.value)} /></Field>
                    <Field label="Ticket Sustentare"><Input value={f.ticketSustentare} onChange={(e) => s('ticketSustentare', e.target.value)} /></Field>
                    <Field label="Manifesto Supertrans"><Input value={f.manifestoSupertrans} onChange={(e) => s('manifestoSupertrans', e.target.value)} /></Field>
                </FormGrid>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.3rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color-soft)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={f.sinir} onChange={(e) => s('sinir', e.target.checked)} />
                        Emitido no SINIR
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <Btn type="button" variant="outline" color="#8b9bb4" onClick={onClose}><FaTimes size={11} /> Cancelar</Btn>
                        <Btn type="submit" color="#10b981"><FaSave size={12} /> Salvar alterações</Btn>
                    </div>
                </div>
            </form>
        </Modal>
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
