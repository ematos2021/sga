// ════════════════════════════════════════════════════════════════
//  FR 231 Rev 11 — Autorização Saída de Resíduos (Grupo MK)
//  Réplica fiel do formulário físico (A4 paisagem). Preenche
//  automaticamente os campos a partir dos dados do manifesto.
// ════════════════════════════════════════════════════════════════
import { FaPrint, FaTimes } from 'react-icons/fa';

const GRAY = '#c0c0c0';
const FONT = 'Arial, Helvetica, sans-serif';

const base = { fontFamily: FONT, color: '#000', fontSize: '8pt', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };
const band = { ...base, background: GRAY, fontWeight: 'bold', padding: '3px 8px' };
const cellPad = { ...base, padding: '3px 8px' };

// Caixa retangular vazia (quantidade)
const boxStyle = { border: '1.2px solid #000', height: '20px', background: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };

// Linha de preenchimento: rótulo em negrito + linha para escrever (com valor opcional)
function Campo({ label, value, flex = 1 }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flex }}>
            <strong style={{ whiteSpace: 'nowrap', ...base }}>{label}</strong>
            <span style={{ flex: 1, borderBottom: '1px solid #000', minHeight: '1.15em', fontWeight: 'bold', ...base, lineHeight: 1.2 }}>{value || ''}</span>
        </div>
    );
}

