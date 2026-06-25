import { useState } from 'react';
import { FaFileSignature, FaPlus, FaTrash, FaCheck, FaPrint, FaCalendarDay } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, DataTable, StatusBadge, Modal, RowAction } from '../components/ui';
import { useCollection, COL } from '../lib/store';
import { UNIDADES, STATUS_AUTORIZACAO, DIAS_OPERACAO } from '../lib/constants';
import ProcessGuide from '../components/ProcessGuide';
import FR231Print from '../components/FR231Print';

const STATUS_COLORS = { Pendente: '#ffb700', Autorizada: '#54a0ff', Liberada: '#10b981', Recusada: '#ff4757' };

// ── Fluxograma: Liberação de Resíduos para Fornecedor ──
const LIBERACAO_STEPS = [
    {
        type: 'action', icon: '🚛',
        title: 'Fornecedor chega à baia de resíduos',
        description: 'O fornecedor chega à baia de resíduos para coletar o material. Identifique o fornecedor e o material solicitado.',
    },
    {
        type: 'decision', icon: '◆',
        title: 'Verificar na planilha FR 614 se o fornecedor está liberado',
        description: 'Consulte a planilha FR 614 para confirmar se a última coleta foi regularizada e se o fornecedor está liberado para nova coleta.',
        branches: [
            {
                label: 'Não confirmado — Aguardar',
                color: '#ff4757',
                description: 'A última coleta não foi confirmada. O fornecedor deve aguardar a regularização antes de prosseguir.',
                steps: [
                    'Informar ao fornecedor que ele não está liberado',
                    'Aguardar confirmação de recebimento da coleta anterior',
                    'Somente após regularização, reiniciar este processo',
                ],
            },
            {
                label: 'Liberado — Prosseguir',
                color: '#10b981',
                description: 'O fornecedor está com a situação regularizada. Confirme ao empilhador para iniciar o carregamento.',
                steps: [
                    'Confirmar ao empilhador que o fornecedor está liberado',
                ],
            },
        ],
    },
    {
        type: 'action', icon: '🏗️',
        title: 'Empilhador carrega o material e confirma a quantidade',
        description: 'O empilhador carrega o material desejado no veículo do fornecedor e confirma a quantidade real carregada.',
    },
    {
        type: 'action', icon: '📝',
        title: 'Preencher a FR 231 para liberação na portaria',
        description: 'Após a informação das quantidades, preencha a FR 231 com os dados da coleta para liberação do veículo na portaria.',
    },
    {
        type: 'action', icon: '📊',
        title: 'Preencher a FR 614',
        description: 'Registre os dados da coleta também na planilha FR 614 para manter o controle atualizado.',
    },
    {
        type: 'action', icon: '🔑',
        title: 'Entregar a FR 231 ao motorista',
        description: 'Entregue a FR 231 preenchida ao motorista. Com este documento, ele está liberado para sair na portaria.',
    },
    {
        type: 'action', icon: '✅',
        title: 'Motorista apresenta documento ao empilhador',
        description: 'Antes de sair, o motorista deve apresentar o documento ao empilhador para conferência, assinar e postar uma foto no grupo do WhatsApp como comprovação.',
    },
    {
        type: 'end',
        title: 'Tarefa concluída',
        description: 'A liberação de resíduos para o fornecedor foi finalizada com sucesso.',
    },
];

const LIBERACAO_NOTES = [
    'O fornecedor deve confirmar o recebimento dos materiais. Novas coletas só devem ser liberadas com a confirmação da coleta anterior.',
    'Cesto aramado e Caixa Poliondas devem sair com nota fiscal obrigatoriamente.',
    'Materiais para colaborador, caixa plástica azul e pallet plástico preto só podem sair com autorização do coordenador ou gerente da área.',
    'O PCPM é responsável por informar a quantidade diária que cada fornecedor deverá coletar e demais materiais.',
];

const empty = () => ({
    data: new Date().toISOString().slice(0, 10),
    residuo: '', quantidade: '', unidade: 'kg', transportadora: '', motorista: '',
    placa: '', destino: '', responsavel: '', obs: '', status: 'Pendente',
});

function diaSemana(dateStr) {
    const idx = new Date(dateStr + 'T12:00:00').getDay(); // 0=Dom
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][idx];
}

