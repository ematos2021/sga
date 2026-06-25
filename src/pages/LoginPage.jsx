import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FaLeaf, FaUser, FaLock, FaArrowRight } from 'react-icons/fa';

function LoginPage({ onLoginSuccess }) {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [carregando, setCarregando] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setCarregando(true);
        const res = await login(username, password);
        setCarregando(false);
        if (res.ok) onLoginSuccess();
        else setError(res.error);
    };

    return (
        <div className="main-menu-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: 400, padding: '2.5rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 18, margin: '0 auto 1rem',
                        background: 'linear-gradient(135deg, #00ff9d, #10b981)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,255,157,0.3)',
                    }}>
                        <FaLeaf size={30} color="#0f1014" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)' }}>SGA</h1>
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-subtle)', letterSpacing: '0.5px' }}>
                        Sistema de Gestão Ambiental
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label-muted">E-mail</label>
                        <div style={{ position: 'relative' }}>
                            <FaUser size={13} style={iconInside} />
                            <input className="input-dark" style={{ paddingLeft: '2.5rem' }} value={username}
                                onChange={(e) => setUsername(e.target.value)} placeholder="voce@empresa.com" autoFocus />
                        </div>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="label-muted">Senha</label>
                        <div style={{ position: 'relative' }}>
                            <FaLock size={13} style={iconInside} />
                            <input className="input-dark" style={{ paddingLeft: '2.5rem' }} type="password" value={password}
                                onChange={(e) => setPassword(e.target.value)} placeholder="••••" />
                        </div>
                    </div>

                    {error && (
                        <div style={{ marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: '0.8rem' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={carregando} className="btn-touch btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem', opacity: carregando ? 0.7 : 1 }}>
                        {carregando ? 'Entrando…' : <>Entrar <FaArrowRight size={14} /></>}
                    </button>
                </form>


            </div>
        </div>
    );
}

const iconInside = {
    position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--color-text-subtle)', pointerEvents: 'none',
};

export default LoginPage;
