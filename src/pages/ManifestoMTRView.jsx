import { useEffect, useMemo, useState } from 'react';
import { FaTruckMoving, FaPlus, FaTrash, FaFileExcel, FaExternalLinkAlt, FaEdit, FaForward, FaPrint, FaClipboardList, FaSave, FaTimes, FaDollarSign, FaBan, FaUndoAlt, FaWeightHanging, FaFilter } from 'react-icons/fa';
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
import { tint } from '../lib/color';

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
                color: 'var(--color-success)',
                description: 'Fluxo padrão com um único manifesto:',
                steps: [
                    'Entrar no login da MK BR ou NE',
                    'Cadastrar o resíduo, incluindo transportador e destinador',
                    'Emitir o MTR no SINIR',
                ],
            },
            {
                label: 'São 2 MTRs',
                color: 'var(--color-info)',
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
    destinador: '', destinadorFinal: '', destinacao: 'Reciclagem', status: 'Emitido', sinir: false,
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

    // Transportador: alterna entre escolher na lista do cadastro ou digitar livre
    const [destLivre, setDestLivre] = useState(false);

    // Destinador: mesma lógica do Transportador, lista compartilhada
    const [destFinalLivre, setDestFinalLivre] = useState(false);

    // Setor de coleta: escolher na lista (setores já usados) ou digitar novo
    const [setorLivre, setSetorLivre] = useState(false);

    // Modal de edição (objeto do manifesto sendo editado, ou null)
    const [editModal, setEditModal] = useState(null);

    // Confirmação de exclusão (manifesto a excluir)
    const [confirmDel, setConfirmDel] = useState(null);

    // Confirmação de cancelamento (manifesto a cancelar)
    const [confirmCancel, setConfirmCancel] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

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

    // Filtros de recorte (busca, mês, resíduo, destinador). É esta a base que
    // alimenta os indicadores — eles precisam acompanhar o filtro.
    const baseFiltrada = useMemo(() => {
        const q = busca.trim().toLowerCase();
        return items.filter((m) =>
            (fMes === 'todos' || mesDe(m) === fMes) &&
            (fResiduo === 'todos' || m.residuo === fResiduo) &&
            (fDestinador === 'todos' || m.destinador === fDestinador) &&
            (!q || `${m.numeroMTR} ${m.residuo} ${m.solicitante} ${m.motorista} ${m.placa} ${m.destinador} ${m.setorColeta}`.toLowerCase().includes(q))
        );
    }, [items, fMes, fResiduo, fDestinador, busca]);

    // O card clicado recorta só a TABELA. Se recortasse também os indicadores,
    // ao clicar em "Aterro" os demais cards zerariam e não haveria como voltar.
    const filtrados = useMemo(() => baseFiltrada.filter((m) => {
        if (fCard === 'reciclagem') return m.destinacao === 'Reciclagem' || m.destinacao === 'Reutilização';
        if (fCard === 'aterro') return m.destinacao === 'Aterro Industrial' || m.destinacao === 'Aterro Sanitário';
        if (fCard === 'outros') return m.destinacao !== 'Reciclagem' && m.destinacao !== 'Reutilização' && m.destinacao !== 'Aterro Industrial' && m.destinacao !== 'Aterro Sanitário';
        return true;
    }), [baseFiltrada, fCard]);

    // Há recorte ativo? (o card não conta — ele não muda os indicadores)
    const filtroAtivo = fMes !== 'todos' || fResiduo !== 'todos' || fDestinador !== 'todos' || busca.trim() !== '';

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

    // KPIs — leem a base filtrada (busca/mês/resíduo/destinador), excluindo
    // cancelados. Sem filtro, a base é o conjunto inteiro e o número é o total.
    const kpis = useMemo(() => {
        const ativos = baseFiltrada.filter((m) => m.status !== 'Cancelado');
        const total = ativos.length;
        const cancelados = baseFiltrada.length - total;
        const recic = ativos.filter((m) =>
            m.destinacao === 'Reciclagem' || m.destinacao === 'Reutilização'
        ).length;
        const aterro = ativos.filter((m) =>
            m.destinacao === 'Aterro Industrial' || m.destinacao === 'Aterro Sanitário'
        ).length;
        const outros = total - recic - aterro; // Coprocessamento, Incineração, Tratamento, Outros…
        const taxaRecic = total ? Math.round((recic / total) * 100) : 0;
        const destCount = new Set(ativos.map((m) => m.destinador).filter(Boolean)).size;
        return { total, recic, aterro, outros, taxaRecic, destinadores: destCount, cancelados };
    }, [baseFiltrada]);

    // Peso recebido pelos fornecedores (relatório mensal de pesagem) e, se
    // preenchido, o valor associado — o peso é o que de fato se controla aqui.
    const totalPesoRecebido = useMemo(() => {
        // Sem filtro, soma tudo. Com filtro, só as pesagens dos manifestos do recorte.
        if (!filtroAtivo) return allRefunds.reduce((acc, r) => acc + Number(r.quantity || 0), 0);
        const ids = new Set(baseFiltrada.map((m) => String(m.id)));
        return allRefunds.reduce((acc, r) => ids.has(String(r.manifest_id)) ? acc + Number(r.quantity || 0) : acc, 0);
    }, [allRefunds, baseFiltrada, filtroAtivo]);

    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');

    const exportar = () => {
        const fonte = filtrados.length ? filtrados : items;
        exportToExcel(fonte.map((m) => ({
            'Data': brData(m.data), 'Mês': mesDe(m), 'Hora': m.hora || '', 'Solicitante': m.solicitante || '',
            'Resíduo': m.residuo || '', 'Motorista': m.motorista || '', 'Placa': m.placa || '', 'Resp. SGI': m.responsavelSGI || '',
            'Nota Fiscal': m.notaFiscal || '', 'Ticket Sustentare': m.ticketSustentare || '',
            'Manifesto Mondial': m.numeroMTR || '', 'Manifesto Supertrans': m.manifestoSupertrans || '',
            'Transportador': m.destinador || '', 'Destinador': m.destinadorFinal || '', 'Setor de Coleta': m.setorColeta || '', 'Destinação': m.destinacao || '',
            'SINIR': m.sinir ? 'Sim' : 'Não', 'Status': m.status || '',
        })), 'controle_manifestos_MTR', 'Manifestos');
    };

    const columns = [
        { key: 'data', label: 'Data', align: 'center', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{brData(r.data)}{r.hora ? <span style={{ color: 'var(--color-text-subtle)', display: 'block', fontSize: '0.62rem' }}>{r.hora}</span> : ''}</span> },
        { key: 'numeroMTR', label: 'Manifesto', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem' }}>{r.numeroMTR || '—'}{r.manifestoSupertrans ? <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.62rem' }}>ST {r.manifestoSupertrans}</div> : null}</span> },
        { key: 'ticketSustentare', label: 'Ticket Sustentare', align: 'center', render: (r) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem' }}>{r.ticketSustentare || '—'}</span> },
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
                                color: 'var(--color-secondary)',
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
        { key: 'destinador', label: 'Transportador', align: 'center', wrap: true, render: (r) => r.destinador || '—' },
        { key: 'destinadorFinal', label: 'Destinador', align: 'center', wrap: true, render: (r) => r.destinadorFinal || '—' },
        { key: 'responsavelSGI', label: 'SGI', align: 'center', wrap: true, render: (r) => r.responsavelSGI || '—' },
        {
            key: 'reembolso', label: 'Peso Recebido', align: 'center', render: (r) => {
                const refundItems = allRefunds.filter(x => String(x.manifest_id) === String(r.id));
                const peso = refundItems.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
                if (peso === 0) return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
                return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{peso.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</span>;
            }
        },
        {
            key: 'status', label: 'Status', align: 'center', render: (r) => {
                if (r.status === 'Cancelado') {
                    const brCancelDate = r.cancelledAt ? new Date(r.cancelledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    const titleText = `Cancelado por ${r.cancelledBy || '—'} em ${brCancelDate}${r.cancelReason ? `\nMotivo: ${r.cancelReason}` : ''}`;
                    return (
                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }} title={titleText}>
                            <span style={{ padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px', color: 'var(--color-danger)', background: `${tint('var(--color-danger)','12')}`, border: `1px solid ${tint('var(--color-danger)','40')}`, borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <FaBan size={9} /> Cancelado
                            </span>
                        </div>
                    );
                }
                const cor = r.status === 'Emitido' ? 'var(--color-success)' : 'var(--color-warning)';
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <Select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px', width: '120px', minWidth: '120px', color: cor, background: tint(cor,'12'), borderColor: tint(cor,'40'), borderRadius: 20, justifyContent: 'center', textAlign: 'center', gap: '6px' }}>
                            {STATUS_MANIFESTO.filter(s => s !== 'Cancelado').map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </div>
                );
            },
        },
        {
            key: 'acoes', label: '', align: 'center', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {isGestorOuAnalista && r.status !== 'Cancelado' && (
                        <RowAction icon={<FaWeightHanging size={13} />} color="var(--color-success)" title="Peso recebido do fornecedor" onClick={() => setRefundModalItem(r)} />
                    )}
                    {r.status !== 'Cancelado' && (
                        <RowAction icon={<FaPrint size={13} />} color="var(--color-info)" title="Imprimir FR 231" onClick={() => setPrintItem(r)} />
                    )}
                    {r.status !== 'Cancelado' && (
                        <RowAction icon={<FaEdit size={13} />} color="var(--color-success)" title="Editar manifesto" onClick={() => editarManifesto(r)} />
                    )}
                    {r.status !== 'Cancelado' ? (
                        <RowAction icon={<FaBan size={13} />} color="var(--color-orange)" title="Cancelar manifesto" onClick={() => { setConfirmCancel(r); setCancelReason(''); }} />
                    ) : (
                        <RowAction icon={<FaUndoAlt size={13} />} color="var(--color-text-muted)" title="Desfazer cancelamento" onClick={() => update(r.id, { cancelledAt: null, cancelledBy: null, status: 'Emitido' })} />
                    )}
                    <RowAction icon={<FaTrash size={13} />} color="var(--color-danger)" title="Excluir" onClick={() => setConfirmDel(r)} />
                </div>
            ),
        },
    ];

    const colunasExibidas = useMemo(() => {
        return columns.filter(col => col.key !== 'reembolso' || isGestorOuAnalista);
    }, [columns, isGestorOuAnalista]);

    return (
        <PageShell
            icon={<FaTruckMoving size={20} />} color="var(--color-info)"
            title="Manifesto de Transporte de Resíduos (MTR)"
            subtitle="Emissão via SINIR · controle consolidado"
            onBack={onBack}
            maxWidth="100%"
            actions={<>
                {isGestorOuAnalista && (
                    <Btn variant="outline" color="var(--color-orange)" onClick={() => setShowCashFlowModal(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                        <FaDollarSign size={10} /> Fluxo de Caixa
                    </Btn>
                )}
                <Btn variant="outline" color="var(--color-text-muted)" onClick={() => window.open(SINIR_URL, '_blank')} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
                    <FaExternalLinkAlt size={10} /> Abrir SINIR
                </Btn>
                <Btn variant="outline" color="var(--color-text-muted)" onClick={() => setShowGuide((s) => !s)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}>
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
                        color="var(--color-text-muted)"
                        steps={MANIFESTO_STEPS}
                        notes={MANIFESTO_NOTES}
                        defaultOpen
                    />
                </div>
            )}

            {/* KPIs — acompanham busca/mês/resíduo/destinador */}
            {filtroAtivo && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem',
                    fontSize: '0.64rem', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase',
                    color: 'var(--color-info)',
                }}>
                    <FaFilter size={9} />
                    Indicadores apurados sobre o filtro ativo
                    <span style={{ color: 'var(--color-text-subtle)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                        ({kpis.total} de {items.length} manifestos)
                    </span>
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.55rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaTruckMoving size={12} />} label="Manifestos" value={kpis.total} sub={filtroAtivo ? `de ${items.length} · filtrado` : 'total registrados'} color="var(--color-info)" onClick={() => setFCard('todos')} active={fCard === 'todos'} />
                <Kpi icon={<FaFileExcel size={12} />} label="Reciclagem" value={kpis.recic} sub={`${kpis.taxaRecic}% do total`} color="var(--color-success)" onClick={() => setFCard('reciclagem')} active={fCard === 'reciclagem'} />
                <Kpi icon={<FaTrash size={12} />} label="Aterro" value={kpis.aterro} sub={`${kpis.total ? Math.round((kpis.aterro / kpis.total) * 100) : 0}% do total`} color={kpis.aterro ? 'var(--color-warning)' : 'var(--color-success)'} onClick={() => setFCard('aterro')} active={fCard === 'aterro'} />
                <Kpi icon={<FaForward size={12} />} label="Outros destinos" value={kpis.outros} sub="copro · incin · trat" color="var(--color-purple)" onClick={() => setFCard('outros')} active={fCard === 'outros'} />
                <Kpi icon={<FaForward size={12} />} label="Destinadores" value={kpis.destinadores} sub="parceiros distintos" color="var(--color-secondary)" />
                {isGestorOuAnalista && (
                    <Kpi icon={<FaWeightHanging size={12} />} label="Peso Recebido" value={`${totalPesoRecebido.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`} sub={filtroAtivo ? 'pesagens do filtro' : 'acumulado · fechamento mensal'} color="var(--color-success)" />
                )}
            </div>

            <Card style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-info)', padding: '0.6rem 0.9rem' }}>
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
                                <Field label="Transportador">
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
                                            <option value="">Selecione o transportador…</option>
                                            {form.destinador && !destinadoresSugeridos.includes(form.destinador) && (
                                                <option value="__ATUAL__">{form.destinador}</option>
                                            )}
                                            {destinadoresSugeridos.map((nome, idx) => <option key={idx} value={nome}>{nome}</option>)}
                                            <option value="__OUTRO__">✏️ Digitar outro…</option>
                                        </Select>
                                    )}
                                </Field>
                                <Field label="Destinador">
                                    {(destFinalLivre || destinadoresSugeridos.length === 0) ? (
                                        <Input
                                            value={form.destinadorFinal}
                                            onChange={(e) => set('destinadorFinal', e.target.value)}
                                            placeholder="SUSTENTARE, PENHA…"
                                            onBlur={() => { if (destinadoresSugeridos.length) setDestFinalLivre(false); }}
                                            autoFocus={destFinalLivre}
                                        />
                                    ) : (
                                        <Select
                                            value={destinadoresSugeridos.includes(form.destinadorFinal) ? form.destinadorFinal : (form.destinadorFinal ? '__ATUAL__' : '')}
                                            onChange={(e) => {
                                                if (e.target.value === '__OUTRO__') { setDestFinalLivre(true); set('destinadorFinal', ''); }
                                                else if (e.target.value !== '__ATUAL__') set('destinadorFinal', e.target.value);
                                            }}
                                        >
                                            <option value="">Selecione o destinador…</option>
                                            {form.destinadorFinal && !destinadoresSugeridos.includes(form.destinadorFinal) && (
                                                <option value="__ATUAL__">{form.destinadorFinal}</option>
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
                                    <Btn type="submit" color="var(--color-info)"><FaPlus size={12} /> Registrar Manifesto</Btn>
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
                    {tiposResiduo.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
                <Select value={fDestinador} onChange={(e) => setFDestinador(e.target.value)} style={{ width: 150 }}>
                    <option value="todos">Transportador</option>
                    {destinadores.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ width: 110 }}>
                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / página</option>)}
                </Select>
                {(fMes !== 'todos' || fResiduo !== 'todos' || fDestinador !== 'todos' || busca !== '' || fCard !== 'todos') && (
                    <Btn variant="outline" color="var(--color-danger)" onClick={() => {
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
                <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: `${tint('var(--color-danger)','1a')}`, border: `1px solid ${tint('var(--color-danger)','55')}`, fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>
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
                <DataTable dense columns={colunasExibidas} rows={paginados} empty={loading ? 'Carregando manifestos do Supabase…' : 'Nenhum manifesto. Registre acima ou use Importar dados.'} onRowClick={(r) => setViewModalItem(r)} rowStyle={(r) => r.status === 'Cancelado' ? { opacity: 0.45, textDecoration: 'line-through', textDecorationColor: 'rgba(255,71,87,0.35)' } : {}} />
            </div>

            {filtrados.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <span>
                        {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtrados.length)} de {filtrados.length}
                    </span>
                    <Btn variant="outline" color="var(--color-info)" onClick={() => setPage(Math.max(1, pageSafe - 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe <= 1 ? 0.4 : 1, pointerEvents: pageSafe <= 1 ? 'none' : 'auto' }}>Anterior</Btn>
                    <span>Página {pageSafe} de {totalPages}</span>
                    <Btn variant="outline" color="var(--color-info)" onClick={() => setPage(Math.min(totalPages, pageSafe + 1))} style={{ padding: '0.35rem 0.7rem', fontSize: '0.74rem', opacity: pageSafe >= totalPages ? 0.4 : 1, pointerEvents: pageSafe >= totalPages ? 'none' : 'auto' }}>Próxima</Btn>
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
                        <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${tint('var(--color-danger)','1a')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <FaTrash size={22} color="var(--color-danger)" />
                        </div>
                        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Excluir manifesto?</h3>
                        <p style={{ margin: '0 0 1.4rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            Esta ação não pode ser desfeita. O manifesto{' '}
                            <strong style={{ color: 'var(--color-text-main)' }}>{confirmDel.numeroMTR || confirmDel.residuo || 'selecionado'}</strong>
                            {confirmDel.data ? ` (${brData(confirmDel.data)})` : ''} será removido permanentemente.
                        </p>
                        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                            <Btn variant="outline" color="var(--color-text-muted)" onClick={() => setConfirmDel(null)}>Cancelar</Btn>
                            <Btn color="var(--color-danger)" onClick={() => { remove(confirmDel.id); setConfirmDel(null); }}><FaTrash size={12} /> Excluir</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Cancelamento */}
            {confirmCancel && (
                <div
                    onClick={() => setConfirmCancel(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16, maxWidth: 440, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.6rem', textAlign: 'center', animation: 'fadeIn 0.15s ease-out' }}
                    >
                        <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${tint('var(--color-orange)','1a')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <FaBan size={22} color="var(--color-orange)" />
                        </div>
                        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Cancelar manifesto?</h3>
                        <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            O manifesto{' '}
                            <strong style={{ color: 'var(--color-text-main)' }}>{confirmCancel.numeroMTR || confirmCancel.residuo || 'selecionado'}</strong>
                            {confirmCancel.data ? ` (${brData(confirmCancel.data)})` : ''} será marcado como cancelado.
                        </p>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.72rem', color: 'var(--color-text-subtle)', lineHeight: 1.4 }}>
                            O registro será mantido para auditoria. Você pode desfazer o cancelamento depois.
                        </p>
                        <div style={{ marginBottom: '1.4rem', textAlign: 'left' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.4rem' }}>
                                Motivo do Cancelamento <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Descreva por que este manifesto está sendo cancelado..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '0.6rem',
                                    color: 'var(--color-text-main)',
                                    fontSize: '0.85rem',
                                    resize: 'vertical',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                            <Btn variant="outline" color="var(--color-text-muted)" onClick={() => setConfirmCancel(null)}>Voltar</Btn>
                            <Btn color="var(--color-orange)" disabled={!cancelReason.trim()} onClick={() => {
                                update(confirmCancel.id, {
                                    cancelledAt: new Date().toISOString(),
                                    cancelledBy: nomeUsuario,
                                    status: 'Cancelado',
                                    cancelReason: cancelReason.trim(),
                                });
                                setConfirmCancel(null);
                                setCancelReason('');
                            }}><FaBan size={12} /> Confirmar Cancelamento</Btn>
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
    const corStatus = manifesto.status === 'Cancelado' ? 'var(--color-danger)' : manifesto.status === 'Emitido' ? 'var(--color-success)' : 'var(--color-warning)';
    const isCancelado = manifesto.status === 'Cancelado';

    const { items: refundItems, loading: refundLoading } = useRefunds(manifesto.id);

    const totalPeso = useMemo(() => {
        return refundItems.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
    }, [refundItems]);
    const totalReembolso = useMemo(() => {
        return refundItems.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
    }, [refundItems]);

    const brCancelDate = manifesto.cancelledAt ? new Date(manifesto.cancelledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <Modal title="Detalhes do Manifesto" onClose={onClose} width={820}>
            {/* Header resumo */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.2rem',
                borderRadius: 12, background: isCancelado ? 'rgba(255, 71, 87, 0.04)' : 'rgba(255, 255, 255, 0.02)', border: `1px solid ${isCancelado ? 'rgba(255,71,87,0.2)' : 'var(--border-color-soft)'}`,
                marginBottom: '1.5rem', flexWrap: 'wrap'
            }}>
                <div style={{ minWidth: 36, width: 'auto', padding: '0 0.55rem', height: 36, borderRadius: 10, background: isCancelado ? `${tint('var(--color-danger)','18')}` : `${tint('var(--color-success)','18')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, gap: '4px' }}>
                    {isCancelado ? <FaBan size={16} color="var(--color-danger)" /> : iconeResiduo(manifesto.residuo)}
                </div>
                <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Manifesto MTR</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isCancelado ? 'var(--color-text-muted)' : 'var(--color-text-main)', textDecoration: isCancelado ? 'line-through' : 'none' }}>
                        {manifesto.numeroMTR || 'Sem número'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600, textAlign: 'right' }}>Status</div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.2rem 0.7rem', fontSize: '0.66rem', fontWeight: 700,
                        color: corStatus, background: tint(corStatus,'15'), border: `1px solid ${tint(corStatus,'35')}`, borderRadius: 20, textAlign: 'right', marginTop: '2px'
                    }}>
                        {isCancelado && <FaBan size={9} />}
                        {manifesto.status}
                    </div>
                </div>
            </div>

            {/* Banner de cancelamento com dados de auditoria */}
            {isCancelado && (
                <div style={{
                    display: 'flex', gap: '0.6rem', padding: '0.6rem 0.9rem',
                    borderRadius: 10, background: 'rgba(255, 71, 87, 0.06)', border: '1px solid rgba(255, 71, 87, 0.18)',
                    marginBottom: '1.2rem', fontSize: '0.72rem', color: 'var(--color-text-muted)'
                }}>
                    <div style={{ marginTop: '2px' }}><FaBan size={12} color="var(--color-danger)" style={{ flexShrink: 0 }} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%' }}>
                        <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>Manifesto cancelado</span>
                            {manifesto.cancelledBy && <> por <strong style={{ color: 'var(--color-text-main)' }}>{manifesto.cancelledBy}</strong></>}
                            {brCancelDate && <> em <strong style={{ color: 'var(--color-text-main)' }}>{brCancelDate}</strong></>}
                        </div>
                        {manifesto.cancelReason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-main)', borderTop: '1px dashed rgba(255, 71, 87, 0.2)', paddingTop: '0.3rem', marginTop: '0.1rem' }}>
                                <strong style={{ color: 'var(--color-danger)' }}>Motivo:</strong> {manifesto.cancelReason}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Grid de Informações */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                
                {/* Bloco 1: Informações Gerais */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🚚 Transporte e Destino
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <DetailField label="Motorista" value={manifesto.motorista} />
                        <DetailField label="Placa do Veículo" value={manifesto.placa} />
                        <DetailField label="Transportador" value={manifesto.destinador} />
                        <DetailField label="Destinador" value={manifesto.destinadorFinal} />
                        <DetailField label="Tipo de Destinação" value={manifesto.destinacao} />
                    </div>
                </div>

                {/* Bloco 3: Documentação e Emissão */}
                <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color-soft)', borderRadius: 12, padding: '1rem', gridColumn: 'span 1' }}>
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                    <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-purple)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                            <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ⚖️ Peso Recebido do Fornecedor
                            </h3>
                            {totalPeso > 0 && (
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-success)' }}>
                                    Total: {totalPeso.toLocaleString('pt-BR')} kg{totalReembolso > 0 ? ` · R$ ${totalReembolso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                                </span>
                            )}
                        </div>

                        {refundLoading ? (
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', padding: '0.5rem 0' }}>Carregando pesos...</div>
                        ) : refundItems.length === 0 ? (
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                Nenhum peso registrado para este manifesto ainda.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color-soft)', borderRadius: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-color-soft)' }}>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Item / Descrição</th>
                                            <th style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Peso</th>
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
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-success)', fontWeight: 600, textAlign: 'right' }}>{Number(it.quantity).toLocaleString('pt-BR')}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{it.unit}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>{Number(it.unit_price) > 0 ? `R$ ${Number(it.unit_price).toFixed(2)}` : '—'}</td>
                                                <td style={{ padding: '0.4rem 0.6rem', color: Number(it.total_price) > 0 ? 'var(--color-orange)' : 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>{Number(it.total_price) > 0 ? `R$ ${Number(it.total_price).toFixed(2)}` : '—'}</td>
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
                <Btn onClick={onClose} color="var(--color-text-muted)" variant="outline"><FaTimes size={11} /> Fechar</Btn>
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
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                        R$ {totais.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div style={{ padding: '0.8rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12 }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Total Saídas (Custo/Despesas)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '4px' }}>
                        R$ {totais.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div style={{ padding: '0.8rem 1rem', background: totais.saldo >= 0 ? 'rgba(84, 160, 255, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${totais.saldo >= 0 ? 'rgba(84, 160, 255, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`, borderRadius: 12 }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>Saldo Líquido</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: totais.saldo >= 0 ? 'var(--color-info)' : 'var(--color-danger)', marginTop: '4px' }}>
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
                        <Btn type="submit" color="var(--color-orange)" style={{ padding: '0.45rem 1rem' }}>
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
                        color="var(--color-danger)"
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
                                const corTipo = it.type === 'entrada' ? 'var(--color-success)' : 'var(--color-danger)';
                                return (
                                    <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                        <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)' }}>{brData(it.date)}</td>
                                        <td style={{ padding: '0.5rem 0.7rem', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '0.1rem 0.45rem', fontSize: '0.58rem', fontWeight: 800,
                                                color: corTipo, background: tint(corTipo,'12'), border: `1px solid ${tint(corTipo,'25')}`, borderRadius: 10, textTransform: 'uppercase'
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
                <Btn onClick={onClose} color="var(--color-text-muted)" variant="outline"><FaTimes size={11} /> Fechar</Btn>
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

        if (!finalDescription || Number(form.quantity || 0) <= 0) {
            alert('Informe o resíduo/item e o peso recebido.');
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

    const modalPeso = useMemo(() => {
        return items.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
    }, [items]);
    const modalTotal = useMemo(() => {
        return items.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
    }, [items]);

    const itemTotal = Number(form.quantity || 0) * Number(form.unit_price || 0);

    const brData = (d) => (d ? d.split('-').reverse().join('/') : '—');

    return (
        <Modal title="Peso Recebido do Fornecedor" onClose={onClose} width={940}>
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

            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: '0.9rem', lineHeight: 1.5 }}>
                No fechamento do mês, registre aqui o peso que cada destinador informou ter recebido deste manifesto (conforme o relatório enviado por ele). O preço unitário é opcional — preencha só se também quiser acompanhar o valor.
            </div>

            {/* Formulário de Adicionar Item com seletor de cadastro */}
            <Card style={{ marginBottom: '1.2rem', padding: '0.9rem' }}>
                <form onSubmit={handleAddItem} className="mtr-refund-form">
                    <style>{`
                        .mtr-refund-form .input-dark { padding: 0.35rem 0.55rem !important; font-size: 0.76rem !important; }
                        .mtr-refund-form .label-muted { font-size: 0.58rem !important; display: block; margin-bottom: 0.12rem; }
                    `}</style>
                    <FormGrid cols={4}>
                        <Field label="Resíduo / Item recebido" required span={2}>
                            {descLivre ? (
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <Input
                                        value={descDigitada}
                                        onChange={(e) => setDescDigitada(e.target.value)}
                                        placeholder="Nome do novo item a cadastrar…"
                                        autoFocus
                                        required
                                    />
                                    <Btn variant="outline" color="var(--color-text-muted)" onClick={() => { setDescLivre(false); setDescDigitada(''); }} style={{ padding: '0.35rem 0.6rem' }}>
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
                                    <option value="">Selecione o item recebido…</option>
                                    {catalog.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    <option value="__OUTRO__">✏️ Cadastrar novo item…</option>
                                </Select>
                            )}
                        </Field>
                        <Field label="Peso recebido" required>
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
                        <Field label="Preço Unitário (R$) — opcional">
                            <Input
                                type="number"
                                step="any"
                                value={form.unit_price}
                                onChange={(e) => set('unit_price', e.target.value)}
                                placeholder="0.00"
                            />
                        </Field>
                        <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            {itemTotal > 0 && (
                                <span>
                                    Cálculo da prévia: {Number(form.quantity).toLocaleString('pt-BR')} {form.unit} × R$ {Number(form.unit_price).toFixed(2)} = <strong style={{ color: 'var(--color-orange)' }}>R$ {itemTotal.toFixed(2)}</strong>
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                            <Btn type="submit" color="var(--color-success)" style={{ padding: '0.45rem 1rem' }}>
                                <FaPlus size={10} /> Adicionar Peso
                            </Btn>
                        </div>
                    </FormGrid>
                </form>
            </Card>

            {/* Listagem de Pesos Registrados */}
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-main)' }}>Pesos Registrados</h3>
            {loading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-text-subtle)' }}>
                    Carregando itens…
                </div>
            ) : items.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginBottom: '1.5rem' }}>
                    Nenhum peso registrado para este manifesto ainda.
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color-soft)', borderRadius: '10px', marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-color-soft)' }}>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600 }}>Descrição</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Peso</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center' }}>Un.</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Preço Unit.</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>Valor</th>
                                <th style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'center', width: 50 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color-soft)' }}>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.description}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-success)', fontWeight: 600, textAlign: 'right' }}>{Number(it.quantity).toLocaleString('pt-BR')}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{it.unit}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>{Number(it.unit_price) > 0 ? `R$ ${Number(it.unit_price).toFixed(2)}` : '—'}</td>
                                    <td style={{ padding: '0.5rem 0.7rem', color: Number(it.total_price) > 0 ? 'var(--color-orange)' : 'var(--color-text-subtle)', fontWeight: 600, textAlign: 'right' }}>{Number(it.total_price) > 0 ? `R$ ${Number(it.total_price).toFixed(2)}` : '—'}</td>
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
                                <td style={{ padding: '0.6rem 0.7rem', fontWeight: 700, color: 'var(--color-text-main)', textAlign: 'right' }}>TOTAL:</td>
                                <td style={{ padding: '0.6rem 0.7rem', fontWeight: 800, color: 'var(--color-success)', textAlign: 'right', fontSize: '0.82rem' }}>{modalPeso.toLocaleString('pt-BR')} kg</td>
                                <td colSpan={2} style={{ padding: '0.6rem 0.7rem', fontWeight: 700, color: modalTotal > 0 ? 'var(--color-orange)' : 'var(--color-text-subtle)', textAlign: 'right' }}>{modalTotal > 0 ? `R$ ${modalTotal.toFixed(2)}` : ''}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Btn onClick={onClose} color="var(--color-text-muted)" variant="outline"><FaTimes size={11} /> Fechar</Btn>
            </div>
        </Modal>
    );
}

// ── Modal de Edição de Manifesto ──
function EditManifestoModal({ manifesto, fichas, residuosUnicos, setoresUnicos, currentUser, onSave, onClose }) {
    const [f, setF] = useState({ ...manifesto });
    const s = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
    const [destLivre, setDestLivre] = useState(false);
    const [destFinalLivre, setDestFinalLivre] = useState(false);
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
                borderRadius: 12, background: `${tint('var(--color-success)','0d')}`, border: `1px solid ${tint('var(--color-success)','22')}`,
                marginBottom: '1.2rem', flexWrap: 'wrap'
            }}>
                <div style={{ minWidth: 36, width: 'auto', padding: '0 0.55rem', height: 36, borderRadius: 10, background: `${tint('var(--color-success)','18')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, gap: '4px' }}>
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
                    <Field label="Transportador">
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
                                <option value="">Selecione o transportador…</option>
                                {f.destinador && !destinadoresSugeridos.includes(f.destinador) && (
                                    <option value="__ATUAL__">{f.destinador}</option>
                                )}
                                {destinadoresSugeridos.map((nome, idx) => <option key={idx} value={nome}>{nome}</option>)}
                                <option value="__OUTRO__">✏️ Digitar outro…</option>
                            </Select>
                        )}
                    </Field>
                    <Field label="Destinador">
                        {(destFinalLivre || destinadoresSugeridos.length === 0) ? (
                            <Input
                                value={f.destinadorFinal}
                                onChange={(e) => s('destinadorFinal', e.target.value)}
                                placeholder="SUSTENTARE, PENHA…"
                                onBlur={() => { if (destinadoresSugeridos.length) setDestFinalLivre(false); }}
                                autoFocus={destFinalLivre}
                            />
                        ) : (
                            <Select
                                value={destinadoresSugeridos.includes(f.destinadorFinal) ? f.destinadorFinal : (f.destinadorFinal ? '__ATUAL__' : '')}
                                onChange={(e) => {
                                    if (e.target.value === '__OUTRO__') { setDestFinalLivre(true); s('destinadorFinal', ''); }
                                    else if (e.target.value !== '__ATUAL__') s('destinadorFinal', e.target.value);
                                }}
                            >
                                <option value="">Selecione o destinador…</option>
                                {f.destinadorFinal && !destinadoresSugeridos.includes(f.destinadorFinal) && (
                                    <option value="__ATUAL__">{f.destinadorFinal}</option>
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
                        <Btn type="button" variant="outline" color="var(--color-text-muted)" onClick={onClose}><FaTimes size={11} /> Cancelar</Btn>
                        <Btn type="submit" color="var(--color-success)"><FaSave size={12} /> Salvar alterações</Btn>
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
                <div style={{ marginTop: '0.8rem', padding: '0.7rem 0.9rem', borderRadius: 10, background: previa.length ? `${tint('var(--color-success)','1a')}` : `${tint('var(--color-danger)','1a')}`, border: `1px solid ${previa.length ? `${tint('var(--color-success)','55')}` : `${tint('var(--color-danger)','55')}`}`, fontSize: '0.8rem', color: 'var(--color-text-main)' }}>
                    {previa.length
                        ? <>Reconhecidos <strong>{previa.length}</strong> manifesto(s). Ex.: <em>{previa[0].data} · {previa[0].residuo} · {previa[0].destinador || '—'}</em></>
                        : 'Nenhum registro reconhecido. Verifique se colou os comandos INSERT completos.'}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <Btn variant="outline" color="var(--color-text-muted)" onClick={onClose}>Cancelar</Btn>
                {!previa
                    ? <Btn color="var(--color-purple)" onClick={processar}><FaFileImport size={12} /> Processar</Btn>
                    : <Btn color="var(--color-success)" onClick={confirmar} ><FaPlus size={12} /> Importar {previa.length || ''}</Btn>}
            </div>
        </Modal>
    );
}

export default ManifestoMTRView;