function AutorizacaoSaidaView({ onBack }) {
    const { items, add, update, remove } = useCollection(COL.AUTORIZACOES);
    const { items: residuos } = useCollection(COL.RESIDUOS);
    const { items: motoristas } = useCollection(COL.MOTORISTAS);
    const [form, setForm] = useState(empty());
    const [printItem, setPrintItem] = useState(null);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        const dia = diaSemana(form.data);
        if (dia === 'Dom') {
            alert('Operação permitida apenas de segunda a sábado. Domingo não é dia útil de coleta.');
            return;
        }
        add({ ...form, quantidade: Number(form.quantidade), dia });
        setForm(empty());
    };

    // Ao escolher resíduo, autopreenche transportadora/destino padrão do cadastro
    const onResiduo = (nome) => {
        const r = residuos.find((x) => x.nome === nome);
        setForm((f) => ({
            ...f, residuo: nome,
            unidade: r?.unidade || f.unidade,
            transportadora: r?.destinador || f.transportadora,
            destino: r?.destinador || f.destino,
        }));
    };

    const onMotorista = (nome) => {
        const m = motoristas.find((x) => x.nome === nome);
        setForm((f) => ({ ...f, motorista: nome, placa: m?.placa || f.placa, transportadora: m?.empresa || f.transportadora }));
    };

    const columns = [
        { key: 'data', label: 'Data', render: (r) => <span>{r.data?.split('-').reverse().join('/')} <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem' }}>{r.dia || diaSemana(r.data)}</span></span> },
        { key: 'residuo', label: 'Resíduo' },
        { key: 'quantidade', label: 'Qtd.', align: 'right', render: (r) => `${r.quantidade} ${r.unidade}` },
        { key: 'transportadora', label: 'Transportadora' },
        { key: 'motorista', label: 'Motorista', render: (r) => <span>{r.motorista}<br /><span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem' }}>{r.placa}</span></span> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} map={STATUS_COLORS} /> },
        {
            key: 'acoes', label: '', align: 'right', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    {r.status === 'Pendente' && <RowAction icon={<FaCheck size={13} />} color="#10b981" title="Liberar" onClick={() => update(r.id, { status: 'Liberada' })} />}
                    <RowAction icon={<FaPrint size={13} />} title="Imprimir autorização" onClick={() => setPrintItem(r)} />
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir autorização?') && remove(r.id)} />
                </div>
            ),
        },
    ];

    const hoje = items.filter((i) => i.data === new Date().toISOString().slice(0, 10)).length;

    return (
        <PageShell
            icon={<FaFileSignature size={20} />}
            title="Autorização de Saída de Resíduos"
            subtitle="Preenchimento diário · segunda a sábado"
            onBack={onBack}
            actions={<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                <FaCalendarDay color="#00ff9d" /> {hoje} autorização(ões) hoje
            </div>}
        >
            {/* Guia de Processo — Fluxo de Liberação de Resíduos para Fornecedor */}
            <ProcessGuide
                title="📋 Fluxo de Liberação de Resíduos para Fornecedor"
                color="#00ff9d"
                steps={LIBERACAO_STEPS}
                notes={LIBERACAO_NOTES}
            />

            {/* Formulário */}
            <Card style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaPlus size={13} color="#00ff9d" /> Nova Autorização
                </h3>
                <form onSubmit={handleSubmit}>
                    <FormGrid cols={3}>
                        <Field label="Data" required>
                            <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} required />
                        </Field>
                        <Field label="Resíduo" required span={2}>
                            <Select value={form.residuo} onChange={(e) => onResiduo(e.target.value)} required>
                                <option value="">Selecione…</option>
                                {residuos.map((r) => <option key={r.id} value={r.nome}>{r.nome}</option>)}
                            </Select>
                        </Field>
                        <Field label="Quantidade" required>
                            <Input type="number" step="any" min="0" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} required />
                        </Field>
                        <Field label="Unidade">
                            <Select value={form.unidade} onChange={(e) => set('unidade', e.target.value)}>
                                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                            </Select>
                        </Field>
                        <Field label="Destino">
                            <Input value={form.destino} onChange={(e) => set('destino', e.target.value)} placeholder="Destinador final" />
                        </Field>
                        <Field label="Motorista">
                            <Select value={form.motorista} onChange={(e) => onMotorista(e.target.value)}>
                                <option value="">Selecione…</option>
                                {motoristas.map((m) => <option key={m.id} value={m.nome}>{m.nome} — {m.empresa}</option>)}
                            </Select>
                        </Field>
                        <Field label="Placa">
                            <Input value={form.placa} onChange={(e) => set('placa', e.target.value)} placeholder="ABC-1234" />
                        </Field>
                        <Field label="Responsável (liberação)">
                            <Input value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} placeholder="Nome do responsável" />
                        </Field>
                        <Field label="Observações" span={3}>
                            <Textarea rows={2} value={form.obs} onChange={(e) => set('obs', e.target.value)} placeholder="Condições, EPIs, restrições…" />
                        </Field>
                    </FormGrid>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <Btn type="submit"><FaPlus size={12} /> Registrar Autorização</Btn>
                    </div>
                </form>
            </Card>

            {/* Lista */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>Autorizações Emitidas</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>{DIAS_OPERACAO.join(' · ')}</span>
            </div>
            <DataTable columns={columns} rows={items} empty="Nenhuma autorização registrada ainda." />

            {/* Impressão FR 231 */}
            {printItem && <FR231Print data={printItem} onClose={() => setPrintItem(null)} />}
        </PageShell>
    );
}

function PrintModal({ item, onClose }) {
    return (
        <Modal title="Autorização de Saída de Resíduos" onClose={onClose} width={620}>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--color-text-main)' }}>
                <div style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.6rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>SGA — AUTORIZAÇÃO DE SAÍDA</strong>
                    <span>Nº {item.id.slice(-6).toUpperCase()}</span>
                </div>
                <Row k="Data" v={`${item.data?.split('-').reverse().join('/')} (${item.dia || ''})`} />
                <Row k="Resíduo" v={item.residuo} />
                <Row k="Quantidade" v={`${item.quantidade} ${item.unidade}`} />
                <Row k="Transportadora" v={item.transportadora} />
                <Row k="Motorista / Placa" v={`${item.motorista || '—'} / ${item.placa || '—'}`} />
                <Row k="Destino" v={item.destino} />
                <Row k="Responsável" v={item.responsavel} />
                <Row k="Status" v={item.status} />
                {item.obs && <Row k="Observações" v={item.obs} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', gap: '2rem' }}>
                    <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Liberado por</div>
                    <div style={{ flex: 1, textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>Portaria</div>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <Btn onClick={() => window.print()}><FaPrint size={12} /> Imprimir</Btn>
            </div>
        </Modal>
    );
}

const Row = ({ k, v }) => (
    <div style={{ display: 'flex', gap: '0.8rem', padding: '0.2rem 0' }}>
        <span style={{ width: 150, color: 'var(--color-text-subtle)', flexShrink: 0 }}>{k}:</span>
        <strong>{v || '—'}</strong>
    </div>
);

export default AutorizacaoSaidaView;