export default function FR231Print({ data, onClose }) {
    const d = data || {};
    const [yy, mm, dd] = (d.data || '').split('-');
    const ehColaborador = (d.tipoRecebedor || 'Fornecedor') === 'Colaborador';
    const handlePrint = () => window.print();

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1rem',
            }}
        >
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 8mm; }
                    html, body { margin: 0 !important; }
                    body * { visibility: hidden !important; }
                    .fr231-page, .fr231-page * {
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .fr231-page { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
                    .fr231-toolbar { display: none !important; }
                }
            `}</style>

            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: 8, maxWidth: 1180, width: '100%', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}
            >
                {/* Toolbar (não imprime) */}
                <div className="fr231-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.2rem', borderBottom: '1px solid #ddd', background: '#f8f8f8' }}>
                    <span style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>FR 231 Rev 11 — Autorização Saída de Resíduos</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <FaPrint size={13} /> Imprimir
                        </button>
                        <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem 0.7rem', borderRadius: 8, background: '#e5e5e5', color: '#333', border: 'none', cursor: 'pointer' }}>
                            <FaTimes size={14} />
                        </button>
                    </div>
                </div>

                {/* Formulário imprimível */}
                <div className="fr231-page" style={{ padding: '10px', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', ...base }}>
                        <tbody>
                            {/* ═══ CABEÇALHO ═══ */}
                            <tr>
                                <td style={{ width: '26%', border: '1px solid #000', textAlign: 'center', padding: '4px' }}>
                                    <span style={{ ...base, fontSize: '17pt' }}>Grupo <strong>MK</strong></span>
                                </td>
                                <td style={{ border: '1px solid #000', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '12.5pt' }}>
                                    AUTORIZAÇÃO SAÍDA DE RESÍDUOS
                                </td>
                                <td style={{ width: '18%', border: '1px solid #000', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '8.5pt' }}>
                                    FR 231 Rev: 11<br />Dezembro 2025
                                </td>
                            </tr>

                            {/* ═══ DATA / HORÁRIO / MOTORISTA (faixas cinza) ═══ */}
                            <tr>
                                <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid #000' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...band, width: '26%', borderRight: '1px solid #000', verticalAlign: 'bottom', height: '30px' }}>
                                                    Data: {dd || '_____'} / {mm || '_____'} / {yy || '_______'}
                                                </td>
                                                <td style={{ ...band, width: '26%', borderRight: '1px solid #000', verticalAlign: 'bottom' }}>
                                                    Horário: {d.hora || '________ : ________'}
                                                </td>
                                                <td style={{ ...band, verticalAlign: 'bottom' }}>
                                                    Motorista: {d.motorista || ''}{d.placa ? ` — ${d.placa}` : ''}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            {/* ═══ MATRIZ DE EMBALAGENS ═══ */}
                            <tr>
                                <td colSpan={3} style={{ padding: '4px 6px 8px', borderBottom: '1px solid #000' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <colgroup>
                                            <col style={{ width: '12%' }} /><col style={{ width: '26%' }} /><col style={{ width: '12%' }} />
                                            <col style={{ width: '12%' }} /><col style={{ width: '22%' }} /><col style={{ width: '16%' }} />
                                        </colgroup>
                                        <tbody>
                                            {/* Cabeçalhos "Quantidade:" */}
                                            <tr>
                                                <td colSpan={3} style={{ ...cellPad, padding: '2px 10px' }}>Quantidade:</td>
                                                <td colSpan={2} style={{ ...cellPad, padding: '2px 10px' }}>Quantidade:</td>
                                                <td />
                                            </tr>
                                            {/* Linha 1 */}
                                            <tr>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td colSpan={2} style={{ ...cellPad, padding: '3px 6px' }}>Pallet de caixa de papelão motor (20P)</td>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ ...cellPad, padding: '3px 6px' }}>Saco Plástico</td>
                                                <td style={{ ...band, textAlign: 'center', border: '1px solid #000' }}>Nº de controle</td>
                                            </tr>
                                            {/* Linha 2 */}
                                            <tr>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td colSpan={2} style={{ ...cellPad, padding: '3px 6px' }}>Pallet de caixa de papelão grande</td>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ ...cellPad, padding: '3px 6px' }}>Caixa de papelão</td>
                                                <td style={{ border: '1px solid #000', background: '#fff', height: '22px' }} />
                                            </tr>
                                            {/* Linha 3 — Caixa Polionda + NF Nº / Papelão Solto / Nº do lacre */}
                                            <tr>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ ...cellPad, padding: '3px 6px' }}>Caixa Polionda</td>
                                                <td style={{ padding: '3px 6px' }}>
                                                    <div style={{ ...boxStyle, display: 'flex', alignItems: 'flex-start', padding: '2px 4px' }}><span style={{ ...base, fontSize: '9.5pt' }}>NF Nº</span></div>
                                                </td>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ ...cellPad, padding: '3px 6px' }}>Papelão Solto</td>
                                                <td style={{ ...band, textAlign: 'center', border: '1px solid #000' }}>Nº do lacre</td>
                                            </tr>
                                            {/* Linha 4 — Cesto Aramado + NF Nº / Pallet de divisória / lacre box */}
                                            <tr>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ ...cellPad, padding: '3px 6px' }}>Cesto Aramado</td>
                                                <td style={{ padding: '3px 6px' }}>
                                                    <div style={{ ...boxStyle, display: 'flex', alignItems: 'flex-start', padding: '2px 4px' }}><span style={{ ...base, fontSize: '9.5pt' }}>NF Nº</span></div>
                                                </td>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ ...cellPad, padding: '3px 6px' }}>Pallet de divisória</td>
                                                <td style={{ border: '1px solid #000', background: '#fff', height: '22px' }} />
                                            </tr>
                                            {/* Linha 5 */}
                                            <tr>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td colSpan={2} style={{ ...cellPad, padding: '3px 6px' }}>Pallet</td>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ padding: '3px 6px', verticalAlign: 'bottom' }}><span style={{ display: 'inline-block', width: '100%', borderBottom: '1px solid #000', minHeight: '1.1em' }} /></td>
                                                <td />
                                            </tr>
                                            {/* Linha 6 */}
                                            <tr>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td colSpan={2} style={{ ...cellPad, padding: '3px 6px' }}>Caixa Plástica de Fornecedor - (HORTIFRUT)</td>
                                                <td style={{ padding: '3px 6px' }}><div style={boxStyle} /></td>
                                                <td style={{ padding: '3px 6px', verticalAlign: 'bottom' }}><span style={{ display: 'inline-block', width: '100%', borderBottom: '1px solid #000', minHeight: '1.1em' }} /></td>
                                                <td />
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            {/* ═══ DOAÇÃO ═══ */}
                            <tr><td colSpan={3} style={{ ...band, borderBottom: '1px solid #000' }}>Doação para Colaborador/Fornecedor:</td></tr>
                            <tr><td colSpan={3} style={{ ...cellPad, borderBottom: '1px solid #000', paddingTop: '7px', paddingBottom: '5px' }}>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    <Campo label="Nome:" flex={2} value={d.destinador} />
                                    {ehColaborador && <Campo label="Matrícula:" flex={1} />}
                                </div>
                            </td></tr>

                            {/* ═══ CONFERÊNCIA PORTARIA ═══ */}
                            <tr><td colSpan={3} style={{ ...band, borderBottom: '1px solid #000' }}>Conferência Portaria</td></tr>
                            <tr><td colSpan={3} style={{ ...cellPad, borderBottom: '1px solid #000', paddingTop: '12px', paddingBottom: '5px' }}>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    <Campo label="Agente de Portaria:" flex={3} />
                                    <Campo label="Quantidade:" flex={1} />
                                </div>
                            </td></tr>

                            {/* ═══ CONFERÊNCIA MOTORISTA ═══ */}
                            <tr><td colSpan={3} style={{ ...band, borderBottom: '1px solid #000' }}>Conferência motorista:</td></tr>
                            <tr><td colSpan={3} style={{ ...cellPad, borderBottom: '1px solid #000', paddingTop: '12px', paddingBottom: '5px' }}>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    <Campo label="Motorista:" flex={3} />
                                    <Campo label="Quantidade:" flex={1} />
                                </div>
                            </td></tr>

                            {/* ═══ MATERIAL / Nº DO MANIFESTO (faixas cinza) ═══ */}
                            <tr><td colSpan={3} style={{ ...band, borderBottom: '1px solid #000', height: '24px', verticalAlign: 'middle' }}>Material do Manifesto: <span style={{ fontWeight: 'bold' }}>{d.residuo || ''}</span></td></tr>
                            <tr><td colSpan={3} style={{ ...band, borderBottom: '1px solid #000', height: '24px', verticalAlign: 'middle' }}>Nº do Manifesto: <span style={{ fontWeight: 'bold' }}>{d.numeroMTR || ''}{d.manifestoSupertrans ? ` / ST: ${d.manifestoSupertrans}` : ''}</span></td></tr>

                            {/* ═══ ASSINATURAS ═══ */}
                            <tr>
                                <td colSpan={3} style={{ padding: 0, borderBottom: '1px solid #000' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '50%', height: '82px', verticalAlign: 'bottom', textAlign: 'center', padding: '0 40px 8px' }}>
                                                    <div style={{ ...base, borderTop: '1px solid #000', paddingTop: '4px', fontWeight: 'bold' }}>Autorização SGI</div>
                                                </td>
                                                <td style={{ width: '50%', height: '82px', verticalAlign: 'bottom', textAlign: 'center', padding: '0 40px 8px' }}>
                                                    <div style={{ ...base, borderTop: '1px solid #000', paddingTop: '4px', fontWeight: 'bold' }}>Assinatura Empilhador</div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            {/* ═══ RESP. CONFERÊNCIA ADM ═══ */}
                            <tr><td colSpan={3} style={{ ...band, borderBottom: '1px solid #000' }}>Resp. pela conferência ADM Fornecedor:</td></tr>
                            <tr><td colSpan={3} style={{ ...cellPad, paddingTop: '7px', paddingBottom: '5px' }}>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    <Campo label="Material:" flex={3} />
                                    <Campo label="Quantidade:" flex={1} />
                                </div>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
