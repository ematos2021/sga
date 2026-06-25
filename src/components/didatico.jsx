// ════════════════════════════════════════════════════════════════
//  Componentes didáticos — explicam termos técnicos e mostram a
//  "memória de cálculo" (fórmula → substituição → resultado).
//  Objetivo: tornar o SGA compreensível sem perder o rigor técnico.
// ════════════════════════════════════════════════════════════════
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaInfoCircle, FaCalculator, FaBookOpen, FaTimes, FaChevronDown } from 'react-icons/fa';
import { GLOSSARIO } from '../lib/constants';

// ─── InfoTip: ícone ⓘ que abre um popover com definição ───
export function InfoTip({ title, children, color = '#00ccff', size = 12 }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const ref = useRef(null);

    const toggle = (e) => {
        e.stopPropagation();
        if (!open && ref.current) {
            const r = ref.current.getBoundingClientRect();
            const w = 300;
            setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
        }
        setOpen((o) => !o);
    };

    return (
        <>
            <button
                ref={ref} onClick={toggle} title="Entenda este item"
                style={{
                    background: 'transparent', border: 'none', color, cursor: 'pointer', padding: 2,
                    display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', lineHeight: 0,
                }}
            >
                <FaInfoCircle size={size} />
            </button>
            {open && createPortal(
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4000 }} />
                    <div style={{
                        position: 'fixed', top: pos.top, left: pos.left, zIndex: 4001, width: 300,
                        background: 'var(--bg-surface)', border: `1px solid ${color}44`, borderRadius: 12,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', padding: '0.9rem 1rem',
                        fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.55,
                        animation: 'fadeIn 0.15s ease-out',
                    }}>
                        {title && <div style={{ fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} /> {title}
                        </div>}
                        {children}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

// ─── MemoriaCalculo: bloco com fórmula, substituição e resultado ───
// passos: array de { label, valor } (a substituição). resultado: string.
export function MemoriaCalculo({ titulo, formula, passos = [], resultado, color = '#10b981', compact = false }) {
    return (
        <div style={{
            border: `1px solid ${color}33`, borderRadius: 12, background: `${color}0c`,
            padding: compact ? '0.7rem 0.9rem' : '0.9rem 1.1rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                <FaCalculator size={11} /> {titulo || 'Memória de cálculo'}
            </div>
            {formula && (
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8rem', color: 'var(--color-text-main)', background: 'var(--bg-surface-2)', padding: '0.4rem 0.6rem', borderRadius: 8, marginBottom: passos.length ? 8 : 0 }}>
                    {formula}
                </div>
            )}
            {passos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: resultado ? 8 : 0 }}>
                    {passos.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                            <span style={{ color: 'var(--color-text-subtle)' }}>{p.label}</span>
                            <span style={{ color: 'var(--color-text-main)', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{p.valor}</span>
                        </div>
                    ))}
                </div>
            )}
            {resultado && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px dashed ${color}55`, paddingTop: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', fontWeight: 700 }}>Resultado</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color }}>{resultado}</span>
                </div>
            )}
        </div>
    );
}

// ─── ExplicaBox: banner colapsável "Como ler esta tela" ───
export function ExplicaBox({ titulo = 'Como interpretar esta tela', children, color = '#54a0ff', defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="glass-panel" style={{ borderLeft: `3px solid ${color}`, padding: 0, marginBottom: '1.2rem', overflow: 'hidden' }}>
            <button onClick={() => setOpen((o) => !o)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1rem',
                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-main)',
            }}>
                <FaBookOpen size={14} color={color} />
                <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>{titulo}</span>
                <FaChevronDown size={12} color="var(--color-text-subtle)" style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {open && (
                <div style={{ padding: '0 1rem 1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Termo: palavra sublinhada que abre a definição do glossário ───
export function Termo({ children, def, title, color = '#00ccff' }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ borderBottom: `1px dotted ${color}`, cursor: 'help' }}>{children}</span>
            <InfoTip title={title || children} color={color} size={11}>{def}</InfoTip>
        </span>
    );
}

// ─── GlossarioModal: dicionário pesquisável de termos ───
export function GlossarioModal({ onClose }) {
    const [q, setQ] = useState('');
    const termos = GLOSSARIO.filter((t) =>
        !q || t.termo.toLowerCase().includes(q.toLowerCase()) || (t.tag || '').toLowerCase().includes(q.toLowerCase()) || t.def.toLowerCase().includes(q.toLowerCase())
    );
    return createPortal(
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem' }}>
            <div onClick={(e) => e.stopPropagation()} className="animate-slide-up" style={{ background: 'var(--bg-surface)', borderRadius: 18, border: '1px solid var(--border-color)', width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-color-soft)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaBookOpen size={16} color="#00ccff" /> Glossário do SGA
                    </h2>
                    <button onClick={onClose} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--color-text-muted)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={13} /></button>
                </div>
                <div style={{ padding: '0.9rem 1.4rem' }}>
                    <input className="input-dark" placeholder="Buscar termo, sigla ou conceito…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </div>
                <div style={{ overflowY: 'auto', padding: '0 1.4rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {termos.length === 0 && <div style={{ textAlign: 'center', color: 'var(--color-text-subtle)', padding: '2rem', fontSize: '0.85rem' }}>Nenhum termo encontrado.</div>}
                    {termos.map((t) => (
                        <div key={t.termo} style={{ borderBottom: '1px solid var(--border-color-soft)', paddingBottom: '0.7rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{t.termo}</span>
                                {t.tag && <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#00ccff', background: '#00ccff18', padding: '1px 7px', borderRadius: 5 }}>{t.tag}</span>}
                            </div>
                            <div style={{ fontSize: '0.79rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>{t.def}</div>
                            {t.formula && <div style={{ marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', color: '#10b981', background: '#10b9810c', padding: '0.3rem 0.5rem', borderRadius: 6, display: 'inline-block' }}>{t.formula}</div>}
                            {t.ref && <div style={{ marginTop: 3, fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>Referência: {t.ref}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
