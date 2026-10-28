import { cloneElement, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ThemePicker from '../components/ThemePicker';
import { useCollection, COL } from '../lib/store';
import { obterEventosProximos } from '../lib/constants';
import {
    FaLeaf, FaSignOutAlt, FaChartPie, FaFileSignature, FaFileExcel, FaTruckMoving,
    FaFileInvoiceDollar, FaUsers, FaDatabase, FaRecycle,
    FaCalendarAlt, FaBell, FaUsersCog, FaBalanceScale, FaBug, FaTable,
    FaSearch, FaChevronRight, FaCheckCircle
} from 'react-icons/fa';


const MENU = [
    { id: 'dashboard', label: 'Dashboard Ambiental', icon: <FaChartPie size={22} />, color: 'var(--color-secondary)', description: 'Indicadores ISO 14001 e conformidade' },
    { id: 'calendario', label: 'Calendário Ambiental', icon: <FaCalendarAlt size={22} />, color: 'var(--color-success)', description: 'Datas ecológicas e cronograma', cat: 'visao' },

    // Operação de resíduos
    { id: 'autorizacoes', label: 'Autorização de Saída', icon: <FaFileSignature size={22} />, color: 'var(--color-primary)', description: 'Preenchimento diário (seg–sáb)', cat: 'residuos' },
    { id: 'manifestos', label: 'Manifesto MTR / SINIR', icon: <FaTruckMoving size={22} />, color: 'var(--color-info)', description: 'Emissão e controle de MTR', cat: 'residuos' },
    { id: 'controle-residuos', label: 'Controle de Saída', icon: <FaFileExcel size={22} />, color: 'var(--color-success)', description: 'Histórico consolidado · exporta Excel', cat: 'residuos' },
    { id: 'conciliacao', label: 'Conciliação Mensal', icon: <FaTable size={22} />, color: 'var(--color-secondary)', description: 'Conferência por fornecedor · pivot anual', cat: 'residuos' },

    // Monitoramento
    { id: 'lira', label: 'LIRA · Requisitos Legais', icon: <FaBalanceScale size={22} />, color: 'var(--color-secondary)', description: 'Análise de conformidade legal · meta diária', cat: 'monitoramento' },
    { id: 'dedetizacao', label: 'Controle de Pragas', icon: <FaBug size={22} />, color: 'var(--color-orange)', description: 'Dedetização FR 861 · solicitações e reincidências', cat: 'monitoramento' },

    // Comercial & logística
    { id: 'nf-sucata', label: 'NF Sucata Plástica', icon: <FaFileInvoiceDollar size={22} />, color: 'var(--color-warning)', description: 'Emissão e controle · VIAMED', cat: 'comercial' },
    { id: 'motoristas', label: 'Motoristas & Logística', icon: <FaUsers size={22} />, color: 'var(--color-cyan)', description: 'Contatos e comunicação de coletas', cat: 'comercial' },

    // Cadastros
    { id: 'cadastros', label: 'Cadastros', icon: <FaDatabase size={22} />, color: 'var(--color-purple)', description: 'Resíduos e geradores', cat: 'cadastros' },
    { id: 'ficha-residuos', label: 'Cadastro de Resíduos', icon: <FaRecycle size={22} />, color: 'var(--color-purple)', description: 'Ficha mestre · destinadores e transportadores', cat: 'cadastros' },

    // Administração (somente admin)
    { id: 'usuarios', label: 'Gerenciar Usuários', icon: <FaUsersCog size={22} />, color: 'var(--color-purple)', description: 'Cadastro e permissões de acesso', cat: 'admin', admin: true },
];

const CATEGORIES = [
    { id: 'visao', label: 'Visão Geral', color: 'var(--color-secondary)', ids: ['dashboard', 'calendario'] },
    { id: 'residuos', label: 'Operação de Resíduos', color: 'var(--color-primary)', ids: ['autorizacoes', 'manifestos', 'controle-residuos', 'conciliacao'] },
    { id: 'monitoramento', label: 'Monitoramento & Conformidade', color: 'var(--color-success)', ids: ['lira', 'dedetizacao'] },
    { id: 'comercial', label: 'Comercial & Logística', color: 'var(--color-warning)', ids: ['nf-sucata', 'motoristas'] },
    { id: 'cadastros', label: 'Cadastros', color: 'var(--color-purple)', ids: ['cadastros', 'ficha-residuos'] },
    { id: 'admin', label: 'Administração', color: 'var(--color-purple)', ids: ['usuarios'] },
];

// Busca sem acento e sem caixa: "residuo" acha "Resíduo"
const normalizar = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// "eugenio" / "eugenio.matos@x.com" → "Eugenio"
function primeiroNome(nome) {
    const base = String(nome || '').split('@')[0].split(/[\s._-]+/)[0];
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

function saudacao(d = new Date()) {
    const h = d.getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function MainMenu({ onNavigate, onLogout }) {
    const { currentUser, ROLE_LABELS } = useAuth();
    const { items: events } = useCollection(COL.CALENDARIO);
    const { items: autorizacoes } = useCollection(COL.AUTORIZACOES);
    const [showNotifications, setShowNotifications] = useState(false);
    const [busca, setBusca] = useState('');
    const buscaRef = useRef(null);
    const sinoRef = useRef(null);

    const upcomingEvents = obterEventosProximos(events, new Date(), 15);
    const autorizacoesPendentes = autorizacoes.filter((a) => a.status === 'Pendente').length;

    const podeVer = (m) => {
        if (m.admin && !currentUser?.is_admin) return false;
        if (currentUser?.allowed_pages === 'all') return true;
        return (currentUser?.allowed_pages || []).includes(m.id);
    };

    // "/" leva o cursor para a busca, como em qualquer buscador
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target?.tagName;
            if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); buscaRef.current?.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Clique fora fecha a lista de eventos
    useEffect(() => {
        if (!showNotifications) return;
        const onDown = (e) => { if (sinoRef.current && !sinoRef.current.contains(e.target)) setShowNotifications(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [showNotifications]);

    const termo = normalizar(busca.trim());
    // Procura no nome do módulo, na descrição e no nome da seção ("resíduo" traz a Operação de Resíduos inteira)
    const casa = (m, cat) => !termo || normalizar(`${m.label} ${m.description} ${cat.label}`).includes(termo);

    const secoes = CATEGORIES
        .map((cat) => ({ ...cat, items: cat.ids.map((id) => MENU.find((m) => m.id === id)).filter(Boolean).filter(podeVer).filter((m) => casa(m, cat)) }))
        .filter((cat) => cat.items.length > 0);
    const resultados = secoes.flatMap((c) => c.items);

    // Só entra o que tem número e que a pessoa pode abrir — zero não vira aviso
    const pendencias = [
        autorizacoesPendentes > 0 && podeVer({ id: 'autorizacoes' }) && {
            id: 'autorizacoes', num: autorizacoesPendentes, cor: 'var(--color-warning)', icon: <FaFileSignature size={15} />,
            texto: <><strong>{autorizacoesPendentes === 1 ? 'autorização de saída' : 'autorizações de saída'}</strong> {autorizacoesPendentes === 1 ? 'aguardando liberação' : 'aguardando liberação'}</>,
        },
        upcomingEvents.length > 0 && podeVer({ id: 'calendario' }) && {
            id: 'calendario', num: upcomingEvents.length, cor: 'var(--color-info)', icon: <FaCalendarAlt size={15} />,
            texto: <><strong>{upcomingEvents.length === 1 ? 'data ambiental' : 'datas ambientais'}</strong> nos próximos 15 dias</>,
        },
    ].filter(Boolean);

    const nome = primeiroNome(currentUser?.name);
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    const renderCard = (item, index) => (
        <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="menu-card"
            style={{ '--card-color': item.color, animationDelay: `${Math.min(index, 8) * 0.03}s` }}
        >
            <span className="menu-card__icon">{cloneElement(item.icon, { size: 19 })}</span>
            <span className="menu-card__body">
                <span className="menu-card__title">{item.label}</span>
                <span className="menu-card__desc">{item.description}</span>
            </span>
            {item.id === 'calendario' && upcomingEvents.length > 0 && (
                <span className="menu-card__tag" title="Datas ambientais nos próximos 15 dias">{upcomingEvents.length}</span>
            )}
            <FaChevronRight size={12} className="menu-card__chevron" />
        </button>
    );

    return (
        <div className="main-menu-bg" style={{ height: '100vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.4s ease-out' }}>
            {/* CABEÇALHO */}
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                padding: '0.8rem clamp(1rem, 3vw, 2rem)', borderBottom: '1px solid var(--border-color-soft)', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,var(--color-primary),var(--color-success))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <FaLeaf size={18} color="var(--color-on-accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-strong)', whiteSpace: 'nowrap' }}>SGA</div>
                        <div className="hide-mobile" style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Gestão Ambiental</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* DATAS AMBIENTAIS */}
                    <div ref={sinoRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="ghost-btn ghost-btn--icon"
                            style={{ position: 'relative', color: upcomingEvents.length > 0 ? 'var(--color-warning)' : undefined }}
                            title="Datas ambientais próximas"
                            aria-label="Datas ambientais próximas"
                        >
                            <FaBell size={14} className={upcomingEvents.length > 0 ? 'bell-glow' : ''} />
                            {upcomingEvents.length > 0 && (
                                <span style={{
                                    position: 'absolute', top: -5, right: -5, background: 'var(--color-danger)', color: 'var(--color-on-accent)',
                                    borderRadius: 10, minWidth: 18, height: 18, padding: '0 4px', fontSize: '0.68rem', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {upcomingEvents.length}
                                </span>
                            )}
                        </button>
                        {showNotifications && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(330px, calc(100vw - 2rem))', maxHeight: 420,
                                overflowY: 'auto', zIndex: 1000, padding: '0.9rem', border: '1px solid var(--border-color)',
                                boxShadow: 'var(--shadow-lg)', borderRadius: 14, display: 'flex',
                                flexDirection: 'column', gap: '0.6rem', background: 'var(--bg-surface)', animation: 'fadeIn 0.15s ease-out',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', borderBottom: '1px solid var(--border-color-soft)', paddingBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-strong)' }}>Datas ambientais</span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>próximos 15 dias</span>
                                </div>
                                {upcomingEvents.length === 0 ? (
                                    <div style={{ padding: '1.2rem 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                                        Nenhuma data nos próximos 15 dias.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {upcomingEvents.map((evt, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => { setShowNotifications(false); onNavigate('calendario'); }}
                                                className="attention-item"
                                                style={{ padding: '0.55rem 0.7rem', background: 'var(--bg-surface-2)' }}
                                            >
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-strong)', fontVariantNumeric: 'tabular-nums', minWidth: 42 }}>
                                                    {String(evt.dia).padStart(2, '0')}/{String(evt.mes).padStart(2, '0')}
                                                </span>
                                                <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', lineHeight: 1.3, color: 'var(--color-text-main)' }}>{evt.titulo}</span>
                                                <span style={{ fontSize: '0.72rem', color: evt.diasRestantes <= 1 ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {evt.diasRestantes === 0 ? 'hoje' : evt.diasRestantes === 1 ? 'amanhã' : `em ${evt.diasRestantes} dias`}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => { setShowNotifications(false); onNavigate('calendario'); }}
                                    className="ghost-btn"
                                    style={{ width: '100%', color: 'var(--color-primary)' }}
                                >
                                    Abrir calendário
                                </button>
                            </div>
                        )}
                    </div>
                    <ThemePicker />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', paddingLeft: '0.35rem' }} title={currentUser?.email}>
                        <span className="avatar-initial">{nome ? nome.charAt(0) : '?'}</span>
                        <div className="hide-mobile" style={{ lineHeight: 1.25 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-main)' }}>{nome}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ROLE_LABELS[currentUser?.role] || currentUser?.role}</div>
                        </div>
                    </div>
                    <button onClick={onLogout} className="ghost-btn" title="Sair do sistema">
                        <FaSignOutAlt size={13} /><span className="hide-mobile">Sair</span>
                    </button>
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.6rem clamp(1rem, 3vw, 2rem) 2rem' }}>
                <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
                    {/* BOAS-VINDAS + BUSCA */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: 'clamp(1.35rem, 3vw, 1.7rem)', fontWeight: 700, color: 'var(--color-text-strong)', lineHeight: 1.2 }}>
                                {saudacao()}{nome ? `, ${nome}` : ''}
                            </h1>
                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                                Hoje é {hoje}. O que você vai fazer agora?
                            </p>
                        </div>
                        <label className="menu-search">
                            <FaSearch size={13} />
                            <input
                                ref={buscaRef}
                                className="input-dark"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && resultados.length === 1) onNavigate(resultados[0].id);
                                    if (e.key === 'Escape') setBusca('');
                                }}
                                placeholder="Procurar módulo…"
                                aria-label="Procurar módulo"
                            />
                            {!busca && <kbd className="hide-mobile" title="Tecle / para procurar">/</kbd>}
                        </label>
                    </div>

                    {/* PARA HOJE */}
                    {!termo && (
                        <section>
                            <div className="menu-section-title">Para hoje</div>
                            {pendencias.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1rem', borderRadius: 12, border: '1px dashed var(--border-color)', color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
                                    <FaCheckCircle size={14} style={{ color: 'var(--color-text-subtle)' }} />
                                    Nada pendente por aqui. Escolha um módulo abaixo para começar.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                                    {pendencias.map((p) => (
                                        <button key={p.id} className="attention-item" onClick={() => onNavigate(p.id)}>
                                            <span style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: p.cor, background: `color-mix(in srgb, ${p.cor} 14%, transparent)` }}>
                                                {p.icon}
                                            </span>
                                            <span className="attention-item__num" style={{ color: p.cor }}>{p.num}</span>
                                            <span className="attention-item__txt" style={{ flex: 1 }}>{p.texto}</span>
                                            <FaChevronRight size={11} style={{ color: 'var(--color-text-faint)', flexShrink: 0 }} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* MÓDULOS */}
                    {secoes.map((cat) => (
                        <section key={cat.id}>
                            <div className="menu-section-title">
                                <i style={{ background: cat.color }} />
                                {cat.label}
                            </div>
                            <div className="menu-grid">
                                {cat.items.map((item, idx) => renderCard(item, idx))}
                            </div>
                        </section>
                    ))}

                    {termo && resultados.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                            Nenhum módulo encontrado para “{busca.trim()}”.
                            <div style={{ marginTop: '0.8rem' }}>
                                <button className="ghost-btn" onClick={() => setBusca('')}>Limpar busca</button>
                            </div>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--color-text-subtle)' }}>
                            <FaRecycle size={11} style={{ verticalAlign: '-1px', marginRight: 6 }} />
                            Sistema de Gestão Ambiental
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MainMenu;
