// ════════════════════════════════════════════════════════════════
//  UI kit compartilhado — replica a linguagem visual do PRIME
// ════════════════════════════════════════════════════════════════
import { Children, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaArrowLeft, FaTimes, FaChevronDown, FaCheck, FaSearch } from 'react-icons/fa';

// ─── Casca de página com cabeçalho ───
export function PageShell({ icon, color = '#00ff9d', title, subtitle, onBack, actions, maxWidth = 1200, children }) {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1.1rem 1.5rem 1rem', borderBottom: '1px solid var(--border-color-soft)',
                flexShrink: 0, gap: '1rem', flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    {onBack && (
                        <button onClick={onBack} title="Voltar" style={iconBtn}>
                            <FaArrowLeft size={14} />
                        </button>
                    )}
                    <div style={{
                        width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: `${color}18`, color, flexShrink: 0,
                    }}>
                        {icon}
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{title}</h1>
                        {subtitle && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>{subtitle}</div>}
                    </div>
                </div>
                {actions && <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                <div style={{ maxWidth: maxWidth === '100%' ? '100%' : `${maxWidth}px`, margin: '0 auto', width: '100%' }}>{children}</div>
            </div>
        </div>
    );
}

const iconBtn = {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--color-text-muted)',
    width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
};

// ─── Botão de ação ───
export function Btn({ children, color = '#00ff9d', variant = 'solid', onClick, type = 'button', style }) {
    const solid = variant === 'solid';
    return (
        <button
            type={type}
            onClick={onClick}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem',
                borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.18s', whiteSpace: 'nowrap',
                background: solid ? color : 'transparent',
                color: solid ? '#0f1014' : color,
                border: `1px solid ${solid ? color : color + '55'}`,
                ...style,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; if (!solid) e.currentTarget.style.background = color + '15'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; if (!solid) e.currentTarget.style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}

// ─── Card / painel ───
export function Card({ children, style }) {
    return (
        <div className="glass-panel" style={{ padding: '1.2rem 1.3rem', ...style }}>{children}</div>
    );
}

// ─── Campo de formulário ───
export function Field({ label, children, required, span }) {
    return (
        <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
            <label className="label-muted" style={{ fontSize: '0.65rem' }}>
                {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
            </label>
            {children}
        </div>
    );
}

export function Input(props) {
    return <input className="input-dark" {...props} />;
}
// ─── Select customizado (dropdown lúdico, via portal p/ não cortar em tabelas) ───
// API compatível com <select>: value, onChange({target:{value}}), <option> filhos.
function parseOptions(children) {
    const out = [];
    Children.forEach(children, (child) => {
        if (!child || child.type !== 'option') return;
        const v = child.props.value ?? '';
        const label = child.props.children;
        const labelText = Array.isArray(label) ? label.map((x) => String(x)).join('') : String(label ?? '');
        out.push({ value: v, label, labelText });
    });
    return out;
}

export function Select({ children, value, onChange, style, disabled, placeholder, searchable }) {
    const opts = parseOptions(children);
    const phOpt = opts.find((o) => o.value === '' || o.value === 'todos');
    const realOpts = opts.filter((o) => o !== phOpt);
    const ph = placeholder ?? phOpt?.labelText ?? 'Selecione…';
    const selected = opts.find((o) => String(o.value) === String(value));
    const isPlaceholder = !selected || selected === phOpt;

    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [rect, setRect] = useState(null);
    const ref = useRef(null);
    const canSearch = searchable ?? realOpts.length > 8;

    const abrir = () => {
        if (disabled) return;
        const r = ref.current?.getBoundingClientRect();
        if (r) setRect({ left: r.left, top: r.bottom + 4, width: r.width });
        setQ('');
        setOpen(true);
    };
    useEffect(() => {
        if (!open) return;
        const reposicionar = () => {
            const r = ref.current?.getBoundingClientRect();
            if (r) setRect({ left: r.left, top: r.bottom + 4, width: r.width });
        };
        window.addEventListener('scroll', reposicionar, true);
        window.addEventListener('resize', reposicionar);
        return () => { window.removeEventListener('scroll', reposicionar, true); window.removeEventListener('resize', reposicionar); };
    }, [open]);

    const escolher = (v) => { onChange?.({ target: { value: v } }); setOpen(false); };
    const filtrados = q ? realOpts.filter((o) => o.labelText.toLowerCase().includes(q.toLowerCase())) : realOpts;

    return (
        <>
            <button
                ref={ref} type="button" onClick={abrir} disabled={disabled} className="input-dark"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%', borderColor: open ? 'var(--color-primary)' : undefined, opacity: disabled ? 0.6 : 1, ...style }}
            >
                <span style={{ color: isPlaceholder ? 'var(--color-text-subtle)' : 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isPlaceholder ? ph : selected.label}
                </span>
                <FaChevronDown size={10} style={{ color: 'var(--color-text-subtle)', flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>

            {open && rect && createPortal(
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                    <div style={{ position: 'fixed', left: rect.left, top: rect.top, width: Math.max(rect.width, 170), maxWidth: '90vw', zIndex: 9999, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 18px 44px rgba(0,0,0,0.45)', overflow: 'hidden', animation: 'fadeIn 0.12s ease-out' }}>
                        {canSearch && (
                            <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color-soft)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <FaSearch size={11} style={{ color: 'var(--color-text-subtle)' }} />
                                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text-main)', fontSize: '0.76rem' }} />
                            </div>
                        )}
                        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '0.25rem' }}>
                            {phOpt && !q && (
                                <Opcao o={phOpt} ativo={isPlaceholder} muted onClick={() => escolher(phOpt.value)} />
                            )}
                            {filtrados.map((o, i) => (
                                <Opcao key={i} o={o} ativo={String(o.value) === String(value)} onClick={() => escolher(o.value)} />
                            ))}
                            {filtrados.length === 0 && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.76rem' }}>Nada encontrado.</div>
                            )}
                        </div>
                    </div>
                </>, document.body)}
        </>
    );
}

function Opcao({ o, ativo, muted, onClick }) {
    return (
        <div
            onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.45rem 0.6rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', color: muted ? 'var(--color-text-subtle)' : 'var(--color-text-main)', background: ativo ? 'var(--color-primary-soft)' : 'transparent', transition: 'background 0.1s' }}
            onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
            onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = 'transparent'; }}
        >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
            {ativo && !muted && <FaCheck size={10} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
        </div>
    );
}
export function Textarea(props) {
    return <textarea className="input-dark" {...props} />;
}

export function FormGrid({ children, cols = 2 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.9rem 1rem' }}>
            {children}
        </div>
    );
}

// ─── Badge de status colorido ───
export function StatusBadge({ status, map }) {
    const color = (map && map[status]) || '#8b9bb4';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '3px 10px',
            borderRadius: 6, fontSize: '0.65rem', fontWeight: 600, background: color + '1f', color,
            whiteSpace: 'nowrap',
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {status}
        </span>
    );
}

