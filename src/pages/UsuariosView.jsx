import { useEffect, useMemo, useState } from 'react';
import { FaUsersCog, FaPlus, FaTrash, FaEdit, FaUserShield, FaLock } from 'react-icons/fa';
import { PageShell, Btn, Field, Input, Select, FormGrid, DataTable, RowAction, Modal, Kpi } from '../components/ui';
import { useUsuarios } from '../lib/usersRepo';
import { ROLE_LABELS } from '../contexts/AuthContext';

const ROLES = ['gestor', 'analista', 'operador'];
const AVATARES = ['🌱', '♻️', '🌎', '🍃', '👤', '🧑‍🔬', '🧑‍💼', '🛠️', '📋', '⚗️'];
const corPapel = (r) => (r === 'gestor' ? '#10b981' : r === 'analista' ? '#54a0ff' : '#ffb700');

// Todas as telas disponíveis no SGA (exceto 'usuarios' que é só admin)
const ALL_PAGES = [
    { id: 'dashboard', label: 'Dashboard Ambiental', cat: 'Visão Geral', color: '#00ccff' },
    { id: 'calendario', label: 'Calendário Ambiental', cat: 'Visão Geral', color: '#10b981' },
    { id: 'autorizacoes', label: 'Autorização de Saída', cat: 'Operação de Resíduos', color: '#00ff9d' },
    { id: 'manifestos', label: 'Manifesto MTR / SINIR', cat: 'Operação de Resíduos', color: '#54a0ff' },
    { id: 'tickets', label: 'Tickets de Coleta', cat: 'Operação de Resíduos', color: '#ff9f43' },
    { id: 'controle-residuos', label: 'Controle de Saída', cat: 'Operação de Resíduos', color: '#10b981' },
    { id: 'esg-carbono', label: 'ESG & Carbono', cat: 'Monitoramento', color: '#10b981' },
    { id: 'fumaca', label: 'Fumaça Preta', cat: 'Monitoramento', color: '#a78bfa' },
    { id: 'lira', label: 'LIRA · Requisitos Legais', cat: 'Monitoramento', color: '#00ccff' },
    { id: 'dedetizacao', label: 'Controle de Pragas · Dedetização', cat: 'Monitoramento', color: '#ff9f43' },
    { id: 'nf-sucata', label: 'NF Sucata Plástica', cat: 'Comercial & Logística', color: '#ffb700' },
    { id: 'motoristas', label: 'Motoristas & Logística', cat: 'Comercial & Logística', color: '#06b6d4' },
    { id: 'cadastros', label: 'Cadastros', cat: 'Cadastros', color: '#9d4edd' },
    { id: 'ficha-residuos', label: 'Cadastro de Resíduos', cat: 'Cadastros', color: '#c77dff' },
];

const PAGE_CATEGORIES = [...new Set(ALL_PAGES.map((p) => p.cat))];

const novo = () => ({ email: '', password: '', name: '', role: 'analista', avatar: '🌱', is_admin: false });

