// ════════════════════════════════════════════════════════════════
//  FR 861 Rev.00 — Solicitação de Dedetização (Grupo MK)
//  Réplica fiel do formulário físico (A4 retrato), preenchida
//  automaticamente a partir da solicitação registrada no SGA.
// ════════════════════════════════════════════════════════════════
import { FaPrint, FaTimes } from 'react-icons/fa';

const BLUE = '#8eb4e3';
const FONT = 'Arial, Helvetica, sans-serif';
const base = { fontFamily: FONT, color: '#000', fontSize: '9pt', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };
const band = { ...base, background: BLUE, fontWeight: 'bold', textAlign: 'center', padding: '3px 8px', fontSize: '10.5pt', border: '1px solid #000' };
const cell = { ...base, border: '1px solid #000', padding: '3px 8px', verticalAlign: 'top' };
const lbl = { fontWeight: 'bold' };

// Caixinha de marcação (☐ / ☒)
function Check({ on, label }) {
    return (
        <span style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 18 }}>
            <span style={{ width: 12, height: 12, border: '1.4px solid #000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9pt', lineHeight: 1, fontWeight: 'bold' }}>
                {on ? '✕' : ''}
            </span>
            {label}
        </span>
    );
}

const brData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

export default function FR861Print({ data, onClose }) {
    const d = data || {};
    const sit = (v) => (d.situacao || '').toLowerCase() === v.toLowerCase();
    const outros = d.situacao && !['Realizado', 'Não realizado', 'Pendente'].includes(d.situacao);

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '1rem' }}>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    html, body { margin: 0 !important; }
                    body * { visibility: hidden !important; }
                    .fr861-page, .fr861-page * {
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .fr861-page { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
                    .fr861-toolbar { display: none !important; }
                }
            `}</style>

            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, maxWidth: 1000, width: '100%', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}>
                {/* Toolbar (não imprime) */}
                <div className="fr861-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.2rem', borderBottom: '1px solid #ddd', background: '#f8f8f8' }}>
                    <span style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem' }}>FR 861 Rev.00 — Solicitação de Dedetização</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                            <FaPrint size={13} /> Imprimir
                        </button>
                        <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem 0.7rem', borderRadius: 8, background: '#e5e5e5', color: '#333', border: 'none', cursor: 'pointer' }}>
                            <FaTimes size={14} />
                        </button>
                    </div>
                </div>

                {/* Formulário */}
                <div className="fr861-page" style={{ padding: 12, background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', ...base }}>
                        <tbody>
                            {/* Cabeçalho */}
                            <tr>
                                <td style={{ ...cell, width: '26%', textAlign: 'center' }}>
                                    <span style={{ ...base, fontSize: '19pt' }}>Grupo <strong>MK</strong></span>
                                </td>
                                <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', fontSize: '14pt' }}>
                                    SOLICITAÇÃO DE DEDETIZAÇÃO
                                </td>
                                <td style={{ ...cell, width: '15%', textAlign: 'center', fontWeight: 'bold', fontSize: '9.5pt' }}>
                                    FR 861<br />(Rev.00<br />Março 2025)
                                </td>
                            </tr>

                            {/* Identificação */}
                            <tr>
                                <td colSpan={3} style={{ padding: 0, border: '1px solid #000' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody><tr>
                                            <td style={{ ...cell, width: '50%', border: 'none', borderRight: '1px solid #000' }}><span style={lbl}>NOME DO SOLICITANTE: </span>{d.solicitante || ''}</td>
                                            <td style={{ ...cell, width: '26%', border: 'none', borderRight: '1px solid #000' }}><span style={lbl}>ÁREA SOLICITANTE: </span>{d.area_solicitante || ''}</td>
                                            <td style={{ ...cell, border: 'none' }}><span style={lbl}>EMPRESA: </span>{d.empresa || ''}</td>
                                        </tr></tbody>
                                    </table>
                                </td>
                            </tr>

                            {/* SOLICITAÇÃO */}
                            <tr><td colSpan={3} style={band}>SOLICITAÇÃO</td></tr>
                            <tr><td colSpan={3} style={cell}><span style={lbl}>MOTIVO: </span>{d.motivo || ''}{d.tipo_praga ? ` — ${d.tipo_praga}` : ''}</td></tr>
                            <tr><td colSpan={3} style={cell}><span style={lbl}>ENDEREÇO: </span>{d.endereco || ''}</td></tr>
                            <tr><td colSpan={3} style={cell}><span style={lbl}>LOCALIZAÇÃO EXATA DO SERVIÇO: </span>{d.localizacao || ''}</td></tr>
                            <tr><td colSpan={3} style={{ ...cell, height: 58 }}><span style={lbl}>DESCRIÇÃO: </span>{d.descricao || ''}</td></tr>
                            <tr>
                                <td colSpan={3} style={{ padding: 0, border: '1px solid #000' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody><tr>
                                            <td style={{ ...cell, width: '44%', border: 'none', borderRight: '1px solid #000' }}><span style={lbl}>DATA DO AGENDAMENTO: </span>{brData(d.data_agendamento)}</td>
                                            <td style={{ ...cell, border: 'none' }}><span style={lbl}>PRIORIDADE: </span>{d.prioridade || ''}</td>
                                        </tr></tbody>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3} style={cell}>
                                    <span style={{ ...lbl, marginRight: 24 }}>SITUAÇÃO:</span>
                                    <Check on={sit('Realizado')} label="Realizado" />
                                    <Check on={sit('Não realizado')} label="Não realizado" />
                                    <Check on={sit('Pendente') || sit('Em análise') || sit('Agendado')} label="Pendente" />
                                    <Check on={outros} label={`Outros${outros ? ` (${d.situacao})` : ''}`} />
                                </td>
                            </tr>
                            <tr><td colSpan={3} style={{ ...cell, height: 44 }}><span style={lbl}>JUSTIFICATIVA: </span>{d.justificativa || ''}</td></tr>

                            {/* ANÁLISE DA SOLICITAÇÃO */}
                            <tr><td colSpan={3} style={band}>ANÁLISE DA SOLICITAÇÃO</td></tr>
                            <tr>
                                <td colSpan={3} style={{ padding: 0, border: '1px solid #000' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...cell, width: '44%', border: 'none', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>
                                                    <span style={lbl}>NECESSIDADE DE ISOLAMENTO? </span>
                                                    <Check on={d.necessidade_isolamento === true} label="Sim" />
                                                    <Check on={d.necessidade_isolamento === false} label="Não" />
                                                </td>
                                                <td style={{ ...cell, border: 'none', borderBottom: '1px solid #000' }}><span style={lbl}>TEMPO ESTIMADO DE ISOLAMENTO: </span>{d.tempo_isolamento || ''}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ ...cell, border: 'none', borderRight: '1px solid #000' }}>
                                                    <span style={lbl}>ESTÁ NO ESCOPO DE CONTRATO? </span>
                                                    <Check on={d.escopo_contrato === true} label="Sim" />
                                                    <Check on={d.escopo_contrato === false} label="Não" />
                                                </td>
                                                <td style={{ ...cell, border: 'none' }}><span style={lbl}>TAMANHO DA ÁREA PARA APLICAÇÃO: </span>{d.tamanho_area || ''}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                            <tr><td colSpan={3} style={{ ...cell, height: 58 }}><span style={lbl}>PARECER DA EMPRESA RESPONSÁVEL PELA APLICAÇÃO: </span>{d.parecer_empresa || ''}</td></tr>

                            {/* CIÊNCIA */}
                            <tr><td colSpan={3} style={band}>CIÊNCIA DO SISTEMA DE GESTÃO:</td></tr>
                            <tr><td colSpan={3} style={{ ...cell, height: 64 }}>{d.ciencia_gestao || ''}{d.analisado_por ? `  —  ${d.analisado_por}${d.analisado_em ? ` em ${brData(d.analisado_em)}` : ''}` : ''}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
