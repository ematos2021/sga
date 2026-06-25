import { useState, useEffect, useRef } from 'react';
import { FaPalette, FaCheck } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export const THEMES = [
    { id: 'onyx', label: 'Onyx', swatch: '#0f1014', accent: '#18191f' },
    { id: 'midnight', label: 'Midnight', swatch: '#0a0e1a', accent: '#141a2e' },
    { id: 'aurora', label: 'Aurora', swatch: '#100a1f', accent: '#1c1233' },
    { id: 'mist', label: 'Mist (claro)', swatch: '#eaeeec', accent: '#f4f7f5' },
];

const THEME_CLASSES = THEMES.map((t) => `theme-${t.id}`);

export function applyThemeClass(themeId) {
    document.body.classList.remove(...THEME_CLASSES);
    document.body.classList.add(`theme-${themeId}`);
}

export function getStoredTheme(user) {
    const id = user?.theme || localStorage.getItem('sga_theme') || 'onyx';
    return THEMES.find((t) => t.id === id) ? id : 'onyx';
}

function ThemePicker() {
    const { currentUser, updateUser } = useAuth();
    const [open, setOpen] = useState(false);
    const popoverRef = useRef(null);
    const current = getStoredTheme(currentUser);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const handlePick = (themeId) => {
        localStorage.setItem('sga_theme', themeId);
        applyThemeClass(themeId);
        if (currentUser?.username) updateUser(currentUser.username, { theme: themeId });
        setOpen(false);
    };

    return (
        <div ref={popoverRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen((o) => !o)}
                title="Alterar tema"
                style={{
                    background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: '#aaa',
                    width: '40px', height: '40px', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'all 0.2s', backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00ff9d'; e.currentTarget.style.color = '#00ff9d'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#aaa'; }}
            >
                <FaPalette size={14} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: '50px', right: 0, zIndex: 200,
                    background: 'rgba(15, 16, 20, 0.95)', border: '1px solid #333', borderRadius: '12px',
                    padding: '0.8rem', minWidth: '200px', backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 0.15s ease-out',
                }}>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', padding: '0 0.3rem' }}>
                        Tema
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {THEMES.map((t) => {
                            const isActive = current === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handlePick(t.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.6rem',
                                        background: isActive ? 'rgba(0,255,157,0.08)' : 'transparent',
                                        border: `1px solid ${isActive ? 'rgba(0,255,157,0.3)' : 'transparent'}`,
                                        borderRadius: '8px', color: isActive ? '#00ff9d' : 'var(--color-text-main)',
                                        cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left', transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        background: `linear-gradient(135deg, ${t.swatch} 50%, ${t.accent} 50%)`,
                                        border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
                                    }} />
                                    <span style={{ flex: 1 }}>{t.label}</span>
                                    {isActive && <FaCheck size={11} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ThemePicker;
