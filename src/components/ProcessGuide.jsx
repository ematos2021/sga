// ════════════════════════════════════════════════════════════════
//  ProcessGuide — Guia visual passo-a-passo de processo
//  Renderiza fluxogramas como steppers interativos colapsáveis
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { FaClipboardList, FaChevronDown, FaChevronUp, FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

/**
 * @param {string}   title   — Título do guia (ex.: "Fluxo de Solicitação de Manifesto")
 * @param {string}   color   — Cor primária do guia
 * @param {Array}    steps   — Etapas do processo
 *   step.type = 'action' | 'decision' | 'end'
 *   step.title, step.description, step.icon (emoji/string)
 *   step.branches = [{ label, description, steps? }]   (para decision)
 *   step.notes = [string]                               (notas contextuais)
 * @param {Array}    notes   — Notas gerais do processo (NOTA 1, NOTA 2, etc.)
 */
export default function ProcessGuide({ title, color = '#00ff9d', steps = [], notes = [], defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="process-guide" style={{ '--pg-color': color }}>
            <button
                className="process-guide__toggle"
                onClick={() => setOpen(!open)}
                type="button"
            >
                <div className="process-guide__toggle-left">
                    <FaClipboardList size={15} style={{ color }} />
                    <span className="process-guide__toggle-title">{title}</span>
                    <span className="process-guide__toggle-hint">
                        {open ? 'clique para ocultar' : 'clique para ver o passo-a-passo'}
                    </span>
                </div>
                <div className="process-guide__toggle-icon" style={{ color }}>
                    {open ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
                </div>
            </button>

            {open && (
                <div className="process-guide__body">
                    <div className="process-steps">
                        {steps.map((step, i) => (
                            <StepItem key={i} step={step} index={i} total={steps.length} color={color} />
                        ))}
                    </div>

                    {notes.length > 0 && (
                        <div className="process-notes">
                            <div className="process-notes__header">
                                <FaExclamationTriangle size={13} color="#ffb700" />
                                <span>Atenções e Exceções</span>
                            </div>
                            {notes.map((note, i) => (
                                <div key={i} className="process-notes__item">
                                    <span className="process-notes__badge">NOTA {i + 1}</span>
                                    <span>{note}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StepItem({ step, index, total, color }) {
    const isEnd = step.type === 'end';
    const isDecision = step.type === 'decision';
    const isLast = index === total - 1;
    const [activeBranch, setActiveBranch] = useState(0);

    return (
        <div className={`process-step ${isEnd ? 'process-step--end' : ''} ${isDecision ? 'process-step--decision' : ''}`}>
            {/* Conector vertical */}
            {!isLast && <div className="process-step__connector" style={{ background: `linear-gradient(180deg, ${color}40, ${color}10)` }} />}

            {/* Indicador */}
            <div className="process-step__indicator" style={isEnd ? { background: '#10b981', borderColor: '#10b981' } : isDecision ? { background: `${color}25`, borderColor: color, transform: 'rotate(45deg)' } : { borderColor: `${color}60` }}>
                {isEnd ? (
                    <FaCheckCircle size={14} color="#fff" />
                ) : isDecision ? (
                    <span style={{ transform: 'rotate(-45deg)', fontSize: '0.65rem', fontWeight: 800, color }}>?</span>
                ) : (
                    <span className="process-step__number" style={{ color }}>{index + 1}</span>
                )}
            </div>

            {/* Conteúdo */}
            <div className="process-step__content">
                <div className="process-step__title">
                    {step.icon && <span className="process-step__icon">{step.icon}</span>}
                    {step.title}
                </div>
                {step.description && (
                    <div className="process-step__desc">{step.description}</div>
                )}

                {/* Ramificações de decisão - Otimizado com Seleção de Abas/Fluxo */}
                {isDecision && step.branches && (
                    <div style={{ marginTop: '0.75rem' }}>
                        {/* Seletor Segmentado */}
                        <div className="process-branches-tabs">
                            {step.branches.map((branch, bi) => {
                                const isActive = activeBranch === bi;
                                const branchColor = branch.color || color;
                                return (
                                    <button
                                        key={bi}
                                        type="button"
                                        onClick={() => setActiveBranch(bi)}
                                        className={`process-branch-tab-btn ${isActive ? 'is-active' : ''}`}
                                        style={{
                                            background: isActive ? branchColor : 'transparent',
                                            boxShadow: isActive ? `0 2px 6px ${branchColor}35` : 'none',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.55rem' }}>{isActive ? '●' : '○'}</span>
                                        {branch.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Conteúdo do Fluxo Selecionado */}
                        {step.branches.map((branch, bi) => {
                            if (activeBranch !== bi) return null;
                            const branchColor = branch.color || color;
                            return (
                                <div
                                    key={bi}
                                    className="process-branch"
                                    style={{
                                        '--branch-color': branchColor,
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-color-soft)',
                                        borderLeft: `3.5px solid ${branchColor}`,
                                        borderRadius: '8px',
                                        padding: '0.75rem 0.95rem',
                                        animation: 'fadeIn 0.25s ease-out'
                                    }}
                                >
                                    <div className="process-branch__desc" style={{ fontSize: '0.74rem', marginBottom: '0.45rem', color: 'var(--color-text-main)', lineHeight: '1.4' }}>
                                        {branch.description}
                                    </div>
                                    {branch.steps && branch.steps.map((bs, bsi) => (
                                        <div key={bsi} className="process-branch__substep" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', padding: '0.2rem 0', fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                                            <span className="process-branch__dot" style={{ background: branchColor, width: '5px', height: '5px', minWidth: '5px', borderRadius: '50%', marginTop: '5px' }} />
                                            <span>{bs}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Notas contextuais inline */}
                {step.notes && step.notes.length > 0 && (
                    <div className="process-step__notes">
                        {step.notes.map((n, ni) => (
                            <div key={ni} className="process-step__note">
                                <FaInfoCircle size={11} color="#54a0ff" style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{n}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
