// ════════════════════════════════════════════════════════════════
//  FichaPicker — seletor lúdico de fichas do Cadastro de Resíduos.
//  Dropdown customizado (não-nativo) com busca, ícone por tipo de
//  resíduo e selo colorido por tratamento. Ao escolher, dispara
//  onSelect(ficha) para auto-preencher o manifesto.
// ════════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { FaSearch, FaChevronDown, FaArrowRight } from 'react-icons/fa';

// Emoji por tipo de resíduo (aproximado, só para leitura rápida)
const iconeResiduo = (wt = '', cat = '') => {
    const t = `${wt} ${cat}`.toUpperCase();
    if (/ISOPOR|PLÁSTIC|PLASTIC/.test(t)) return '🧴';
    if (/PAPEL|PAPELÃO|PAPELAO|TUBETE/.test(t)) return '📦';
    if (/METAL|SUCATA|AÇO|ACO/.test(t)) return '🔩';
    if (/VIDRO/.test(t)) return '🫙';
    if (/MADEIRA|LENHA|PALLET/.test(t)) return '🪵';
    if (/ÓLEO|OLEO|LUBRIF/.test(t)) return '🛢️';
    if (/BORRACHA|PNEU/.test(t)) return '🛞';
    if (/LÂMPADA|LAMPADA/.test(t)) return '💡';
    if (/PILHA|BATERIA/.test(t)) return '🔋';
    if (/ELETRÔNIC|ELETRONIC|INFORMÁTIC|INFORMATIC/.test(t)) return '💻';
    if (/AMBULATORIAL|INFECT|RSS/.test(t)) return '⚕️';
    if (/EFLUENTE|SANITÁRIO|SANITARIO/.test(t)) return '💧';
    if (/ENTULHO/.test(t)) return '🧱';
    if (/CONTAMINAD|RESÍDUO CONTAMIN/.test(t)) return '☣️';
    return '♻️';
};

// Cor do selo conforme o tratamento/destinação
const corTratamento = (tr = '') => {
    const t = tr.toUpperCase();
    if (/RECICLA|REREFINO|REUTILIZ/.test(t)) return '#10b981';
    if (/ATERRO CLASSE I\b|ATERRO CLASSE 1/.test(t)) return '#ff6b6b';
    if (/ATERRO/.test(t)) return '#ffb700';
    if (/INCINER/.test(t)) return '#ff6b6b';
    if (/AUTOCLAVE|DESCONTAMINA/.test(t)) return '#a78bfa';
    if (/EFLUENTE|TRATAMENTO/.test(t)) return '#00ccff';
    return '#8b9bb4';
};

export default function FichaPicker({ fichas = [], onSelect, color = '#54a0ff' }) {
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState('');

    const lista = useMemo(() => {
        const ordenadas = [...fichas].sort((a, b) =>
            `${a.waste_type} ${a.category}`.localeCompare(`${b.waste_type} ${b.category}`));
        if (!busca.trim()) return ordenadas;
        const q = busca.toLowerCase();
        return ordenadas.filter((f) =>
            `${f.waste_type} ${f.category} ${f.destinator_name} ${f.treatment}`.toLowerCase().includes(q));
    }, [fichas, busca]);

    const escolher = (f) => { onSelect?.(f); setOpen(false); setBusca(''); };

    return (
        <div style={{ position: 'relative' }}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="input-dark"
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    borderColor: open ? color : undefined,
                }}
            >
                <span style={{ color: 'var(--color-text-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem' }}>📋</span>
                    Selecione uma ficha para auto-preencher (resíduo, destinador, destinação)…
                </span>
                <FaChevronDown size={11} style={{ color: 'var(--color-text-subtle)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>

            {open && (
                <>
                    {/* clique-fora */}
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />

                    <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                        background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 12,
                        boxShadow: '0 18px 44px rgba(0,0,0,0.45)', overflow: 'hidden',
                        animation: 'fadeIn 0.12s ease-out',
                    }}>
                        {/* Busca */}
                        <div style={{ padding: '0.6rem', borderBottom: '1px solid var(--border-color-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FaSearch size={12} style={{ color: 'var(--color-text-subtle)' }} />
                            <input
                                autoFocus
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar resíduo, destinador, tratamento…"
                                style={{
                                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                    color: 'var(--color-text-main)', fontSize: '0.78rem',
                                }}
                            />
                            <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)' }}>{lista.length}</span>
                        </div>

                        {/* Lista */}
                        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0.3rem' }}>
                            {lista.length === 0 && (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-subtle)', fontSize: '0.8rem' }}>
                                    Nenhuma ficha encontrada.
                                </div>
                            )}
                            {lista.map((f) => {
                                const cor = corTratamento(f.treatment);
                                return (
                                    <div
                                        key={f.id}
                                        onClick={() => escolher(f)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.6rem',
                                            borderRadius: 9, cursor: 'pointer', transition: 'background 0.12s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-2)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span style={{
                                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: cor + '1f', fontSize: '1rem',
                                        }}>{iconeResiduo(f.waste_type, f.category)}</span>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {f.waste_type}{f.category ? <span style={{ color: 'var(--color-text-subtle)', fontWeight: 400 }}> · {f.category}</span> : null}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <FaArrowRight size={8} style={{ color: cor, flexShrink: 0 }} />
                                                {f.destinator_name || 'sem destinador'}
                                            </div>
                                        </div>

                                        {f.treatment && (
                                            <span style={{
                                                flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px',
                                                color: cor, background: cor + '1a', border: `1px solid ${cor}40`,
                                                padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
                                            }}>{f.treatment}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