function UsuariosView({ onBack }) {
    const { items, loading, error, criar, update, remove, getPermissions, savePermissions } = useUsuarios();
    const [busca, setBusca] = useState('');
    const [modal, setModal] = useState(null); // { form, id|null, permissions: string[] }
    const [confirmDel, setConfirmDel] = useState(null);
    const [salvando, setSalvando] = useState(false);

    const filtrados = useMemo(() => items.filter((u) =>
        !busca || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(busca.toLowerCase())
    ), [items, busca]);

    const kpis = useMemo(() => ({
        total: items.length,
        admins: items.filter((u) => u.is_admin).length,
        ativos: items.filter((u) => u.active !== false).length,
    }), [items]);

    // Ao abrir modal de edição, carrega permissões do usuário
    const openModal = async (user, id) => {
        let permissions = ALL_PAGES.map((p) => p.id); // novo usuário: tudo marcado por padrão
        if (id) {
            permissions = await getPermissions(id);
        }
        setModal({ form: { ...novo(), ...user }, id, permissions });
    };

    const togglePermission = (pageId) => {
        setModal((m) => {
            const perms = m.permissions || [];
            const has = perms.includes(pageId);
            return { ...m, permissions: has ? perms.filter((p) => p !== pageId) : [...perms, pageId] };
        });
    };

    const toggleAllPermissions = () => {
        setModal((m) => {
            const allIds = ALL_PAGES.map((p) => p.id);
            const allSelected = allIds.every((id) => (m.permissions || []).includes(id));
            return { ...m, permissions: allSelected ? [] : allIds };
        });
    };

    const salvar = async () => {
        const f = modal.form;
        if (!f.name?.trim()) { alert('Informe o nome.'); return; }
        setSalvando(true);
        if (modal.id) {
            await update(modal.id, { name: f.name, role: f.role, avatar: f.avatar, is_admin: !!f.is_admin });
            // Salvar permissões (somente se não é admin, pois admin tem tudo)
            if (!f.is_admin) {
                await savePermissions(modal.id, modal.permissions || []);
            }
        } else {
            if (!f.email?.trim() || !f.password) { alert('E-mail e senha são obrigatórios para criar.'); setSalvando(false); return; }
            if (f.password.length < 6) { alert('A senha deve ter ao menos 6 caracteres.'); setSalvando(false); return; }
            const r = await criar(f);
            if (!r) { setSalvando(false); return; }
            // Salvar permissões do novo usuário
            if (!f.is_admin && r.id) {
                await savePermissions(r.id, modal.permissions || []);
            }
        }
        setSalvando(false);
        setModal(null);
    };

    const columns = [
        {
            key: 'name', label: 'Usuário', align: 'left', render: (u) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>{u.avatar || '👤'}</span>
                    <span>
                        <div style={{ fontWeight: 600 }}>{u.name || '—'}</div>
                        <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.66rem' }}>{u.email || ''}</div>
                    </span>
                </span>
            ),
        },
        {
            key: 'role', label: 'Papel', align: 'center', render: (u) => {
                const c = corPapel(u.role);
                return <span style={{ fontSize: '0.62rem', fontWeight: 700, color: c, background: c + '1a', border: `1px solid ${c}55`, padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase' }}>{ROLE_LABELS[u.role] || u.role}</span>;
            },
        },
        { key: 'is_admin', label: 'Admin', align: 'center', render: (u) => u.is_admin ? <FaUserShield size={14} color="#ffb700" title="Administrador" /> : <span style={{ color: 'var(--color-text-subtle)' }}>—</span> },
        {
            key: 'active', label: 'Ativo', align: 'center', render: (u) => {
                const on = u.active !== false; const c = on ? '#10b981' : '#8b9bb4';
                return <span onClick={() => update(u.id, { active: !on })} title="Clique para alternar" style={{ cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, color: c, background: c + '1a', border: `1px solid ${c}55`, padding: '2px 9px', borderRadius: 20 }}>{on ? 'ATIVO' : 'INATIVO'}</span>;
            },
        },
        {
            key: 'acoes', label: '', align: 'center', render: (u) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <RowAction icon={<FaEdit size={13} />} color="#54a0ff" title="Editar" onClick={() => openModal(u, u.id)} />
                    <RowAction icon={<FaTrash size={13} />} color="#ff4757" title="Excluir perfil" onClick={() => setConfirmDel(u)} />
                </div>
            ),
        },
    ];

    return (
        <PageShell
            icon={<FaUsersCog size={20} />} color="#a78bfa"
            title="Gerenciar Usuários"
            subtitle="Cadastro e permissões · autenticação via Supabase"
            onBack={onBack}
            actions={<Btn variant="outline" color="#8b9bb4" onClick={() => openModal(novo(), null)} style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}><FaPlus size={10} /> Novo usuário</Btn>}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                <Kpi icon={<FaUsersCog size={13} />} label="Usuários" value={kpis.total} color="#a78bfa" />
                <Kpi icon={<FaUserShield size={13} />} label="Administradores" value={kpis.admins} color="#ffb700" />
                <Kpi icon={<FaUsersCog size={13} />} label="Ativos" value={kpis.ativos} color="#10b981" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)', marginRight: 'auto' }}>Usuários <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>({filtrados.length})</span></h3>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" style={{ width: 200, fontSize: '0.72rem' }} />
            </div>

            {error && (
                <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: '#ff47571a', border: '1px solid #ff475755', fontSize: '0.8rem', color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>
                    Falha ao carregar usuários: {error}. Verifique se a tabela <code>profiles</code> existe no Supabase.
                </div>
            )}

            <DataTable dense columns={columns} rows={filtrados} empty={loading ? 'Carregando…' : 'Nenhum usuário. Clique em "Novo usuário".'} />

            {modal && (
                <Modal title={modal.id ? 'Editar usuário' : 'Novo usuário'} onClose={() => setModal(null)} width={600}>
                    <FormGrid cols={2}>
                        <Field label="Nome" span={2}><Input value={modal.form.name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></Field>
                        {!modal.id && <Field label="E-mail" span={2}><Input type="email" value={modal.form.email} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, email: e.target.value } }))} placeholder="voce@empresa.com" /></Field>}
                        {!modal.id && <Field label="Senha" span={2}><Input type="password" value={modal.form.password} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, password: e.target.value } }))} placeholder="mín. 6 caracteres" /></Field>}
                        <Field label="Papel">
                            <Select value={modal.form.role} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, role: e.target.value } }))}>
                                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </Select>
                        </Field>
                        <Field label="Avatar">
                            <Select value={modal.form.avatar} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, avatar: e.target.value } }))}>
                                {AVATARES.map((a) => <option key={a} value={a}>{a}</option>)}
                            </Select>
                        </Field>
                    </FormGrid>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', cursor: 'pointer', margin: '0.8rem 0 0.6rem' }}>
                        <input type="checkbox" checked={!!modal.form.is_admin} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, is_admin: e.target.checked } }))} />
                        <FaUserShield size={12} color="#ffb700" /> Administrador (acesso total a todas as telas)
                    </label>

                    {/* ── Permissões de Acesso por Tela ── */}
                    {!modal.form.is_admin && (
                        <div style={{
                            marginTop: '0.6rem', padding: '0.9rem', borderRadius: 12,
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FaLock size={13} color="#a78bfa" />
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                        Permissões de Acesso
                                    </span>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>
                                        ({(modal.permissions || []).length}/{ALL_PAGES.length} telas)
                                    </span>
                                </div>
                                <button
                                    onClick={toggleAllPermissions}
                                    style={{
                                        padding: '3px 10px', fontSize: '0.62rem', fontWeight: 700, borderRadius: 6,
                                        border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)',
                                        color: '#a78bfa', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {ALL_PAGES.every((p) => (modal.permissions || []).includes(p.id)) ? 'Desmarcar tudo' : 'Marcar tudo'}
                                </button>
                            </div>

                            {PAGE_CATEGORIES.map((cat) => {
                                const pages = ALL_PAGES.filter((p) => p.cat === cat);
                                return (
                                    <div key={cat} style={{ marginBottom: '0.5rem' }}>
                                        <div style={{
                                            fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-text-subtle)',
                                            letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '0.3rem',
                                            paddingBottom: '0.2rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                            {cat}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                            {pages.map((page) => {
                                                const checked = (modal.permissions || []).includes(page.id);
                                                return (
                                                    <label
                                                        key={page.id}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                            padding: '0.3rem 0.6rem', borderRadius: 8, cursor: 'pointer',
                                                            fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s',
                                                            background: checked ? `${page.color}15` : 'rgba(255,255,255,0.02)',
                                                            border: `1px solid ${checked ? page.color + '55' : 'rgba(255,255,255,0.06)'}`,
                                                            color: checked ? page.color : 'var(--color-text-muted)',
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => togglePermission(page.id)}
                                                            style={{ accentColor: page.color }}
                                                        />
                                                        {page.label}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {modal.form.is_admin && (
                        <div style={{
                            marginTop: '0.6rem', padding: '0.7rem 0.9rem', borderRadius: 10,
                            background: 'rgba(255,183,0,0.06)', border: '1px solid rgba(255,183,0,0.2)',
                            fontSize: '0.75rem', color: '#ffb700', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}>
                            <FaUserShield size={14} />
                            Administradores possuem acesso total a todas as telas automaticamente.
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                        <Btn variant="outline" color="#8b9bb4" onClick={() => setModal(null)}>Cancelar</Btn>
                        <Btn color="#a78bfa" onClick={salvar}><FaPlus size={12} /> {salvando ? 'Salvando…' : (modal.id ? 'Salvar' : 'Criar usuário')}</Btn>
                    </div>
                </Modal>
            )}

            {confirmDel && (
                <div onClick={() => setConfirmDel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '1rem' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.6rem', textAlign: 'center' }}>
                        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#ff47571a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}><FaTrash size={22} color="#ff4757" /></div>
                        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Excluir perfil?</h3>
                        <p style={{ margin: '0 0 1.4rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                            O perfil de <strong style={{ color: 'var(--color-text-main)' }}>{confirmDel.name || confirmDel.email}</strong> será removido. O login no Auth permanece (para removê-lo de vez é preciso uma função admin no servidor) — considere apenas <strong>inativar</strong> o usuário.
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

export default UsuariosView;
