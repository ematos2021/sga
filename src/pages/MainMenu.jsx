import { cloneElement, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ThemePicker from '../components/ThemePicker';
import { useCollection, COL } from '../lib/store';
import { obterEventosProximos } from '../lib/constants';
import {
    FaLeaf, FaSignOutAlt, FaChartPie, FaFileSignature, FaFileExcel, FaTruckMoving,
    FaTicketAlt, FaSmog, FaFileInvoiceDollar, FaUsers, FaDatabase, FaRecycle,
    FaCalendarAlt, FaBell, FaGlobeAmericas, FaUsersCog, FaBalanceScale
} from 'react-icons/fa';


const MENU = [
    { id: 'dashboard', label: 'Dashboard Ambiental', icon: <FaChartPie size={22} />, color: '#00ccff', description: 'Indicadores ISO 14001 e conformidade' },
    { id: 'calendario', label: 'Calendário Ambiental', icon: <FaCalendarAlt size={22} />, color: '#10b981', description: 'Datas ecológicas e cronograma', cat: 'visao' },

    // Operação de resíduos
    { id: 'autorizacoes', label: 'Autorização de Saída', icon: <FaFileSignature size={22} />, color: '#00ff9d', description: 'Preenchimento diário (seg–sáb)', cat: 'residuos' },
    { id: 'manifestos', label: 'Manifesto MTR / SINIR', icon: <FaTruckMoving size={22} />, color: '#54a0ff', description: 'Emissão e controle de MTR', cat: 'residuos' },
    { id: 'tickets', label: 'Tickets de Coleta', icon: <FaTicketAlt size={22} />, color: '#ff9f43', description: 'Tickets vinculados aos manifestos', cat: 'residuos' },
    { id: 'controle-residuos', label: 'Controle de Saída', icon: <FaFileExcel size={22} />, color: '#10b981', description: 'Histórico consolidado · exporta Excel', cat: 'residuos' },

    // Monitoramento
    { id: 'esg-carbono', label: 'ESG & Carbono', icon: <FaGlobeAmericas size={22} />, color: '#10b981', description: 'Inventário de GEE e trajetória Net Zero', cat: 'monitoramento' },
    { id: 'fumaca', label: 'Fumaça Preta', icon: <FaSmog size={22} />, color: '#a78bfa', description: 'Medição Ringelmann dos geradores', cat: 'monitoramento' },
    { id: 'lira', label: 'LIRA · Requisitos Legais', icon: <FaBalanceScale size={22} />, color: '#00ccff', description: 'Análise de conformidade legal · meta diária', cat: 'monitoramento' },

    // Comercial & logística
    { id: 'nf-sucata', label: 'NF Sucata Plástica', icon: <FaFileInvoiceDollar size={22} />, color: '#ffb700', description: 'Emissão e controle · VIAMED', cat: 'comercial' },
    { id: 'motoristas', label: 'Motoristas & Logística', icon: <FaUsers size={22} />, color: '#06b6d4', description: 'Contatos e comunicação de coletas', cat: 'comercial' },

    // Cadastros
    { id: 'cadastros', label: 'Cadastros', icon: <FaDatabase size={22} />, color: '#9d4edd', description: 'Resíduos e geradores', cat: 'cadastros' },
    { id: 'ficha-residuos', label: 'Cadastro de Resíduos', icon: <FaRecycle size={22} />, color: '#c77dff', description: 'Ficha mestre · destinadores e transportadores', cat: 'cadastros' },

    // Administração (somente admin)
    { id: 'usuarios', label: 'Gerenciar Usuários', icon: <FaUsersCog size={22} />, color: '#a78bfa', description: 'Cadastro e permissões de acesso', cat: 'admin', admin: true },
];

const CATEGORIES = [
    { id: 'visao', label: 'Visão Geral', color: '#00ccff', ids: ['dashboard', 'calendario'] },
    { id: 'residuos', label: 'Operação de Resíduos', color: '#00ff9d', ids: ['autorizacoes', 'manifestos', 'tickets', 'controle-residuos'] },
    { id: 'monitoramento', label: 'Monitoramento & Conformidade', color: '#10b981', ids: ['esg-carbono', 'fumaca', 'lira'] },
    { id: 'comercial', label: 'Comercial & Logística', color: '#ffb700', ids: ['nf-sucata', 'motoristas'] },
    { id: 'cadastros', label: 'Cadastros', color: '#9d4edd', ids: ['cadastros', 'ficha-residuos'] },
    { id: 'admin', label: 'Administração', color: '#a78bfa', ids: ['usuarios'] },
];

function MainMenu({ onNavigate, onLogout }) {
    const { currentUser, ROLE_LABELS } = useAuth();
    const { items: events } = useCollection(COL.CALENDARIO);
    const [showNotifications, setShowNotifications] = useState(false);

    const upcomingEvents = obterEventosProximos(events, new Date(), 15);

    const renderCard = (item, index) => (
        <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
                padding: '1rem 0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '0.4rem', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14,
                transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)', background: 'rgba(20,23,33,0.55)',
                backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                position: 'relative', overflow: 'hidden', width: '100%', minHeight: 108,
                animation: `slideUp 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 0.04}s both`,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.015)';
                e.currentTarget.style.background = 'rgba(28,32,45,0.75)';
                e.currentTarget.style.boxShadow = `0 16px 32px rgba(0,0,0,0.3), 0 0 1px ${item.color}40`;
                e.currentTarget.style.borderColor = `${item.color}35`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.background = 'rgba(20,23,33,0.55)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
        >
            <div style={{
                position: 'absolute', top: '-20%', left: '-20%', width: '140%', height: '140%',
                background: `radial-gradient(circle at 30% 30%, ${item.color}08 0%, transparent 60%)`, pointerEvents: 'none',
            }} />
            {item.id === 'calendario' && upcomingEvents.length > 0 && (
                <div 
                    style={{
                        position: 'absolute', top: 8, right: 8, background: 'linear-gradient(135deg, #ff4757, #ff6b81)', color: '#fff',
                        padding: '2px 8px', borderRadius: 20, fontSize: '0.55rem', fontWeight: 800,
                        boxShadow: '0 0 8px rgba(255,71,87,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase',
                        zIndex: 2
                    }}
                    className="animate-pulse"
                >
                    {upcomingEvents.length} Alerta{upcomingEvents.length > 1 ? 's' : ''}
                </div>
            )}
            <div style={{ color: item.color, position: 'relative', zIndex: 1, height: 26, display: 'flex', alignItems: 'center' }}>
                {cloneElement(item.icon)}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', textAlign: 'center', lineHeight: 1.2, zIndex: 1 }}>
                {item.label}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)', textAlign: 'center', zIndex: 1, lineHeight: 1.3, maxWidth: 180 }}>
                {item.description}
            </span>
        </button>
    );

    return (
        <div className="main-menu-bg" style={{ minHeight: '100vh', padding: '1.25rem', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease-out' }}>
            {/* HEADER */}
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem',
                padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#00ff9d,#10b981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FaLeaf size={20} color="#0f1014" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            SGA · Gestão Ambiental
                        </h2>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)' }}>
                            {currentUser?.avatar} {currentUser?.name} — {ROLE_LABELS[currentUser?.role] || currentUser?.role}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {/* NOTIFICAÇÕES BELL */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                padding: '0.45rem', background: 'rgba(20,23,33,0.55)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 8, color: upcomingEvents.length > 0 ? '#ffb700' : 'var(--color-text-muted)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                                width: 34, height: 34, position: 'relative', outline: 'none'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                            title="Datas Ambientais Próximas"
                        >
                            <FaBell size={14} className={upcomingEvents.length > 0 ? "bell-glow" : ""} />
                            {upcomingEvents.length > 0 && (
                                <span style={{
                                    position: 'absolute', top: -3, right: -3, background: '#ff4757', color: '#fff',
                                    borderRadius: '50%', width: 15, height: 15, fontSize: '0.55rem', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 0 6px #ff4757'
                                }}>
                                    {upcomingEvents.length}
                                </span>
                            )}
                        </button>
                        {showNotifications && (
                            <div 
                                className="glass-panel"
                                style={{
                                    position: 'absolute', top: '125%', right: 0, width: 310, maxHeight: 380,
                                    overflowY: 'auto', zIndex: 1000, padding: '0.9rem', border: '1px solid var(--border-color)',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderRadius: 12, display: 'flex',
                                    flexDirection: 'column', gap: '0.6rem', background: 'var(--bg-surface)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.4rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                        Eventos Ambientais Próximos
                                    </span>
                                    <span style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>
                                        Próximos 15 dias
                                    </span>
                                </div>
                                {upcomingEvents.length === 0 ? (
                                    <div style={{ padding: '1.2rem 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                                        Nenhum evento ambiental próximo.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        {upcomingEvents.map((evt, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => { setShowNotifications(false); onNavigate('calendario'); }}
                                                style={{ 
                                                    padding: '0.5rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column',
                                                    gap: '2px', cursor: 'pointer', transition: 'all 0.15s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981' }}>
                                                        {evt.dia}/{String(evt.mes).padStart(2, '0')}
                                                    </span>
                                                    <span style={{ fontSize: '0.56rem', color: '#ffb700', fontWeight: 700 }}>
                                                        {evt.diasRestantes === 0 ? 'Hoje!' : evt.diasRestantes === 1 ? 'Amanhã!' : `Em ${evt.diasRestantes} dias`}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
                                                    {evt.titulo}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button 
                                    onClick={() => { setShowNotifications(false); onNavigate('calendario'); }}
                                    style={{ 
                                        padding: '0.45rem', background: 'rgba(16,185,129,0.1)', border: 'none',
                                        borderRadius: 6, color: '#10b981', fontSize: '0.68rem', cursor: 'pointer',
                                        fontWeight: 'bold', marginTop: '0.2rem', textAlign: 'center', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.18)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                                >
                                    Abrir Calendário Completo
                                </button>
                            </div>
                        )}
                    </div>
                    <ThemePicker />
                    <button
                        onClick={onLogout}
                        style={{
                            padding: '0.45rem 0.9rem', background: 'transparent', border: '1px solid rgba(255,71,87,0.2)',
                            borderRadius: 8, color: '#ff4757', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,71,87,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        <FaSignOutAlt size={12} /> SAIR
                    </button>
                </div>
            </header>

            {/* CATEGORIES */}
            <div style={{ flex: 1, overflowY: 'auto', maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {CATEGORIES.map((cat) => {
                    const items = cat.ids
                        .map((id) => MENU.find((m) => m.id === id))
                        .filter(Boolean)
                        .filter((m) => !m.admin || currentUser?.is_admin)
                        .filter((m) => {
                            // Admin tem acesso total
                            if (currentUser?.allowed_pages === 'all') return true;
                            // Usuário normal: verifica se tem permissão
                            return (currentUser?.allowed_pages || []).includes(m.id);
                        });
                    if (items.length === 0) return null;
                    return (
                        <div key={cat.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, boxShadow: `0 0 8px ${cat.color}66` }} />
                                <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>
                                    {cat.label}
                                </span>
                                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem' }}>
                                {items.map((item, idx) => renderCard(item, idx))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-faint)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    <FaRecycle size={10} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                    Sistema de Gestão Ambiental
                </span>
            </div>
        </div>
    );
}

export default MainMenu;
