import { useState } from 'react';
import { FaTicketAlt, FaTrash, FaFileExcel, FaWeightHanging, FaCheckDouble } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Select, FormGrid, DataTable, StatusBadge, Modal, RowAction } from '../components/ui';
import { useCollection, COL } from '../lib/store';
import { STATUS_TICKET, UNIDADES } from '../lib/constants';
import { exportToExcel } from '../lib/excel';

const STATUS_COLORS = { 'Aguardando Coleta': '#ffb700', Coletado: '#54a0ff', Conferido: '#10b981' };

function TicketsColetaView({ onBack }) {
    const { items, add, update, remove } = useCollection(COL.TICKETS);
    const { items: manifestos } = useCollection(COL.MANIFESTOS);
    const [editing, setEditing] = useState(null); // ticket sendo aferido
    const [novo, setNovo] = useState(false);

    const exportar = () => {
        exportToExcel(items.map((t) => ({
            'Ticket': t.numero, 'MTR': t.numeroMTR, 'Resíduo': t.residuo,
            'Data Coleta': t.dataColeta?.split('-').reverse().join('/'), 'Motorista/Transp.': t.motorista,
            'Peso Aferido': t.pesoAferido, 'Unidade': t.unidade, 'Status': t.status,
        })), 'tickets_coleta', 'Tickets');
    };

    const columns = [
        { key: 'numero', label: 'Ticket', render: (r) => <strong>{r.numero}</strong> },
        { key: 'numeroMTR', label: 'MTR vinculado' },
        { key: 'residuo', label: 'Resíduo' },
        { key: 'dataColeta', label: 'Coleta', render: (r) => r.dataColeta?.split('-').reverse().join('/') },
        { key: 'motorista', label: 'Transportador' },
        { key: 'pesoAferido', label: 'Peso aferido', align: 'right', render: (r) => `${r.pesoAferido ?? '—'} ${r.unidade || ''}` },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} map={STATUS_COLORS} /> },
        {
            key: 'acoes', label: '', align: 'right', render: (r) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <RowAction icon={<FaWeightHanging size={13} />} color="#54a0ff" title="Aferir peso / preencher" onClick={() => setEditing(r)} />
                    {r.status !== 'Conferido' && <RowAction icon={<FaCheckDouble size={13} />} color="#10b981" title="Marcar conferido" onClick={() => update(r.id, { status: 'Conferido' })} />}
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir ticket?') && remove(r.id)} />
                </div>
            ),
        },
    ];

    const pendentes = items.filter((t) => t.status === 'Aguardando Coleta').length;

    return (
        <PageShell
            icon={<FaTicketAlt size={20} />} color="#ff9f43"
            title="Tickets de Coleta de Resíduos"
            subtitle="Preenchidos a partir dos manifestos (MTR) criados"
            onBack={onBack}
            actions={<>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginRight: '0.4rem' }}>{pendentes} aguardando coleta</span>
                <Btn variant="outline" color="#8b9bb4" onClick={exportar} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaFileExcel size={10} /> Exportar Excel</Btn>
                <Btn variant="outline" color="#8b9bb4" onClick={() => setNovo(true)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaPlus size={10} /> Ticket manual</Btn>
            </>}
        >
            <Card style={{ marginBottom: '1.5rem', borderLeft: '3px solid #ff9f43' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    Os tickets são gerados automaticamente na tela de <strong>Manifesto MTR</strong> (ícone de ticket) e aparecem aqui
                    para o preenchimento do <strong>peso aferido na balança</strong> e a conferência final da coleta.
                </div>
            </Card>

            <DataTable columns={columns} rows={items} empty="Nenhum ticket. Gere a partir de um manifesto na tela de MTR." />

            {editing && <AferirModal ticket={editing} onClose={() => setEditing(null)} onSave={(patch) => { update(editing.id, patch); setEditing(null); }} />}
            {novo && <NovoModal manifestos={manifestos} onClose={() => setNovo(false)} onSave={(t) => { add(t); setNovo(false); }} count={items.length} />}
        </PageShell>
    );
}

function AferirModal({ ticket, onClose, onSave }) {
    const [peso, setPeso] = useState(ticket.pesoAferido ?? '');
    const [obs, setObs] = useState(ticket.obs || '');
    const [status, setStatus] = useState(ticket.status);
    return (
        <Modal title={`Ticket ${ticket.numero} — Aferição`} onClose={onClose} width={460}>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                MTR <strong>{ticket.numeroMTR}</strong> · {ticket.residuo}
            </div>
            <FormGrid cols={2}>
                <Field label="Peso aferido (balança)">
                    <Input type="number" step="any" value={peso} onChange={(e) => setPeso(e.target.value)} autoFocus />
                </Field>
                <Field label="Status">
                    <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUS_TICKET.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </Field>
                <Field label="Observações" span={2}>
                    <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Divergências, lacre, etc." />
                </Field>
            </FormGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#54a0ff" onClick={() => onSave({ pesoAferido: peso === '' ? null : Number(peso), obs, status })}>Salvar</Btn>
            </div>
        </Modal>
    );
}

function NovoModal({ manifestos, onClose, onSave, count }) {
    const [manifestoId, setManifestoId] = useState('');
    const m = manifestos.find((x) => x.id === manifestoId);
    return (
        <Modal title="Novo Ticket de Coleta" onClose={onClose} width={460}>
            <Field label="Manifesto (MTR) vinculado" required>
                <Select value={manifestoId} onChange={(e) => setManifestoId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {manifestos.map((x) => <option key={x.id} value={x.id}>{x.numeroMTR} — {x.residuo}</option>)}
                </Select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#ff9f43" onClick={() => {
                    if (!m) return alert('Selecione um manifesto.');
                    onSave({
                        numero: 'TK-' + String(1000 + count + 1), manifestoId: m.id, numeroMTR: m.numeroMTR,
                        residuo: m.residuo, dataColeta: m.data, motorista: m.transportador,
                        pesoAferido: m.quantidade, unidade: m.unidade, status: 'Aguardando Coleta', obs: '',
                    });
                }}>Criar Ticket</Btn>
            </div>
        </Modal>
    );
}

export default TicketsColetaView;