// ─── Tabela de dados ───
export function DataTable({ columns, rows, empty = 'Nenhum registro.', dense = false, onRowClick }) {
    if (!rows || rows.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
                {empty}
            </div>
        );
    }
    return (
        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-color)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: dense ? '0.7rem' : '0.76rem' }}>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} style={{
                                textAlign: c.align || 'left', padding: dense ? '0.45rem 0.6rem' : '0.55rem 0.8rem', color: 'var(--color-text-subtle)',
                                fontSize: dense ? '0.56rem' : '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px',
                                whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)',
                            }}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr 
                            key={row.id || i} 
                            onClick={(e) => {
                                if (e.target.closest('button, select, input, a, svg')) return;
                                onRowClick?.(row);
                            }}
                            style={{ 
                                borderBottom: '1px solid var(--border-color-soft)',
                                cursor: onRowClick ? 'pointer' : 'default'
                            }}
                        >
                            {columns.map((c) => (
                                <td key={c.key} style={{
                                    textAlign: c.align || 'left', padding: dense ? '0.4rem 0.6rem' : '0.55rem 0.8rem',
                                    color: 'var(--color-text-main)', whiteSpace: c.wrap ? 'normal' : 'nowrap',
                                }}>
                                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Modal ───
export function Modal({ title, onClose, children, width = 560 }) {
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(5px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="animate-slide-up"
                style={{
                    background: 'var(--bg-surface)', borderRadius: 18, border: '1px solid var(--border-color)',
                    width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--border-color-soft)',
                    position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1,
                }}>
                    <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{title}</h2>
                    <button onClick={onClose} style={{ ...iconBtn, width: 32, height: 32 }}><FaTimes size={13} /></button>
                </div>
                <div style={{ padding: '1.4rem' }}>{children}</div>
            </div>
        </div>
    );
}

// ─── Mini KPI ───
export function Kpi({ icon, label, value, sub, color = '#00ff9d', onClick, active }) {
    return (
        <div 
            className="glass-panel" 
            onClick={onClick}
            style={{
                padding: '0.55rem 0.65rem', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.2rem',
                cursor: onClick ? 'pointer' : 'default',
                border: active ? `1px solid ${color}aa` : '1px solid var(--border-color-soft)',
                background: active ? `${color}11` : 'var(--bg-card)',
                transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { if (onClick && !active) e.currentTarget.style.borderColor = color + '55'; }}
            onMouseLeave={(e) => { if (onClick && !active) e.currentTarget.style.borderColor = 'var(--border-color-soft)'; }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: color + '1f', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <span style={{ fontSize: '0.55rem', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1, marginTop: '0.05rem' }}>{value}</div>
            {sub && <div style={{ fontSize: '0.54rem', color: 'var(--color-text-subtle)' }}>{sub}</div>}
        </div>
    );
}

// ─── Botão de ícone em linha de tabela ───
export function RowAction({ icon, onClick, color = 'var(--color-text-muted)', title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: 'transparent', border: 'none', color, cursor: 'pointer', padding: '0.3rem',
                borderRadius: 6, display: 'inline-flex', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
            {icon}
        </button>
    );
}
