import { useState } from 'react';
import { FaUsers, FaPlus, FaTrash, FaWhatsapp, FaPhone, FaTruck, FaEdit, FaCommentDots } from 'react-icons/fa';
import { PageShell, Btn, Card, Field, Input, Textarea, FormGrid, Modal, RowAction } from '../components/ui';
import { useCollection, COL } from '../lib/store';

const empty = () => ({ nome: '', empresa: '', telefone: '', placa: '', whatsapp: true, obs: '' });
const onlyDigits = (s) => (s || '').replace(/\D/g, '');

function MotoristasView({ onBack }) {
    const { items, add, update, remove } = useCollection(COL.MOTORISTAS);
    const { items: autorizacoes } = useCollection(COL.AUTORIZACOES);
    const [editing, setEditing] = useState(null);
    const [msgFor, setMsgFor] = useState(null);

    const openWhats = (m, text) => {
        const phone = '55' + onlyDigits(m.telefone);
        const url = `https://wa.me/${phone}${text ? '?text=' + encodeURIComponent(text) : ''}`;
        window.open(url, '_blank');
    };

    return (
        <PageShell
            icon={<FaUsers size={20} />} color="#06b6d4"
            title="Motoristas & Logística"
            subtitle="Contatos das transportadoras e comunicação de coletas"
            onBack={onBack}
            actions={<Btn variant="outline" color="#8b9bb4" onClick={() => setEditing(empty())} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaPlus size={10} /> Novo Contato</Btn>}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
                {items.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--color-text-subtle)' }}>
                        Nenhum motorista cadastrado.
                    </div>
                )}
                {items.map((m) => (
                    <Card key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{m.nome}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <FaTruck size={11} /> {m.empresa}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 2 }}>
                                <RowAction icon={<FaEdit size={13} />} title="Editar" onClick={() => setEditing(m)} />
                                <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir" onClick={() => window.confirm('Excluir contato?') && remove(m.id)} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--color-text-main)' }}>
                            <FaPhone size={11} color="#06b6d4" /> {m.telefone || '—'}
                            {m.placa && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--color-text-subtle)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '1px 7px' }}>{m.placa}</span>}
                        </div>

                        {m.obs && <div style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>{m.obs}</div>}

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.4rem' }}>
                            <Btn color="#25D366" variant="outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openWhats(m, '')}>
                                <FaWhatsapp size={14} /> WhatsApp
                            </Btn>
                            <Btn color="#06b6d4" variant="outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMsgFor(m)}>
                                <FaCommentDots size={13} /> Avisar coleta
                            </Btn>
                        </div>
                    </Card>
                ))}
            </div>

            {editing && (
                <ContatoModal
                    initial={editing}
                    onClose={() => setEditing(null)}
                    onSave={(data) => { editing.id ? update(editing.id, data) : add(data); setEditing(null); }}
                />
            )}
            {msgFor && (
                <MensagemModal
                    motorista={msgFor}
                    autorizacoes={autorizacoes}
                    onClose={() => setMsgFor(null)}
                    onSend={(text) => { openWhats(msgFor, text); setMsgFor(null); }}
                />
            )}
        </PageShell>
    );
}

function ContatoModal({ initial, onClose, onSave }) {
    const [f, setF] = useState(initial);
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
        <Modal title={initial.id ? 'Editar Contato' : 'Novo Contato'} onClose={onClose} width={500}>
            <FormGrid cols={2}>
                <Field label="Nome" required span={2}><Input value={f.nome} onChange={(e) => set('nome', e.target.value)} autoFocus /></Field>
                <Field label="Empresa / Transportadora" span={2}><Input value={f.empresa} onChange={(e) => set('empresa', e.target.value)} /></Field>
                <Field label="Telefone (WhatsApp)"><Input value={f.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(11) 99999-9999" /></Field>
                <Field label="Placa"><Input value={f.placa} onChange={(e) => set('placa', e.target.value)} placeholder="ABC-1234" /></Field>
                <Field label="Observações (agenda, restrições)" span={2}><Textarea rows={2} value={f.obs} onChange={(e) => set('obs', e.target.value)} /></Field>
            </FormGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#06b6d4" onClick={() => { if (!f.nome) return alert('Informe o nome.'); onSave(f); }}>Salvar</Btn>
            </div>
        </Modal>
    );
}

function MensagemModal({ motorista, autorizacoes, onClose, onSend }) {
    const hoje = new Date().toISOString().slice(0, 10);
    const doMotorista = autorizacoes.filter((a) => a.transportadora === motorista.empresa || a.motorista === motorista.nome);
    const pendentes = doMotorista.filter((a) => a.status !== 'Recusada');

    const linhas = pendentes.map((a) => `• ${a.residuo} — ${a.quantidade} ${a.unidade} (${a.data?.split('-').reverse().join('/')})`).join('\n');
    const defaultMsg = `Olá ${motorista.nome.split(' ')[0]}, tudo bem?\n\nConfirmando a coleta de resíduos:\n${linhas || '• (sem itens vinculados)'}\n\nData prevista: ${hoje.split('-').reverse().join('/')}\nPlaca: ${motorista.placa || '—'}\n\nQualquer dúvida estou à disposição. Obrigado!`;

    const [text, setText] = useState(defaultMsg);

    return (
        <Modal title={`Avisar coleta — ${motorista.nome}`} onClose={onClose} width={520}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.8rem' }}>
                Mensagem pré-montada com as autorizações vinculadas a <strong>{motorista.empresa}</strong>. Edite se necessário e envie pelo WhatsApp.
            </div>
            <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <Btn variant="outline" color="#8b9bb4" onClick={onClose}>Cancelar</Btn>
                <Btn color="#25D366" onClick={() => onSend(text)}><FaWhatsapp size={14} /> Enviar pelo WhatsApp</Btn>
            </div>
        </Modal>
    );
}

export default MotoristasView;
