// ════════════════════════════════════════════════════════════════
//  ErrorBoundary — um módulo que quebra ao renderizar não derruba
//  o app inteiro. Sem isso o React desmonta a raiz e sobra só o
//  fundo escuro (a "tela preta"). Aqui a falha aparece com a
//  mensagem real e um caminho de volta ao menu.
// ════════════════════════════════════════════════════════════════
import { Component } from 'react';
import { FaArrowLeft, FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import { Btn, Card } from './ui';

export default class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[SGA] módulo quebrou ao renderizar:', error, info?.componentStack);
    }

    componentDidUpdate(prev) {
        // Trocar de módulo limpa o erro anterior
        if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                <Card style={{ maxWidth: 560, width: '100%', borderLeft: '3px solid var(--color-danger)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.9rem' }}>
                        <FaExclamationTriangle size={16} /> Este módulo não conseguiu abrir
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', lineHeight: 1.6 }}>
                        Os dados continuam salvos. Volte ao menu ou tente de novo; se repetir, envie a mensagem abaixo.
                    </div>
                    <pre style={{
                        marginTop: '0.9rem', padding: '0.7rem 0.8rem', borderRadius: 8, background: 'var(--bg-app)',
                        border: '1px solid var(--border-color)', color: 'var(--color-text-main)', fontSize: '0.7rem',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflow: 'auto',
                    }}>{String(error?.message || error)}</pre>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                        <Btn variant="outline" color="var(--color-text-muted)" onClick={() => this.setState({ error: null })}><FaRedo size={10} /> Tentar de novo</Btn>
                        <Btn onClick={this.props.onBack}><FaArrowLeft size={10} /> Voltar ao menu</Btn>
                    </div>
                </Card>
            </div>
        );
    }
}
